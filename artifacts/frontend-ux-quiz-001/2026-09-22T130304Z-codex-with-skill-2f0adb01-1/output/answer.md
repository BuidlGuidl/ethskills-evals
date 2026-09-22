# Approve button failure modes

Both tickets come from treating `writeContractAsync` / `isPending` as if they covered the full approval lifecycle. They do not. In wagmi, the write mutation is pending while the wallet request is in flight and the transaction is being submitted. It resolves once the wallet/client returns the transaction hash. It does not wait for the transaction to be mined, and it does not wait for the allowance read to show the new allowance.

## 1. Duplicate approvals on mainnet

Timeline with roughly 12 second Ethereum mainnet blocks:

1. `t=0s`: The allowance read still shows insufficient allowance, so the UI renders `Approve`.
2. The user clicks `Approve`.
3. The handler runs `setSubmitting(true)` and then `await writeContractAsync(approveArgs)`.
4. React re-renders with `submitting=true` and/or `isPending=true`, so the button is disabled.
5. The user confirms in the wallet. The approval transaction is broadcast.
6. `t=1-3s`: `writeContractAsync` resolves with the transaction hash. The transaction is only pending in the mempool; it is not confirmed yet.
7. The next line runs: `setSubmitting(false)`.
8. wagmi's `isPending` also falls back to `false`, because the write mutation is no longer pending.
9. The allowance read still shows the old insufficient allowance, because the transaction has not landed in a block yet. With 12 second blocks, that stale onchain state can remain visible for several seconds, often until `t=12s+`, and possibly longer until the read refetches.
10. The UI still renders `Approve`, now enabled again: `disabled={false || false}`.
11. The user clicks it again before the first approval is mined/refetched.
12. A second identical approval transaction is submitted.

So the duplicate transaction window is:

```text
first tx hash returned
-> isPending=false and submitting=false
-> allowance read still old
-> Approve button enabled again
-> next block/refetch has not caught up yet
```

## 2. Rejection leaves the button dead

Timeline:

1. The user clicks `Approve`.
2. The handler runs `setSubmitting(true)`.
3. The wallet opens.
4. The user rejects the approval.
5. `writeContractAsync(approveArgs)` throws.
6. Because there is no `try/catch/finally`, execution never reaches `setSubmitting(false)`.
7. `isPending` eventually becomes `false`, but `submitting` remains stuck at `true`.
8. The button stays disabled until the component is remounted, such as after a full page reload.

The stuck state is caused by this line being after an awaited call that can throw:

```ts
await writeContractAsync(approveArgs);
setSubmitting(false);
```

## State handling that fixes both

The approval button needs state for the whole approval lifecycle, not just the wallet submission:

1. Set an approval-specific local lock immediately on click.
2. Always release or advance that state in `finally`, so wallet rejection cannot strand the button.
3. After `writeContractAsync` returns a hash, wait for the approval receipt with `useWaitForTransactionReceipt` or `waitForTransactionReceipt`.
4. After confirmation, invalidate/refetch the allowance read and keep the Approve button locked until the fresh allowance read shows enough allowance.
5. Optionally keep a short post-confirmation cooldown while the allowance query updates, so the UI cannot flash an enabled `Approve` from stale cache.

Conceptually:

```ts
const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}`>();
const [approvalSubmitting, setApprovalSubmitting] = useState(false);

const {
  isLoading: approvalConfirming,
  isSuccess: approvalConfirmed,
} = useWaitForTransactionReceipt({
  hash: approvalTxHash,
});

const approveDisabled =
  approvalSubmitting ||
  approvalConfirming ||
  allowanceRefetching ||
  hasEnoughAllowance;

async function onApprove() {
  setApprovalSubmitting(true);

  try {
    const hash = await writeContractAsync(approveArgs);
    setApprovalTxHash(hash);
    await waitForTransactionReceipt(config, { hash });
    await refetchAllowance();
  } catch (error) {
    showApprovalError(error);
  } finally {
    setApprovalSubmitting(false);
  }
}
```

The exact implementation can use either the hook style or the imperative `waitForTransactionReceipt`, but the important rule is the same: do not re-enable `Approve` just because the wallet returned a transaction hash. Keep it disabled until the chain confirms and the allowance read has caught up. Also, put the local lock cleanup in `finally` so rejected wallet requests return the button to a usable state.
