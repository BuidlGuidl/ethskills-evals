# Approve button incident explanation

Both tickets come from treating `writeContractAsync(approveArgs)` as if it means
"approval is complete." In wagmi/viem it only means the wallet/RPC write call has
finished and the app has a transaction hash. It does not mean the transaction is
mined, and it does not mean the allowance read has observed the new allowance.

The local `submitting` flag also has no `try/finally`, so any thrown wallet error
skips `setSubmitting(false)`.

## Ticket 1: duplicate approvals

Mainnet produces blocks about every 12 seconds, so there is a real gap between
"wallet accepted and broadcast the approval" and "the allowance exists in an
onchain read."

Timeline:

1. `t=0s`: allowance read says the current allowance is too low. The UI shows
   `Approve`. `isPending === false`, `submitting === false`, so the button is
   enabled.
2. `t=1s`: user clicks `Approve`. The handler runs `setSubmitting(true)` and
   awaits `writeContractAsync(approveArgs)`. The wallet opens and wagmi's write
   mutation is pending.
3. `t=3s`: user confirms in the wallet. The transaction is broadcast and
   `writeContractAsync` resolves with a hash. wagmi's `isPending` is now false,
   because the write request is done. The handler immediately runs
   `setSubmitting(false)`.
4. `t=3s-12s+`: the approval transaction is still waiting to be included in a
   block. The default `useReadContract` allowance read still returns the old
   insufficient allowance, because the chain state has not changed yet. The UI
   therefore still shows `Approve`, and now `isPending || submitting` is false.
   The button is enabled again.
5. The user clicks `Approve` again during this window. The app sends the same
   approval call again, producing a second approval transaction seconds after the
   first.
6. After the first approval is mined and the allowance read refetches, the UI
   finally sees enough allowance and swaps to `Stake`. By then the duplicate may
   already be in the wallet activity.

## Ticket 2: rejected approval leaves the button dead

Timeline:

1. `t=0s`: allowance is insufficient, so the UI shows an enabled `Approve`
   button.
2. `t=1s`: user clicks. The handler runs `setSubmitting(true)` and then awaits
   `writeContractAsync(approveArgs)`.
3. `t=4s`: the user rejects the wallet request. `writeContractAsync` rejects.
4. Because there is no `try/catch/finally`, execution never reaches
   `setSubmitting(false)`.
5. wagmi's `isPending` eventually returns to false, but local
   `submitting === true` forever. The allowance is still insufficient, so the UI
   still wants to show `Approve`, but `disabled={isPending || submitting}` keeps
   it disabled until a full reload remounts the component and resets state.

## State handling that fixes both

Use one approve-in-progress state that covers the whole lifecycle:

1. User clicks approve.
2. App submits the wallet transaction.
3. App waits for the approval transaction receipt.
4. App refetches or invalidates the allowance read and waits for that
   authoritative read to settle.
5. Only then does the app release the approve button or swap to `Stake`.

Release that state in `finally` for all failure paths, including wallet
rejection, RPC errors, and reverted transactions. Do not use a local
`approved` flag to switch to `Stake`; keep deriving that from the fresh
allowance read.

Shape of the fix:

```tsx
const [approving, setApproving] = useState(false);
const [approveError, setApproveError] = useState<Error | null>(null);
const { writeContractAsync, isPending: isWritePending } = useWriteContract();

const onApprove = async () => {
  if (approving || isWritePending) return;

  setApproving(true);
  setApproveError(null);

  try {
    const hash = await writeContractAsync(approveArgs);
    await publicClient.waitForTransactionReceipt({ hash });
    await refetchAllowance();
  } catch (error) {
    setApproveError(error as Error);
  } finally {
    setApproving(false);
  }
};

<button disabled={approving || isWritePending} onClick={onApprove}>
  {approving || isWritePending ? "Approving..." : "Approve"}
</button>
```

The exact implementation can use `useWaitForTransactionReceipt` plus a query
invalidation/refetch instead of awaiting `publicClient` directly. The important
rule is the same: the button stays locked from click through receipt and the
fresh allowance read, and the lock is cleared in `finally` when the user rejects
or anything else fails.
