# Mobile WalletConnect signing with Rainbow

1. Before the patch, nothing auto-opened because RainbowKit and WalletConnect v2 do not foreground the mobile wallet for every later transaction request.

   After the user has connected through WalletConnect, the dApp has an approved WalletConnect session. When the user taps `Stake`, wagmi/RainbowKit sends an `eth_sendTransaction` request through that session. In practice that means `writeContractAsync` builds the transaction, estimates gas as needed, encodes the calldata, and publishes an encrypted JSON-RPC request over the WalletConnect relay. Rainbow receives that request as a WalletConnect session request. The request can appear in Rainbow, and Rainbow may rely on push notification or the user manually switching apps, but the protocol request itself is not an OS-level app switch.

   So the old behavior makes sense: the signing request was delivered and was waiting inside Rainbow, but Safari/Chrome/the dApp tab stayed in front. RainbowKit handled the connection UX, but it did not automatically deep-link Rainbow on this later `Stake` request.

2. The patch made it worse because it deep-linked before the transaction request existed.

   `window.location.href = "rainbow://"` immediately asks the browser to leave the dApp and foreground Rainbow. On mobile, once that happens, the browser tab is backgrounded and JavaScript execution can be paused, throttled, or abandoned before the following `writeContractAsync` has actually published the WalletConnect request.

   The result is exactly what users saw: Rainbow opens instantly, but there is no signing request there. The dApp navigated away first, so the WalletConnect request never reliably made it through the relay. A deep link is only a nudge to switch apps; it is not the transaction request.

3. The correct pattern is: start the write first, then deep-link the correct wallet after a delay.

   Use a wrapper around every write that needs a wallet signature:

   ```ts
   const writeAndOpenWallet = useCallback(
     <T>(writeFn: () => Promise<T>): Promise<T> => {
       const promise = writeFn(); // starts gas estimation, calldata encoding, and WC relay publish

       setTimeout(() => {
         openConnectedMobileWallet();
       }, 2000);

       return promise;
     },
     [openConnectedMobileWallet],
   );

   await writeAndOpenWallet(() =>
     writeContractAsync({
       address: stakingAddress,
       abi: stakingAbi,
       functionName: "stake",
       args: [amount],
       chainId: base.id,
     }),
   );
   ```

   The order matters: the WalletConnect request must be in flight before the dApp backgrounds itself. The delay should be about 2 seconds. That is long enough for `writeContractAsync` to do the preflight work and for the WalletConnect client to publish the request to the relay. A tiny delay, like 200-300ms, is often too short; the user arrives in Rainbow before Rainbow has received anything. Much longer than 2 seconds starts to feel broken.

   Do not decide the wallet from `connector.id` alone. With wagmi, a Rainbow connection made through WalletConnect still reports `connector.id === "walletConnect"`. That tells you the transport, not the peer wallet. Use the actual connected wallet metadata:

   - Prefer WalletConnect session peer metadata if available from the provider/session, especially `peer.metadata.name` and `peer.metadata.redirect.native` or `peer.metadata.redirect.universal`.
   - Also check RainbowKit/wagmi persisted wallet hints, such as the recent connector/wallet id.
   - As a fallback, inspect WalletConnect v2 client/session data in localStorage for the peer wallet name or redirect metadata.
   - Only then map known wallets to simple app-opening schemes, for example `rainbow://`, `metamask://`, `cbwallet://`, `trust://`, or `phantom://`.

   The helper should open the wallet the user actually connected, not always Rainbow:

   ```ts
   function openConnectedMobileWallet() {
     if (typeof window === "undefined") return;

     const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
     if (!isMobile) return;

     // Already inside a wallet browser or using an injected provider. Do not bounce.
     if (window.ethereum) return;

     const haystack = [
       connector?.id,
       connector?.name,
       localStorage.getItem("wagmi.recentConnectorId"),
       findWalletConnectSessionText(),
     ]
       .filter(Boolean)
       .join(" ")
       .toLowerCase();

     const schemes: Array<[string[], string]> = [
       [["rainbow"], "rainbow://"],
       [["metamask"], "metamask://"],
       [["coinbase", "cbwallet"], "cbwallet://"],
       [["trust"], "trust://"],
       [["phantom"], "phantom://"],
     ];

     const match = schemes.find(([keywords]) =>
       keywords.some(keyword => haystack.includes(keyword)),
     );

     if (!match) return; // Unknown wallet: do not guess.

     window.location.href = match[1];
   }
   ```

   Skip the deep link entirely in these cases:

   - The user is not on mobile.
   - The user is already inside a wallet in-app browser or any injected-provider flow exists, such as `window.ethereum`.
   - The connected wallet is not a WalletConnect mobile-wallet flow.
   - The wallet cannot be identified reliably. Opening Rainbow for a MetaMask, Coinbase, Trust, or Phantom user is worse than doing nothing.
   - The write is not actually going to be sent, for example the user is disconnected, on the wrong chain, missing approval, or validation failed.
   - The flow is desktop QR-to-phone WalletConnect. The dApp browser should not try to open a wallet app on the desktop.

   The mental model is simple: WalletConnect carries the signing request; the deep link only brings the already-connected wallet to the foreground. Send first, wait about 2 seconds, then open the correct wallet, and only in mobile cases where switching apps is actually needed.
