# Approve button failure modes

Both QA tickets come from treating `useWriteContract().isPending` and the local
`submitting` flag as if they cover the whole approval. They do not.

`writeContractAsync(approveArgs)` resolves when the wallet/client has produced a
transaction hash. On Ethereum mainnet, that is usually several seconds before the
transaction is included in a block. With roughly 12 second blocks, there is a
real window where the approval transaction exists but the onchain allowance read
still correctly returns the old allowance.

## Ticket 1: duplicate approval transactions

One possible mainnet timeline:

1. `t = 0s`: allowance is too low, so the UI shows `Approve`.
2. User clicks `Approve`.
3. The handler calls `setSubmitting(true)` and then `await writeContractAsync(approveArgs)`.
4. While the wallet request is open, `isPending` is true and/or `submitting` is
   true, so the button is disabled.
5. `t = 2s`: the user confirms in the wallet. The transaction is broadcast and
   wagmi resolves `writeContractAsync` with the transaction hash.
6. The next line runs: `setSubmitting(false)`.
7. `isPending` also becomes false because the write mutation is no longer
   pending. It has a hash; it is not waiting for the receipt.
8. The next mainnet block has not landed yet. The approval is not mined, so the
   default `useReadContract` allowance value still shows the old insufficient
   allowance.
9. The UI therefore still renders `Approve`, but the button is enabled again:
   `disabled={false || false}`.
10. `t = 3s-11s`: the user clicks `Approve` again. The app sends the same
    `approve(spender, amount)` call again.
11. `t = 12s+`: one or both transactions get mined. The wallet activity now
    shows two identical approval transactions seconds apart.

Nothing in this code remembers that an approval transaction is already in
flight after the hash is returned. It releases the button before the receipt and
before the authoritative allowance read has caught up.

## Ticket 2: rejection leaves the button dead

Rejection follows a different path:

1. `t = 0s`: allowance is too low, so the UI shows `Approve`.
2. User clicks `Approve`.
3. The handler calls `setSubmitting(true)`.
4. The wallet opens.
5. The user rejects the request.
6. `writeContractAsync(approveArgs)` rejects.
7. Because there is no `try/finally`, execution never reaches
   `setSubmitting(false)`.
8. wagmi's `isPending` eventually becomes false because the mutation has ended
   with an error, but local `submitting` is still true.
9. The button renders as disabled forever:
   `disabled={false || true}`.
10. A full page reload resets React state, so the button comes back.

## State handling that fixes both

Use one approve action lock that spans the whole lifecycle:

1. Start the lock before opening the wallet.
2. Call `writeContractAsync`.
3. If the wallet rejects or the write fails, show the error and release the lock
   in `finally`.
4. If a hash is returned, keep the lock after `writeContractAsync` resolves.
5. Wait for the transaction receipt.
6. Refetch or invalidate the allowance read and wait for the fresh read.
7. Render `Stake` only from the refreshed onchain allowance, not from a local
   "approved" flag.
8. Release the lock only after the receipt plus allowance refresh has completed.

In code shape, the important part is:

```tsx
const [approveState, setApproveState] = useState<
  "idle" | "wallet" | "mining" | "refreshing"
>("idle");

const approving = approveState !== "idle";

<button
  disabled={approving}
  onClick={async () => {
    setApproveState("wallet");

    try {
      const hash = await writeContractAsync(approveArgs);

      setApproveState("mining");
      await publicClient.waitForTransactionReceipt({ hash });

      setApproveState("refreshing");
      await refetchAllowance();
    } catch (error) {
      // Translate wallet rejection / contract errors into user-facing text.
      setApproveError(error);
    } finally {
      setApproveState("idle");
    }
  }}
>
  {approveState === "wallet"
    ? "Confirm in wallet"
    : approveState === "mining"
      ? "Approval pending"
      : approveState === "refreshing"
        ? "Updating allowance"
        : "Approve"}
</button>
```

The exact implementation can use `useWaitForTransactionReceipt` plus query
invalidation instead of `publicClient.waitForTransactionReceipt`, but the state
boundary is the same: the Approve button must stay unavailable from click
through receipt and allowance refetch, and every error path must release local
state with `finally`.
