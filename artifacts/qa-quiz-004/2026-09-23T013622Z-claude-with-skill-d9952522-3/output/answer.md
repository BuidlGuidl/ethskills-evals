# Mobile WalletConnect deep links: why "Stake" does nothing, and why `rainbow://` first made it worse

## 1. Why nothing auto-opened before the patch

Nothing was broken. The transaction request was being created and delivered correctly — it just
wasn't being *shown*, because on mobile the browser is the one that has to hand off focus, and
nobody was asking it to.

What actually happens when a mobile user taps "Stake" on a WalletConnect v2 session:

- `writeContractAsync` → wagmi → the WalletConnect provider → an `eth_sendTransaction` JSON-RPC
  request is encrypted for the active session topic and **published to the WalletConnect relay
  over the page's websocket**. The page then sits there `await`ing the response.
- The relay pushes the request to the paired wallet. Rainbow receives it and enqueues it. If the
  app is backgrounded, the only nudge the user gets is a WalletConnect push notification — which
  is best-effort: it depends on push permission, the wallet's registration with the Echo/push
  server, iOS delivery, and Low Power Mode. It is routinely never seen.
- The signing sheet exists inside Rainbow the whole time. That's exactly what your users
  described: switch to the app by hand and the request is waiting. The request was fine; the
  *app switch* never happened.

Why RainbowKit doesn't do the app switch for you: RainbowKit auto-deep-links on the **connect**
step only. Connecting is the one moment it owns a URI (`wc:...`) and a wallet choice from its
modal, so it opens `rainbow://wc?uri=...` for you. After the session is established, every
subsequent request goes through wagmi's `walletConnect` connector, and neither wagmi nor
RainbowKit re-foregrounds the wallet per request. WalletConnect v2 sessions *do* carry
`session.peer.metadata.redirect` precisely so the dApp can do this, but it's opt-in: the dApp has
to read it and navigate. SE-2's scaffold out of the box does not. So on mobile, a transaction
button with no deep-link handling is a dead button — and that is a shipping bug, not a user error.

A browser tab cannot foreground another app spontaneously, either. It can only do it by
navigating to a custom scheme or universal link, and mobile browsers only honor that inside a
live user-activation window (i.e. shortly after the tap). That constraint is what makes the
ordering and the delay below matter.

## 2. Why the patch made it worse

```ts
window.location.href = "rainbow://";        // <- first line
await writeContractAsync({ ... });          // <- never really runs
```

The patch inverted the only ordering that can work. Four separate failures, any one of which is
fatal:

1. **It navigates away before the request is published.** Assigning `location.href` to an
   external scheme starts a navigation and hands control to the OS. iOS Safari and Android Chrome
   freeze/background the page's JS and can tear down the websocket. `writeContractAsync` either
   never executes, or executes but its relay publish never completes. **There is no request on the
   relay.** Hence: Rainbow opens instantly and has nothing to sign. The patch traded a silent bug
   for a louder one — the user now believes the app is lying to them.
2. **Even the await is dead.** The `await` needs the page alive to receive the response over the
   same session. A frozen page has no `isMining`, no receipt, no error — the flow can't complete
   even if the wallet somehow had something to sign.
3. **The bare `rainbow://` scheme carries no payload and no target.** It means "open Rainbow",
   nothing more — it lands on whatever screen Rainbow was last on. The pairing case works because
   the URI is in the link; a transaction has no URI to pass, which is why the request must already
   be in flight on the relay before you switch apps.
4. **It's hardcoded to Rainbow and unconditional.** MetaMask, Trust, Zerion and Coinbase Wallet
   users get yanked toward an app they may not have installed (iOS shows a "Cannot open page"
   alert, or nothing). Desktop users and users inside a wallet's own in-app browser get ejected
   from a flow that was working.

## 3. The correct pattern

### Ordering: write first, then redirect — always

Fire the write, do **not** await it before redirecting (awaiting means waiting for a signature
that can only happen after the app switch — a deadlock). Keep the promise, redirect, then await it
for `isMining`, the receipt and error handling.

```tsx
const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "Staker" });
const { connector } = useAccount();

const handleStake = async () => {
  try {
    const tx = writeContractAsync({ functionName: "stake", value: parseEther(amount) }); // in flight
    void openWalletApp(connector);        // fire-and-forget; never awaited before the write
    await tx;                             // resolves on confirmation, back in the browser
  } catch (e) {
    notification.error(getParsedError(e)); // rejection in the wallet must surface here, not console
  }
};
```

