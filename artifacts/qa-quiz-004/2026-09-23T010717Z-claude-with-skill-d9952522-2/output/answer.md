# Mobile WalletConnect deep links: why nothing opened, why the patch broke it, and the correct pattern

## 1. Why nothing auto-opened before the patch

Nothing was broken in the signing path — the request *was* reaching Rainbow. That is the tell: "if they manually switch to Rainbow, the signing request is waiting for them inside."

What actually happens on mobile with WalletConnect v2:

- The dApp and the wallet share a **relay session**, not a window. `writeContractAsync` → the WalletConnect connector serializes an `eth_sendTransaction` request → it goes out over the WalletConnect relay (websocket) → the wallet app receives it and renders the confirmation sheet. All of that succeeds regardless of which app is in the foreground.
- **RainbowKit's modal is a browser UI.** It only handles the *connect* leg: it shows the QR / wallet list, and on mobile it fires the `wc:` pairing URI at the wallet's universal link, which is what brings the wallet to the foreground the one time. After the session exists, subsequent requests are plain relay messages — RainbowKit's modal is not involved and does not reopen.
- **A web page cannot foreground another app on its own.** iOS and Android only hand foreground to an app in response to a navigation to its URL scheme / universal link, and only when that navigation is attributable to a user gesture. WalletConnect v2 has no mechanism to do this for you on request #2 onward: there is no push-to-foreground in the protocol. WalletConnect v2 *does* carry a `redirect` / `metadata.redirect` hint in the session — but that is the **wallet → dApp** return trip (so Rainbow can bounce the user back to the browser after signing), not a dApp → wallet trigger.

So the user taps Stake, the request leaves over the relay, the sheet is waiting in Rainbow, and the browser has no reason to change what is on screen. From the user's point of view: tapping does nothing.

This is exactly the mobile finding in the QA checklist: *"if nothing happens and the user has to switch apps by hand, that is a finding."* The fix is a dApp-side deep link — but ordering is everything.

## 2. Why the patch made it worse

```ts
// broken
const handleStake = async () => {
  window.location.href = "rainbow://";   // navigate away FIRST
  await writeContractAsync({ ... });     // never reliably runs
};
```

Assigning `window.location.href` starts a navigation *immediately*. The browser begins tearing down / backgrounding the page, and iOS Safari in particular suspends JS execution as soon as the app switch commits. The `writeContractAsync` line either never executes, or it executes far enough to build the request but the websocket send never flushes before the page is frozen.

Result matches the symptom precisely: **Rainbow opens instantly and there is nothing to sign.** The deep link did its one job — foreground the wallet — but it raced the only line that actually creates the transaction, and won. Before the patch there was a request with no redirect; after the patch there is a redirect with no request. The patch converted a bad-UX bug into a *functional* bug: the transaction never lands onchain, and the user is now staring at an idle wallet with no explanation, which is worse than a page that looks stuck in a browser where a "check your wallet" hint could at least be shown.

Two secondary problems with the patch, independent of ordering:

- `rainbow://` is hardcoded. Anyone who connected with MetaMask, Coinbase Wallet, Trust, Zerion, etc. gets thrown into Rainbow (or, if Rainbow is not installed, into an unhandled-scheme error page or a blank tab) mid-transaction.
- It fires unconditionally — including on desktop and inside a wallet's own in-app browser, where it is at best a no-op and at worst navigates the user out of the page they are transacting on.

## 3. The correct pattern

### Ordering

**Fire the write first, then deep link.** The write call must be initiated — and the request handed to the WalletConnect transport — before the navigation begins. Do not `await` the full `writeContractAsync` before redirecting: that promise only settles after the user signs *and* (through `useScaffoldWriteContract`) after the receipt is confirmed, so awaiting it means the user is never sent to the wallet at all. Kick off the promise, schedule the deep link, then await the promise for the result.

```ts
const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "Staker" });

const handleStake = async () => {
  try {
    const tx = writeContractAsync({ functionName: "stake", value: parseEther(amount) });

    const scheme = getWalletDeepLink(connector);   // see below
    if (scheme) setTimeout(() => { window.location.href = scheme; }, 300);

    await tx;
  } catch (e) {
    notification.error(getParsedError(e));
  }
};
```

