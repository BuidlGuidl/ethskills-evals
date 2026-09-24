# Mobile WalletConnect deep-linking on a Scaffold-ETH 2 dApp

## 1. Why nothing auto-opened before the patch

### What actually happens when you call `writeContractAsync`

Nothing about a WalletConnect v2 transaction request touches the wallet app directly.
The chain of events is:

1. `useScaffoldWriteContract().writeContractAsync(...)` → wagmi → the WalletConnect
   EthereumProvider's `request({ method: "eth_sendTransaction", params: [...] })`.
2. The provider serialises the request, encrypts it with the session's symmetric key,
   and **publishes it to the WalletConnect relay** over its WebSocket.
3. The relay pushes the ciphertext to the wallet's subscription — or, if Rainbow's
   socket is asleep (backgrounded app), queues it and fires a **Web Push / APNs
   notification** so Rainbow can wake up and fetch it.
4. Rainbow decrypts it and adds it to its pending-request queue. That queue is
   rendered as a sheet **the next time the app is foregrounded**.

Step 4 is the whole story. On iOS and Android a backgrounded app **cannot foreground
itself**. There is no API for it, by design. So the request genuinely *is* sitting in
Rainbow — exactly what your users report — and the only thing on earth that can bring
Rainbow to the front is the app that currently *is* in the foreground: the mobile
browser rendering your dApp. It must navigate to a link that the OS resolves to
Rainbow.

### So why didn't RainbowKit / WalletConnect do that redirect for you?

They try. `@walletconnect/sign-client` has a redirect step that runs on every outgoing
request. It looks up where to send the user from two places:

- `session.peer.metadata.redirect` — `{ native: "rainbow://", universal: "https://rnbwapp.com" }`,
  advertised by the wallet at pairing time; and
- `localStorage["WALLETCONNECT_DEEPLINK_CHOICE"]` — written as
  `{"href":"https://rnbwapp.com/","name":"Rainbow"}` when the user picks a wallet
  **through the WalletConnect / RainbowKit mobile-wallet-link flow**.

It then does the equivalent of `window.open(href, "_self")`. Any of the following
kills it, and all of them are common in production:

- **Lost user activation (the most common cause).** iOS Safari and Android Chrome only
  allow a navigation to an external app scheme while the page holds *transient user
  activation* — roughly the first ~1 second after a real tap, and only if no other
  navigation consumed it. `writeContractAsync` is async: by the time the payload is
  built, the chain/account checks pass, gas is estimated (an RPC round-trip to Base!),
  and the relay publish resolves, several hundred milliseconds to several seconds have
  passed. Activation has expired, the browser silently drops the navigation, and no
  error surfaces anywhere. The page "just sits there" — precisely the symptom.
- **`WALLETCONNECT_DEEPLINK_CHOICE` is missing or stale.** It's only written on the tap
  that connects the wallet. A user who connected yesterday and returned today via a
  restored session has a session but no deeplink choice. A custom connect button that
  calls wagmi's `connect()` directly, bypassing the RainbowKit modal, never writes it
  at all.
- **The peer advertised no `redirect`.** Older wallet versions, or a desktop wallet
  paired by QR, ship metadata with no `redirect` block. Nothing to open.
- **Storage was cleared / Safari Private Browsing / ITP eviction**, which wipes the key
  while the WC session itself lives in a different store.

Note the asymmetry that makes this so confusing to debug: **connecting works fine.**
The connect deep link fires synchronously inside the tap handler, with activation
intact, using a URI the modal already has in hand. It's only the *subsequent signing
requests* that lose the race.

## 2. Why the patch made it worse

```ts
window.location.href = "rainbow://";      // ← first line
await writeContractAsync({ ... });        // ← never gets a fair chance
```

Three independent failures, any one of which would be fatal:

1. **You navigate away before the request exists.** `writeContractAsync` hasn't run.
   Nothing has been encrypted, nothing published to the relay. Rainbow opens with an
   empty queue — "nothing to sign", exactly as observed.
2. **Backgrounding the browser suspends the code that was supposed to send it.** The
   moment iOS hands control to Rainbow, Safari is backgrounded: JS timers are throttled
   to near-zero, and the relay WebSocket is suspended and frequently torn down
   (iOS is aggressive about this; a backgrounded WKWebView gets a few hundred ms of
   grace at best). So the `eth_sendTransaction` publish that was *about* to happen is
   stalled mid-flight or dropped. If the user waits in Rainbow, nothing ever arrives;
   the request only limps out when they switch back to the browser and the page
   resumes — by which point they've given up. The transaction never lands.
