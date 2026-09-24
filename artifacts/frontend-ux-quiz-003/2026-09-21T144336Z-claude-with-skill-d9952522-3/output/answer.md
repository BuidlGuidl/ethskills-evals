# Review: stake widget

Verdict: **request changes.** The widget only checks "is a wallet connected". It ignores which chain the wallet is on, it ignores the amount, and it trusts a local flag over the real onchain allowance. So it shows buttons that cannot work.

---

## 1. User on Arbitrum with zero allowance

**What they see:** two buttons side by side, **Approve** and **Stake**. There is no network warning and no "Switch to Ethereum" button. The only check is `isConnected`, and that is true. Nothing says which button to press first, or that neither will work on this chain.

**Click Approve:** what happens depends on how `approve` calls wagmi. Every version is bad:
- **No `chainId` passed:** wagmi sends the tx on the wallet's current chain (Arbitrum) to the **mainnet** token address.
  - If there is no contract at that address on Arbitrum, the tx still succeeds as a plain call to an empty address. The user pays gas and nothing happens.
  - If a different contract lives there, the tx does something unintended or reverts.
- **`chainId: mainnet.id` passed:** wagmi throws a chain-mismatch error. The code has no `try/catch` and no error display, so the click silently does nothing (an unhandled promise rejection).
- **In every case:** if the wallet returns a hash, `setHasApproved(true)` runs. The Approve button disappears even though no approval exists on mainnet.
  - If `approve` is the fire-and-forget `writeContract` rather than `writeContractAsync`, `await` resolves at once. Then the flag flips **even if the user rejects the request in the wallet**.
- There is no pending state, so a user can double-click and send two approve txs.

**Click Stake:** same chain problem. On Arbitrum it either goes to the wrong contract or throws a mismatch error that nobody catches.

Even on mainnet with zero allowance, `stake` would revert at `transferFrom`. The wallet shows a "this transaction will likely fail" warning or a raw gas-estimation error. The UI shows no message and no pending state.

---

## 2. The subtler bug: `hasApproved` goes stale

`hasApproved` records that "an approve tx was *sent* once, in this component instance". It does not mean "this account currently has enough allowance on this chain for this amount". Several ordinary sequences make them differ.

**Main example: the allowance gets used up.**
1. User on mainnet enters 100, clicks **Approve**, and the dApp approves exactly 100 (not unlimited, as it should). The approve confirms and `hasApproved = true`. The Approve button disappears.
2. User clicks **Stake** for 100. It succeeds, and `transferFrom` uses the whole allowance, so it is now **0**.
3. User enters 50 and clicks **Stake**. Only the Stake button is shown, because `hasApproved` is still `true`. The tx reverts (or the wallet warns it will fail). There is no Approve button to recover with, only a page reload.

**Other sequences with the same result (Stake shown alone, can't work):**
- **Account switch:** approve with account A. Then switch to account B in the wallet. The component doesn't remount, so `hasApproved` stays `true`, but B's allowance is 0.
- **Wrong-chain approve:** approve on Arbitrum as in section 1 (the flag flips). Then switch to mainnet. Only Stake is shown, and there is no mainnet allowance.
- **Approve never lands:** the tx is sent, the flag flips, and then the tx is dropped, replaced ("cancel" / speed-up in the wallet), or reverts. The flag is set on *hash*, not on a successful receipt.
- **Amount goes up:** approve 100, then enter 500. The flag doesn't compare against the amount.
- **Allowance revoked** elsewhere (revoke.cash, another tab). The flag never learns about it.

The opposite also happens: after a reload, `hasApproved` resets to `false`. Then a user who already has enough allowance is shown Approve again and pays for a pointless approve tx.

"Saving an RPC call" buys nothing here. wagmi caches the read, and one `allowance()` call is far cheaper than a reverted tx.

---

## 3. Flow the widget should implement

Always render **exactly one primary button**. Run the checks in this order, top to bottom, and stop at the first one that matches:

| # | Condition | Button |
|---|-----------|--------|
| 1 | `!isConnected` | **Connect wallet** |
| 2 | `chainId !== mainnet.id` | **Switch to Ethereum** (`switchChain({ chainId: mainnet.id })`) |
| 3 | amount empty / not a number / ≤ 0 | disabled: "Enter an amount" |
| 4 | amount > token balance | disabled: "Insufficient balance" |
| 5 | allowance or balance read still loading / errored | disabled: "Checking allowance…" (or the error + retry) |
| 6 | `allowance < parseUnits(amount, decimals)` | **Approve** |
| 7 | otherwise | **Stake** |

While a tx is in flight, that same single button becomes a disabled "Approving…" / "Staking…":
- Hold the pending state from the click, through the receipt, **and** through the refetch of allowance and balance.
- `isPending` alone clears as soon as the wallet returns the hash, which is too early.
- Clear the pending state in `finally`, so a wallet rejection can't lock the button.
- Check `receipt.status === 'success'`.
- Show wallet errors and reverts as plain text next to the button.

**Where approval status comes from:** a fresh onchain read, and nowhere else. Never a local flag.

```ts
const { data: allowance, refetch: refetchAllowance } = useReadContract({
  address: TOKEN,
  abi: erc20Abi,
  functionName: 'allowance',
  args: address ? [address, STAKING] : undefined,
  chainId: mainnet.id,
  query: { enabled: !!address },
});
const needsApproval = allowance === undefined || allowance < parsedAmount;
```

- Because the query key includes `address` and `chainId`, switching account or chain gives a fresh result automatically.
- After the approve receipt, and again after the stake receipt, `await refetchAllowance()` (and refetch the balance) before the button moves on to the next step.
- All writes pass `chainId: mainnet.id`. Step 2 already guarantees the wallet is on mainnet by the time they can be clicked.
- Parse amounts with the token's real `decimals`.

Delete `hasApproved` entirely.
