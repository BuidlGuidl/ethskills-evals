# Approve button: double approval + dead button after rejection

## Key facts about this code

- `writeContractAsync` **resolves when the wallet returns the tx hash** (signed and sent), **not when the tx is mined**. `isPending` only covers the wallet prompt step.
- `useReadContract` with default options **does not watch blocks and does not poll**. It refetches only on mount, window focus, or reconnect. Nothing tells it the approval was mined.
- The handler has **no `try/finally`**. If the promise rejects, `setSubmitting(false)` never runs.

So `disabled={isPending || submitting}` protects only the wallet prompt step. It does not cover the wait for the block, and it breaks on errors.

---

## Ticket 1: two identical approvals, seconds apart

Timeline on mainnet (~12s blocks):

| t | Event | `isPending` | `submitting` | allowance (cached) | Button |
|---|---|---|---|---|---|
| 0s | Click → wallet popup | true | true | 0 | disabled, "Approving..." |
| ~4s | User confirms, wallet sends tx, promise resolves with hash | false | false | 0 | **enabled, "Approve"** |
| 4s → ~16s+ | Tx waits in mempool for next block (may take >1 block) | false | false | 0 (stale) | **enabled, "Approve"** |
| ~6s | User sees plain "Approve" again, thinks it failed, clicks | true | true | 0 | disabled |
| ~9s | Confirms again → **second identical approve tx** | false | false | 0 | enabled, "Approve" |
| ~16s | Tx 1 mined, allowance on-chain = amount | false | false | **still 0**, no refetch | still "Approve" |

- The gap: from "hash returned" until "allowance read updated", every flag says idle. The button is live and still says "Approve".
- It is worse than one block. The allowance read never refetches by itself, so the UI can stay on "Approve" long after the tx is mined. It only moves on after a window-focus event or a remount. A focus refetch that runs *before* the tx is mined also reads 0, and the UI stays stuck.
- Smaller cause: `setSubmitting(true)` is a React state update, so the disabled flag only takes effect on the next render. A fast double-click can fire `onClick` twice before that render. You need a synchronous guard (a ref).

## Ticket 2: rejection leaves the button dead

| t | Event | `isPending` | `submitting` | Button |
|---|---|---|---|---|
| 0s | Click → wallet popup | true | true | disabled, "Approving..." |
| ~3s | User rejects → `writeContractAsync` throws `UserRejectedRequestError` | false (mutation → error) | **true (never reset)** | **disabled, "Approve"** |
| forever | `setSubmitting(false)` was skipped by the throw; error is an unhandled rejection | false | true | dead until reload |

The label goes back to "Approve" because the label reads `isPending`, but `disabled` is still true because of `submitting`. Only a remount (full reload) resets local state. No block timing is involved: the button breaks as soon as the user rejects.

---

## Fix: one explicit phase that lasts until the allowance read is fresh

Rules:
1. Model the flow as phases: `idle → signing → confirming → syncing → idle`. Keep the button disabled in every phase except `idle`.
2. After getting the hash, **wait for the receipt** and check `status === "success"`.
3. After a successful receipt, **refetch the allowance** and stay disabled until the refetch returns. Then the UI swaps to Stake without ever showing a live Approve button in between.
4. Wrap the flow in `try/catch/finally` and always return to `idle`. Treat a user rejection as a quiet cancel, not an error.
5. Use a **ref lock** to block the double-click before re-render.

```tsx
import { useRef, useState } from "react";
import { useConfig, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { BaseError, UserRejectedRequestError } from "viem";

type Phase = "idle" | "signing" | "confirming" | "syncing";

const isUserRejection = (e: unknown) =>
  e instanceof BaseError &&
  !!e.walk((err) => err instanceof UserRejectedRequestError);

function ApproveButton() {
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const allowance = useReadContract(allowanceArgs);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  async function approve() {
    if (lock.current) return; // sync guard vs double-click
    lock.current = true;
    setError(null);
    try {
      setPhase("signing");
      const hash = await writeContractAsync(approveArgs);

      setPhase("confirming");
      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status !== "success") throw new Error("Approval reverted");

      setPhase("syncing");
      await allowance.refetch(); // UI flips to Stake from fresh data
    } catch (e) {
      if (!isUserRejection(e)) setError("Approval failed. Try again.");
    } finally {
      lock.current = false;
      setPhase("idle");
    }
  }

  const label = {
    idle: "Approve",
    signing: "Confirm in wallet…",
    confirming: "Approving… (waiting for block)",
    syncing: "Finalizing…",
  }[phase];

  return (
    <>
      <button disabled={phase !== "idle"} onClick={approve}>{label}</button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
```

How this fixes each ticket:
- **Ticket 1:** the button stays disabled and labeled through signing, the ~12s+ block wait, and the allowance refetch. By the time it goes back to `idle`, the allowance is already enough and the parent shows Stake. There is never a window where "Approve" is clickable while the first tx is in flight. The ref lock covers the same-frame double-click.
- **Ticket 2:** the rejection lands in `catch` (ignored quietly), and `finally` always resets `phase` and the lock. The button works again right away.

Optional hardening:
- If the RPC is load-balanced, a node that is a block behind can return the old allowance after the receipt. Check that the refetched value is `>= required` and retry briefly before going back to `idle`.
- `waitForTransactionReceipt` already follows speed-up/cancel replacements. If you want the "confirming" state to survive a page reload, save the hash in `localStorage`.
