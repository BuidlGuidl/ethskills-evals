# Review: stake widget

**Verdict: request changes.** The only check is `isConnected`, and approval is tracked with a local flag, `hasApproved`, that nothing ever corrects. So the widget shows buttons the contracts will reject.

## 1. User on Arbitrum with zero allowance

**What they see:** two buttons at once, **Approve** and **Stake**. Nothing says they are on the wrong network, and there is no **Switch Network** button. `isConnected` is true on any chain.

**Clicking Approve:**
- `approve()` sends the tx on the wallet's *current* chain, Arbitrum, unless the call pins `chainId`. The mainnet token address on Arbitrum is either empty, which gives a "successful" no-op, or a different contract. The user pays Arbitrum gas and gets **no mainnet allowance**.
- If the call does pin `chainId: mainnet.id`, wagmi throws a chain-mismatch error, or with some wallets it pops a switch prompt. There is no `try/catch`, so the error goes unhandled and nothing is shown to the user.
- The await resolves as soon as the tx is *sent* (a hash comes back), not when it is mined. So `setHasApproved(true)` runs, the Approve button disappears, and the widget acts as if approval is done. Onchain, the mainnet allowance is still 0.
- The button has no disabled or pending state, so double-clicking sends duplicate approvals.

**Clicking Stake:**
- If it goes to Arbitrum, the tx hits the wrong contract or address, and it reverts or does nothing. Gas is wasted.
- Even on mainnet it would revert, because `transferFrom` fails with a zero allowance.
- Stake is clickable before any approval exists, so Approve and Stake are shown together. That is exactly the mix this flow must avoid.
- There is no pending state and no readable error message.

## 2. The subtler bug: `hasApproved` goes stale

`hasApproved` is only ever set to `true`. Nothing resets it when chain state changes, so after any of these sequences the widget shows **only Stake**, and Stake is sure to revert. The user also has no way to approve again without reloading the page.

**Main sequence (the allowance gets used up):**
1. User on mainnet enters 100 and clicks Approve. The wallet approves exactly 100, which is the default in many wallets and a common dApp pattern. `hasApproved` becomes `true`.
2. User stakes 100. The stake uses up the allowance, which goes back to 0.
3. User enters 50 and clicks **Stake**. The tx reverts (insufficient allowance). No Approve button appears, because `hasApproved` is still `true`.

**Other sequences that end the same way:**
- **Account switch:** account A approves, then the user switches to account B in the wallet. The component doesn't remount, so `hasApproved` stays `true`. B has zero allowance, sees only Stake, and it reverts.
- **Approval tx fails after sending:** the user clicks Approve, and the hash comes back, so the flag is set. Then the tx fails or is dropped, or the user replaces it with "cancel"/"speed up" to 0 in the wallet. The allowance stays 0 and only Stake is shown.
- **Revoked elsewhere:** the user revokes the approval in another tab (for example revoke.cash). The flag still says approved.
- **The Arbitrum case from §1:** approving on the wrong chain sets the flag with no mainnet allowance.

The root cause is the same in every case. The flag remembers an *event* (a tx was sent), but what matters is *state* (the current allowance for this owner, this spender, this chain, and this amount).

## 3. Correct flow

Show **exactly one primary button**. Run the checks in this order and stop at the first one that matches:

| # | Condition | Button shown |
|---|-----------|--------------|
| 1 | `!isConnected` | **Connect Wallet** (a clickable button that opens the connect modal, not passive text) |
| 2 | `chainId !== mainnet.id` | **Switch to Ethereum** (`useSwitchChain().switchChain({ chainId: mainnet.id })`) |
| 3 | No valid amount, or amount > balance | Disabled button: "Enter amount" / "Insufficient balance" |
| 4 | `allowance < parsedAmount` (allowance still loading counts as "not ready": show disabled or a spinner) | **Approve** → "Approving..." |
| 5 | Otherwise | **Stake** → "Staking..." |

The network check (2) must come before the approval and stake checks. Approval and stake status mean nothing on the wrong chain.

**Where approval status comes from:** always from fresh onchain state, never from a local flag.

```ts
const { data: allowance, refetch } = useReadContract({
  address: TOKEN, abi: erc20Abi, functionName: 'allowance',
  args: [address!, STAKING], chainId: mainnet.id,
  query: { enabled: !!address },
});
const needsApproval = allowance === undefined || allowance < parsedAmount;
```

- Compare the allowance against the **amount being staked**, not just "is it more than 0".
- The query key includes the owner address and `chainId`. Switching account or chain therefore re-reads the allowance on its own.
- After the approve **receipt** confirms (`useWaitForTransactionReceipt`), call `refetch()`. Do the same after a stake. Also poll or watch blocks at about 2–5s intervals, so changes made elsewhere (such as a revoke) show up.

**Button behavior:**
- Pin `chainId: mainnet.id` on both writes.
- Each action gets its own pending state. The button disables as soon as it is clicked and stays disabled until the tx is *confirmed*, not just until the hash comes back.
- For Approve, cover two gaps. First, click → confirmation: set a "submitting" state on click and clear it in `finally`, so a rejected tx doesn't lock the button forever. Second, confirmation → refetched allowance: add a short cooldown, then refetch.
- Wrap calls in `try/catch/finally` and show readable errors next to the button (user rejected, revert reason). Never fail silently.
- Delete `hasApproved` entirely.
