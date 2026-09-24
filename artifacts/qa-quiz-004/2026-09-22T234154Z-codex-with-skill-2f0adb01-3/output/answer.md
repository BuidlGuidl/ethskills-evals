# Mobile WalletConnect deep linking

## 1. Why nothing auto-opened before the patch

RainbowKit is the wallet picker and wagmi connector setup; it is not a mobile app switcher for every later transaction request. Once the user is connected through WalletConnect v2, `writeContractAsync` sends an `eth_sendTransaction` / signing request through the existing WalletConnect session and relay. The request is delivered to the wallet side of that session, and Rainbow may queue it or surface it via its own notification/pending-request UI.

What WalletConnect v2 does not reliably do for a normal transaction request is force iOS/Android to foreground Rainbow. The deep link used during the initial connection is not automatically replayed for every later signing request. So the original behavior makes sense: the dApp did send the request, but the browser stayed foregrounded. When the user manually switched to Rainbow, the request was already waiting there.

## 2. Why `window.location.href = "rainbow://"` made it worse

Putting the deep link as the first line changes the browser location immediately. On mobile, that hands control to the OS and backgrounds or suspends the browser tab before the JavaScript handler reaches `writeContractAsync`.

So Rainbow opens, but no transaction request has been created yet:

```ts
window.location.href = "rainbow://"; // browser leaves now
await writeContractAsync(...);       // often never runs
```

That is why Rainbow appears instantly but shows nothing to sign, and why no transaction lands on Base. The patch opened the wallet before there was any WalletConnect request for the wallet to display.

## 3. Correct pattern

The transaction request must be fired first, and the wallet app should be opened second:

```ts
const writeAndOpenWallet = <T>(writeFn: () => Promise<T>): Promise<T> => {
  const promise = writeFn();          // estimate gas, encode calldata, send via WC relay
  setTimeout(openConnectedWallet, 2000);
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

Do not `await writeContractAsync` before scheduling the deep link, because the promise usually waits for the wallet/user flow to complete. The important ordering is:

1. Start `writeContractAsync`.
2. Let it build and publish the WalletConnect request.
3. After a short delay, open the connected wallet.
4. Return/await the original write promise so success, rejection, and errors still flow through the normal handler.

Use about a 2 second delay. This is intentionally longer than a UI animation delay: `writeContractAsync` may need to estimate gas, encode calldata, and send the JSON-RPC request through the WalletConnect relay before Rainbow has a pending request to show. A few hundred milliseconds is often too fast on mobile networks and slower phones; the user arrives in the wallet before the request has been received.

The deep link must target the wallet the user actually connected. In wagmi, `connector.id` will usually be `"walletConnect"` for Rainbow, MetaMask, Coinbase Wallet, Trust, Phantom, and other WalletConnect wallets, so it is not enough. Treat `connector.id === "walletConnect"` as the transport, then infer the wallet from several places:

```ts
const openConnectedWallet = () => {
  if (typeof window === "undefined") return;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) return;

  // If this exists, the page is usually already inside a wallet browser.
  if (window.ethereum) return;

  const visibleIds = [
    connector?.id,
    connector?.name,
    localStorage.getItem("wagmi.recentConnectorId"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let walletConnectSession = "";
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith("wc@2:client"));
    walletConnectSession = key ? localStorage.getItem(key)?.toLowerCase() ?? "" : "";
  } catch {}

  const haystack = `${visibleIds} ${walletConnectSession}`;

  const scheme =
    haystack.includes("rainbow") ? "rainbow://" :
    haystack.includes("metamask") ? "metamask://" :
    haystack.includes("coinbase") || haystack.includes("cbwallet") ? "cbwallet://" :
    haystack.includes("trust") ? "trust://" :
    haystack.includes("phantom") ? "phantom://" :
    undefined;

  if (scheme) window.location.href = scheme;
};
```

If the WalletConnect provider exposes the current session metadata directly, prefer that over scraping storage: `session.peer.metadata.name`, `url`, and `redirect.native` / `redirect.universal` can identify the wallet. The core point is the same: do not hardcode `rainbow://` just because the failing report came from Rainbow users, and do not expect wagmi's connector id to name the wallet.

Skip the deep link entirely when:

- The user is not on mobile.
- The dApp is already running inside a wallet in-app browser, commonly indicated by `window.ethereum`.
- The active connector is not WalletConnect, such as an injected wallet path that can show its own prompt.
- You cannot confidently identify the connected wallet's scheme. Opening the wrong app is worse than leaving the request queued.
- The code is running during SSR or before `window` / `localStorage` are available.

The rule for every signing button is: fire the write first, then deep link to the correct connected wallet after roughly 2 seconds, and skip the deep link when the browser context does not need or cannot safely use one.
