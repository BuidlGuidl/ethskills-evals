1. Before the patch, the transaction request was probably being sent correctly, but nothing in WalletConnect v2 requires the OS to foreground the wallet app for an already-established session.

RainbowKit helps the user create the WalletConnect session: on mobile, choosing Rainbow during connect can open Rainbow with the pairing URI. After that, a contract write is different. `writeContractAsync` asks wagmi's WalletConnect connector to send an `eth_sendTransaction` session request over the WalletConnect relay. Rainbow receives that request as the connected peer wallet and displays or queues the signing prompt inside Rainbow. WalletConnect delivers the request; it does not automatically deep link back into Rainbow for every later transaction. RainbowKit also does not auto-open Rainbow for each write. So the browser page appears to sit still, while the signing request is waiting in Rainbow if the user manually switches apps.

2. The patch made the race deterministic in the wrong direction.

`window.location.href = "rainbow://"` runs before `writeContractAsync`, so Safari/Chrome starts leaving the dApp and foregrounding Rainbow before the dApp has done the work needed to create the request. A WalletConnect write is not just a synchronous function call: wagmi/viem may estimate gas, encode the calldata, call RPC, and publish an encrypted JSON-RPC request through WalletConnect. Once the browser is backgrounded, that async work can be paused or abandoned before the request reaches Rainbow. The result is exactly what users saw: Rainbow opens instantly, but there is no pending request to sign, and no transaction can land.

It also hardcodes the wallet. `rainbow://` is only correct if the active WalletConnect peer is Rainbow. wagmi's `connector.id` being `"walletConnect"` only says which transport connector is in use; it does not identify the actual wallet app.

3. The correct pattern is: start the write first, then open the correct wallet after a short, deliberate delay.

The handler should synchronously create the write promise, schedule the wallet deep link, and then await/return the original promise for normal loading and error handling:

```ts
const writeAndOpenWallet = async () => {
  const promise = writeContractAsync({
    address: stakingAddress,
    abi: stakingAbi,
    functionName: "stake",
    args: [amount],
    chainId: base.id,
  });

  if (shouldOpenMobileWallet()) {
    window.setTimeout(() => {
      const url = getConnectedWalletDeepLink();
      if (url) window.location.href = url;
    }, 2000);
  }

  return promise;
};
```

Do not `await writeContractAsync` before scheduling the deep link, because the promise will not resolve until the wallet interaction completes. Also do not deep link before calling it. The 2 second delay is intentional: the dApp needs time to estimate gas, build the transaction request, publish it through WalletConnect, and give Rainbow time to receive/index the pending request. Very short delays, such as 100-300ms, commonly open the wallet before the request is visible. Two seconds is a conservative mobile delay that trades a little latency for reliability; tune it only with real-device WalletConnect testing.

To decide which scheme to open, do not use `connector.id` alone. For WalletConnect sessions it will usually be `"walletConnect"` for Rainbow, MetaMask, Coinbase Wallet, Trust, and others. Use wallet identity from the connection flow or the active WalletConnect session peer metadata, then map that wallet to its foregrounding link:

```ts
const walletLinks: Record<string, string> = {
  rainbow: "rainbow://",
  metamask: "metamask://",
  coinbase: "cbwallet://",
  trust: "trust://",
};
```

In practice, persist the selected RainbowKit wallet id/name when the user connects, or inspect the WalletConnect peer metadata after connection, for example the peer name/url/redirect metadata exposed by the provider session. Normalize that to a known wallet id, then open only that wallet's scheme. If the wallet cannot be identified, skip the deep link and show a small "Open your wallet to sign" state instead of opening the wrong app.

Skip the deep link entirely when:

- The user is not on a mobile browser.
- The active connector is not WalletConnect, such as an injected extension or injected in-app browser provider.
- The dApp is already running inside a wallet's in-app browser, including Rainbow's browser; the wallet is already foregrounded and WalletConnect is unnecessary there.
- The wallet cannot be identified confidently from connect-time state or WalletConnect peer metadata.
- The write was not actually started because validation failed, the user is disconnected, the app is on the wrong chain, or the action is disabled.

So the fix is not "open Rainbow on click." The fix is "send the WalletConnect request, wait long enough for the wallet to have it, then foreground the same wallet the user actually connected with, and only in the mobile WalletConnect browser case."
