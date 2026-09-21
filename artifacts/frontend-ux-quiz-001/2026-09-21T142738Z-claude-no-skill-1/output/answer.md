# Approve button: both tickets explained

## The root cause, in one line each

- `writeContractAsync` resolves when the wallet **returns the tx hash** (signed and broadcast). It does **not** wait for the tx to be mined. `isPending` means "waiting for the wallet signature", nothing more.
- `useReadContract` with default options does **not** poll and does not watch blocks. After the tx is mined, the cached allowance stays old until something makes it refetch (window refocus, remount, manual refetch).
- `setSubmitting(false)` sits after an `await` with no `try/finally`. If the promise rejects, that line never runs.

---

## Ticket 1: two identical approvals, seconds apart

Nothing stays "busy" between **signed** and **mined**, and nothing refreshes the allowance after it is mined.

| t (s) | Event | `isPending` | `submitting` | allowance (cached) | Button |
|---|---|---|---|---|---|
| 0 | Click | true | true | 0 | disabled, "Approving..." |
| ~3 | User confirms in wallet. Wallet broadcasts and returns the hash, so `writeContractAsync` resolves | false | false | 0 | **enabled, "Approve"** |
| 3 → ~15 | Tx waits in the mempool for the next block (avg 12s, can take several blocks) | false | false | 0 | enabled, "Approve" |
| ~6 | User sees an unchanged "Approve" button, thinks it failed, clicks again. Wallet shows the same approve, user confirms | true→false | true→false | 0 | same cycle again |
| ~15 | Tx #1 is mined (in block N+1) | false | false | **still 0**: no poll, no block watch | still "Approve" |
| ~27 | Tx #2 is mined | | | still 0 until refocus/remount | |

Result: two identical `approve` txs a few seconds apart. Gas is paid twice. Even after both are mined, the button can keep showing "Approve", because the allowance read never refetches on its own. That invites a third click.

(A fast double-click is not the main cause: React applies the `disabled` update before the next click event. The real gap is the whole post-signature window. It still makes sense to add a synchronous ref guard as extra protection, shown below.)

## Ticket 2: rejected in the wallet, button dead until reload

| t (s) | Event | `isPending` | `submitting` | Button |
|---|---|---|---|---|
| 0 | Click, `setSubmitting(true)` | true | true | disabled, "Approving..." |
| ~4 | User rejects. The mutation errors (`UserRejectedRequestError`, code 4001) | **false** | true | disabled, label back to "Approve" |
| ~4 | `await` throws, so `setSubmitting(false)` never runs. The error becomes an unhandled promise rejection | false | **true forever** | **disabled "Approve"**, looks idle but dead |
| … | Only a remount (page reload) resets `submitting` | | | |

Note: no block timing is involved here. It fails as soon as the rejection happens. The label going back to "Approve" makes it worse, because the button looks ready but can't be clicked.

---

## Fix: state handling

Rules:

1. **Busy = signing OR hash known and not yet mined OR mined but allowance not yet refetched.** Base this on wagmi state (`isPending`, a stored `hash`, `useWaitForTransactionReceipt`). Drop the hand-rolled `submitting` flag.
2. **Always leave the busy state on failure.** Catch the error. A user rejection goes back to idle quietly. Any other error goes back to idle and shows a message. Same for a reverted or failed receipt.
3. **Refetch the allowance after the receipt succeeds**, and only then clear the busy state. Approve→Stake swaps on fresh data, so there is never an "enabled Approve" gap.
4. **Synchronous re-entry guard** (`useRef`) so no second `writeContract` can start while one is in flight.
5. **Label reflects the real phase**: "Confirm in wallet…" → "Approving… (waiting for block)" → Stake.

```tsx
import { useEffect, useRef, useState } from "react";
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { BaseError, UserRejectedRequestError, type Hash } from "viem";

const isUserRejection = (e: unknown) =>
  e instanceof BaseError && !!e.walk((err) => err instanceof UserRejectedRequestError);

function ApproveButton() {
  const { data: allowance, refetch: refetchAllowance } = useReadContract(allowanceArgs);
  const { writeContractAsync, isPending: isSigning } = useWriteContract();

  const [hash, setHash] = useState<Hash>();
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);

  const receipt = useWaitForTransactionReceipt({ hash });

  // Mined (or failed): refresh allowance, THEN leave busy state
  useEffect(() => {
    if (!hash) return;
    const done = () => { setHash(undefined); inFlight.current = false; };

    if (receipt.isSuccess && receipt.data.status === "success") {
      refetchAllowance().finally(done); // UI swaps to Stake once allowance is enough
    } else if (receipt.isError || (receipt.isSuccess && receipt.data.status === "reverted")) {
      setError("Approval failed on-chain. Try again.");
      done();
    }
  }, [hash, receipt.isSuccess, receipt.isError, receipt.data, refetchAllowance]);

  async function onApprove() {
    if (inFlight.current) return; // sync guard, no re-entry
    inFlight.current = true;
    setError(undefined);
    try {
      setHash(await writeContractAsync(approveArgs)); // stay busy until receipt + refetch
    } catch (e) {
      inFlight.current = false; // ALWAYS leave busy state
      if (!isUserRejection(e)) {
        setError(e instanceof BaseError ? e.shortMessage : "Approval failed");
      }
    }
  }

  const isConfirming = !!hash; // covers mempool wait + allowance refetch
  const busy = isSigning || isConfirming;

  return (
    <>
      <button disabled={busy} onClick={onApprove}>
        {isSigning ? "Confirm in wallet…" : isConfirming ? "Approving… (waiting for block)" : "Approve"}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
```

How this closes each ticket:

- **Ticket 1:** from click until the allowance refetch finishes after mining (~12s+ on mainnet), the button is disabled and says what is happening. When busy ends, fresh allowance swaps the UI to Stake. There is no moment where "Approve" is clickable while the first approval is pending.
- **Ticket 2:** rejection lands in `catch`, which resets the guard. `isSigning` is already false and `hash` was never set, so the button is immediately clickable again, and there is no unhandled rejection. Other errors show a message instead of failing silently.

Optional hardening:
- Save `hash` to `localStorage` so a reload during the mempool wait resumes "Approving…" instead of offering a fresh Approve.
- If the RPC node lags and the refetched allowance still reads low, poll (`refetchInterval`) until it is enough, then clear busy.
