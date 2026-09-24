# Mobile WalletConnect transaction deep linking

1. Before the patch, nothing auto-opened because RainbowKit and WalletConnect v2 had already done their mobile deep-linking job during connection. Once the WalletConnect session exists, a later `writeContractAsync` does not automatically foreground Rainbow. It sends an `eth_sendTransaction` request through the WalletConnect session/relay to the connected wallet. Rainbow receives that request and shows it as pending inside the app, but the browser stays in front unless the wallet sends a push notification or the dApp explicitly opens the wallet. So the request was not lost: it was sitting in Rainbow, which is exactly what users saw when they manually switched apps.

2. The patch made it worse because it opened Rainbow before creating the signing request. `window.location.href = "rainbow://"` immediately navigates the mobile browser away from the page and foregrounds Rainbow. The following `writeContractAsync` call may never run, may be interrupted, or may lose the time it needs to estimate gas, encode calldata, and publish the WalletConnect JSON-RPC request. The user arrives in Rainbow before any transaction request has been relayed, so there is nothing to sign and no transaction can land onchain.

3. The correct pattern is: fire the write first, then deep-link to the connected wallet after a delay.

```typescript
const writeAndOpen = useCallback(
  <T,>(writeFn: () => Promise<T>): Promise<T> => {
    const promise = writeFn(); // starts gas estimation + WalletConnect relay publish
    setTimeout(openConnectedWallet, 2000);
    return promise;
  },
  [openConnectedWallet],
);

await writeAndOpen(() =>
  writeContractAsync({
    address: stakingAddress,
    abi: stakingAbi,
    functionName: "stake",
    args: [amount],
  }),
);
```

Do not `await writeContractAsync` before opening the wallet, because that promise needs the user to sign before it can resolve. Also do not open the wallet before calling it. Start the promise, schedule the wallet switch, then return or await the same promise so normal error handling still works.

The delay should be long enough for wagmi/viem and WalletConnect to prepare and relay the request before the browser is backgrounded. A good default is about 2 seconds. Very short delays like 300ms are too racy on mobile because the request may still be doing gas estimation, calldata encoding, session lookup, or relay publication when the app switch suspends the browser.

Choosing the wallet scheme cannot rely on `connector.id`. For Rainbow, MetaMask, Coinbase Wallet, Trust, Phantom, and similar wallets connected through WalletConnect, wagmi often reports the connector as `"walletConnect"` because that is the transport connector, not the wallet brand. Use multiple hints:

- `connector.name`
- `connector.id`
- wagmi's recent connector storage
- WalletConnect v2 session/client data in `localStorage`, commonly under keys like `wc@2:client...`

Build a lowercase searchable string from those sources and map wallet keywords to simple app schemes:

```typescript
const schemes: [string[], string][] = [
  [["rainbow"], "rainbow://"],
  [["metamask"], "metamask://"],
  [["coinbase", "cbwallet"], "cbwallet://"],
  [["trust"], "trust://"],
  [["phantom"], "phantom://"],
];
```

Only open a scheme when you can identify the connected wallet. Opening `rainbow://` unconditionally is wrong because a WalletConnect user may have connected with MetaMask, Coinbase Wallet, Trust, Phantom, or another wallet.

Skip the deep link entirely when it is not needed or would be harmful:

- Skip on desktop.
- Skip when the dApp is already inside a wallet's in-app browser, commonly detectable with `window.ethereum`; the wallet is already the active environment.
- Skip for injected/browser-extension connections where there is no separate mobile wallet app to foreground.
- Skip when the connected wallet cannot be identified confidently.
- Skip during server-side rendering or any non-browser context.

This helper should wrap every write that needs a wallet confirmation: stake, approve, claim, withdraw, batch actions, and any other transaction button. The invariant is always the same: send the WalletConnect request first, wait long enough for it to reach the wallet, then open the wallet that actually owns the active WalletConnect session.
