# What happened

`writeContractAsync(approveArgs)` only waits for the wallet/RPC submission to return a transaction hash. It does not wait for the approval transaction to be mined, and it does not wait for the `allowance` read to refetch and show the new value.

The current code has two separate bugs:

```tsx
setSubmitting(true);
await writeContractAsync(approveArgs);
setSubmitting(false);
```

There is no `try/finally`, so rejection skips `setSubmitting(false)`.

And on success, `setSubmitting(false)` runs as soon as the hash is returned, while the approval is still only pending onchain. On Ethereum mainnet, the next block is usually about 12 seconds away, and the `useReadContract` allowance query with default behavior may still be showing the old allowance.

## Ticket 1: two identical approvals

One possible mainnet timeline:

1. `t = 0s`: allowance is too low, so the UI renders `Approve`.
2. User clicks `Approve`.
3. React state is set:
   - `submitting = true`
   - wagmi mutation `isPending = true`
   - button is disabled.
4. User confirms in the wallet.
5. `t = 2s`: the wallet/RPC returns the approval transaction hash. `writeContractAsync` resolves.
6. The handler runs `setSubmitting(false)`. wagmi `isPending` also becomes `false` because the write mutation is done.
7. The approval transaction is still not mined. The next mainnet block may be around `t = 12s`.
8. The allowance read still shows the old low allowance, because the chain state has not changed yet, and the default read query has not produced a fresh enough value.
9. The UI still renders `Approve`, and now `disabled={isPending || submitting}` is `false`.
10. User clicks `Approve` again at `t = 3s` or `t = 4s`.
11. A second approval transaction with the same calldata is submitted. The wallet activity now shows two approval transactions seconds apart.

So the duplicate is caused by treating "hash returned" as "approval complete". The button reopens during the hash-to-confirmation-to-refetch gap.

## Ticket 2: rejected approval leaves the button dead

Rejection timeline:

1. `t = 0s`: user clicks `Approve`.
2. The handler runs `setSubmitting(true)`.
3. wagmi `isPending` becomes `true` while the wallet prompt is open.
4. User rejects the request in the wallet.
5. `writeContractAsync(approveArgs)` throws.
6. JavaScript exits the async handler before reaching `setSubmitting(false)`.
7. wagmi eventually sets `isPending = false`, but local React state is still `submitting = true`.
8. The button remains disabled because `disabled={isPending || submitting}` is still `true`.
9. A full reload resets React state, so the button works again.

The label may even say `Approve`, because the label only checks `isPending`, but the disabled state is still stuck on `submitting`.

# State handling that fixes both

The approval button needs to stay locked for the whole approval lifecycle:

1. wallet prompt / transaction submission
2. transaction hash returned
3. transaction mined
4. allowance refetched and observed as sufficient, or at least refetched after confirmation

It also must release the local state in every error path.

A simple version is:

```tsx
const { writeContractAsync, isPending: isWalletPending } = useWriteContract();
const publicClient = usePublicClient();
const [isApproving, setIsApproving] = useState(false);
const [approvalError, setApprovalError] = useState<string | null>(null);

const approveDisabled = isWalletPending || isApproving;

<button
  disabled={approveDisabled}
  onClick={async () => {
    if (approveDisabled) return;

    setIsApproving(true);
    setApprovalError(null);

    try {
      const hash = await writeContractAsync(approveArgs);

      await publicClient.waitForTransactionReceipt({ hash });

      // Use the actual allowance query's refetch, or invalidate the exact
      // readContract query key. Do not rely on the default read staying fresh.
      await refetchAllowance();

      // If the RPC/read can lag, keep the button locked until the refetched
      // allowance is enough, or do a short settle-and-refetch loop/cooldown.
    } catch (err) {
      setApprovalError(toUserMessage(err));
    } finally {
      setIsApproving(false);
    }
  }}
>
  {isApproving || isWalletPending ? "Approving..." : "Approve"}
</button>
```

Equivalent hook-based handling is also fine: store the approval hash, use `useWaitForTransactionReceipt({ hash })`, refetch/invalidate the allowance read when the receipt succeeds, and keep `disabled` true while `hash` exists or the allowance refetch is settling.

The key rules are:

- Do not clear the approval lock when `writeContractAsync` returns the hash.
- Clear the lock on rejection/error with `finally`.
- After confirmation, explicitly refetch or invalidate the allowance read before swapping from `Approve` to `Stake`.
- Drive the button label from the full local approval lifecycle, not from wagmi `isPending` alone.
