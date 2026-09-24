# Mobile WalletConnect deep-linking on Scaffold-ETH 2 / Base

## 1. Why nothing auto-opened before the patch

### What actually happens when you call `writeContractAsync` over WalletConnect v2

There is no direct channel between your dApp tab and the wallet app on the same phone. The chain is:

```
useWriteContract → wagmi → viem walletClient
  → connector.getProvider()            (WalletConnect EthereumProvider)
  → signClient.request({ method: 'eth_sendTransaction', ... })
  → irn_publish over the relay WebSocket (relay.walletconnect.org)
  → relay pushes to Rainbow (socket if foregrounded, APNs/FCM push if not)
  → Rainbow renders the signing sheet
  → user signs → response travels back over the relay
  → the awaited promise finally resolves with a tx hash
```

Everything about that is *invisible*. The request reaching Rainbow does not make iOS switch apps. iOS only foregrounds another app when the current app (Safari/Chrome) performs a navigation to a URL scheme or universal link that the OS resolves to that app. **Nothing in the WalletConnect protocol does that for you.**

### The piece that is *supposed* to do it

RainbowKit / Web3Modal add that behavior in the UI layer. When the user taps a wallet row in the connect modal on mobile, the modal:

1. reads the wallet's deep link (`rainbow://` / `https://rnbwapp.com`),
2. navigates to `<link>?uri=<encoded wc: uri>` to hand over the pairing,
3. **persists the chosen link** in `localStorage` under `WALLETCONNECT_DEEPLINK_CHOICE`, e.g.
   `{"href":"https://rnbwapp.com/","name":"Rainbow"}`.

From then on, the connector's request path is meant to re-open that saved `href` each time a request is published, so the second, third, Nth signature also bounces the user into the wallet.

### Why it didn't fire for your users

In roughly descending order of likelihood:

- **The deeplink choice was never written.** If the user connected by opening Rainbow first and scanning the QR (or pasting the `wc:` URI), the *wallet* initiated the pairing — your page's modal never recorded a choice. The session works perfectly; the auto-open key is simply absent. This is the single most common cause of "it worked for me in testing, it doesn't for real users."
- **The key was written but lost.** Different origin (`www.` vs apex), in-app browser with partitioned storage, iOS Safari 7-day ITP eviction of localStorage, private browsing, or a `wagmi` reconnect from a cookie-backed session on a fresh storage bucket. The session survives; the deeplink hint doesn't.
- **The user-activation window expired.** This is the subtle one, and it matters for the fix. iOS Safari only allows `window.open()` — and treats scheme navigation as "intentional" — while the tab holds *transient user activation*, which is granted by the tap and expires after a few hundred milliseconds, and is consumed/invalidated by intervening awaits. `writeContractAsync` is not a single hop. Before it publishes anything it typically does: chain-id check (possibly a `wallet_switchEthereumChain` round trip first), `eth_estimateGas`, fee estimation, nonce fetch — several RPC calls to Base. By the time the connector gets around to opening the deep link, the activation is long gone and Safari silently swallows the navigation. No error, no wallet, page "just sits there."
- **Version skew.** Older `@walletconnect/ethereum-provider` / RainbowKit combinations only did the redirect on *pairing*, not on subsequent requests.

So: the request genuinely arrived in Rainbow every time — hence "if they manually switch to Rainbow, it's waiting." The only missing piece was the app switch.

## 2. Why the patch made it worse

```ts
const onStake = async () => {
  window.location.href = "rainbow://";        // ← fires first, synchronously
  await writeContractAsync({ ... });          // ← hasn't published anything yet
};
```

Four separate problems, any one of which is fatal:

**a) Ordering — the request does not exist yet.** The navigation is synchronous and happens on the current tick. `writeContractAsync` hasn't even started its gas estimation, let alone called `irn_publish`. Rainbow is foregrounded with an empty queue, so it shows its home screen. There is literally nothing to sign, exactly as reported.

**b) Backgrounding suspends the publisher.** The moment Safari goes to the background, iOS freezes the tab's JS (usually within a second or so) and tears down or stalls its WebSockets. So the pending `eth_estimateGas` to Base and the subsequent relay publish either hang, or fail, or only resume when the user comes *back* to Safari — which is after they've already given up in Rainbow.

**c) `location.href` to a bare custom scheme is a navigation, not a side effect.** If the scheme resolves, you leave the page. If it doesn't (Rainbow not installed, or the user connected with MetaMask), iOS may show "Safari cannot open the page" or leave a broken navigation; on return, the page may have been discarded and reloaded — destroying the in-flight promise, the wagmi mutation state, and any optimistic UI.