Note `writeContractAsync(...)` is called without `await` on its own line, and the returned promise is awaited *after* the redirect is scheduled — that is what keeps rejection/failure handling intact while still letting the redirect fire mid-flight. Keep the button locked on `isMining` (not wagmi's `isPending`) so a user returning from the wallet cannot double-submit, and surface failures with `notification` + `getParsedError` — a backgrounded page that comes back to a silent `console.error` is indistinguishable from the original bug.

### The delay, and why that length

A short `setTimeout` (**roughly 250–500 ms; 300 ms is a good default**) between the write call and the navigation. The reason is not cosmetic:

- `writeContractAsync` is async well past the synchronous part of the click handler. It has to resolve the ABI/args, possibly estimate gas, build the JSON-RPC payload, and hand it to the WalletConnect signer, which then has to **actually write it to the relay websocket** — and the relay session may need a reconnect/resubscribe first if the socket went idle while the page was backgrounded. None of that has completed by the time the handler's first synchronous tick ends.
- The delay yields the event loop so those microtasks and the socket write can flush. Below ~200 ms you start losing the race on cold sockets and slower devices; above ~800 ms the tap feels unresponsive and you drift out of the window where the OS still treats the navigation as user-gesture-attributed (Safari is the strictest here) — so the app switch can be silently blocked. 300 ms clears the flush on real devices while still reading as instant.
- A timer is a heuristic, not a guarantee. The honest alternative, if your connector exposes it, is to redirect off the transport's "request sent" signal rather than a clock. Absent that, keep the timer short and make the UI resilient: leave a visible "Confirm in your wallet" state on the page so a missed switch degrades to the pre-patch behaviour with an explanation, not to silence.

### Choosing the wallet scheme when `connector.id === "walletConnect"`

`connector.id` is useless for this — every WalletConnect-connected wallet reports `"walletConnect"`, because the connector *is* the protocol, not the wallet. The wallet identity lives elsewhere:

1. **The WalletConnect session peer metadata** — the most reliable source. The active session's `peer.metadata` (`name`, `url`, `redirect.native` / `redirect.universal`) is populated by whichever wallet actually approved the session. If `redirect.native` or `redirect.universal` is present, **use it verbatim** — it is the wallet telling you its own correct link, and it stays correct as wallets change schemes.
2. **RainbowKit's own record of the chosen wallet** — RainbowKit persists the selected wallet id (e.g. in its `rk-recent` / recent-wallet localStorage entry, and via `connector.rkDetails`), which distinguishes `rainbow` from `metaMask` from `trust` even though wagmi flattens them all to `walletConnect`. Map that id to a known scheme as a fallback.
3. **Fall back to no deep link** if neither resolves. Do not guess.

Prefer **universal links over raw custom schemes** (`https://rnbwapp.com/...` rather than `rainbow://`): if the app is not installed, a universal link lands on a real web page, whereas an unhandled custom scheme produces an OS error dialog or a dead tab in the middle of the user's transaction.

### When to skip the deep link entirely

- **Inside a wallet's in-app browser.** MetaMask's, Coinbase Wallet's, Rainbow's own browsers inject the provider directly — the confirmation sheet is already in the same app. Deep linking here navigates the user out of the page mid-transaction, and can drop the dApp's state. Detect the injected/in-app-browser case (injected connector, or the wallet's UA marker / `window.ethereum.isMetaMask`-style flags) and skip.
- **Desktop, and any injected browser-extension connection.** The extension popup surfaces itself; a scheme navigation at best no-ops and at worst opens an app-store page.
- **Desktop WalletConnect via QR.** The session peer is a phone in the user's hand; navigating the desktop browser to a mobile scheme does nothing useful. Gate on actually being on a mobile device.
- **Smart-contract-wallet / WalletConnect sessions with no resolvable app target** — e.g. Safe via WalletConnect, or any peer whose metadata offers no `redirect`. There is no single app to foreground; the signers are elsewhere. Show "Confirm in your wallet" instead.
- **When the wallet is not installed** — an unresolvable scheme should degrade to nothing, not to an error page.
- **Non-signing calls.** Only deep link for actions that require a user signature (`eth_sendTransaction`, `personal_sign`, `eth_signTypedData`). Reads and chain switches that resolve without approval should never yank the user out of the browser.

In every skip case the page must still explain itself: a visible "Confirm in your wallet" / pending state is what turns "tapping does nothing" into a comprehensible flow, whether or not the deep link fires.
