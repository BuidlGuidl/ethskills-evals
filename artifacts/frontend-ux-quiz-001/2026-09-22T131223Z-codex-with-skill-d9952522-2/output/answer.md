# Approve Button Failure Modes

Both tickets come from the same state boundary bug: this button treats
`writeContractAsync(approveArgs)` returning as the end of the approval.
With wagmi v2, `useWriteContract().isPending` only covers the write
mutation while the wallet request is pending and the transaction is being
submitted. It does not mean the transaction has mined, and it does not
mean the allowance read has observed the new allowance.

## Ticket 1: duplicate approval transactions

Initial state on Ethereum mainnet:

- The current allowance read says allowance is too low.
- The UI renders `Approve`.
- `isPending === false`.
- `submitting === false`.
- The button is enabled.

Timeline:

1. `t = 0s`: the user clicks `Approve`.
2. The handler runs `setSubmitting(true)` and calls
   `writeContractAsync(approveArgs)`.
3. React re-renders with `submitting === true` and wagmi sets
   `isPending === true`, so the button is disabled and shows
   `Approving...`.
4. `t = 2s`: the user confirms in their wallet. The approval transaction is
   broadcast, but it is not mined yet.
5. `writeContractAsync` resolves with the transaction hash. At this point
   wagmi's write mutation is done, so `isPending` becomes `false`.
6. The next line runs: `setSubmitting(false)`.
7. The transaction is still pending in the mempool. On mainnet, the next
   block may be around 12 seconds away.
8. The allowance read still shows the old low allowance because the approve
   transaction has not been included in a block yet. With default read
   behavior, the UI has no authoritative new allowance to show.
9. The UI therefore renders `Approve` again with
   `isPending === false` and `submitting === false`.
10. `t = 4s`: the user clicks `Approve` again. The app sends the exact same
    approval call a second time.
11. `t = 12s` or later: one or both approval transactions are mined. The
    wallet activity now shows two identical approvals, seconds apart.

The bug is the gap between "wallet returned a hash" and "the chain plus
the allowance read agree that approval is complete." The current code
re-enables the same primary action during that gap.

## Ticket 2: rejected approval leaves the button dead

Initial state is the same: allowance is too low and the enabled action is
`Approve`.

Timeline:

1. `t = 0s`: the user clicks `Approve`.
2. The handler runs `setSubmitting(true)`.
3. The wallet opens and `writeContractAsync(approveArgs)` waits for the
   user's decision.
4. `t = 5s`: the user rejects the request in their wallet.
5. `writeContractAsync` rejects.
6. Because there is no `try/catch/finally`, execution jumps out of the
   async click handler before `setSubmitting(false)` runs.
7. wagmi's `isPending` returns to `false`, but local React state remains
   `submitting === true`.
8. The disabled expression is still true:

   ```tsx
   disabled={isPending || submitting}
   ```

9. No transaction was sent, so no mainnet block can change the allowance.
   At `t = 12s`, `t = 24s`, and beyond, the allowance read still says the
   user needs approval, but the button remains disabled until a reload
   remounts the component and resets `submitting`.

## State handling that fixes both

Use one explicit approval-in-progress state for the button, and hold it
from click through all of these steps:

1. Wallet approval request.
2. Transaction hash returned.
3. Transaction receipt observed on the target chain.
4. Allowance query invalidated/refetched and the UI has seen the
   authoritative post-approval allowance.

Release that state in `finally`, so wallet rejection, RPC errors, and
reverts cannot leave the button permanently disabled.

The shape should be:

```tsx
const [approving, setApproving] = useState(false);
const approvingRef = useRef(false);

const onApprove = async () => {
  if (approvingRef.current) return;

  approvingRef.current = true;
  setApproving(true);

  try {
    const hash = await writeContractAsync(approveArgs);

    await publicClient.waitForTransactionReceipt({ hash });

    await refetchAllowance();
    // Or invalidate the exact allowance query and await the refetch.
    // The UI should switch to Stake only because the fresh allowance read
    // says the allowance is now sufficient.
  } catch (error) {
    // Show a human-readable wallet/revert/RPC error near the button.
  } finally {
    approvingRef.current = false;
    setApproving(false);
  }
};
```

Then disable the button with that full lifecycle state:

```tsx
<button disabled={approving} onClick={onApprove}>
  {approving ? "Approving..." : "Approve"}
</button>
```

The important rule is that a transaction hash is not the completion point
for an approve-then-stake UI. Completion is the receipt plus a fresh
allowance read. The app should never swap to `Stake` from a local success
flag, and it should never re-enable `Approve` while an approval transaction
that could satisfy the allowance is still pending.
