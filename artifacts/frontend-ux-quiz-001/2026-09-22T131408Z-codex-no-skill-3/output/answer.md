# Approve button failures

Both tickets come from treating `writeContractAsync` as the whole approval lifecycle. In wagmi v2, `useWriteContract` is a TanStack mutation for sending the transaction. `isPending` is only true while that mutation is executing, and `writeContractAsync` resolves when the wallet/RPC has produced a transaction hash. It does not mean the approval has been mined or that `allowance` has changed onchain.

## 1. Duplicate approval transactions

Timeline on Ethereum mainnet:

1. `t = 0s`: `useReadContract` has read `allowance = 0`, so the UI renders `Approve`. The button is enabled because `isPending === false` and `submitting === false`.
2. `t = 1s`: the user clicks. The handler calls `setSubmitting(true)` and then awaits `writeContractAsync(approveArgs)`. The button disables while the wallet confirmation is open.
3. `t = 3s`: the user confirms in the wallet. The wallet broadcasts approval transaction `A` and wagmi returns its hash. At this point the transaction is only in the mempool.
4. Immediately after the hash: the awaited promise resolves, `isPending` becomes false, and the code runs `setSubmitting(false)`. The button is enabled again.
5. Still before the next mainnet block, roughly until `t = 12s` or later: the approval has not been included yet, so an allowance read still returns the old value. With default `useReadContract` query options, the read is stale by time but it is not automatically a per-block latch for the pending transaction. The UI still shows `Approve`.
6. `t = 4s..11s`: the user clicks `Approve` again. The same args are sent again, producing approval transaction `B`. Wallet activity now shows two identical approvals seconds apart.
7. `t = 12s+`: one or both approvals are mined. Only after the allowance query refetches and sees the new allowance does the UI swap to `Stake`.

The bug is the gap between "transaction hash received" and "transaction mined and allowance refetched." The current code unlocks the button during that gap.

## 2. Rejected approval leaves the button dead

Timeline:

1. `t = 0s`: `allowance = 0`; `Approve` is enabled.
2. `t = 1s`: the user clicks. The handler calls `setSubmitting(true)`.
3. `t = 2s`: the user rejects the wallet request. `writeContractAsync(approveArgs)` rejects.
4. Because there is no `try`/`catch`/`finally`, execution never reaches `setSubmitting(false)`.
5. wagmi's mutation leaves `isPending`, but local React state remains `submitting === true`, so `disabled={isPending || submitting}` stays true until the component is remounted or the page reloads.

## State handling that fixes both

Handle approval as a state machine, not as one boolean:

- `idle`: no approval request in flight.
- `signing`: wallet prompt / `writeContractAsync` in flight.
- `mining`: a hash exists; wait for the approval transaction receipt.
- `refreshingAllowance`: receipt succeeded; refetch or invalidate the allowance read.
- terminal success: allowance read is now sufficient, so render `Stake`.
- terminal failure/rejection/revert: clear the approval state and allow retry.

The important rules:

1. Always clear local "signing" state in `finally` when `writeContractAsync` rejects or throws.
2. Do not re-enable `Approve` just because `writeContractAsync` returned a hash.
3. Store the returned hash and wait for it with `useWaitForTransactionReceipt`.
4. After the receipt succeeds, invalidate/refetch the allowance query and only swap to `Stake` once the allowance read confirms enough allowance, or keep the approval button disabled while that refetch is happening.
5. On rejection, failed send, reverted receipt, replaced/cancelled transaction, or refetch failure, reset the in-flight approval state so the user can retry.

Sketch:

```tsx
const [approvalHash, setApprovalHash] = useState<`0x${string}`>();
const [approvePhase, setApprovePhase] = useState<"idle" | "signing" | "mining" | "refreshing">("idle");

const { writeContractAsync, isPending: isSendingApproval } = useWriteContract();

const receipt = useWaitForTransactionReceipt({
  hash: approvalHash,
  confirmations: 1,
  query: { enabled: !!approvalHash },
});

const approveBusy =
  approvePhase !== "idle" ||
  isSendingApproval ||
  receipt.isLoading ||
  receipt.isFetching ||
  allowanceQuery.isFetching;

async function onApprove() {
  if (approveBusy) return;

  setApprovePhase("signing");
  try {
    const hash = await writeContractAsync(approveArgs);
    setApprovalHash(hash);
    setApprovePhase("mining");
  } catch (error) {
    setApprovalHash(undefined);
    setApprovePhase("idle");
    return;
  }
}

useEffect(() => {
  if (!receipt.isSuccess) return;

  let cancelled = false;
  setApprovePhase("refreshing");

  allowanceQuery.refetch().finally(() => {
    if (cancelled) return;
    setApprovalHash(undefined);
    setApprovePhase("idle");
  });

  return () => {
    cancelled = true;
  };
}, [receipt.isSuccess]);
```

In production code, also handle `receipt.isError` by clearing `approvalHash` and returning to `idle`, and show a rejected/reverted/cancelled message as appropriate. The core fix is that the button remains disabled from click through mined receipt and allowance refresh, but every error path, especially wallet rejection, resets the local state.
