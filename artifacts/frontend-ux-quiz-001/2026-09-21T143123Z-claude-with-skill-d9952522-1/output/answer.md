# Approve button: two QA tickets

Both bugs come from one wrong assumption: that `isPending` and a resolved `writeContractAsync` mean the approval is done. They don't.

- `writeContractAsync` resolves when the wallet **returns the tx hash** (tx signed and broadcast). It does not wait for the tx to be mined.
- `isPending` is the wagmi mutation's "waiting for wallet" flag. It clears at the same moment, when the hash comes back.
- `useReadContract` with default options does **not** refetch on new blocks. It refetches only on mount, window focus, reconnect or a manual `refetch()`.

## Ticket 1: two identical approvals

Timeline on mainnet (12s blocks):

| t | Event | `isPending` | `submitting` | allowance read | Button |
|---|---|---|---|---|---|
| 0s | User clicks Approve | true | true | 0 (cached) | disabled, "Approving..." |
| ~3s | User confirms in wallet. Hash returned, tx in mempool, `await` resolves, `setSubmitting(false)` | **false** | **false** | 0. The wallet popup closing may trigger a window-focus refetch, but the tx isn't mined yet, so it still reads 0 | **enabled, "Approve"** |
| ~5s | Nothing on screen says a tx is in flight, so the user clicks again and confirms | true → false | true → false | 0 | Approve again |
| ~12–24s | Both txs (nonce n, n+1) are mined, seconds apart | false | false | still 0: no block-based refetch, so it stays stale until the next focus event or remount | still "Approve" |

The button was re-enabled and relabeled "Approve" during the entire 12s+ window when the tx was unconfirmed. The allowance read that should switch it to Stake never refetches after the tx is mined. Together those make a second click look like the right thing to do. The result is two identical `approve` txs and gas paid twice.

## Ticket 2: button dead after rejecting in the wallet

| t | Event | `isPending` | `submitting` | Button |
|---|---|---|---|---|
| 0s | Click | true | true | disabled |
| ~2s | User rejects. `writeContractAsync` **throws** `UserRejectedRequestError` | false (mutation → error) | **true** | disabled |
| after | `setSubmitting(false)` is never reached because there is no `try/finally`. The rejection is also unhandled, so no message is shown | false | true (forever) | **disabled until reload** |

`disabled={isPending || submitting}` stays true because `submitting` is stuck. Only a remount (page reload) resets it.

## Fix: one pending state, held from click → receipt → allowance refetch, released in `finally`

```tsx
const publicClient = usePublicClient();
const { writeContractAsync } = useWriteContract();
const { data: allowance, refetch: refetchAllowance } = useReadContract(allowanceArgs);
const [phase, setPhase] = useState<"idle" | "wallet" | "mining">("idle");
const [error, setError] = useState<string | null>(null);

const busy = phase !== "idle";
const needsApproval = allowance === undefined || allowance < amount; // fresh onchain read, not a local flag

async function approve() {
  if (busy) return;
  setError(null);
  setPhase("wallet");
  try {
    const hash = await writeContractAsync(approveArgs);          // wallet returned hash
    setPhase("mining");
    const receipt = await publicClient!.waitForTransactionReceipt({ hash }); // mined
    if (receipt.status !== "success") throw new Error("Approval reverted");
    await refetchAllowance();                                     // authoritative state
  } catch (e) {
    setError(
      e instanceof UserRejectedRequestError || (e as any)?.name === "UserRejectedRequestError"
        ? "Approval cancelled in wallet."
        : (e as any)?.shortMessage ?? "Approval failed. Try again."
    );
  } finally {
    setPhase("idle");                                             // always released, even on reject
  }
}

{needsApproval ? (
  <>
    <button disabled={busy} onClick={approve}>
      {phase === "wallet" ? "Confirm in wallet..." : phase === "mining" ? "Approving..." : "Approve"}
    </button>
    {error && <p role="alert">{error}</p>}
  </>
) : (
  <StakeButton />
)}
```

What this changes:

1. **The single `phase` state replaces `isPending || submitting`.** It stays non-idle from the click, through the wallet prompt, through mining (~12s+), and until the allowance refetch has returned. The button can't be re-enabled while a tx is in flight, which fixes ticket 1.
2. **Release happens in `finally`.** A rejection, revert or RPC error always resets the state, and the `catch` shows a readable message next to the button. This fixes ticket 2.
3. **The Approve → Stake swap is driven by the refetched onchain allowance.** It never relies on a local "approved" flag or on `isPending`. It flips only after the receipt has been received and the allowance has been reread. If the tx reverted, the user sees an error and the button is still Approve.
4. **The labels match each step.** "Confirm in wallet..." shows while the wallet is waiting and "Approving..." shows while the tx is mining, so a slow block no longer looks like nothing happened. Optionally, show the tx hash with a block-explorer link while mining.

`useWaitForTransactionReceipt({ hash })` also works in place of `publicClient.waitForTransactionReceipt`. In that case, keep the `phase` state non-idle until its `isSuccess` has triggered `refetchAllowance()`, and still reset the state on error.
