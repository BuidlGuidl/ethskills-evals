# Approve button tickets

Both tickets come from treating `writeContractAsync(approveArgs)` as "the approval is done". In wagmi v2 it is only the write mutation: after the wallet signs and broadcasts, the async call can resolve with the transaction hash while the approval transaction is still waiting in the mempool. `isPending` is the TanStack mutation's pending state, not "the transaction is pending on mainnet".

## Ticket 1: two identical approval transactions

Mainnet block time is about 12 seconds, so there is a real window between "wallet broadcasted my approval" and "the allowance read can observe the approval on-chain".

State timeline:

1. `T+0s`: The allowance read says the allowance is too low. The UI renders `Approve`. `isPending === false`, `submitting === false`, so the button is enabled.
2. `T+0s`: The user clicks. The handler runs `setSubmitting(true)` and awaits `writeContractAsync(approveArgs)`. After React rerenders, the button is disabled.
3. `T+2s`: The user confirms in the wallet. The transaction is broadcast and `writeContractAsync` resolves with a hash. The approval is not mined yet.
4. `T+2s`: The handler immediately runs `setSubmitting(false)`. wagmi's write mutation is now successful, so `isPending === false`.
5. `T+2s` to roughly `T+12s`: The transaction is still pending. The latest confirmed chain state still has the old allowance. The default `useReadContract` allowance query is not a pending-transaction lock and does not read the mempool, so the UI still sees "allowance too low" and renders `Approve`.
6. During that window, the button is enabled again because `isPending || submitting` is false. If the user clicks again before the first approval is mined and the allowance query is refetched, the app submits the same `approveArgs` again. The wallet activity then shows two approval transactions seconds apart.
7. `T+12s+`: The first approval is included in a block. After the allowance query is invalidated/refetched, the UI finally has enough allowance and swaps to `Stake`. If the second click already happened, that second approval is still a real transaction too.

With default read-query behavior, the stale period can be longer than one block unless the app invalidates/refetches the allowance query, watches blocks and invalidates on new blocks, or otherwise refreshes after the receipt.

## Ticket 2: rejected approval leaves the button dead

This one is the missing `finally`.

State timeline:

1. `T+0s`: The allowance is too low, so `Approve` is enabled.
2. `T+0s`: The user clicks. The handler runs `setSubmitting(true)` and starts `writeContractAsync`.
3. `T+3s`: The user rejects in the wallet. `writeContractAsync` rejects.
4. Because the `await` throws, execution never reaches `setSubmitting(false)`.
5. wagmi's mutation state leaves pending and becomes an error, so `isPending === false`, but the local React state is still `submitting === true`.
6. The button text goes back to `Approve`, but `disabled={isPending || submitting}` stays true forever. A full page reload resets local component state, so the button works again.

## State handling that fixes both

Track the whole approval lifecycle, not just the wallet write mutation:

- `idle`: no approval in progress; the user may click Approve if the allowance is still too low.
- `wallet`: the wallet request is open / `writeContractAsync` is running.
- `confirming`: a hash was returned, but the approval is not yet included in a block.
- `refreshingAllowance`: the receipt succeeded, and the app is invalidating/refetching the allowance read.
- back to `idle` only after rejection/error/revert, or after the allowance refetch confirms enough allowance and the UI can render Stake.

The button should be disabled for every non-idle approval phase:

```tsx
const disabled =
  approvalPhase !== "idle" ||
  isPending ||
  isConfirmingApproval ||
  isRefetchingAllowance;
```

The click handler also needs a terminal-path reset:

```tsx
const approvalLock = useRef(false);
const [approvalPhase, setApprovalPhase] = useState<
  "idle" | "wallet" | "confirming" | "refreshingAllowance"
>("idle");
const [approvalHash, setApprovalHash] = useState<`0x${string}`>();

const onApprove = async () => {
  if (approvalLock.current || hasEnoughAllowance) return;

  approvalLock.current = true;
  setApprovalPhase("wallet");

  try {
    const hash = await writeContractAsync(approveArgs);
    setApprovalHash(hash);
    setApprovalPhase("confirming");
  } catch (error) {
    // Includes user rejection.
    setApprovalPhase("idle");
    approvalLock.current = false;
    // Surface the error/rejection to the user.
  }
};
```

Then wait for the hash to be mined, refetch allowance, and only unlock after that finishes:

```tsx
const approvalReceipt = useWaitForTransactionReceipt({
  hash: approvalHash,
  confirmations: 1,
});

useEffect(() => {
  if (!approvalReceipt.isSuccess) return;

  let cancelled = false;

  (async () => {
    setApprovalPhase("refreshingAllowance");
    await refetchAllowance(); // or queryClient.invalidateQueries({ queryKey: allowanceQueryKey })

    if (!cancelled) {
      setApprovalPhase("idle");
      approvalLock.current = false;
    }
  })();

  return () => {
    cancelled = true;
  };
}, [approvalReceipt.isSuccess, refetchAllowance]);

useEffect(() => {
  if (!approvalReceipt.isError) return;

  setApprovalPhase("idle");
  approvalLock.current = false;
  // Surface the revert/replacement/cancel error.
}, [approvalReceipt.isError]);
```

Equivalently, an imperative version can do `try { const hash = await writeContractAsync(...); await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 }); await refetchAllowance(); } catch { ... } finally { unlock }`.

The important rules are:

1. Do not re-enable Approve when the hash is returned. Re-enable only after the receipt and allowance refresh, or after a terminal error/rejection.
2. Always clear the local lock in a `catch`/`finally`/`onSettled` path for rejected wallet requests and other failures.
3. Keep a synchronous guard, such as a ref, so two clicks in the same render window cannot start two writes before React commits the disabled state.
