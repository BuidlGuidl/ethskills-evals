# Mobile WalletConnect deep-linking on Scaffold-ETH 2

## 1. Why nothing auto-opened before the patch

Nothing was broken in the transaction path. The proof is in the bug report itself: *"if they manually switch to Rainbow, the signing request is waiting for them inside."* The request was built, signed-off to the relay, and delivered. The only thing that failed was the **foreground hand-off** — bringing the wallet app to the front.

What actually happens when `writeContractAsync` runs over a WalletConnect v2 session:

1. wagmi's `walletConnect` connector resolves its EIP-1193 provider (`@walletconnect/ethereum-provider`, wrapping `UniversalProvider` → `SignClient`).
2. viem/wagmi first does its prep work: `estimateGas`, `getChainId`, nonce/fee lookups, ABI encoding. These are HTTP round trips to your Base RPC. **This is not instant** — on a mobile network it is easily 200–800 ms.
3. Only then does the provider emit a `wc_sessionRequest` (method `eth_sendTransaction`) — it encrypts the payload with the session's symmetric key and `publish`es it to the relay (`wss://relay.walletconnect.com`) on the session topic.
4. Rainbow, subscribed to that topic, receives it — either live if it is running, or on next foreground/via WalletConnect's push relay — and enqueues it in its request UI.

Step 4 is why the request is sitting there. What is missing is a step 5: **the browser telling iOS/Android to switch apps.**

A web page cannot raise another app on its own. The only mechanism is navigating to a URL the OS claims — a custom scheme (`rainbow://`) or a universal/app link (`https://rnbwapp.com/...`). And both operating systems only honor that navigation when it happens **inside the user-activation window** of a real tap. Safari in particular consumes activation on the first `await` boundary and expires the residual window within roughly a second; a navigation attempted after a chain of RPC awaits is silently dropped — no error, no prompt, nothing.

So there are two distinct reasons the auto-open never fired, and both are usually in play:

- **The SDK's own redirect may never be attempted.** WalletConnect v2 only auto-redirects when the session carries peer redirect metadata (`session.peer.metadata.redirect.{native,universal}`) *and* the connect-time `WALLETCONNECT_DEEPLINK_CHOICE` localStorage entry is present. RainbowKit reliably deep-links on **connect** (it has the `wc:` URI and a fresh tap); on **subsequent requests** the behavior depends on SDK version and on that metadata surviving. If the user connected by scanning a QR from another device, or cleared storage, there is no redirect target at all.
- **Even when attempted, it is attempted too late.** By the time the request is published, the tap's user activation is gone, so the navigation is a no-op.

The user-visible result: the tap appears to do nothing, because the only feedback channel left is a Rainbow push notification, which many users have disabled.

## 2. Why the patch made it worse

```ts
// the teammate's patch
const onStake = async () => {
  window.location.href = "rainbow://";        // ①
  await writeContractAsync({ /* ... */ });    // ② never gets to run properly
};
```

Line ① fixes the *symptom* (activation is intact, so the app opens) by destroying the *substance*. Three things go wrong:

**a. The request has not been published yet.** `writeContractAsync` on line ② has not even started. Rainbow is asked to come forward before there is anything on the relay for it to display — so it opens on its home screen. The patch inverted the ordering: it foregrounds the wallet and *then* tries to produce work for it.

**b. Backgrounding the page suspends the work that would have produced it.** The moment the OS honors the scheme navigation, the browser tab goes to the background. Mobile browsers immediately throttle timers and JS, and the OS tears down or freezes open WebSockets — including the WalletConnect relay socket. So the pending RPC calls and the relay `publish` either stall indefinitely or fail. Worse, iOS Safari readily evicts backgrounded tabs; when the user swipes back, the page has reloaded and the promise on line ② no longer exists in any form. The transaction never lands because it was never sent.

**c. `rainbow://` with no path is a bare "open the app" link.** Deep links do not *carry* the request — the request travels over the relay. A bare scheme is only ever a foregrounding hint, which is fine *if* the request is already on the relay and useless otherwise. It is also the fragile form: if Rainbow is not installed, `location.href` to an unclaimed custom scheme produces a "Safari cannot open the page" interstitial and strands the user, and it hardcodes one wallet for every user of the dApp.

So: before the patch, the transaction was correct and the UX was broken. After the patch, the UX looks fixed and the transaction is broken. That is a strictly worse trade.

## 3. The correct pattern

### Ordering

Start the write, **do not await it before deep-linking**, and schedule the deep link on a short timer started synchronously inside the tap handler:

```ts
const onStake = async () => {
  // ① kick off the write — do NOT await here.
  const txPromise = writeContractAsync({
    functionName: "stake",
    args: [amount],
  });

  // ② schedule the hand-off from inside the gesture, so activation is inherited.
  const target = getWalletRedirectTarget();          // see below
  if (shouldDeepLink(target)) {
    setTimeout(() => {
      if (document.visibilityState === "visible") {
        window.location.href = target;
      }
    }, 350);
  }

  // ③ now await — resolves when the user signs in the wallet and comes back.
  try {
    const hash = await txPromise;
    // ...
  } catch (e) {
    // user rejected, or session expired
  }
};
```

Three properties matter here, and all three come from *not awaiting first*:

- The write begins immediately, so encoding + RPC prep + relay publish overlap with the delay instead of following it.
- `setTimeout` is registered synchronously in the handler, so the deferred navigation still rides the tap's user activation (a navigation scheduled after an `await` does not).
- The page is only backgrounded *after* the relay publish has had time to complete, so the request is genuinely waiting when Rainbow appears.

### The delay, and why that length

