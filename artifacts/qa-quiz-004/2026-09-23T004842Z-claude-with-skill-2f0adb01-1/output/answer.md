# Mobile WalletConnect deep links: why "Stake" does nothing, and why `rainbow://` first made it worse

## 1. Why nothing auto-opened before the patch

Nothing was broken in the transport. The giveaway is in the bug report itself: *"if they manually switch to Rainbow, the signing request is waiting for them inside."* The request reached the wallet. Only the **app switch** failed.

WalletConnect v2 splits those two jobs, and they travel by completely different routes:

**The request** goes over the relay. When `writeContractAsync` runs on a WalletConnect connector, wagmi hands an `eth_sendTransaction` (or `eth_signTypedData_v4`, etc.) payload to the WalletConnect `UniversalProvider`, which publishes it as an encrypted `wc_sessionRequest` to `relay.walletconnect.com` over the session's WebSocket. Rainbow — subscribed to that same topic, plus a push notification — receives it and enqueues the signing sheet. This part is pure background networking. It works whether or not Rainbow is in the foreground, and it is why the prompt is sitting there waiting.

**Foregrounding the wallet** is a separate, purely client-side act. The only thing on a phone that can move the user from Safari/Chrome to Rainbow is a *navigation* from the web page to a URL the OS routes to Rainbow — `rainbow://` (custom scheme) or `https://rnbwapp.com/...` (universal link). There is no server-side "wake up the wallet" primitive. The relay cannot do it. The push notification can only put a banner on the lock screen.

So: who is supposed to perform that navigation?

- **RainbowKit does it for `connect`.** The pairing flow emits a `display_uri` event, and RainbowKit's mobile connect sheet turns that URI into a deep link and navigates. This is the code path everyone assumes is "the deep-link handling" — and it only covers the first handshake.
- **WalletConnect's SDK does it for requests *conditionally*.** `@walletconnect/sign-client` will try to redirect to `session.peer.metadata.redirect.native` after publishing a request, but only when the wallet actually populated `redirect` in its session metadata and only when `window.location` assignment is still permitted at that moment. Coverage is genuinely inconsistent across wallets and SDK versions.
- **wagmi does nothing here.** `writeContractAsync` is a transport-agnostic RPC call. It has no concept of "and also bring another app to the foreground."

And then the part that kills it even when the SDK does try: **mobile browsers only honour a scheme navigation inside the call stack of a user gesture.** iOS Safari and Android Chrome both drop `window.location.href = "rainbow://"` (silently, no error) if too much asynchronous work has elapsed since the tap. `writeContractAsync` is *full* of asynchronous work before it ever publishes anything:

```
tap → (optional simulate/publicClient.simulateContract)
    → eth_estimateGas        ← RPC round trip to Base
    → eth_getTransactionCount ← RPC round trip
    → eth_gasPrice / eth_feeHistory
    → ...only now is the payload published to the relay
```

Several hundred milliseconds of network, sometimes more on a flaky LTE connection. By the time anything would like to deep-link, the gesture has expired and the browser refuses. The transaction request sails off to Rainbow, the page sits there, and the user has no idea anything happened.

**Diagnosis: the request delivery works; the app-switch navigation is either never attempted or attempted after the user-gesture window has closed.**

---

## 2. Why the patch made it worse

```ts
// the teammate's patch
const handleStake = async () => {
  window.location.href = "rainbow://";   // ← line 1
  await writeContractAsync({ ... });     // ← never gets to publish
};
```

This fixes the symptom the user complained about (Rainbow now opens) by destroying the thing that was actually working (the request reaching Rainbow). The ordering is exactly backwards.

`window.location.href = "rainbow://"` on line 1 is *inside* the gesture, so the browser honours it immediately. The OS foregrounds Rainbow and **backgrounds the browser tab** — and a backgrounded mobile tab is not a paused-but-healthy tab:

- **Timers and JS execution are throttled or frozen.** iOS suspends the WebView aggressively; a tab that loses foreground can stop executing JS within a frame or two.
- **The relay WebSocket gets torn down.** iOS reclaims sockets from suspended apps/tabs. Android Chrome does the same under memory pressure.
- **In-flight `fetch`/RPC calls to Base stall or abort.**

Now look at where `writeContractAsync` was when the lights went out: it had *just* been invoked. It hasn't estimated gas. It hasn't fetched the nonce. It has published **nothing** to the relay. The entire prep phase is exactly the work that requires a live network stack, and the navigation on the previous line just guaranteed it wouldn't get one.

Rainbow opens to its home screen with an empty request queue. There is nothing to sign because nothing was ever sent.

What happens next is worse than a clean failure:

- The user, seeing nothing, switches back to the browser. The tab resumes and the pending `writeContractAsync` *may* now complete and publish — firing a signing request at a wallet the user just left. A "ghost prompt."
- Or the WebSocket died and the provider must re-handshake; the request is rejected or expires (`wc_sessionRequest` carries a TTL, typically ~5 min, and stale requests are dropped).
- If the user taps Stake repeatedly out of frustration, several requests can resume at once → duplicate transactions.
- The promise may never settle at all, so any `isPending` spinner state in the component hangs forever.

