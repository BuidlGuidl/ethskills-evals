# Approve button: two tickets, one root cause

The button's `disabled` state doesn't cover the whole approval process. It
relies on two flags:

- `isPending` (wagmi mutation): `true` only while the wallet popup is open.
  It goes `false` as soon as the wallet **returns a tx hash**, or as soon as
  the user rejects. It knows nothing about mining.
- `submitting` (local): cleared by a line that only runs if
  `writeContractAsync` **resolves**. It also resolves at "hash returned", not
  at "mined".

Neither flag covers **hash returned → tx mined → allowance re-read**. On the
error path, `submitting` is never cleared.

---

## Ticket 1: two identical approvals, seconds apart

`writeContractAsync` resolves with the hash right after the user signs and
the tx is broadcast. The tx is still in the mempool. On mainnet it needs
roughly 0–12s+ to be included, sometimes more than one block.

| t | Event | `isPending` | `submitting` | allowance read | Button |
|---|---|---|---|---|---|
| 0.0s | Click. `setSubmitting(true)`, wallet opens | true | true | old (0) | disabled, "Approving..." |
| ~3s | User confirms. Wallet returns hash, promise resolves | **false** | **false** (next line runs) | old (0) | **enabled, "Approve"** |
| 3–15s | Tx in mempool, waiting for a block | false | false | old (0), because nothing triggers a refetch | enabled, "Approve" |
| ~5s | User sees "Approve" again and thinks it failed. Clicks, confirms | true→false | true→false | old (0) | a second identical `approve` is sent |
| ~12–24s | Both txs mined (same or next block) | false | false | still old until a refetch happens | still "Approve" |

Why the allowance stays old: `useReadContract` with default options doesn't
watch blocks or poll. It refetches only on remount, window refocus, or a
manual `refetch`/invalidate. Nothing refetches when the approval is mined.
So the UI can keep showing Approve long after the chain has the allowance.
That invites the second click, or a third.

The two txs are identical because the second click sends the same
`approveArgs`. Both use the next nonce, so both are valid and both get
mined. The user pays gas twice.

## Ticket 2: rejection leaves the button dead until reload

When the user rejects, `writeContractAsync` **throws**
(`UserRejectedRequestError`). There's no `try/finally`, so
`setSubmitting(false)` never runs.

| t | Event | `isPending` | `submitting` | Button |
|---|---|---|---|---|
| 0.0s | Click. `setSubmitting(true)`, wallet opens | true | true | disabled, "Approving..." |
| ~2s | User clicks Reject. Promise rejects, handler exits at `await` | **false** (mutation → error) | **true, forever** | **disabled, "Approve"** |
| later | Nothing ever resets `submitting` | false | true | dead |
| reload | Component remounts, `useState(false)` | false | false | works again |

The label says "Approve" because it reads only `isPending`, which is now
false. But `disabled` also reads `submitting`, which is stuck at true. The
result looks clickable and does nothing. The rejection also shows up as an
unhandled promise rejection, and the user gets no feedback.

(No chain timing is involved here. The rejection happens before anything is
broadcast.)

---

## Fix: one lock for the whole approval, always released

Required state handling:

1. **Lock on click** with a single local flag for this button (`approving`).
   Don't share it with Stake.
2. **Hold the lock through confirmation**: after getting the hash, await the
   receipt (`waitForTransactionReceipt`).
3. **Hold the lock until the allowance read is updated**: `await refetch()`
   on the allowance query after the receipt. This way the UI goes straight
   from "Approving..." to "Stake" and never shows "Approve" in between.
4. **Always release in `finally`**, covering rejection, revert, and RPC
   errors.
5. **Handle errors explicitly**: treat a user rejection as a quiet reset (or
   a short "Approval cancelled"). For a reverted receipt or other errors,
   show a readable inline error near the button.
6. **Make the label match the real state**, e.g. "Confirm in wallet..." →
   "Approving..." (waiting for the block). Don't read label and `disabled`
   from different flags.

```tsx
import { useState } from "react";
import { useWriteContract, useReadContract, usePublicClient } from "wagmi";
import { UserRejectedRequestError } from "viem";

type ApproveStep = "idle" | "signing" | "confirming";

const publicClient = usePublicClient();
const { writeContractAsync } = useWriteContract();
const { data: allowance, refetch: refetchAllowance } = useReadContract({
  ...allowanceArgs,
  query: { refetchInterval: 4_000 }, // also pick up changes made elsewhere
});

const [step, setStep] = useState<ApproveStep>("idle");
const [error, setError] = useState<string | null>(null);
const approving = step !== "idle";

async function onApprove() {
  if (approving) return;                 // guard against a double click in the same tick
  setError(null);
  setStep("signing");
  try {
    const hash = await writeContractAsync(approveArgs);  // wallet popup
    setStep("confirming");
    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Approval reverted");
    await refetchAllowance();            // UI switches to Stake before unlock
  } catch (e) {
    const rejected =
      e instanceof Error &&
      (e.name === "UserRejectedRequestError" ||
        (e as any).cause instanceof UserRejectedRequestError);
    setError(rejected ? null : parseContractError(e)); // readable message
  } finally {
    setStep("idle");                     // always unlock: fixes ticket 2
  }
}

<button disabled={approving} onClick={onApprove}>
  {step === "signing" ? "Confirm in wallet..."
    : step === "confirming" ? "Approving..."
    : "Approve"}
</button>
{error && <p role="alert">{error}</p>}
```

How this closes each ticket:

- **Ticket 1**: the button stays disabled from click → hash → receipt →
  refreshed allowance. By the time `step` returns to `idle`, the allowance
  read already shows enough, so the parent renders **Stake** in place of
  Approve. There's never a moment with an enabled "Approve" and an approval
  still in flight. The `if (approving) return` guard also blocks a double
  click that lands before React re-renders.
- **Ticket 2**: `finally` always resets `step`. A rejection gives back a
  working "Approve" button right away, with no reload.

Notes:

- Wagmi alternative: store `hash` in state and use
  `useWaitForTransactionReceipt({ hash })`. Then derive
  `disabled = isPending || (!!hash && !receipt.isSuccess && !receipt.isError)`,
  and in an effect on success: `await refetch()`, then clear `hash`. The idea
  is the same: the lock covers the receipt and the refetch. The imperative
  version above keeps it in one place.
- If the allowance RPC can lag the receipt (load-balanced nodes), add a short
  lock after confirmation (for example ~4s, while refetching). You can also
  keep polling until `allowance >= amount` before unlocking.
- Check the flow order: wrong network → Switch Network comes before the
  Approve/Stake decision. Never show Approve and Stake at the same time.