The delay exists to cover exactly one window: **from tap to `wc_sessionRequest` acknowledged by the relay.** That window contains ABI encoding and local ECIES/ChaCha encryption (sub-millisecond), the viem prep RPC calls to Base, and one WebSocket publish round trip to the relay (typically 100–300 ms on cellular).

It is bounded on both sides:

- **Too short (< ~150 ms, or zero as in the patch):** you background the tab mid-publish. Same failure mode as the patch — wallet opens empty, socket dies, transaction lost.
- **Too long (> ~1 s):** iOS drops the residual user activation and refuses the navigation outright, putting you back at the original bug. And the user has been staring at an unresponsive button long enough to tap it again, which queues a second request.

**250–500 ms is the working range; 300–350 ms is a good default.** It is deliberately a compromise, which is why the *better* version of this replaces the timer with the real signal. If you can observe the publish, do that instead of guessing:

```ts
const provider: any = await connector.getProvider();
provider.signer?.client?.core?.relayer?.once("relayer_publish", () => {
  window.location.href = target;
});
```

Event-driven also fixes a case a fixed timer gets wrong: **if the user is on the wrong chain**, wagmi issues `wallet_switchEthereumChain` as its own session request *before* the transaction. A blind 350 ms timer may fire against either one; firing on the first publish is correct in both cases.

### Choosing the wallet scheme when `connector.id === "walletConnect"`

`connector.id` identifies the **transport, not the wallet**. Every wallet that pairs over WalletConnect — Rainbow, Trust, Zerion, Uniswap Wallet, imToken, Ledger Live — reports `"walletConnect"`. It can never tell you which app to open, so never branch on it and never hardcode `rainbow://`.

The wallet identifies itself in the session. Read it, best source first:

```ts
function getWalletRedirectTarget(connector): string | null {
  // 1. Authoritative: peer metadata negotiated at pairing time.
  const provider: any = connectorProvider;                  // await connector.getProvider()
  const session = provider?.session ?? provider?.signer?.session;
  const redirect = session?.peer?.metadata?.redirect;        // { native, universal }
  if (redirect?.universal) return redirect.universal;        // prefer universal
  if (redirect?.native) return redirect.native;

  // 2. Fallback: what the WC modal recorded when the user picked a wallet.
  try {
    const choice = JSON.parse(
      localStorage.getItem("WALLETCONNECT_DEEPLINK_CHOICE") ?? "null"
    );
    if (choice?.href) return choice.href;                    // e.g. "https://rnbwapp.com/"
  } catch {}

  return null;                                               // → skip the deep link
}
```

- `session.peer.metadata.redirect` is supplied by the wallet itself at pairing. It is correct for whatever wallet this particular user connected with — Rainbow gives `{ native: "rainbow://", universal: "https://rnbwapp.com" }`.
- `session.peer.metadata.name` is useful for UI copy ("Opening Rainbow…") but should not be used to look up a scheme from a hardcoded table.
- **Prefer `universal` over `native`.** A universal/app link resolves to the installed app when present and to a normal web page when not — no dead navigation, no "cannot open page" interstitial, and no custom-scheme confirmation prompt.
- If the target is `null`, that is a real answer: this session does not support redirect. Skip it and show an inline hint ("Open your wallet app to confirm") rather than guessing a scheme.

### When to skip the deep link entirely

- **Desktop / non-touch.** The user paired by QR from a phone across the room, or is on a desktop wallet. Gate on a mobile check (`matchMedia("(pointer: coarse)")` plus UA), never fire otherwise.
- **Any non-WalletConnect connector.** `injected`, `coinbaseWalletSDK`, `metaMaskSDK`, `safe` — the provider is in-process and prompts on its own.
- **Inside a wallet's in-app browser.** Rainbow's and MetaMask's dApp browsers inject a provider directly; deep-linking from in there can kick the user out of the very WebView holding the session. Detect via the injected connector being active, or `window.ethereum?.isRainbow` / `isMetaMask` present.
- **Safe / Safe Apps iframe and other smart-contract wallets.** The request goes to a multisig queue for other signers. There is no app to raise, and a redirect is actively misleading.
- **Scaffold-ETH 2's burner wallet.** `burnerWallet` signs locally with a key in localStorage — no wallet app exists. This is easy to miss on a SE-2 dApp because burner is commonly enabled for local/testnet development.
- **Read-only paths.** `useReadContract` / `useScaffoldReadContract` never prompt. Only wire this into write handlers.
- **No redirect metadata and no `WALLETCONNECT_DEEPLINK_CHOICE`** (returns `null` above) — see previous section.
- **When the SDK already does it.** If your `@walletconnect/ethereum-provider` / RainbowKit version already auto-redirects on request for your sessions, adding a manual one double-navigates and can bounce the user between apps. Verify on a real device before adding the manual path, and if it already works, don't.
- **When the page isn't visible.** The `document.visibilityState === "visible"` guard in the snippet prevents firing a navigation the user has already navigated away from (or after they manually switched to the wallet themselves).

### Scaffold-ETH 2 placement note

Put the deep-link logic in the **component's `onClick`**, not inside `useScaffoldWriteContract` or `useTransactor`. It depends on the synchronous user gesture, and a hook called from a callback several frames deep has already lost the activation. `useTransactor`'s `waitForTransactionReceipt` step runs after the user returns from the wallet and needs no special handling.

One last piece of polish: the **return trip**. After signing, Rainbow tries to send the user back using your dApp's WalletConnect metadata. Make sure `getDefaultConfig({ appName, appUrl, appIcon, projectId })` carries an accurate `appUrl` — otherwise the user signs and is left sitting in the wallet wondering whether it worked.