**d) `rainbow://` with no path, and hardcoded.** A bare scheme means "launch the app," not "launch and show the pending request." And `connector.id === 'walletConnect'` covers *every* WalletConnect wallet — MetaMask, Trust, Zerion, Ledger Live, Uniswap Wallet, and desktop QR sessions. Every one of those users now gets kicked to Rainbow (or to a dead scheme / the App Store).

Net effect: you traded a silent failure that the user could work around manually for a loud failure they cannot work around at all.

## 3. The correct pattern

### 3a. Ordering: fire the request first, deep-link second, never `await` in between

```ts
const onStake = async () => {
  // 1. Start the request. DO NOT await here — the promise only settles
  //    after the user signs, which can't happen until they're in the wallet.
  const txPromise = writeContractAsync({
    address: stakingAddress,
    abi: stakingAbi,
    functionName: "stake",
    value: amount,
  });

  // 2. Keep the promise's rejection handled so a user-reject doesn't
  //    surface as an unhandled rejection while we're backgrounded.
  txPromise.catch(() => {});

  // 3. Hand off to the wallet once the request is plausibly on the wire.
  scheduleWalletHandoff(connector);

  // 4. Now await. Resolves when the user returns, signed.
  const hash = await txPromise;
  return hash;
};
```

The invariant: **the deep link must fire after the request is published to the relay, and before the user gives up.** Those are the only two constraints, and they're what sets the delay.

### 3b. The delay, and why it's the length it is

```ts
const HANDOFF_DELAY_MS = 120;
setTimeout(() => openWallet(target), HANDOFF_DELAY_MS);
```

**Lower bound (~50 ms).** A single `setTimeout(…, 0)` / microtask flush is not enough. Between your call and the bytes hitting the relay there are several genuinely async steps: viem assembling the request, the provider looking up the session topic, envelope encryption, `irn_publish` over the WebSocket, and the relay's ack. On a warm socket over cellular that's tens of milliseconds. Publish before backgrounding, or step (b) above bites you.

**Upper bound (~250–300 ms).** Two ceilings converge here. iOS's transient user activation from the tap is short-lived — push the navigation out too far and the browser treats it as an unsolicited redirect and blocks it (this is precisely the bug you had before the patch). And perceptually, a button that does nothing for a third of a second already reads as broken.

**100–150 ms is the sweet spot.** It is comfortably past the publish and comfortably inside the activation window.

**Make the delay honest by removing the async work from the click path.** The delay is only a heuristic because you don't know when the publish landed. Shrink the uncertainty: simulate and prepare ahead of time so the handler's only network step is the signing request itself.

```ts
// Prepared while the user is typing, not when they tap.
const { data: sim } = useSimulateContract({ address, abi, functionName: "stake", value: amount });
// handler: writeContractAsync(sim!.request) — no estimate, no nonce fetch, one publish.
```

Also make sure you are on the right chain *before* the tap. A `wallet_switchEthereumChain` to Base inside the handler is its own wallet round trip and completely desynchronizes the timer — gate the button on `chainId === base.id` and do the switch as a separate, explicit user action.

If you'd rather not use a timer at all, the deterministic alternative is to wrap the provider and trigger the handoff from the actual publish:

```ts
const provider = await connector.getProvider();
const original = provider.request.bind(provider);
provider.request = async (args) => {
  const p = original(args);
  if (SIGNING_METHODS.has(args.method)) queueMicrotask(() => openWallet(target));
  return p;
};
```
This is more code and more coupling to provider internals; the 120 ms timer is what most production dApps ship, and it's fine.

### 3c. Choosing the wallet scheme (`connector.id` is "walletConnect" — that's the transport, not the wallet)

`connector.id === 'walletConnect'` tells you *how* you're talking to a wallet, never *which* one. Resolve the actual target from the live session, in this priority order:

**1. The session's `peer.metadata.redirect` — the canonical, spec'd source.** WalletConnect v2 sessions carry the wallet's own declared redirect targets:

```ts
const provider: any = await connector.getProvider();
const redirect = provider?.session?.peer?.metadata?.redirect;
// e.g. { native: "rainbow://", universal: "https://rnbwapp.com" }
const name = provider?.session?.peer?.metadata?.name; // "Rainbow"
```

This is authoritative, works regardless of how the session was created (modal *or* QR scan), and — crucially — the wallet that declared it is demonstrably installed, because it completed a handshake with you. Prefer `redirect.native` for mid-session resume: it's the fastest path, it foregrounds the already-running app, and it avoids Safari's universal-link interstitial. Fall back to `redirect.universal`.