3. **`rainbow://` with no path is a context-free "just open the app" link.** Even in
   the best case it carries no topic, no request id, no session. It lands on Rainbow's
   home tab rather than deep-linking into a request. It's also a bare custom scheme,
   which is the legacy mechanism: on iOS it can trigger an "Open in Rainbow?" interstitial
   or fail silently if Rainbow isn't installed, and on Android it can throw
   `ActivityNotFoundException` in the browser. Universal links (`https://rnbwapp.com/wc`)
   are what modern wallets publish and what degrades gracefully. And it's hardcoded:
   every non-Rainbow user — MetaMask Mobile, Coinbase Wallet, Zerion, Ledger Live —
   now gets a dead navigation or an App Store page on *every* Stake tap.

The pre-patch bug was "the redirect didn't fire." The patch turned it into "the
redirect fires and prevents the request from ever being sent." Strictly worse: before,
a savvy user could app-switch manually and complete the transaction. Now there is
nothing to complete.

## 3. The correct pattern

### The ordering

**Start the request first, deep-link second, and never `await` in between.**

The subtlety that trips everyone up: you cannot `await writeContractAsync(...)` before
redirecting, because that promise only resolves *after the user has signed* — the
redirect would fire after it's no longer needed. So you fire the promise (keeping the
reference for `.then/.catch`), let the synchronous part of the call stack run — which
is where the provider encrypts and hands the payload to the relay socket — and then
open the wallet from a short timer.

```ts
const handleStake = async () => {
  if (isSubmitting) return;
  setIsSubmitting(true);

  // 1. Resolve the target BEFORE anything async, while user activation is alive.
  const target = await getWalletRedirectTarget(connector); // see below; cheap, usually sync

  // 2. Fire the request. Do NOT await it here.
  const tx = writeContractAsync({
    functionName: "stake",
    args: [amount],
    value: parseEther(amountEth),
  });

  // 3. Hand the wallet the foreground, shortly after.
  if (target) {
    setTimeout(() => {
      window.location.href = target;   // "_self" navigation, not window.open
    }, 150);
  }

  try {
    await tx;                          // resolves when the user signs, in Rainbow
  } catch (e) {
    if (!isUserRejection(e)) notification.error(getParsedError(e));
  } finally {
    setIsSubmitting(false);
  }
};
```

In Scaffold-ETH 2 this belongs in a small wrapper hook (e.g.
`~~/hooks/scaffold-eth/useDeepLinkedWrite`) rather than in every button, so `useScaffoldWriteContract`
call sites stay clean and every write path gets the same behaviour.

### The delay, and why *that* length

150 ms (anything in the **100–300 ms** band) is the right order of magnitude, and both
bounds are real constraints:

- **Lower bound — the request must actually leave the device.** The redirect has to
  come *after* the relay publish, not before. Zero delay (or a redirect on the same
  synchronous tick) reproduces the patch's bug: you background the browser while the
  encrypt-and-publish is still queued. The publish itself is one message on an
  already-open WebSocket — sub-50 ms on a decent connection — but you're also waiting
  for wagmi's synchronous prep and a microtask turn or two. ~100 ms buys comfortable
  margin. A `setTimeout(0)` or `queueMicrotask` is *not* enough; it only yields one turn.
- **Upper bound — transient user activation expires.** Browsers grant roughly **1 second**
  of transient activation after a tap (Chrome's `transient_activation_duration` is
  exactly 5 s for some APIs but ~1 s for the navigation gate; Safari's window is
  shorter and stricter). Push the redirect past that and the navigation is silently
  blocked — you're back to the original bug. Staying well under 500 ms keeps you safely
  inside it. This is also why you must not `await` the gas estimate or a chain switch
  before redirecting: an RPC round-trip to Base can easily eat the entire budget.
- **Perception.** Above ~300 ms the user has already started wondering whether the tap
  registered, which is what makes them mash the button and produce duplicate requests
  (hence the `isSubmitting` guard).

If your flow genuinely needs a slow async step first (a chain switch, an ERC-20 allowance
check), do that step, then require a **second tap** for the signing step so you start
from a fresh activation. Don't try to stretch the timer.

### Choosing the wallet scheme — `connector.id` is useless here

`connector.id === "walletConnect"` for *every* wallet that connects over WalletConnect:
Rainbow, MetaMask Mobile, Trust, Zerion, Uniswap Wallet, Ledger Live. The connector id
identifies the *transport*, not the peer. Hardcoding `rainbow://` is the concrete form
of that mistake.

