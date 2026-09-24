# Mobile WalletConnect staking flow

1. Before the patch, nothing auto-opened because RainbowKit and WalletConnect v2 do not treat a transaction request as an app-switch command.

   On mobile, RainbowKit helps the user create a WalletConnect session. After that session exists, a call like `writeContractAsync` sends an `eth_sendTransaction` JSON-RPC request through the WalletConnect relay to the already-connected wallet. Rainbow receives the session request and shows or queues the signing prompt on its side, but the browser tab stays in front. WalletConnect v2 delivers the request; it does not reliably deep-link the OS back into the wallet app for every later transaction.

   That matches the report: tapping `Stake` did send a signing request, but Safari/Chrome stayed foregrounded. When the user manually switched to Rainbow, the request was waiting there.

2. The patch made it worse because it navigates away before the transaction request is sent.

   `window.location.href = "rainbow://"` is not a harmless notification to the wallet. It immediately asks the OS to leave the browser and open Rainbow. If that runs as the first line of the button handler, the page is backgrounded before `writeContractAsync` has finished building, estimating, encoding, and publishing the WalletConnect request. On mobile, that is a race the dApp usually loses: the user lands in Rainbow, but Rainbow has no new session request yet. The following `writeContractAsync` call may never run, may be paused, or may fail while the browser is in the background. No request means no signature prompt and no onchain transaction.

3. The correct pattern is: start the write, wait briefly, then open the wallet that owns the active WalletConnect session.

   The helper should call the write function first and keep its promise. Only after the request has had time to reach the WalletConnect relay should it deep-link to the wallet:

   ```ts
   async function writeAndOpenWallet<T>(writeFn: () => Promise<T>) {
     const promise = writeFn();

     if (shouldDeepLinkToWallet()) {
       window.setTimeout(() => {
         window.location.href = walletDeepLink;
       }, 2000);
     }

     return await promise;
   }
   ```

   The delay is intentional. `writeContractAsync` is not just a local function call: it may simulate or estimate gas, prepare calldata, send the WalletConnect session request, encrypt it, and publish it through the relay before Rainbow can display it. A very short delay, like 300 ms, can reproduce the same bug in a subtler form: the wallet opens before the request is available. Around 2 seconds is the conservative mobile UX value because it gives the request time to propagate while still feeling immediate to the user. The right verification is on a real phone: tap `Stake`, the wallet opens, and the signing sheet is already there.

   Do not decide the target wallet from `connector.id`. With wagmi, WalletConnect wallets commonly report `connector.id === "walletConnect"` no matter whether the user picked Rainbow, MetaMask, Trust, or another mobile wallet. Instead, use wallet identity captured at connection time or read the active WalletConnect session peer metadata. Store or derive the wallet-specific redirect from that identity, for example Rainbow's native or universal link for a Rainbow session, MetaMask's link for a MetaMask session, and so on. If all you know is `"walletConnect"`, you do not know enough to safely open `rainbow://`.

   The deep link should be skipped entirely when the current flow is not an external mobile-browser WalletConnect flow:

   - The user is on desktop, including a desktop browser connected by QR code.
   - The user is already inside a wallet's in-app browser, because the wallet is already foregrounded and the provider should show the request there.
   - The active connector is not WalletConnect, such as an injected extension, embedded wallet, or smart-wallet flow.
   - The active WalletConnect wallet cannot be identified, or there is no trusted native or universal link for that wallet.
   - The connected wallet is not Rainbow; never hard-code `rainbow://` for every WalletConnect session.

   In short: send the transaction request first, deep-link second, and only deep-link to the wallet the user actually connected.
