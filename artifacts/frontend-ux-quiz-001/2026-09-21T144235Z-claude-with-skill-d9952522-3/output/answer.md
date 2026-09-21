# Approve button: two tickets, one cause

The button's "busy" state is tied to the wrong moments. `isPending` covers only the wallet step. `submitting` is only cleared if the call succeeds. Neither one tracks the thing that matters: the approval being mined and the allowance read showing it.

Two facts about wagmi v2 that the code gets wrong:

- `writeContractAsync` resolves as soon as the wallet **sends the tx and returns its hash**. It does not wait for the tx to be mined. `isPending` (the mutation's pending flag) goes `false` at the same moment.
- `useReadContract` with default options **does not watch new blocks**. It only refetches on mount, window refocus or reconnect. So the allowance won't update on its own after the approval is mined.

---

## Ticket 1: two identical approvals seconds apart

**Timeline (mainnet, ~12s blocks):**

| t | Event | `isPending` | `submitting` | allowance read | Button |
|---|---|---|---|---|---|
| 0s | User clicks Approve | true | true | 0 | disabled, "Approving..." |
| ~4s | User confirms in wallet, wallet returns hash. `writeContractAsync` resolves, then `setSubmitting(false)` | **false** | **false** | 0 (tx 1 is in the mempool) | **enabled, "Approve"** |
| ~6s | Nothing looks like it happened, so the user clicks again | true | true | 0 | disabled |
| ~8s | User confirms again, hash 2 returned | false | false | 0 | enabled, "Approve" |
| ~12–24s | tx 1 and tx 2 get mined in the next block or two | false | false | **still 0**: no refetch triggered | still "Approve" |
| later | Tab refocus or remount refetches, allowance shows up, UI swaps to Stake | | | ≥ amount | Stake |

The busy state ends at the hash, not at the receipt. That leaves a window of at least one block, often longer, where the button is enabled again. It still says "Approve" and gives no sign that a tx is in progress. The allowance doesn't refetch on its own, so the window can stay open long after the tx is mined, and a third approval is possible too. Both txs go through. `approve` sets the allowance rather than adding to it, so no funds are at risk, but the user pays gas twice.

## Ticket 2: rejection leaves the button dead until reload

**Timeline:**

| t | Event | `isPending` | `submitting` | Button |
|---|---|---|---|---|
| 0s | Click, then `setSubmitting(true)` | true | true | disabled, "Approving..." |
| ~3s | User rejects in wallet. `writeContractAsync` **throws** `UserRejectedRequestError` | false (mutation is now in the error state) | **true** | disabled, label goes back to "Approve" |
| forever | The line after `await` never runs, so `setSubmitting(false)` is skipped. The rejection is also unhandled: no catch, no message | false | true | **dead**: `false \|\| true` = disabled |

The button looks idle ("Approve") but can't be clicked, and nothing explains why. Only a reload resets the `useState`. The same happens on any other error: RPC failure, gas estimation revert, wrong chain.

---

## Fix: one pending state, from click to allowance refetch, released in `finally`

Rules:

1. **One busy state per action.** It starts on click. It is held through signing, **the receipt**, **and the allowance refetch**. Don't mix `isPending` with a separate flag.
2. **Release it in `finally`.** A rejection or any other error must always unlock the button.
3. **Approve vs Stake comes only from the fresh onchain allowance read.** After the receipt, refetch it explicitly (or watch blocks). Release the busy state only after the refetch has finished. Then the swap to Stake happens in the same render that unlocks the button, so "Approve" is never clickable while an approval is in flight.
4. **Add a synchronous guard (`useRef`)** so two very fast clicks can't both start before React re-renders the button as disabled.
5. **Show errors as plain text next to the button.** A rejection just gets a soft "Approval cancelled" message. Treat a reverted receipt as an error.

```tsx
import { useRef, useState } from "react";
import { BaseError, UserRejectedRequestError } from "viem";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";

type Phase = "idle" | "signing" | "confirming";

const publicClient = usePublicClient();
const { writeContractAsync } = useWriteContract();
const { data: allowance, refetch: refetchAllowance } = useReadContract(allowanceArgs);

const [phase, setPhase] = useState<Phase>("idle");
const [error, setError] = useState<string | null>(null);
const inFlight = useRef(false);

async function approve() {
  if (inFlight.current) return;          // sync guard against double-click
  inFlight.current = true;
  setError(null);
  setPhase("signing");
  try {
    const hash = await writeContractAsync(approveArgs);
    setPhase("confirming");
    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Approval reverted");
    await refetchAllowance();            // fresh onchain read decides Approve vs Stake
  } catch (e) {
    const rejected =
      e instanceof BaseError && e.walk((x) => x instanceof UserRejectedRequestError);
    setError(rejected ? "Approval cancelled in wallet." : humanizeError(e));
  } finally {
    inFlight.current = false;            // always unlock, even on rejection
    setPhase("idle");
  }
}

const busy = phase !== "idle";

<button disabled={busy} onClick={approve}>
  {phase === "signing" ? "Confirm in wallet..."
    : phase === "confirming" ? "Approving (waiting for block)..."
    : "Approve"}
</button>
{error && <p role="alert">{error}</p>}
```

How this fixes each ticket:

- **Ticket 1:** the button stays disabled with a "waiting for block" label from the click until the receipt arrives (~12s+) and the allowance refetch finishes. Then the UI swaps to Stake. There is never a moment where an enabled "Approve" sits next to a pending approval.
- **Ticket 2:** the rejection throws into `catch`, which shows a message. `finally` then resets `phase` and the ref, so the button is clickable right away with no reload.

Optional extras: `waitForTransactionReceipt` already follows sped-up/replaced txs (use `onReplaced` if you want to show that). If you'd rather keep this declarative, `useWaitForTransactionReceipt({ hash })` plus `refetchAllowance` in an effect works too. The rule stays the same: busy covers click → receipt → refetch, and it always resets on error.