`isMining` from `useScaffoldWriteContract` (not wagmi's `isPending`) stays true across
`waitForTransactionReceipt`, so the button stays locked while the user is over in Rainbow.

### The delay, and why ~300ms

```ts
setTimeout(() => { window.location.href = target; }, 300);
```

The delay exists to bracket two opposing deadlines:

- **Lower bound (~150–200ms):** the request must be encrypted and actually flushed to the relay
  websocket before the page is frozen. Redirect too early and you reproduce the patch's bug —
  wallet opens empty. A one-tick `setTimeout(0)` is not enough; the publish is a network round
  trip, and the relay socket may need to reconnect first.
- **Upper bound (~500ms):** mobile browsers only allow custom-scheme navigation while the tap's
  user-activation is still alive. Stretch past roughly half a second and Safari silently drops the
  navigation — no wallet, no error. Long delays also read as a frozen button.

300ms is the value that comfortably clears both; treat 200–500ms as the usable band. Never make it
a "wait for the transaction" timer — it is only a publish-flush window. If your provider gives you
a hook for "request sent" (e.g. a `display_uri`/session-request event), prefer reacting to that
over the fixed timer.

### Choosing the scheme when `connector.id` is `"walletConnect"`

`connector.id === "walletConnect"` names the **transport**, not the wallet — every WC wallet
reports the same id. The wallet's identity lives on the session's peer metadata, so read it from
the provider:

```ts
const FALLBACK_SCHEMES: Record<string, string> = {
  rainbow: "rainbow://",
  metamask: "metamask://",
  "trust wallet": "trust://",
  "coinbase wallet": "cbwallet://",
  zerion: "zerion://",
};

async function openWalletApp(connector?: Connector) {
  if (typeof window === "undefined") return;
  if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return;  // desktop: skip
  if (connector?.id !== "walletConnect") return;                       // injected / in-app / smart wallet: skip

  const provider: any = await connector.getProvider();
  const peer = provider?.session?.peer?.metadata;
  if (!peer) return;                                                   // no live session: skip

  const target =
    peer.redirect?.native ||                                           // "rainbow://" — wallet's own answer
    peer.redirect?.universal ||                                        // "https://rnbwapp.com" — safer fallback
    FALLBACK_SCHEMES[peer.name?.toLowerCase() ?? ""];

  if (!target) return;                                                 // unknown wallet: never guess
  setTimeout(() => { window.location.href = target; }, 300);
}
```

Priority order, and why:

1. **`session.peer.metadata.redirect.native`** — the wallet told you its scheme during pairing.
   This is authoritative and works for wallets you've never heard of.
2. **`redirect.universal`** — prefer this over a raw scheme when a scheme lookup would be a guess:
   a universal link degrades to a web page or the App Store, whereas an uninstalled custom scheme
   produces an OS error dialog.
3. **A small name→scheme table** for older sessions with no `redirect` block.
4. **Nothing.** An unknown wallet gets no redirect — the pre-patch behavior, which is merely
   suboptimal, rather than an error alert.

### When the deep link must be skipped entirely

- **Desktop.** The extension or the RainbowKit modal already surfaces the prompt; navigating to a
  scheme does nothing useful and can trigger a protocol-handler dialog.
- **Any connector that isn't `walletConnect`** — injected/extension connectors show the prompt in
  place.
- **Inside a wallet's in-app browser** (Rainbow's, MetaMask's, Coinbase's). The wallet injects a
  provider, so it's already the same app; a deep link exits the in-app browser and destroys the
  page that's awaiting the response. The `connector.id !== "walletConnect"` guard covers this,
  since in-app browsers connect as injected.
- **No live WC session** (`provider.session` undefined) — there is nothing pending to sign; the
  user should be sent through Connect instead.
- **Smart-account / passkey / embedded connectors** (Coinbase Smart Wallet, Privy-style embedded
  signers). These sign in a popup or need no wallet app; the scheme is wrong or absent.
- **When the write failed before leaving the browser** — a failed simulation, wrong chain, or bad
  input rejects immediately. Don't open the wallet for a request that was never published. This is
  also why the wrong-network case must turn the CTA itself into "Switch to Base": redirecting a
  user on the wrong chain sends them to a wallet with no request waiting.
- **Read-only calls.** Only signature-requiring requests warrant an app switch.

Don't build a "return to browser" deep link on the way back — Rainbow uses the dApp's own
`metadata.redirect` from your WalletConnect config to bring the user back. Set that in your
wagmi/RainbowKit metadata instead.

### Verify on a real phone

Simulators don't reproduce user-activation or app-switch freezing. Test on a device: tap Stake →
Rainbow foregrounds with the sheet already up → sign → you land back in the browser with the
button still locked → confirmation notification. Then repeat with MetaMask, and once inside
Rainbow's in-app browser, to confirm the skip paths.
