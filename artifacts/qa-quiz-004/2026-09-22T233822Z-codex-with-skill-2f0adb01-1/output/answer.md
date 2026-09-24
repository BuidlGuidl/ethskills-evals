# WalletConnect/Rainbow mobile staking failure

## 1. Why nothing auto-opened before the patch

The original behavior was annoying, but it was consistent with how RainbowKit and WalletConnect v2 work.

RainbowKit uses deep links during the connection flow. When the user chooses Rainbow from the RainbowKit modal on mobile, RainbowKit builds a wallet-specific WalletConnect URI and sends the user to Rainbow so the session can be approved. After that session exists, the dApp is connected through a generic WalletConnect transport.

When the user later taps `Stake`, `writeContractAsync` does not ask RainbowKit to open the Rainbow app again. It asks wagmi/viem to send an EIP-1193 JSON-RPC request through the active connector. With WalletConnect v2, that becomes a WalletConnect `session_request` such as `eth_sendTransaction` on the existing session topic. The request is published over the WalletConnect relay to the wallet. The wallet can then show the approval UI when it receives the request.

That transport step is not an OS app-launch step. WalletConnect does not automatically bring the peer wallet app to the foreground for every transaction, and RainbowKit does not automatically deep-link on every `writeContractAsync`. So the mobile browser stayed on the dApp. The request was real, but it was waiting inside Rainbow until the user manually switched apps.

Base is not the interesting part of this bug, except that the request should be sent on the Base chain namespace, for example `eip155:8453`. The broken part is app foregrounding, not contract execution.

## 2. Why `window.location.href = "rainbow://"` made it worse

The patch put the app switch before the WalletConnect request:

```ts
window.location.href = "rainbow://";
await writeContractAsync(...);
```

That reverses the required order. On mobile, assigning `window.location.href` to a native app scheme can immediately hand control to the OS and suspend or background the browser tab. Once that happens, the rest of the click handler is no longer reliable. The call to `writeContractAsync` may not run at all, or it may start but fail to finish the important parts: building the JSON-RPC request, persisting the WalletConnect state, publishing to the relay, and flushing the WebSocket message.

Also, `rainbow://` does not contain a transaction. It is only an instruction to foreground Rainbow. Rainbow cannot show a signing sheet unless the dApp has already published a pending WalletConnect `session_request`. The patch opens Rainbow faster, but it opens it before there is anything for Rainbow to sign.

## 3. Correct pattern

Start the WalletConnect request first. Do not `await` it before opening the wallet, because the promise resolves only after the user approves or rejects in the wallet. Keep the promise, wait briefly, then foreground the correct wallet app.

```ts
const MOBILE_WALLET_OPEN_DELAY_MS = 1000;

async function onStake() {
  const txPromise = writeContractAsync({
    address: stakingAddress,
    abi: stakingAbi,
    functionName: "stake",
    args: [amount],
    chainId: base.id,
  });

  const walletUri = await getMobileWalletForegroundUri();

  const openTimer =
    walletUri === undefined
      ? undefined
      : window.setTimeout(() => {
          if (document.visibilityState === "visible") {
            window.location.href = walletUri;
          }
        }, MOBILE_WALLET_OPEN_DELAY_MS);

  try {
    return await txPromise;
  } catch (error) {
    if (openTimer !== undefined) window.clearTimeout(openTimer);
    throw error;
  }
}
```

The one-second delay is intentional. It is not waiting for the wallet to sign. It gives the browser enough time to let wagmi/viem hand the request to the WalletConnect provider, create the JSON-RPC request id, persist session/request state, publish the message, and let the relay/WebSocket work happen before the browser is backgrounded. A very short delay, like `0ms` or `100ms`, is still race-prone on real mobile networks and slower devices. A much longer delay feels broken. In practice, use roughly `750ms` to `1000ms`, test on iOS and Android, and prefer the conservative end for production.

The URI must be chosen from the actual connected wallet, not from `connector.id` alone. With RainbowKit wallets that use WalletConnect, wagmi often reports the transport connector as:

```ts
connector.id === "walletConnect"
```

That does not mean "Rainbow". It means "this account is connected over WalletConnect". The app still needs to know which wallet is on the other side.

Use one of these, in this order:

1. If the active connector was created by RainbowKit, read RainbowKit's wallet metadata, for example `connector.rkDetails?.id` / `connector.rkDetails?.name`. For Rainbow this should identify the wallet as `rainbow`.
2. If needed, inspect the WalletConnect provider session peer metadata, for example `provider.session?.peer?.metadata`. Prefer a wallet-provided redirect/native URI if the session exposes one.
3. If neither gives a trusted answer, use an explicit allowlist that maps known wallet ids/names to schemes. For this incident, only open `rainbow://` when the connected WalletConnect peer is actually Rainbow.

Do not infer Rainbow from `walletConnect`. A user connected through the generic WalletConnect option may be using Rainbow, MetaMask, Trust, Rabby, or something else. Opening Rainbow for a non-Rainbow session is at best confusing and at worst breaks the signing flow.

Skip the deep link entirely when any of these are true:

- The user is not on a mobile browser.
- The active connector is not WalletConnect.
- The dApp is already running inside a wallet in-app browser or injected wallet context, such as Rainbow's in-app browser or extension.
- The selected WalletConnect peer is unknown, generic, or not in your scheme allowlist.
- The flow is using a QR-code desktop WalletConnect session.
- The transaction path does not require a wallet prompt, such as a relayed/account-abstraction flow that is not waiting on the user's mobile wallet.
- The user is already in the wallet app context or the page is no longer visible.

So the fix is not "deep-link to Rainbow before staking". The fix is "publish the WalletConnect transaction request first, then, after a short delay, foreground the specific connected wallet if and only if the current environment needs that foregrounding."

References:

- WalletConnect Sign API handles transaction/message approvals as session requests over an established session: https://github.com/WalletConnect/walletconnect-docs/blob/main/docs/api/sign/wallet-usage.md
- wagmi's WalletConnect connector id is the generic `walletConnect` transport: https://github.com/wevm/wagmi/blob/main/packages/connectors/src/walletConnect.ts
- RainbowKit's Rainbow wallet connector uses WalletConnect when Rainbow is not injected and builds Rainbow-specific mobile URIs for connection: https://github.com/rainbow-me/rainbowkit/blob/main/packages/rainbowkit/src/wallets/walletConnectors/rainbowWallet/rainbowWallet.ts
- RainbowKit attaches its own wallet metadata as `rkDetails` around wallet connectors: https://github.com/rainbow-me/rainbowkit/blob/main/packages/rainbowkit/src/wallets/connectorsForWallets.ts