**2. `WALLETCONNECT_DEEPLINK_CHOICE` in localStorage** — the modal's record of what the user picked. Good fallback when `session.peer.metadata.redirect` is absent. Parse defensively; it's a JSON object in current versions and was a bare string in older ones.

**3. Nothing.** Do not guess from `peer.metadata.name` against a hardcoded scheme table, and never fall back to a default wallet. Show UI instead: *"Request sent — open your wallet app to approve,"* with a manual "Open wallet" button (that button has a fresh user gesture, so it will always work).

Putting it together:

```ts
type Handoff = { href: string; native: boolean };

function resolveHandoff(provider: any): Handoff | null {
  const r = provider?.session?.peer?.metadata?.redirect;
  if (r?.native)    return { href: r.native, native: true };
  if (r?.universal) return { href: r.universal, native: false };
  try {
    const raw = localStorage.getItem("WALLETCONNECT_DEEPLINK_CHOICE");
    if (raw) {
      const v = JSON.parse(raw);
      const href = typeof v === "string" ? v : v?.href;
      if (href) return { href, native: href.includes("://") && !href.startsWith("http") };
    }
  } catch {}
  return null;                       // unknown wallet → show the hint, don't guess
}

function openWallet(h: Handoff | null) {
  if (!h) return;
  // Native scheme: assign directly (window.open without activation is blocked on iOS).
  // Universal link: open in a new context so a miss doesn't unload our page.
  if (h.native) window.location.href = h.href;
  else window.open(h.href, "_blank", "noopener,noreferrer");
}
```

Note the deliberate asymmetry with the teammate's patch: `location.href` is still used, but only for a scheme the *connected wallet itself* published, so a failed resolution is essentially impossible.

**Don't force the return trip.** WalletConnect v2 wallets read *your* `metadata.redirect` from the session proposal and send the user back to you after signing. Set it once in your wagmi/RainbowKit config:

```ts
metadata: {
  name: "…", description: "…", url: "https://yourdapp.xyz",
  icons: ["https://yourdapp.xyz/icon.png"],
  redirect: { native: "", universal: "https://yourdapp.xyz" },
}
```
Never navigate back yourself on promise resolution — you'll fight the wallet and can land the user on a reloaded page.

### 3d. When to skip the deep link entirely

Guard on all of these; each one turns the handoff from a help into a bug.

- **Not a mobile browser.** On desktop, the session is paired to a phone or a desktop wallet; a scheme navigation either no-ops or pops an OS dialog. Gate on a real mobile UA/touch check.
- **Connector isn't WalletConnect.** `injected`, `metaMaskSDK`, `coinbaseWalletSDK`, `safe` — these surface their own UI (extension popup, native SDK modal, Safe transaction service). Deep-linking out of them is pure damage.
- **You're already inside a wallet's in-app browser** (Rainbow's dApp browser, MetaMask browser, Coinbase Wallet browser). The webview is the wallet; it prompts inline. Navigating to a scheme from inside it can kill or reload the webview. Detect via UA sniff plus `window.ethereum?.isRainbow` / `isMetaMask` / `isCoinbaseWallet`.
- **The peer is a desktop wallet.** A WC session can be paired to Ledger Live desktop or a desktop wallet while your page runs on mobile. `redirect.native` will be absent or desktop-only — that absence is meaningful, honor it.
- **The wallet declared no `redirect` at all.** Per spec that means "I don't support redirect handoff." Respect it and show the manual hint.
- **A request is already pending.** Guard with a ref/flag. Double-firing the handoff during an open signing sheet can dismiss it or stack navigations.
- **The call never reaches a wallet.** Read-only calls, gasless/relayed paths, session-key or embedded-wallet flows, account-abstraction paths where a bundler signs — no user signature, no reason to switch apps.
- **The request will fail anyway.** If your `useSimulateContract` already reverted, surface the error in-page; don't send the user to Rainbow to watch a failure.

### 3e. Also worth doing

- **Upgrade `@walletconnect/ethereum-provider`, `wagmi`, `viem`, and RainbowKit.** Recent versions handle the post-connect request redirect natively via `session.peer.metadata.redirect`; you may find most of this becomes redundant. Keep your guards regardless — they're the part that survives library churn.
- **Always render the fallback affordance.** As soon as the request is published, show *"Waiting for your wallet…"* with an "Open wallet" button and a cancel. That button carries a fresh user gesture, so it works even when every automatic path is blocked. It is the safety net that makes the whole thing acceptable to ship.
- **Handle the come-back.** The tab may have been frozen or bfcached. Listen for `visibilitychange`/`pageshow` and re-sync wagmi state rather than assuming your promise is still live.
