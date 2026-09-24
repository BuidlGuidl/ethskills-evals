# Review: stake widget

Verdict: **request changes.** The widget checks only `isConnected`. It never checks the network. It shows Approve and Stake together. It gets "approved" from a local flag that is set when the tx is *sent*, not from the chain.

---

## 1. User on Arbitrum (app is mainnet-only), allowance = 0

**What they see:** `isConnected` is true and `hasApproved` is false, so **both** buttons show: `[Approve] [Stake]`. Nothing says they are on the wrong network, and there is no Switch Network button. Nothing shows which button to click first, either.

**Click Approve:**
- The approve call targets the token's *mainnet* address, but the wallet is on chain 42161. One of two things happens:
  - If `approve` passes `chainId: mainnet.id` (or wagmi refuses an unconfigured chain), wagmi throws a chain-mismatch error. The handler has no `try/catch`, so the promise rejection goes unhandled. The user sees no feedback and the button just "does nothing".
  - If it doesn't pin the chain, the wallet signs a tx **on Arbitrum** to that address. Maybe nothing is deployed there, so the call succeeds as a no-op and burns gas. Maybe an unrelated contract lives there. Or it reverts. In every case the mainnet allowance stays 0.
- If the wallet returns a hash, `setHasApproved(true)` runs. The Approve button disappears even though nothing was approved on mainnet.
- If the user rejects in the wallet, `approve()` throws, `setHasApproved` is skipped, and the error goes nowhere.
- There is no disabled or pending state (`Approving...`), so double-clicks send duplicate approvals.

**Click Stake** (before or after Approve):
- On Arbitrum it fails the same way: chain-mismatch error, or a tx sent to the wrong chain or contract.
- Even on mainnet the allowance is 0, so `transferFrom` reverts. Usually the wallet's gas estimate or simulation fails first. The raw revert is either swallowed or shown as a hex error. No pending state, no human-readable error.
- Stake is clickable **while the approve tx is still pending**. `await approve()` resolves on the tx hash, not on the receipt, so a user who clicks Stake right after Approve hits a revert even when everything else is correct.

## 2. The subtler bug: `hasApproved` is stale local state

`hasApproved` means "an approve tx hash came back in this component instance at some point". It is not "allowance ≥ amount on the current chain for the current account". Once it flips to true, nothing sets it back to false. The Approve button is then gone until a page reload, and only a Stake button that is sure to revert is left.

Concrete sequences:

**A. Approve on the wrong chain, then switch (follows from §1):**
1. Connect on Arbitrum. Click Approve, confirm in the wallet. The tx lands on Arbitrum and `hasApproved = true`.
2. Notice the mistake and switch the wallet to Ethereum mainnet. The component stays mounted, so the state survives.
3. The widget shows **only Stake**. Mainnet allowance is 0, so Stake reverts every time, and there is no Approve button to fix it.

**B. The allowance gets used up:**
1. On mainnet, approve exactly 100 tokens (`hasApproved = true`), then stake 100. The allowance is now 0.
2. Enter 50 more and click Stake. It reverts, and Approve is hidden.

**Other ways to reach the same broken state:**
- The approve tx reverts, gets dropped, or is replaced/cancelled with "speed up/cancel" after the hash returned.
- The user switches to a different account in the wallet.
- The user revokes the allowance elsewhere (revoke.cash, another tab).
- The user raises the stake amount above what was approved.

## 3. Correct flow

Render **exactly one primary action**, picked by the first check that matches, in this order:

| # | Condition | Single action shown |
|---|-----------|---------------------|
| 1 | Not connected | **Connect Wallet** (a clickable button, not text) |
| 2 | `chainId !== mainnet.id` | **Switch to Ethereum** (`useSwitchChain`) |
| 3 | Amount empty/zero or above balance | Disabled **Stake** with the reason ("Enter amount" / "Insufficient balance") |
| 4 | `allowance < amount` (read from chain) | **Approve** |
| 5 | Otherwise | **Stake** |

Rules:
- **The network check comes before the approval and action checks.** It gates everything, so we never read the allowance from, or send a tx on, the wrong chain.
- **Never show Approve and Stake at the same time.**
- **Approval status comes from the chain, not local state.** Delete `hasApproved`. Use `useReadContract({ address: TOKEN, abi: erc20Abi, functionName: 'allowance', args: [account, STAKING], chainId: mainnet.id })`, and compare the result to the parsed amount (`parseUnits(amount, decimals)`). The query key includes account and chain, so switching account or chain re-reads it automatically.
- **After approve:** wait for the receipt (`useWaitForTransactionReceipt` / `waitForTransactionReceipt`), then `refetch()` the allowance. Do **not** flip to Stake when the hash comes back. Refetch the allowance after a stake too (it may have gone down), and poll it (or refetch on block) so revokes and other-tab changes show up.
- **Each button gets its own pending state.** Keep `isApproving` and `isStaking` separate. Set them on click, clear them in `finally {}` (so a rejected tx never locks the button), and keep the button disabled with `Approving...` / `Staking...` until the receipt confirms and the allowance/balance refetch finishes. This closes the gap between hash and confirmation and blocks double-submits.
- **Errors:** wrap each action in `try/catch`. Turn wallet rejections and contract reverts into plain messages, and show them inline next to the button.
- Pin `chainId: mainnet.id` on every read and write, so a stray tx can never go to another chain.
