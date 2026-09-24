# Mobile WalletConnect: why "Stake" did nothing, why the deep-link patch broke it, and the correct pattern

## 1. Why nothing auto-opened before the patch

RainbowKit's mobile deep-linking only covers **connection**, not **requests**.

When the user taps *Connect*, the WalletConnect v2 client generates a pairing URI
(`wc:<topic>@2?relay-protocol=...&symKey=...`). RainbowKit listens for the provider's
`display_uri` event, wraps that URI in the wallet's own link
(`rainbow://wc?uri=...`, or the universal link `https://rnbwapp.com/wc?uri=...`) and
navigates the browser to it. That is what foregrounds Rainbow at connect time. It is
an explicit, wallet-specific navigation performed by RainbowKit — not something the
browser or the WalletConnect SDK does on its own.

Once the session exists, that machinery is done. Every subsequent request —
`eth_sendTransaction`, `personal_sign`, `wallet_switchEthereumChain` — is *not* a URI
and *not* a navigation. `writeContractAsync` → viem wallet client → WalletConnect
`EthereumProvider` → `signClient.request(...)`, which encrypts a JSON-RPC payload with
the session's symmetric key and **publishes it over an already-open WebSocket to the
relay**. The relay forwards it to whichever sockets are subscribed to that session
topic. Nothing in that path touches `window.location`. There is no URI to deep-link
with, and RainbowKit does not hook non-connection requests.

So how is the wallet *supposed* to wake up? Two mechanisms, both outside the dApp:

- **Push (WalletConnect Echo / push server).** If the wallet registered a device token
  for the session, the relay pokes it and the wallet raises a notification. This is
  best-effort: it depends on the wallet having registered, on the user having granted
  notification permission, and on iOS/Android not throttling or deferring delivery.
- **`session.peer.metadata.redirect`.** WC v2 added a `redirect: { native, universal }`
  field to session metadata *precisely* so the dApp side can bring the user back to the
  wallet after dispatching a request. It is data the wallet publishes; **somebody has
  to act on it**, and by default nobody in the wagmi/RainbowKit stack does on a
  per-request basis.

Meanwhile iOS will not let a backgrounded app foreground itself, and Safari cannot
foreground another app without a navigation. Result: the encrypted request lands in
Rainbow's queue instantly and correctly, the browser stays in the foreground, and the
page "just sits there." When the user switches by hand, the request is already waiting —
which is exactly the symptom reported, and confirms the transport was never the problem.

(This is also why the bug is invisible in a wallet's in-app browser and on desktop: in
the in-app browser the wallet *is* the host app and renders the sheet natively; on
desktop the wallet app or extension is already on screen.)

## 2. Why the patch made it worse

```ts
const onStake = async () => {
  window.location.href = "rainbow://";           // <-- fires first
  await writeContractAsync({ functionName: "stake", value: parseEther(amount) });
};
```

The navigation is **synchronous and immediate**; the write is **asynchronous and
unfinished**. Assigning `window.location.href` starts the app-switch right away.
`writeContractAsync` returns a promise: at the moment the handler yields, essentially
none of the real work has happened yet. Still pending are one or more RPC round trips
to prepare the request (chain id, nonce/gas preparation depending on the path), then
encryption of the `eth_sendTransaction` payload, then the `publish` over the relay
WebSocket and its ack.

All of that needs the page to be **alive and foregrounded**. The moment iOS/Android
backgrounds the browser it suspends timers and JS execution and will tear down or
freeze the WebSocket. So either the payload was never serialized, or it was serialized
and the socket closed before the publish flushed. Nothing reaches the relay, nothing
reaches Rainbow.

Rainbow therefore opens *faster than ever* — and opens empty. The patch traded a
delivered-but-unnoticed request for a noticed-but-undelivered one, which is strictly
worse: before, a user who switched apps manually could complete the stake.

Three further problems with that one line, independent of ordering:

- **`rainbow://` with no path is a bare app launch.** Even with correct ordering it
  carries no session or request context. You want the session's own redirect target.
- **It is unconditional.** Desktop users, extension users, Coinbase Smart Wallet users
  and users browsing *inside* Rainbow's own in-app browser all get hijacked. Navigating
  to `rainbow://` from inside Rainbow's webview can bounce the user out of the dApp or
  reload the webview, killing the session.
- **It hardcodes one wallet.** A Trust Wallet or MetaMask-mobile user who taps Stake is
  sent to an app they may not have installed — a custom scheme for a missing app fails
  silently or dumps them on an error page.
- **The promise's rejection is now the only error surface**, and if the navigation
  suspends the page before the `catch` runs the user never sees a message at all.

## 3. The correct pattern

### Ordering: dispatch first, redirect second, await third

The redirect must come **after** the write has been kicked off, but you must **not**
`await` the write before redirecting — that promise only settles once the user has
already signed in the wallet, so awaiting first deadlocks the very redirect meant to get
them there. Start the call, schedule the redirect, then await for the result.

```ts
// packages/nextjs/components/Stake.tsx
const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "Staker" });
const { connector } = useAccount();
const redirectTimer = useRef<ReturnType<typeof setTimeout>>();

useEffect(() => () => clearTimeout(redirectTimer.current), []);

const onStake = async () => {
  // Preflight anything that can fail locally BEFORE dispatching or redirecting.
  // (amount validation, chain check — wrong network should have swapped this button
  // for a "Switch to Base" CTA already.)

  const link = await getWalletRedirect(connector);   // null on desktop / injected / in-app

  // 1. dispatch — do not await yet
  const pending = writeContractAsync({ functionName: "stake", value: parseEther(amount) });

  // 2. give the request time to reach the relay, then foreground the wallet
  if (link) {
    redirectTimer.current = setTimeout(() => { window.location.href = link; }, 750);
  }

  // 3. now await, so errors and the receipt are still handled
  try {
    await pending;
  } catch (e) {
    clearTimeout(redirectTimer.current);
    notification.error(getParsedError(e));
  }
};
```

