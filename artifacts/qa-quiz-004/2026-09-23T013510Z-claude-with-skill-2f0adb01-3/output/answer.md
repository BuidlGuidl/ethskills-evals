# Mobile WalletConnect Deep Linking — Why It Broke, and the Correct Pattern

## 1. Why nothing auto-opened before the patch

Nothing was broken in your contract call. The transaction request *was* being
delivered — that's exactly why the signing prompt is sitting there waiting when
the user manually switches to Rainbow.

What's missing is the **app switch**, and RainbowKit v2 / WalletConnect v2 does
not perform it for you on an outbound request.

The flow when a mobile user taps "Stake":

1. `writeContractAsync` runs in your dApp's browser tab (Safari/Chrome).
2. wagmi estimates gas, encodes the calldata, builds the
   `eth_sendTransaction` JSON-RPC payload.
3. The WalletConnect v2 connector encrypts that payload and publishes it to the
   WC relay network over the pairing's websocket topic.
4. Rainbow, whenever it next has that socket alive (foreground, or woken by a
   push), decrypts it and renders the signing sheet.

Step 4 is the problem. **Only the connection handshake deep-links.** When
RainbowKit builds the initial pairing it has a `wc:` URI, and it hands that URI
to the OS as a deep link — that's why *connecting* on mobile does jump you into
Rainbow. Once the session exists there is no URI anymore, just an encrypted
message on a relay topic. WC v2's designed answer for "wake the user's wallet"
post-session is the **push notification** (Web3Wallet / Echo server), not a deep
link — and mobile push is slow, gets coalesced, is frequently disabled per-app,
and does nothing at all when the wallet is backgrounded but the process is still
warm.

And crucially: your dApp's browser tab is the foreground app at that moment. A
website cannot be brought out of the foreground by the OS on a wallet's behalf.
**Nothing in the stack has both the ability and the responsibility to foreground
Rainbow.** That is your job as the dApp — RainbowKit v2 on mobile browsers
simply does not do it, and this is the single most common "the dApp is broken on
mobile" report in Scaffold-ETH 2 deployments.

So the pre-patch symptom — request arrives, page just sits there — is the
expected, unhandled default.

## 2. Why the patch made it worse

```ts
const handleStake = async () => {
  window.location.href = "rainbow://";   // ← first line
  await writeContractAsync({ ... });
};
```

`window.location.href = "rainbow://"` is a **navigation**, not a side effect.
The browser begins unloading the current document and handing the URL to the OS,
which foregrounds Rainbow. The JS execution context of that page is torn down or
frozen the moment the app switch happens.

So the ordering is now:

- The navigation is queued/committed.
- `writeContractAsync` is *reached*, but it is asynchronous work with several
  awaits in front of the relay publish: gas estimation (`eth_estimateGas` RPC
  round trip to Base), nonce/fee lookups, calldata encoding, then the encrypted
  publish to the WC relay.
- The page is backgrounded/frozen before any of that finishes. The RPC calls and
  the relay websocket write never complete. iOS Safari in particular suspends
  timers, aborts in-flight fetches, and may discard the tab outright.

Result: **Rainbow opens instantly and has nothing to sign**, because no request
was ever published. You traded a slow-but-correct flow for a fast-and-empty one.
The transaction never lands onchain — it was never sent.

This is strictly worse than before. Pre-patch the user could rescue the flow by
switching apps manually; post-patch there is nothing to rescue, and worse, the
user sees a wallet open and close with no prompt, which reads as "the dApp is
malfunctioning" rather than "I need to switch apps."

The general rule: **never navigate away from a page that still has async work in
flight.** A deep link is navigation.

## 3. The correct pattern

### The ordering

Fire the transaction **first**, then deep link after a delay. Wrap every write
call in one helper so this is impossible to get wrong per-button.

```ts
const writeAndOpen = useCallback(
  <T,>(writeFn: () => Promise<T>): Promise<T> => {
    const promise = writeFn();      // kick off TX — gas estimate + WC relay publish
    setTimeout(openWallet, 2000);   // switch apps AFTER the request is on the wire
    return promise;                 // caller still awaits the real result
  },
  [openWallet],
);

// Usage — wrap every single write, not just the headline one:
await writeAndOpen(() => stakeWrite({ functionName: "stake", args: [amount] }));
await writeAndOpen(() => approveWrite({ functionName: "approve", args: [spender, amount] }));
```

Note that `writeFn()` is called *synchronously first* and the promise is
returned unawaited before `setTimeout` is scheduled — the timer starts counting
while the write is still in flight, and the caller keeps the real promise so
`isPending`, confirmation waiting and error handling all behave normally.

### The delay, and why 2000ms

The delay must cover everything between the click and the moment Rainbow
actually has a decryptable request:

- `eth_estimateGas` + fee/nonce RPC round trips to Base (highly variable on
  mobile networks — this is the long pole, and it's why a public rate-limited
  RPC makes mobile *feel* broken)
- ABI encoding and request construction
- The encrypted publish to the WalletConnect relay
- The relay fanning the message out to Rainbow's subscribed socket

