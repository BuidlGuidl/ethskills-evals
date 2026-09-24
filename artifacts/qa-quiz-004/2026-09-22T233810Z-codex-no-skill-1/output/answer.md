# WalletConnect mobile signing with Rainbow

1. **Why nothing auto-opened before the patch**

RainbowKit opens Rainbow during the **connection** flow because the WalletConnect pairing URI is wrapped in Rainbow's mobile link. After the session exists, though, a stake transaction is no longer a pairing flow. `writeContractAsync` sends an `eth_sendTransaction` / contract write request over the WalletConnect v2 relay to the existing session. The wallet receives that as a WalletConnect `session_request` and shows it inside the wallet app.

WalletConnect v2 does not reliably foreground the mobile wallet app for every later signing request. In practice the request is queued in Rainbow, and the dapp page remains in Safari/Chrome unless the user follows a push notification or manually switches apps. That is why users could open Rainbow manually and find the signing request already waiting.

2. **Why `window.location.href = "rainbow://"` first made it worse**

The patch navigates away before the transaction request is created and relayed. On mobile, setting `window.location.href` to a wallet scheme immediately hands control to the OS and foregrounds Rainbow. The JavaScript handler may be paused, killed, or simply never reach the later `writeContractAsync` call in a useful way.

So Rainbow opens, but there is no WalletConnect request yet. The user arrives in the wallet with nothing to sign, and because the dapp never successfully sent the write request, no transaction lands onchain.

3. **Correct pattern**

Fire the contract write first, then open the wallet after a short delay. Do not `await` the write before scheduling the deep link, because the write promise resolves only after the user signs/rejects in the wallet.

```ts
const writeAndOpenWallet = <T>(writeFn: () => Promise<T>): Promise<T> => {
  const promise = writeFn(); // builds/estimates/relays the WalletConnect request

  if (shouldDeepLinkToWallet()) {
    window.setTimeout(openConnectedWallet, 2000);
  }

  return promise;
};

await writeAndOpenWallet(() =>
  writeContractAsync({
    address: stakingAddress,
    abi: stakingAbi,
    functionName: "stake",
    args: [amount],
  }),
);
```

Use about **2 seconds**. The delay is intentional: `writeContractAsync` still has work to do before Rainbow can show anything. It may estimate gas, encode calldata, ask the WalletConnect provider to publish the request, and wait for the relay/wallet side to receive it. A tiny delay like 100-300ms can foreground Rainbow before the request has arrived, reproducing the "wallet opens with nothing to sign" bug. Two seconds is a pragmatic mobile buffer: long enough for the request to be queued, short enough that the tap still feels connected to the wallet opening.

Choosing the wallet link cannot be based only on `connector.id`, because with wagmi the active connector often reports `"walletConnect"` for Rainbow, MetaMask, Coinbase Wallet, Trust, etc. Decide from wallet-specific metadata instead:

- Prefer RainbowKit metadata when available: `(connector as any).rkDetails?.id` / `.name`. For Rainbow this is `rainbow` / `Rainbow`.
- Also check persisted wagmi/RainbowKit recent connector data if your app stores it.
- As a fallback, inspect the WalletConnect v2 session/peer metadata in local storage or provider state and match the wallet name/url/redirect metadata.
- If the detected wallet is Rainbow, use the simple foregrounding scheme `rainbow://`. For other wallets, use their own scheme, such as `metamask://`, `cbwallet://`, or `trust://`. Do not hardcode Rainbow for every WalletConnect session.

Skip the deep link entirely when:

- the user is not on mobile;
- the dapp is already running inside a wallet in-app browser or injected-wallet context, because the wallet UI is already present and opening a scheme can bounce/reload the user;
- the active connector is not WalletConnect, for example an injected/EIP-6963 browser wallet;
- no supported wallet can be identified confidently, because opening the wrong wallet is worse than leaving the request queued;
- the write call fails before the request is sent, such as validation, simulation, wrong network, missing approval, or user-facing form errors.

The invariant is: **send the WalletConnect request first, then after about 2 seconds foreground the same wallet that owns the WalletConnect session, and only do that for mobile WalletConnect sessions that are not already inside a wallet browser.**
