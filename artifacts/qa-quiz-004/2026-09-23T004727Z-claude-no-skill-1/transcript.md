# Executor transcript — 2026-09-23T004727Z-claude-no-skill-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T004727Z-claude-no-skill-1/qa-quiz-004

## assistant
I'll write the explanation to `answer.md`.

## assistant
- **Bash** `cat > /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T004727Z-claude-no-skill-1/qa-quiz-004/answer.md <<'MDEOF'
# Mobile WalletConnect deep-linking on Scaffold-ETH 2 / Base

## 1. Why nothing au … [15086 more chars]`

  >      209 /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T004727Z-claude-no-skill-1/qa-quiz-004/answer.md

## assistant
Written to `answer.md`. The short version:

**1. Why nothing opened.** WalletConnect v2 delivers the request over a relay — the protocol never foregrounds an app. The app switch is a *UI-layer* behavior that RainbowKit/Web3Modal add, driven by a deep link recorded at connect time (`WALLETCONNECT_DEEPLINK_CHOICE`) plus a navigation. It fails when the user paired by scanning the QR from inside Rainbow (the key was never written), when storage was evicted, or — most subtly — when iOS's transient user activation has already expired, because `writeContractAsync` does gas estimation, nonce, and chain-id round trips before it publishes anything. The request always arrived; only the app switch was missing.

**2. Why the patch is worse.** `window.location.href` fires synchronously, before `writeContractAsync` has published anything, so Rainbow opens to an empty queue. Backgrounding then freezes the tab's JS and its relay socket, so the publish may never go out at all. A bare `rainbow://` also means "launch the app," not "show the pending request," and it's hardcoded for every WalletConnect user — MetaMask/Trust/desktop-QR users get kicked to a dead scheme.

**3. The fix.** Start the write *without* awaiting, deep-link ~120 ms later, then await. Lower bound ~50 ms so the `irn_publish` actually lands; upper bound ~250–300 ms because iOS drops user activation past that and the button reads as broken. Shrink the uncertainty by pre-simulating and gating on `chainId === base.id`, so the handler's only network step is the signing request. Resolve the target from `provider.session.peer.metadata.redirect` (`native`, falling back to `universal`) — that's authoritative, works for QR-initiated sessions, and the wallet is provably installed; `connector.id` only tells you the transport. If nothing resolves, don't guess — show an "Open wallet" button, which carries a fresh gesture. Skip the handoff entirely on desktop, non-WalletConnect connectors, in-app wallet browsers, desktop peers, wallets that declared no `redirect`, already-pending requests, and gasless/read-only paths.

## run stats
- turns: 2
- duration: 129s
- cost: $0.4059535
- tokens in/out: 42878/9415
- of which cache write/read: 15697/27177