**2000ms is the working value.** 300ms — the instinctive choice — is far too
fast: you'll switch apps while gas estimation is still outstanding and hit the
same empty-wallet symptom as the broken patch, just less deterministically
(it'll work on office wifi and fail on LTE, which makes it a nightmare to
debug). Going much above ~2.5s is also bad: the user is staring at an
apparently dead button, taps again, and you get duplicate transactions. 2s is
the empirical sweet spot between "request has landed" and "user has not yet
concluded the app is broken."

Pair this with a proper pending state on the button (disabled + inline
spinner) so the 2s gap reads as "working," not "dead."

### Choosing the wallet scheme when `connector.id === "walletConnect"`

wagmi's `connector.id` reports the *transport*, not the wallet. Every
WalletConnect-connected wallet — Rainbow, MetaMask mobile, Trust, Phantom —
reports `"walletConnect"`. Branching on it alone means you can only ever guess
one wallet, and you'll deep link MetaMask users into Rainbow.

Gather evidence from several sources and match on keywords:

```ts
const openWallet = useCallback(() => {
  if (typeof window === "undefined") return;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile || window.ethereum) return;   // see "when to skip" below

  // connector.id is "walletConnect" — useless alone. Pull in the other signals.
  const allIds = [
    connector?.id,
    connector?.name,                                   // often "Rainbow" via WC metadata
    localStorage.getItem("wagmi.recentConnectorId"),
  ].filter(Boolean).join(" ").toLowerCase();

  // The WC v2 session record holds the peer wallet's metadata (name, url, icons).
  let wcWallet = "";
  try {
    const wcKey = Object.keys(localStorage).find(k => k.startsWith("wc@2:client"));
    if (wcKey) wcWallet = (localStorage.getItem(wcKey) || "").toLowerCase();
  } catch {}

  const search = `${allIds} ${wcWallet}`;

  const schemes: [string[], string][] = [
    [["rainbow"], "rainbow://"],
    [["metamask"], "metamask://"],
    [["coinbase", "cbwallet"], "cbwallet://"],
    [["trust"], "trust://"],
    [["phantom"], "phantom://"],
  ];

  for (const [keywords, scheme] of schemes) {
    if (keywords.some(k => search.includes(k))) {
      window.location.href = scheme;
      return;
    }
  }
  // No confident match → do nothing. Never guess a scheme.
}, [connector]);
```

The load-bearing source is the **WalletConnect v2 session blob** under the
`wc@2:client…` localStorage key. During the pairing handshake the wallet sends
its own `metadata` — `{ name: "Rainbow", url: "https://rainbow.me", … }` — and
WC persists it with the session. Substring-searching that blob identifies the
actual peer wallet even though wagmi has flattened everything to
`"walletConnect"`.

Two details worth keeping:

- **Use the bare scheme (`rainbow://`), not a path like `rainbow://dapp/…`.**
  A bare scheme foregrounds the app and lands on whatever it was already showing
  — which is the pending request sheet. A path-bearing deep link makes the
  wallet navigate, often reloading its in-app browser and *discarding* the
  request you just sent.
- **Fall through silently on no match.** An unregistered scheme on iOS produces
  a "Safari cannot open the page" alert on top of your dApp, which is worse than
  no deep link at all.

### When to skip the deep link entirely

1. **Desktop.** No app to open. A `rainbow://` navigation on desktop is at best
   a no-op and at worst a browser error dialog / protocol-handler prompt.
   Gate on the mobile UA test.

2. **Inside a wallet's in-app browser** — the `window.ethereum` check. If the
   user opened your dApp from Rainbow's or MetaMask's built-in browser, they are
   *already in the wallet*; the provider is injected and the signing sheet slides
   up natively over the page. Deep linking here yanks the wallet out of its own
   browser back to its home screen, and the request the user was about to sign
   goes with it. This is the second-most-common way to break an otherwise
   correct implementation.

3. **Injected / browser-extension connectors generally.** Anything that isn't a
   WalletConnect session doesn't need the app switch. `window.ethereum` covers
   most of this, but if you support Coinbase Smart Wallet or other popup-based
   connectors, exclude those connector IDs too — the popup is already
   foregrounded.

4. **Embedded / smart-account or sponsored flows where no user signature is
   requested.** Gasless relayed calls, session-key transactions, and anything
   signed by an embedded key never surface a wallet prompt. Deep linking there
   just ejects the user from a flow that was about to complete on its own.

5. **When the write call throws synchronously** (unconnected, wrong chain,
   insufficient balance caught before dispatch). If you can detect the failure
   before the 2s timer fires, cancel it — don't send someone to their wallet to
   see nothing. In practice: do the network-check / connection-check branching in
   the button's render path (Connect → Switch Network → Approve → Action) so
   `writeAndOpen` is only ever reachable in a state that will genuinely produce a
   signing request.

### Summary

| | Before | Teammate's patch | Correct |
|---|---|---|---|
| Ordering | TX only | deep link → TX | TX → delay → deep link |
| Wallet opens | No | Instantly | After ~2s |
| Request present | Yes (unseen) | No | Yes |
| Lands onchain | Only if user switches manually | Never | Yes |

Fire the transaction first. Wait 2 seconds so gas estimation and the relay
publish complete. Identify the wallet from the WC session metadata, not
`connector.id`. Skip the whole thing on desktop and inside wallet in-app
browsers. Wrap every write — approve, stake, claim — not just the one that got
reported.
