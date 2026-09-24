# What happened

The bug is that `writeContractAsync(approveArgs)` is only the wallet/RPC submission step. It resolves when the approval transaction has been accepted and a hash is available. It does **not** mean the approval has been mined, and it does **not** mean the allowance read has updated.

The local `submitting` flag has the same problem: it is cleared immediately after `writeContractAsync` resolves, so it only protects the wallet submission window. It does not protect the 12-ish second mainnet block window before the approval exists in chain state.

## Ticket 1: duplicate approval transactions

One mainnet timeline that follows directly from this code:

1. `t = 0s`: allowance read says the user has insufficient allowance, so the UI shows `Approve`.
2. User clicks `Approve`.
3. The handler runs:
   - `setSubmitting(true)` is scheduled/applied.
   - `writeContractAsync(approveArgs)` opens the wallet and sends the transaction.
   - `isPending` is `true` while the wagmi mutation is in flight.
   - the button is disabled.
4. `t = 2s`: the user confirms in the wallet. The transaction is broadcast and wagmi gets a hash.
5. `writeContractAsync` resolves. The next line runs:
   - `setSubmitting(false)`
   - wagmi mutation `isPending` becomes `false`
6. The first approval is still pending in the mempool. On Ethereum mainnet the next block may be around `t = 12s`, so for roughly ten more seconds the on-chain allowance is still the old value.
7. The allowance read still says "not enough allowance" because the approval has not been mined yet, and with default read behavior it is not a transaction-aware confirmation gate.
8. The UI still renders `Approve`, but now `disabled={isPending || submitting}` is `false`.
9. The user clicks again at `t = 3s` or `t = 4s`.
10. The app sends a second identical `approve` transaction. The wallet activity now shows two approval transactions seconds apart.

So the duplicate is not caused by the allowance check being conceptually wrong. It is caused by re-enabling the button after transaction submission but before transaction confirmation and allowance refresh.

## Ticket 2: rejected approval leaves the button dead

The rejection path has a different timeline:

1. `t = 0s`: allowance is insufficient, so the UI shows `Approve`.
2. User clicks `Approve`.
3. The handler runs:
   - `setSubmitting(true)`
   - `writeContractAsync(approveArgs)` opens the wallet
   - the button is disabled
4. `t = 2s`: the user rejects the request in the wallet.
5. `writeContractAsync` rejects its promise.
6. Because there is no `try/finally`, execution never reaches:

   ```ts
   setSubmitting(false);
   ```

7. wagmi's `isPending` eventually returns to `false`, but local React state is still `submitting === true`.
8. The disabled expression stays true:

   ```ts
   disabled={isPending || submitting}
   ```

9. The button remains dead until a page reload resets React state.

# State handling that fixes both

The button needs to model the whole approval flow, not only the wallet mutation. Treat approval as a small state machine:

- `idle`: user may click Approve.
- `wallet`: waiting for the user to approve/reject in the wallet.
- `confirming`: transaction was submitted; waiting for the approval receipt.
- `refreshingAllowance`: receipt is mined; refetching or invalidating the allowance read.

The important rules are:

1. Use `try/catch/finally` so user rejection and other errors always clear the local lock.
2. After a successful `writeContractAsync`, keep the button disabled until the transaction receipt is confirmed.
3. After the receipt, explicitly refetch or invalidate the allowance query before allowing the UI to depend on the new allowance.
4. Do not use `useWriteContract().isPending` as the only disabled state. It ends when submission ends, not when the approval is usable.

For example:

```tsx
const { writeContractAsync } = useWriteContract();
const [approvalPhase, setApprovalPhase] = useState<
  "idle" | "wallet" | "confirming" | "refreshingAllowance"
>("idle");

const approving = approvalPhase !== "idle";

<button
  disabled={approving}
  onClick={async () => {
    if (approvalPhase !== "idle") return;

    try {
      setApprovalPhase("wallet");

      const hash = await writeContractAsync(approveArgs);

      setApprovalPhase("confirming");
      await waitForTransactionReceipt(config, { hash, confirmations: 1 });

      setApprovalPhase("refreshingAllowance");
      await refetchAllowance();
    } catch (error) {
      // User rejection lands here too. Show an error/toast if desired,
      // but do not leave the button locked.
    } finally {
      setApprovalPhase("idle");
    }
  }}
>
  {approvalPhase === "wallet"
    ? "Confirm in wallet"
    : approvalPhase === "confirming" || approvalPhase === "refreshingAllowance"
      ? "Approving..."
      : "Approve"}
</button>
```

In a real component this can also be implemented with `useWaitForTransactionReceipt` keyed by the returned hash, plus a `useEffect` that refetches the allowance after `isSuccess`. The essential behavior is the same: rejection must reset local state, and success must keep the approval UI locked until the mined approval is reflected in the allowance read.
