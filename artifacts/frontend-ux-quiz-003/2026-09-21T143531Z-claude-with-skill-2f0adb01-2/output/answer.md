# Review: stake widget

**Verdict: request changes.** The widget decides which buttons to show from `isConnected` and a local boolean. It should decide from chain ID, account and the on-chain allowance. It shows Approve and Stake together, never checks the network, and `hasApproved` is a guess that goes stale.

---

## 1. User on Arbitrum with zero allowance

**What they see:** `isConnected` is true, so both **Approve** and **Stake** show together. Nothing says they are on the wrong network, and there is no Switch Network button. The widget looks ready to use.

**Click Approve:**
- `approve()` sends `approve(staking, amount)` on the chain the wallet is connected to, which is Arbitrum. Unless the write pins `chainId: mainnet.id`, one of two things happens:
  - The token address on Arbitrum has no code, or holds some unrelated contract. The user pays Arbitrum gas and gets **no mainnet allowance**.
  - If the chain is pinned, wagmi throws a chain-mismatch error. The code has no `try/catch` and no error UI, so the user sees nothing.
- If the user rejects the transaction in the wallet, `await` throws. The error is never caught, so nothing is shown. This case at least leaves `hasApproved` false.
- If the wallet returns a tx hash, `setHasApproved(true)` runs right away. That hash only means the tx was *submitted*. It has not been confirmed or even mined, and here it was sent on the wrong chain. The Approve button disappears anyway.
- The button has no disabled or pending state. Double-clicking sends two approve transactions, and the user gets no "Approving…" feedback.

**Click Stake (before or after Approve):**
- On Arbitrum, the call goes to the wrong chain. Either gas estimation fails or the tx reverts or does nothing.
- Even on mainnet it would revert, because the allowance is still 0 (`transferFrom` fails). The user sees a raw wallet or revert error, or nothing, since `stake` has no error handling either. There is also no pending state, so repeated clicks send repeated transactions.

**Result:** the user never gets a path that works. They can pay gas for a useless approve, then face a Stake button that always fails.

---

## 2. The subtle bug: `hasApproved` goes stale

`hasApproved` is a local boolean. It is set when the wallet *returns a hash*, and it is never reset when the account, chain, amount or on-chain allowance changes.

**Concrete sequence (switching account):**
1. The user connects account **A** on mainnet. A has 0 allowance.
2. They click Approve. The wallet returns a hash, `hasApproved = true`, the Approve button is gone, and the tx confirms.
3. In the wallet, they switch to account **B**, which also has 0 allowance. The component stays mounted and `isConnected` stays true, so state is kept.
4. The widget shows **only Stake**. B has no allowance, so Stake always reverts. B has no Approve button, and the only fix is a page reload.

Other sequences with the same result (Stake shown, Approve hidden, allowance too low):
- **Approve fails after submit:** the user clicks Approve, gets a hash, then the tx reverts, is dropped, or is cancelled/replaced from the wallet. `hasApproved` is already true.
- **Wrong chain, then switch:** the user approves while on Arbitrum (flag set), then switches to mainnet. Mainnet allowance is 0.
- **Allowance used up:** the user approves the exact amount, stakes, and the stake uses the allowance. They try to stake again, but the allowance is 0 and the flag is still true.
- **Larger amount:** the user approves 100 and then enters 500. `allowance < amount`, but the flag says "approved".
- **Revoked elsewhere:** the user revokes the allowance in another tab or on revoke.cash.

"Saving an RPC call" is a false saving. The only reliable source for approval status is `allowance(owner, spender)` read from the chain.

---

## 3. What the widget should do

**Only one primary action at a time.** Run the checks in this order and render the first one that matches:

| # | Condition | Render |
|---|---|---|
| 1 | `!isConnected` | **Connect Wallet**: a clickable button that opens the connect modal, not passive text |
| 2 | `chainId !== mainnet.id` | **Switch to Ethereum** (`switchChain({ chainId: mainnet.id })`) |
| 3 | Allowance/balance still loading, or amount empty/invalid | Disabled button with the reason ("Loading…", "Enter amount") |
| 4 | Amount > balance | Disabled button: "Insufficient balance" |
| 5 | `allowance < parsedAmount` | **Approve** |
| 6 | Otherwise | **Stake** |

The network check (2) must run **before** the approval and stake checks. Allowance on another chain means nothing. Approve and Stake are **never** shown together.

**Where approval status comes from:** always the chain, never `useState`.

```ts
const { address, chainId, isConnected } = useAccount();
const amount = parseUnits(input || "0", decimals);

const { data: allowance, refetch: refetchAllowance } = useReadContract({
  address: TOKEN,
  abi: erc20Abi,
  functionName: "allowance",
  args: address ? [address, STAKING] : undefined,
  chainId: mainnet.id,                 // always read mainnet
  query: { enabled: !!address, refetchInterval: 4_000 },
});

const needsApproval = allowance === undefined || allowance < amount;
```

- The query key includes `address` and `chainId`, so changing account or chain refetches automatically. None of the stale cases above can happen.
- Compare against the **current amount** in base units (`parseUnits` with the token's decimals), not against "has approved ever".
- Treat the approval as done only after **confirmation**: `useWaitForTransactionReceipt({ hash })`, check it succeeded, then `refetchAllowance()`. A returned hash proves nothing.

**Pending and error handling (applies to every button):**
- Approve: set `approvalSubmitting` on click and clear it in `finally`, so a rejected tx does not lock the button. Keep the button disabled while waiting for the receipt, and add a short cooldown plus refetch after confirmation so the button does not re-enable before the new allowance is read. Label: "Approving…".
- Stake: use its own `isStaking` state, not a shared `isLoading`. Label: "Staking…". Disable until the receipt arrives, then refetch allowance and balance.
- Pin `chainId: mainnet.id` on both writes.
- Catch errors, translate wallet rejections and custom revert errors into plain messages, and show them next to the button.
- Show amounts in human units with USD context.

---

### Open questions
- Exact-amount approve or unlimited? Exact is safer but the user must approve again each time. Unlimited has a larger risk if the staking contract is compromised.
- Does the token support EIP-2612 `permit`? If so, the approve transaction can be replaced by a signature.