The peer tells you where it lives. Read it from the live session, in priority order:

```ts
async function getWalletRedirectTarget(connector): Promise<string | null> {
  if (connector?.id !== "walletConnect") return null;

  const provider: any = await connector.getProvider();
  const session = provider?.session ?? provider?.signer?.session;
  const redirect = session?.peer?.metadata?.redirect;

  // 1. Universal link — preferred. Works on iOS 17+, survives the app not being
  //    installed (falls back to the wallet's website instead of an OS error),
  //    and is what wallets keep current.
  if (redirect?.universal) return redirect.universal;

  // 2. Native custom scheme — legacy fallback, still what several wallets ship.
  if (redirect?.native) return redirect.native;

  // 3. What the WalletConnect modal recorded at connect time.
  try {
    const choice = localStorage.getItem("WALLETCONNECT_DEEPLINK_CHOICE");
    if (choice) {
      const href = JSON.parse(choice)?.href as string | undefined;
      if (href) return href;
    }
  } catch { /* private mode / cleared storage */ }

  // 4. Nothing advertised. Do NOT guess a scheme — show in-app guidance instead
  //    ("Open your wallet app to confirm").
  return null;
}
```

Two refinements worth adding:

- **Prefer universal over native on iOS; the reverse is defensible on Android**, where
  intent URLs resolve reliably and universal links sometimes bounce through a chooser.
- **Set your *own* `redirect` in the wagmi connector metadata** so the wallet can send
  the user *back* after signing. Without it, users sign in Rainbow and are stranded
  there while your page waits. In `services/web3/wagmiConnectors.tsx`:

  ```ts
  walletConnect({
    projectId,
    metadata: {
      name: "Your dApp", description: "...", url: "https://yourdapp.xyz",
      icons: ["https://yourdapp.xyz/icon.png"],
      redirect: { native: "yourdapp://", universal: "https://yourdapp.xyz" },
    },
  })
  ```

  Round-tripping is half the UX fix; the deep link out is only half.

### When the deep link must be skipped entirely

Firing it in these cases makes things worse, not better:

1. **Desktop.** Gate on a genuine mobile check (`navigator.maxTouchPoints > 0` plus a UA
   check, or a `matchMedia("(pointer: coarse)")` test). On desktop the peer is an
   extension, a desktop app, or a phone paired by QR — navigating the tab to
   `rainbow://` at best does nothing and at worst pops an OS "open application" dialog
   or blanks the page.
2. **Injected / in-app-browser connectors.** If `connector.id` is `injected`,
   `io.metamask`, `com.coinbase.wallet`, or anything other than `walletConnect`, skip.
   In particular, when the user is browsing *inside Rainbow's own dApp browser*, the
   wallet is the browser: it renders the confirmation sheet natively and instantly.
   Deep-linking there navigates the webview away from your dApp and can destroy the
   page state holding the pending request.
3. **The peer advertised no redirect and there's no stored choice** (case 4 above).
   Silence there is information: the wallet is telling you it can't be foregrounded by
   link. Render an inline hint instead of guessing a scheme.
4. **Popup/iframe-based wallets** — Coinbase Smart Wallet, Privy/Para-style embedded
   wallets, passkey/WebAuthn signers, and Safe apps running in an iframe
   (`window.self !== window.top`). These confirm in-page or in a popup; app-switching
   breaks the popup's opener relationship and kills the flow.
5. **Requests that never reach a human** — read-only calls, `eth_call`, simulations, and
   anything auto-approved by a session key, paymaster, or ERC-4337 flow with a
   pre-authorised signer. No prompt, no reason to switch apps.
6. **The page isn't actually visible** (`document.visibilityState !== "visible"`) or you
   already redirected for this request. Re-firing yanks the user around mid-signature.
7. **When the call fails before dispatch** — wrong chain, insufficient balance, a
   simulation revert. Validate before you fire so you don't send the user to Rainbow to
   look at an empty queue. Note that `switchChain` on Base is *itself* a wallet request
   needing its own deep link, so treat chain switching as its own tap-and-redirect step
   rather than a prelude to the stake.

### Summary

| | Before the patch | After the patch | Correct |
|---|---|---|---|
| Request published to relay | Yes | No / dropped mid-flight | Yes |
| Wallet foregrounded | No (activation expired) | Yes, too early | Yes, ~150 ms later |
| Target chosen from | WC's own (failed) lookup | Hardcoded `rainbow://` | `session.peer.metadata.redirect` |
| Result | Request waits unseen in Rainbow | Rainbow opens empty, tx never lands | Sheet is open when the user arrives |