Keep the button locked on `isMining` (not wagmi's `isPending`) so the user cannot
double-dispatch while the app-switch is in flight.

### The delay and why ~500–1000 ms

The window has a hard floor and a soft ceiling:

- **Floor — one mobile network round trip, plus crypto.** The payload has to be prepared,
  encrypted with the session key, published to the relay over the WebSocket, and ack'd,
  all before the page is suspended. On LTE or a weak connection that is comfortably more
  than the ~100–300 ms that feels "instant" on Wi-Fi. Anything under ~300 ms
  reintroduces the bug intermittently — and intermittently is worse than always, because
  it will pass your test and fail for users.
- **Ceiling — the user's patience.** Past roughly 1.5 s the tap reads as broken: they tap
  again, or switch apps themselves, which is the behaviour you are trying to eliminate.

**~750 ms** is the value to ship: one slow round trip of headroom, still fast enough to
feel like a response to the tap. It is a heuristic, not a guarantee — which is why the
`await` and the error path stay in place. If the connector ever exposes a
"request published" signal, redirect on that instead and drop the timer; the timeout is
the pragmatic stand-in for an event that isn't surfaced.

### Choosing the wallet scheme when `connector.id` is `"walletConnect"`

`connector.id === "walletConnect"` for **every** WalletConnect wallet in RainbowKit's
list — Rainbow, MetaMask mobile, Trust, Zerion, Ledger Live all route through
`getWalletConnectConnector()`, so they share the wagmi connector id. `connector.name`
and RainbowKit's internal `rkDetails.id` (`"rainbow"`, `"metaMask"`, …) tell you which
*entry the user clicked*, but `rkDetails` is undocumented internal shape, and the entry
clicked is not proof of which app actually completed the handshake.

Use the session's own peer metadata — the wallet's self-report, and the field WC v2
added for this purpose:

```ts
async function getWalletRedirect(connector?: Connector): Promise<string | null> {
  if (!connector) return null;
  if (connector.id !== "walletConnect") return null;          // injected / smart wallet / etc.
  if (!isMobileBrowser() || isInsideWalletBrowser()) return null;

  const provider: any = await connector.getProvider();
  const redirect = provider?.session?.peer?.metadata?.redirect;
  if (!redirect) return null;                                  // wallet published none — do not guess

  // Prefer the universal link on iOS: it degrades to the App Store / web page if the
  // app is missing, where a custom scheme dead-ends.
  return redirect.universal || redirect.native || null;
}
```

Two rules this encodes:

- **Never hardcode a scheme.** A static `{ Rainbow: "rainbow://" }` map keyed on
  `peer.metadata.name` breaks the moment a non-Rainbow user taps the button — which is
  the shipped bug in a new costume — and rots as wallets change links.
- **Prefer `universal` over `native`.** Universal links fail gracefully; custom schemes
  do not.

### When to skip the deep link entirely

1. **Not a WalletConnect session.** Injected/extension, Coinbase Smart Wallet popup, any
   connector whose id isn't `walletConnect`. The signer is already reachable; navigating
   away only loses the page.
2. **Inside a wallet's in-app browser** (Rainbow, MetaMask, Coinbase, Trust). The wallet
   is the host app and shows the sheet natively; a top-level navigation to its own scheme
   can eject the user from the dApp or reload the webview and drop the session. Detect via
   an injected provider / `connector.type === "injected"` / UA markers, and bail.
3. **Desktop**, including desktop WalletConnect over QR where the peer is a desktop app.
   Gate on `matchMedia("(pointer: coarse)")` plus the absence of a native redirect.
4. **No `redirect` metadata on the session peer.** Do nothing rather than guess.
5. **Iframe / Safe App context** (`@safe-global/safe-apps-wagmi`, WalletConnect Safe).
   "Signing" there is queueing a multisig proposal — there is no app to foreground, and
   top-level navigation from an iframe is wrong and often blocked.
6. **Whenever the write did not actually get dispatched.** If preflight fails — invalid
   amount, wrong chain, insufficient balance, a synchronous throw from the hook — there is
   nothing in the queue, so redirecting guarantees the empty-wallet symptom. Validate
   first, dispatch, *then* schedule; and clear the timer in the `catch`.
7. **Wrong network.** Don't stack a chain switch and a transaction behind one tap; the
   primary CTA should already be a "Switch to Base" button, and that switch is its own
   WC request with its own redirect.

### Summary

- Before: the request was delivered correctly over the relay; nothing navigated the
  browser, and push/redirect never fired, so the wallet stayed in the background.
- The patch: navigated before the request was published, so backgrounding the page
  killed the publish — wallet opens, queue empty.
- Correct: validate → dispatch the write → `setTimeout(~750 ms)` → navigate to
  `session.peer.metadata.redirect.universal ?? .native` → `await` the promise for
  errors and the receipt; skip the navigation on desktop, on injected/smart-wallet
  connectors, inside wallet in-app browsers, in Safe/iframe contexts, when the session
  publishes no redirect, and whenever the write never left the page.
