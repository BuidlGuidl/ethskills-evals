# What happened

The code treats `writeContractAsync(approveArgs)` as if it means "approval is complete." In wagmi v2 it only means the write mutation completed, i.e. the wallet request produced or failed to produce a transaction hash. It does not mean the approval has been mined, and it does not mean the `allowance` read has observed the new chain state.

It also has no `try/finally`, so any thrown error skips `setSubmitting(false)`.

## Ticket 1: duplicate approvals

State timeline on Ethereum mainnet, assuming the allowance is still too low and the app renders `Approve` until `useReadContract` sees the new allowance:

1. `t = 0s`: `isPending = false`, `submitting = false`, allowance read says "not enough", so the button is enabled and says `Approve`.
2. User clicks `Approve`. The handler calls `setSubmitting(true)` and awaits `writeContractAsync(approveArgs)`.
3. React re-renders: `submitting = true`; wagmi mutation is also pending while the wallet prompt / send is in flight, so the button is disabled and may say `Approving...`.
4. `t = 2s`: the user confirms in the wallet and the transaction is broadcast. `writeContractAsync` resolves with the transaction hash. wagmi's mutation stops being pending, and the next line runs: `setSubmitting(false)`.
5. Now `isPending = false` and `submitting = false`, but the approval is only in the mempool. On mainnet the next block may be around 12 seconds away. The allowance read still returns the old allowance, because the transaction is not included yet.
6. The UI still needs approval, so it renders the same `Approve` button again, enabled.
7. `t = 3s` or `t = 8s`: the user clicks again. The app sends the same approval call again because no state represents "approval transaction already submitted and awaiting confirmation / allowance refresh."
8. The wallet activity shows two approval transactions seconds apart. Both can be valid chain transactions; the second was allowed by the UI window between "hash returned" and "allowance read updated."

The bug is that `submitting` is cleared too early. It covers wallet submission, not chain confirmation plus allowance synchronization.

## Ticket 2: rejected approval leaves the button dead

State timeline:

1. `t = 0s`: `isPending = false`, `submitting = false`, allowance read says "not enough", so `Approve` is enabled.
2. User clicks. The handler immediately calls `setSubmitting(true)`.
3. The wallet opens. The button is disabled because `submitting = true` and/or `isPending = true`.
4. User rejects the wallet request.
5. `writeContractAsync(approveArgs)` rejects. JavaScript exits the async handler at the `await`.
6. `setSubmitting(false)` never runs, because it is after the `await` and there is no `catch` or `finally`.
7. wagmi eventually reports `isPending = false`, but React state is still `submitting = true`.
8. The button remains disabled until component state is recreated, such as by a full page reload.

# State handling that fixes both

Use an explicit approval state machine and always release local state on failures. The button should stay disabled from click until either the approval fails/rejects, or the chain and allowance read prove the approval is usable.

Required states:

- `approvalSubmitting`: set `true` synchronously when the user clicks. Clear it in `finally` for wallet rejection, simulation/send failure, and any other thrown error.
- `approvalHash`: store the hash returned by `writeContractAsync`.
- `approvalConfirming`: true while waiting for the approval transaction receipt, via `useWaitForTransactionReceipt({ hash: approvalHash })`, `publicClient.waitForTransactionReceipt`, or wagmi's sync write helper.
- `allowanceRefreshing` or `approvalSyncing`: true after the receipt until the allowance query has refetched and returns `allowance >= neededAmount`.
- Optional short cooldown: keep the approve button locked briefly after confirmation/refetch on slower RPCs, then refetch again.

The disabled predicate should include all in-flight approval states, not only wagmi's write mutation state:

```tsx
const approveLocked =
  approvalSubmitting ||
  isPending ||
  approvalConfirming ||
  allowanceRefreshing ||
  approvalSyncing;

async function onApprove() {
  if (approveLocked) return;

  setApprovalSubmitting(true);
  setApprovalError(null);

  try {
    const hash = await writeContractAsync(approveArgs);
    setApprovalHash(hash);

    await waitForTransactionReceipt({ hash });
    await refetchAllowance();

    // Only switch to Stake after the fresh allowance read confirms enough allowance.
    // If the refetch still shows the old value, keep syncing/polling or show a
    // clear "Confirming approval..." state instead of re-enabling Approve.
  } catch (error) {
    setApprovalError(error);
  } finally {
    setApprovalSubmitting(false);
  }
}
```

The important rule is: do not make `Approve` clickable again merely because `writeContractAsync` returned a hash. It becomes clickable again only after failure/rejection, replacement/revert handling, or after the app has waited for the receipt and reconciled the allowance read. Once the allowance read is fresh and sufficient, render `Stake` instead.
