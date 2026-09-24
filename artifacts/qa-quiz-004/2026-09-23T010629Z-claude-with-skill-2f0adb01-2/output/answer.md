# Mobile WalletConnect deep linking: why "Stake" does nothing, and how to fix it

## 1. Why nothing auto-opened before the patch

RainbowKit v2 on top of WalletConnect v2 **does not deep link back into the wallet app when a
transaction request is sent.** That auto-redirect only exists for the *connection* handshake — the
QR / "Open Rainbow" step at pairing time. After the session is established, a
`writeContractAsync` call does this:

1. wagmi/viem estimates gas and encodes the calldata,
2. the `eth_sendTransaction` request is published to the WalletConnect **relay**,
3. the relay hands it to the wallet, which surfaces it via a **push notification**.

There is no navigation event on the dApp side at all. The browser tab stays exactly where it is.
The user is expected to notice the push notification and switch apps themselves — and push on iOS
is slow, frequently throttled, and silently dropped if notifications were never granted.

So the observed behaviour is correct-but-useless: the request *did* reach Rainbow (that's why the
prompt is sitting there when the user switches manually), the app just never told the phone to
bring Rainbow to the foreground. **Deep linking on transaction send is something the dApp has to
implement itself.**

## 2. Why the patch made it worse

```ts
window.location.href = "rainbow://";   // ← first line of the handler
await writeContractAsync({ ... });     // ← never really happens
```

`window.location.href = "rainbow://"` is a **navigation**. The mobile OS immediately backgrounds
Safari/Chrome and foregrounds Rainbow. A backgrounded mobile browser tab is frozen: timers are
throttled, JS execution is suspended, and in-flight work is abandoned. The `writeContractAsync`
call either never runs, or starts and dies mid-flight before it can finish gas estimation and
publish to the relay.

Result: the wallet opens fast (the deep link works fine) and has **nothing to sign**, because the
request was never relayed. The teammate traded "request arrives, wallet doesn't open" for "wallet
opens, request never arrives" — strictly worse, because the first version at least landed onchain
once the user switched manually.

## 3. The correct pattern

### Ordering: transaction first, deep link second

Fire the write, **do not await it**, then schedule the deep link on a timer and return the
promise so the caller still gets the receipt:

```ts
const writeAndOpen = useCallback(
  <T,>(writeFn: () => Promise<T>): Promise<T> => {
    const promise = writeFn();     // fires TX: gas estimation + WC relay publish
    setTimeout(openWallet, 2000);  // switch to wallet AFTER the request is relayed
    return promise;
  },
  [openWallet],
);

// usage — wrap EVERY write, not just the headline one
await writeAndOpen(() => stakeWrite({ functionName: "stake", args: [amount] }));
```

Awaiting the write before deep linking is also wrong: `writeContractAsync` doesn't resolve until
the user *signs*, and they can't sign in an app you haven't opened yet.

### The delay, and why ~2000 ms

Between the call and the request actually being in the wallet's hands there is: ABI encoding, an
`eth_estimateGas` round trip to the RPC, nonce/fee lookups, and the WalletConnect relay publish
plus the wallet's subscription pickup. On a mobile network that is comfortably over a second.
300 ms fires while the request is still in flight — the browser freezes mid-relay and you're back
to the broken patch. 2 s is empirically past the relay hop on typical mobile connections while
still feeling instantaneous to the user. Err long rather than short: a 2 s pause is a minor UX
nit, a too-short delay is a dead transaction.

### Picking the wallet scheme when `connector.id === "walletConnect"`

wagmi reports the *transport*, not the wallet — every WalletConnect wallet is `"walletConnect"`.
Never hardcode `rainbow://`; a MetaMask user would be bounced into an app that has no session.
Instead sniff several sources and match keywords:

```ts
const openWallet = useCallback(() => {
  if (typeof window === "undefined") return;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile || window.ethereum) return;   // see "when to skip" below

  const allIds = [connector?.id, connector?.name,
    localStorage.getItem("wagmi.recentConnectorId")]
    .filter(Boolean).join(" ").toLowerCase();

  // the WC session record names the peer wallet
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
  // no match → do nothing; fall back to the push notification
}, [connector]);
```

Use the **bare scheme** (`rainbow://`), not `rainbow://dapp/...` or a wc URI — path-carrying deep
links make the wallet reopen its browser/reload the dApp, which can tear down the pending request.
And if nothing matches, open nothing: a wrong app is worse than the default push flow.

### When to skip the deep link entirely

- **Desktop.** No app to open; navigation just breaks the page. Gate on the user-agent check.
- **Inside a wallet's in-app browser.** If `window.ethereum` is injected you're already *in*
  Rainbow/MetaMask/Coinbase — the prompt appears natively and a deep link would either no-op or
  reload the dApp and kill the request.
- **Unrecognized wallet.** No keyword match → skip, rather than guess a scheme.
- **Non-wallet interactions.** Reads, `useScaffoldReadContract`, view calls — nothing to sign.
- **SSR / no `window`.** Guard with `typeof window === "undefined"`.

### Coverage

Wrap every write path in `writeAndOpen` — approve, stake, claim, batch, unstake. A half-migrated
app is the classic regression: Stake opens the wallet, Approve doesn't, and users conclude the
approval step is broken.
