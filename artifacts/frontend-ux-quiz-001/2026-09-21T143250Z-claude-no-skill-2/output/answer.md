# Approve button: two tickets, one root problem

The button only tracks **the wallet prompt**. It does not track **the transaction**. Two facts explain both tickets:

- `writeContractAsync` **resolves** when the wallet hands back a tx hash, meaning the tx was *sent*, not *mined*. It **rejects** (throws) when the user clicks Reject.
- `useReadContract` with default options does **not** refetch on new blocks. No `watch`, no polling. It refetches only on mount, window refocus, or reconnect.

---

## Ticket 1: two identical approvals, seconds apart

The button unlocks when the tx is *sent*. Mining takes longer, and nothing on screen says a tx is on its way.

| t | Event | `isPending` | `submitting` | allowance read | Button |
|---|---|---|---|---|---|
| 0s | Click. `setSubmitting(true)`, wallet popup opens | true | true | 0 | disabled, "Approving..." |
| ~3s | User confirms. Wallet sends tx A, returns hash. Promise resolves, `setSubmitting(false)` | false | false | 0 | **enabled, "Approve"** |
| ~3s | Focus returns from wallet popup, so allowance refetches. Tx A is still in the mempool (waiting to be mined) | false | false | **0** (still) | enabled, "Approve" |
| ~5s | The app looks like nothing happened. User clicks again, confirms. Wallet sends tx B (next nonce, same args) | → false | → false | 0 | enabled, "Approve" |
| ~12–24s | A and B are mined in the next 1–2 blocks. Both succeed, both set the same allowance | false | false | **still 0**: no block watching, no refetch after mining | still "Approve", inviting a 3rd click |

The result is two identical `approve` txs in wallet activity, seconds apart. The user pays gas twice. The UI moves to Stake only when some unrelated refocus or remount happens to refetch the allowance.

Why it happens:
1. `isPending`/`submitting` cover only the signing step (~3s), not the ≥12s it takes to mine.
2. Nothing waits for the receipt (the record that the tx was mined).
3. Nothing refetches the allowance after mining. The only refetch comes on refocus, and that fires *before* mining, so it reads 0.

## Ticket 2: rejected approval leaves the button dead

`await writeContractAsync(...)` throws `UserRejectedRequestError`. There is no `try/finally`, so `setSubmitting(false)` never runs.

| t | Event | `isPending` | `submitting` | Button |
|---|---|---|---|---|
| 0s | Click. `setSubmitting(true)`, wallet popup opens | true | true | disabled, "Approving..." |
| ~2s | User rejects. Mutation goes to `error`. The `await` throws, the rest of the handler is skipped, and the promise rejection goes unhandled | **false** | **true (forever)** | disabled, labeled **"Approve"** |

The label reads `isPending`, which is false, so it says "Approve". `disabled` reads `isPending || submitting`, which is true, so it can't be clicked. `submitting` is local state and only resets on remount, which is why only a full reload fixes it. The same happens for any other thrown error: wrong chain, RPC error, failed gas estimate.

---

## Fix: track the tx lifecycle, not the popup

The button must stay locked through every step: **signing → sent → mined → allowance refetched**. It must unlock immediately on any failure.

```tsx
const { data: allowance, refetch: refetchAllowance } = useReadContract(allowanceArgs);
const { writeContractAsync, isPending: isSigning } = useWriteContract();
const [hash, setHash] = useState<`0x${string}`>();
const [error, setError] = useState<string>();
const lock = useRef(false); // blocks a double-click before React re-renders

const receipt = useWaitForTransactionReceipt({ hash }); // also follows speed-up/replace

useEffect(() => {
  if (!hash) return;
  if (receipt.isSuccess) {
    if (receipt.data.status === "success") {
      // wait for the fresh allowance before unlocking, so the UI goes straight to Stake
      refetchAllowance().finally(() => { setHash(undefined); lock.current = false; });
    } else {
      setError("Approval reverted");
      setHash(undefined); lock.current = false;
    }
  } else if (receipt.isError) {
    setError("Could not confirm approval");
    setHash(undefined); lock.current = false;
  }
}, [hash, receipt.isSuccess, receipt.isError]);

const busy = isSigning || !!hash;

async function approve() {
  if (lock.current) return;
  lock.current = true;
  setError(undefined);
  try {
    setHash(await writeContractAsync(approveArgs)); // stay locked: tx sent, not mined
  } catch (e) {
    lock.current = false; // unlock on reject / any error
    if (!(e instanceof BaseError && e.walk(x => x instanceof UserRejectedRequestError)))
      setError(e instanceof BaseError ? e.shortMessage : "Approval failed");
    // user rejection: silently back to idle, button clickable again
  }
}

<button disabled={busy} onClick={approve}>
  {isSigning ? "Confirm in wallet..." : hash ? "Approving..." : "Approve"}
</button>
{error && <p role="alert">{error}</p>}
```

(`BaseError`, `UserRejectedRequestError` come from `viem`. `useWaitForTransactionReceipt` comes from `wagmi`.)

What each piece fixes:
- **Remove the `submitting` flag.** `isPending` from `useWriteContract` already covers signing and resets on error. The extra flag was what stuck in ticket 2.
- **`try/catch`** unlocks on rejection or any error (ticket 2). A user rejection is not shown as an error. Real errors get a message.
- **Store `hash` and pass it to `useWaitForTransactionReceipt`.** Keep the button disabled and labeled "Approving..." until the receipt arrives (ticket 1).
- **On a successful receipt, `refetchAllowance()`, and unlock only after it resolves.** The UI goes straight from "Approving..." to Stake, with no enabled "Approve" in between. A reverted receipt or wait error unlocks with a message.
- **The `useRef` lock** blocks a fast double-click that lands before `isSigning` or `hash` has re-rendered the button as disabled.
- Optional: persist `hash` (e.g. in `sessionStorage`) so a reload mid-confirmation keeps the lock instead of offering "Approve" again.