The patch converted a **visible, recoverable** failure (prompt waiting in Rainbow, user switches manually, transaction lands) into an **invisible, unrecoverable** one (nothing anywhere, funds never move, non-deterministic ghost prompts). That is a regression even though the surface complaint went away.

**The rule: never navigate away before the request has been published to the relay.** Deep-linking is the *last* step, not the first.

---

## 3. The correct pattern

### 3a. Ordering

Fire the write first, then deep-link — but **do not `await` the write before deep-linking.** This is the subtlety that trips people up:

```ts
await writeContractAsync({ ... });   // resolves only AFTER the user signs
openWallet();                        // far too late — user has been staring at a dead page
```

`writeContractAsync` resolves with a tx hash, which only exists once the user has approved in the wallet. Awaiting it before deep-linking means you open the wallet after the user already signed. Useless.

So the shape is: **start** the write (keep the promise, don't await it yet), **schedule** the deep link, **then** await the promise for the result.

```ts
const p = writeContractAsync({ ... });  // starts the publish pipeline
scheduleDeepLink();                     // fires ~N ms later, after publish
const hash = await p;                   // resolves when the user signs
```

### 3b. The delay, and why its length is what it is

The delay exists to cover exactly one window: **from "handler invoked" to "the `wc_sessionRequest` frame has actually left the device."** You are waiting for:

1. local prep — simulate / `eth_estimateGas` / `eth_getTransactionCount` / fee data against Base, and
2. the encrypted publish over the relay WebSocket (plus, ideally, its ack).

It is squeezed from both sides:

- **Too short** and you reproduce the patch's bug in miniature: you background the tab mid-`estimateGas`, the socket dies, nothing is published.
- **Too long** and the browser refuses the navigation entirely, because it is no longer plausibly attributable to the user's tap. Practically this budget is a few hundred milliseconds on iOS Safari; past roughly half a second you are gambling, and past ~1s the navigation is reliably dropped — leaving the user on a dead page again.

That leaves a fairly narrow band. **~200–300 ms is the working default**, and the reason it works is that it is long enough for a publish on a warm relay socket (typically 50–150 ms) while staying inside the gesture-attribution budget. It is not a magic number; it is the overlap of two constraints.

The right engineering response is to **shrink the work the delay has to cover** rather than to lengthen the delay:

- **Pre-simulate and pre-estimate before the tap.** Run `useSimulateContract` (or a `publicClient.simulateContract`) while the button renders, and pass the prepared request into `writeContract`. Now the only thing between the tap and the publish is the relay round trip, so a short delay is genuinely sufficient — and you also catch reverts before bothering the user.
- **Keep the WalletConnect socket warm.** A cold socket forces a reconnect inside your delay window and blows the budget.

If you want to stop guessing entirely, watch the provider instead of using a timer — subscribe to the WalletConnect provider's request lifecycle and deep-link on confirmation of publish, with the timeout as a fallback. The SDK's event surface for *requests* (as opposed to `display_uri` for pairing) is thin and version-dependent, so in practice most production dApps ship the timer with the pre-simulation optimisation above. Keep the timer as the backstop either way.

### 3c. Choosing the wallet scheme — `connector.id` cannot tell you

`connector.id === "walletConnect"` identifies the **transport**, not the wallet. Rainbow, Trust, Zerion, Uniswap Wallet, imToken, Ledger Live and fifty others all report `"walletConnect"`. Hardcoding `rainbow://` means every non-Rainbow mobile user gets bounced to the App Store or a dead navigation — which is a *new* bug the teammate's patch also introduced, just invisible to the Rainbow users who filed the report.

The authoritative source is the **peer metadata on the live WalletConnect session**, which the wallet itself populated during pairing:

```ts
const provider: any = await connector.getProvider();
const session = provider?.session ?? provider?.signer?.session;

const redirect = session?.peer?.metadata?.redirect;
// redirect.native    → "rainbow://"           (custom scheme)
// redirect.universal → "https://rnbwapp.com"  (universal / app link)
// session.peer.metadata.name / .url → for logging & UI copy only
```

Preference order:

1. **`redirect.universal` first.** Universal links (iOS) / App Links (Android) are routed by the OS to the installed app, and degrade to a web page if it isn't installed. A custom scheme pointed at a missing app fails silently on iOS and can throw an interstitial on Android.
2. **`redirect.native`** as the fallback when no universal link is advertised.
3. **If neither is present, do not deep-link.** The wallet has declined to opt in. Guessing a scheme is how you get dead navigations and App Store bounces. Show an inline "Open your wallet app to confirm" hint instead — which is strictly better than the pre-patch behaviour, because at least the user knows what happened.

Never maintain your own `connector.name → scheme` lookup table. It rots, and it is wrong for every wallet you didn't think of.

### 3d. When the deep link must be skipped entirely

Gate on all of these. Each one is a real bug if you get it wrong:

- **Not a WalletConnect connector.** Injected / in-app browser connectors (`injected`, MetaMask's in-app browser, Coinbase Wallet's in-app browser, Rainbow's own dApp browser) — the wallet **is** the browser. Navigating to a scheme tears the user out of your dApp and can kill the page context mid-transaction. The wallet UI surfaces itself; do nothing.
- **Not mobile.** A WalletConnect session on desktop is a QR pairing to a phone, or a desktop wallet. `window.location = "rainbow://"` on desktop is at best a no-op and at worst a browser protocol-handler prompt. Gate on a mobile UA/pointer check *and* the WalletConnect connector, not on either alone.
- **No `redirect` metadata on the session** (see 3c).
- **Safe / smart-contract wallets and any iframe context.** Safe Apps run inside an iframe; `window.location` there either does nothing or navigates the parent. Detect the Safe connector (or `window !== window.top`) and skip. The same applies to ERC-4337 flows where a bundler/paymaster submits and there is no per-tx user signature.
- **`document.visibilityState !== "visible"` when the timer fires.** The user already switched apps themselves, or the wallet's own SDK-side redirect already won the race. Firing now yanks them somewhere unexpected. Check at fire time, not at schedule time.
- **The write rejected before publishing.** Wrong chain, insufficient balance, a revert caught by simulation, an ABI/arg error — these throw locally, before anything hits the relay. Cancel the pending timer in the failure path, or you send the user to a wallet with nothing to sign: the exact bug you are fixing.
- **Wrong network.** Handle `switchChain` first and let *it* own the app switch; don't stack two deep links. Chaining a chain-switch redirect and a transaction redirect is a reliable way to lose both.
- **The post-signing return trip.** Wallets implementing the v2 redirect spec bounce the user *back* to your dApp automatically after signing. Don't add your own return navigation — you'll fight the wallet and can bounce the user in a loop.

### 3e. Reference implementation

```ts
// hooks/useWalletDeepLink.ts
import { useAccount } from "wagmi";

const isMobile = () =>
  typeof navigator !== "undefined" &&
  /android|iphone|ipad|ipod/i.test(navigator.userAgent);

const isInIframe = () => typeof window !== "undefined" && window.self !== window.top;

export function useWalletDeepLink() {
  const { connector } = useAccount();

  // Resolve the target from the live session, never from a hardcoded table.
  const resolveTarget = async (): Promise<string | null> => {
    if (!connector || connector.id !== "walletConnect") return null; // injected / in-app browser
    if (!isMobile() || isInIframe()) return null;                    // desktop / Safe app

    const provider: any = await connector.getProvider().catch(() => null);
    const session = provider?.session ?? provider?.signer?.session;
    const redirect = session?.peer?.metadata?.redirect;

    // Universal link preferred: degrades gracefully if the app isn't installed.
    return redirect?.universal || redirect?.native || null; // null ⇒ wallet didn't opt in
  };

  /** Schedules the app switch. Returns a cancel fn for the write's failure path. */
  return function scheduleWalletOpen(delayMs = 250) {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const target = await resolveTarget();
      if (!target || cancelled) return;
      // The user may have switched apps on their own, or the WC SDK already redirected.
      if (document.visibilityState !== "visible") return;
      window.location.href = target;
    }, delayMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  };
}
```

```tsx
// components/StakeButton.tsx
const { writeContractAsync, isPending } = useScaffoldWriteContract("Staker");
const scheduleWalletOpen = useWalletDeepLink();

const handleStake = async () => {
  // 1. Start the write FIRST. Do not await yet — it resolves only after signing.
  const pending = writeContractAsync({
    functionName: "stake",
    value: parseEther(amount),
  });

  // 2. Schedule the app switch to land just after the relay publish.
  const cancelDeepLink = scheduleWalletOpen(250);

  try {
    // 3. Now await the signature / submission.
    const hash = await pending;
    return hash;
  } catch (err) {
    // Local failure (revert, wrong chain, user rejection) — nothing was published.
    // Don't send the user to a wallet with an empty queue.
    cancelDeepLink();
    throw err;
  }
};
```

Pair it with a `useSimulateContract` on render so the 250 ms only has to cover the relay publish, and keep an inline "Confirm in your wallet app…" state visible for the wallets where `redirect` is absent and no deep link fires.

---

## Summary

| | Behaviour | Result |
|---|---|---|
| **Before** | Request published to relay; no navigation survives the gesture window | Prompt waits in Rainbow; user must switch manually. Ugly but **correct** — the tx lands. |
| **Patch** | Navigate first, tab suspended, write never publishes | Rainbow opens empty. Tx **never lands**. Ghost prompts on resume. A regression. |
| **Correct** | Start write → ~250 ms → navigate to `session.peer.metadata.redirect` (universal ▸ native), gated on mobile + WC + visible + non-iframe, cancelled on local throw | Wallet opens with the prompt already queued, for **every** WalletConnect wallet, not just Rainbow. |

The single load-bearing idea: **the relay delivers the request, the browser delivers the user — and the browser must go second.**
