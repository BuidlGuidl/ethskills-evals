# WalletConnect / Rainbow mobile signing flow

## 1. Why nothing auto-opened before the patch

RainbowKit and WalletConnect are doing two separate jobs that are easy to mentally collapse into one:

1. `writeContractAsync` creates an EVM write request, usually `eth_sendTransaction`.
2. The WalletConnect v2 provider sends that JSON-RPC request over the existing WalletConnect session/relay to the wallet.
3. Rainbow receives it and queues a signing screen.

That is why manually switching to Rainbow shows the pending request: the transaction request did get to the wallet. What did not happen was app foregrounding.

RainbowKit's mobile deep link handling is mostly about connection/session setup: it can turn a WalletConnect pairing URI into a wallet-specific mobile URI, such as Rainbow's `rainbow://wc?uri=...` link. Once the user is already connected, a later contract write is not a new pairing URI and wagmi's WalletConnect connector is just a generic `walletConnect` transport. WalletConnect can deliver the request, but the browser is not automatically moved to Rainbow unless the dapp also opens the wallet app, or the wallet manages to notify the user.

So the pre-patch behavior was not "Stake did nothing." It was "Stake published a signing request through WalletConnect, but the dapp never foregrounded the wallet app."

## 2. Why `window.location.href = "rainbow://"` first made it worse

Opening `rainbow://` before `writeContractAsync` reverses the required order.

On mobile, setting `window.location.href` to a native scheme immediately navigates away from the browser tab and foregrounds Rainbow. That can pause or interrupt the JavaScript context before wagmi/viem has finished the work needed to create and publish the request: encoding calldata, resolving the write, estimating gas/simulation as needed, checking chain/session state, and sending the JSON-RPC request through WalletConnect.

The result is exactly what users saw: Rainbow opens instantly, but it opens before the WalletConnect request exists. There is nothing to sign, and because the write was interrupted or never relayed, no transaction is submitted.

A bare `rainbow://` is also not the transaction request. It is only an app switch. The request still has to be sent over WalletConnect first.

## 3. Correct pattern

The pattern is:

1. Start the write immediately from the user's tap.
2. Keep the returned promise.
3. After a short delay, deep link to the wallet that owns the active WalletConnect session.
4. Await/return the original write promise so the dapp still receives the hash or error.

Example shape:

```ts
async function stake() {
  const txPromise = writeContractAsync({
    address: stakingAddress,
    abi: stakingAbi,
    functionName: "stake",
    args: [amount],
    chainId: base.id,
  });

  if (shouldOpenExternalWallet()) {
    window.setTimeout(() => {
      const scheme = getConnectedWalletScheme();
      if (scheme) window.location.href = scheme;
    }, 2000);
  }

  return await txPromise;
}
```

The delay should be about **2 seconds**, not a tiny `0`, `100`, or `300ms` timeout. The delay exists because `writeContractAsync` is not a synchronous "put request in Rainbow" operation. It may do client-side preparation, gas estimation/simulation, chain/session checks, and then publish through the WalletConnect relay before Rainbow has the request in its local queue. If you open Rainbow too early, you recreate the same bug: the user arrives before the request has arrived. Two seconds is a pragmatic buffer that is long enough for the request to be relayed on real mobile networks without making the tap feel abandoned.

Do not hardcode Rainbow just because wagmi says the active connector is `walletConnect`. With WalletConnect v2, wagmi's connector id identifies the transport, not necessarily the selected wallet. The connected wallet might be Rainbow, MetaMask, Trust, Coinbase Wallet, etc.

Use wallet/session metadata instead:

- If the connection came from RainbowKit's specific wallet list, store the selected RainbowKit wallet id/rdns at connect time, for example `rainbow` / `me.rainbow`.
- If the user connected through the generic WalletConnect modal, inspect the WalletConnect provider session, especially `provider.session.peer.metadata` and any `redirect.native` metadata. Match on stable values such as rdns, wallet name, URL, or native redirect.
- Prefer a wallet-provided native redirect when available. Otherwise use a small explicit allowlist, e.g. Rainbow -> `rainbow://`, MetaMask -> `metamask://`, Coinbase Wallet -> `cbwallet://`, Trust -> `trust://`.
- If you cannot identify the wallet with confidence, do not open a hardcoded scheme.

Skip the deep link entirely in these cases:

- The user is already inside a wallet in-app browser or injected-wallet context, commonly detectable with `window.ethereum` / an injected connector. The wallet is already foregrounded.
- The connection is not WalletConnect, such as an injected extension, embedded wallet, Safe app, or a connector SDK that handles its own mobile routing.
- The user is on desktop, or the WalletConnect session was established by desktop/QR with the wallet on another device.
- The active wallet cannot be identified safely. Opening Rainbow for a MetaMask or Trust user is worse than doing nothing.
- There is no browser `window` environment, or the platform is not a mobile browser where native schemes are appropriate.

In short: **publish first, then open the right wallet after a 2 second buffer, and only when the active session is an external mobile WalletConnect wallet.**
