# WalletConnect mobile transaction deep linking

## 1. Why nothing auto-opened before the patch

With RainbowKit v2 and WalletConnect v2, connecting to the wallet and sending a transaction are different flows.

The initial connect flow can deep link the user into Rainbow because the user explicitly chose a wallet from RainbowKit's connect UI. After the session is established, a transaction button such as "Stake" does not automatically foreground the wallet app. `writeContractAsync` sends an `eth_sendTransaction` request over the existing WalletConnect v2 session, through the WalletConnect relay, to the connected wallet. Rainbow receives that request and queues/displays it inside the app, often relying on push notification or the user manually switching apps.

So the original behavior was not that the transaction was absent. The request was sitting in Rainbow. The missing piece was app switching: RainbowKit/Wagmi/WalletConnect do not reliably auto-deep-link to the wallet for every later session request on mobile.

## 2. Why the patch made it worse

Putting this first:

```ts
window.location.href = "rainbow://";
await writeContractAsync(...);
```

opens Rainbow before the dapp has created and relayed the signing request.

On mobile, changing `window.location.href` to an app scheme immediately backgrounds or navigates away from the browser tab. That can suspend JavaScript, interrupt the click handler, unmount the page, or prevent the following `writeContractAsync` from running far enough to publish the WalletConnect request. The user lands in Rainbow instantly, but Rainbow has nothing new to sign because the dapp left before the request existed.

It also hardcodes Rainbow. That is only correct for users whose WalletConnect peer is Rainbow. Wagmi's connector can still report `connector.id === "walletConnect"` for Rainbow, MetaMask, Coinbase Wallet, Trust, Phantom, and many others.

## 3. Correct pattern

The correct order is:

1. Start the write first.
2. Let the dapp build the transaction, estimate/simulate as needed, encode calldata, and publish the WalletConnect request.
3. After a real delay, open the connected wallet app.
4. Return/await the original write promise so normal success, rejection, and error handling still work.

Example shape:

```ts
const writeAndOpen = useCallback(
  <T,>(writeFn: () => Promise<T>): Promise<T> => {
    const promise = writeFn();
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

The delay should be about 2 seconds. A tiny delay such as 100-300ms is often too short: `writeContractAsync` may still be doing client-side preparation, gas estimation/simulation, calldata encoding, or relay publishing. If the wallet is opened too early, the user sees the same broken UX as the patch: the wallet is foregrounded before it has received the request. The delay is not for aesthetics; it gives the WalletConnect request time to arrive.

The wallet scheme cannot be chosen from `connector.id` alone. For WalletConnect sessions, Wagmi usually says `"walletConnect"` regardless of the actual wallet. Use multiple signals:

```ts
const openConnectedWallet = useCallback(() => {
  if (typeof window === "undefined") return;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) return;

  // If we are already inside a wallet browser, do not deep link away.
  if (window.ethereum) return;

  const localHints = [
    connector?.id,
    connector?.name,
    localStorage.getItem("wagmi.recentConnectorId"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let wcHints = "";
  try {
    const wcKey = Object.keys(localStorage).find(key => key.startsWith("wc@2:client"));
    if (wcKey) wcHints = (localStorage.getItem(wcKey) || "").toLowerCase();
  } catch {
    // localStorage may be unavailable in some browser modes.
  }

  const search = `${localHints} ${wcHints}`;

  const schemes: Array<[string[], string]> = [
    [["rainbow"], "rainbow://"],
    [["metamask"], "metamask://"],
    [["coinbase", "cbwallet"], "cbwallet://"],
    [["trust"], "trust://"],
    [["phantom"], "phantom://"],
  ];

  for (const [keywords, scheme] of schemes) {
    if (keywords.some(keyword => search.includes(keyword))) {
      window.location.href = scheme;
      return;
    }
  }
}, [connector]);
```

In production code, prefer a small helper around this idea and wrap every WalletConnect write path with it: approve, stake, claim, withdraw, batch actions, etc. Use simple app-opening schemes like `rainbow://`, not deep links that reload the dapp inside the wallet.

Skip the deep link entirely when:

- The user is not on mobile.
- The dapp is already running inside a wallet in-app browser, commonly detectable with `window.ethereum`.
- The active connector is not an external WalletConnect mobile wallet, such as an injected desktop extension or an embedded/smart account flow that handles signing in-page.
- The connected WalletConnect wallet cannot be identified. Do not guess and open Rainbow for everyone.
- You are in SSR or any environment where `window`, `navigator`, or `localStorage` is unavailable.

The invariant is: create the WalletConnect request first, open the correct wallet second, and do nothing when app switching is unnecessary or unsafe.
