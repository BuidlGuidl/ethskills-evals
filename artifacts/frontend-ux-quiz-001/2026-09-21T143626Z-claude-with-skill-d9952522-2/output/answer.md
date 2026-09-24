# Approve button: two QA tickets

## Two facts about this code

1. **`writeContractAsync` resolves once the wallet hands back the tx hash**, not when the tx is mined. `isPending` from `useWriteContract` works the same way: it's `true` only while the wallet is open, then goes `false` as soon as the hash comes back. Neither one follows confirmation.
2. **`useReadContract` with default options doesn't refetch when new blocks arrive.** It's a cached TanStack Query. It only refetches on mount, window refocus, reconnect or a manual `refetch`/invalidate. Nothing in this code tells it an approval happened.

Also, `setSubmitting(false)` sits on the line after the `await`, with no `try/finally`.

---

## Ticket 1: two identical approvals, seconds apart

Timeline on mainnet (~12s blocks):

| t | Event | `isPending` | `submitting` | Allowance read | Button |
|---|---|---|---|---|---|
| 0s | Click → `setSubmitting(true)`, wallet opens | true | true | 0 (cached) | disabled, "Approving..." |
| ~3s | User signs; wallet returns hash; promise resolves; `setSubmitting(false)` | **false** | **false** | 0 (cached) | **enabled, "Approve"** |
| 3–15s+ | Tx sits in mempool, waiting for a block | false | false | 0 | enabled, "Approve" |
| ~5s | User sees nothing changed and clicks again → signs a 2nd identical `approve` | … | … | … | … |
| ~15s | Both txs get mined | false | false | **still 0 (cached)**: nothing refetches it | still "Approve" |

Both pending flags clear at *signature* time, so there's no busy state for the whole wait until the tx is mined (≥1 block, often more). The allowance read never refreshes either, so the button still says "Approve" even after the tx is mined. To the user it looks like the approval did nothing, so they sign it again. That produces two identical txs, seconds apart. Both go through, and the user pays gas twice. Worse, the UI can stay on "Approve" until they refocus the tab, which invites a third click.

## Ticket 2: rejection leaves the button dead until reload

| t | Event | `isPending` | `submitting` | Button |
|---|---|---|---|---|
| 0s | Click → `setSubmitting(true)`, wallet opens | true | true | disabled |
| ~2s | User rejects → `writeContractAsync` **throws** `UserRejectedRequestError` | false | **true** | disabled |
| forever | `setSubmitting(false)` never runs (the throw skips it); unhandled promise rejection; no error shown | false | true | **disabled** |

No blocks are involved. The rejection throws, and the line that clears `submitting` never runs. `isPending` recovers, but `disabled={isPending || submitting}` stays `true` because `submitting` is stuck at `true`. That state lives only in memory, so only a page reload clears it.

---

## Fix: one busy state from click to fresh allowance, always released

Rules:
- **One busy state per button**, held from click → signature → **receipt** → **allowance refetch done**. Don't rely on `isPending` for this.
- **Release it in `finally`**, so a rejection, revert or RPC error can't leave it stuck.
- **Catch and show errors** next to the button. A wallet rejection gets a quiet "Approval cancelled" message, not a crash.
- **Check `receipt.status`.** A reverted approval isn't a success.
- **Approve vs Stake comes only from the fresh onchain allowance**, never from a local "approved" flag. Refetch it explicitly after the receipt.
- A **ref guard** blocks a second click that lands before React has re-rendered the button as disabled.

```tsx
import { useRef, useState } from "react";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { BaseError, UserRejectedRequestError } from "viem";

type Step = "idle" | "signing" | "confirming" | "syncing";

const { writeContractAsync } = useWriteContract();
const publicClient = usePublicClient();
const { data: allowance, refetch: refetchAllowance } = useReadContract(allowanceArgs);

const [step, setStep] = useState<Step>("idle");
const [error, setError] = useState<string | null>(null);
const busyRef = useRef(false);
const busy = step !== "idle";

async function approve() {
  if (busyRef.current) return;
  busyRef.current = true;
  setError(null);
  setStep("signing");
  try {
    const hash = await writeContractAsync(approveArgs);
    setStep("confirming");
    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Approval reverted");
    setStep("syncing");
    await refetchAllowance(); // UI swaps to Stake only once this shows enough allowance
  } catch (e) {
    const rejected =
      e instanceof BaseError && e.walk((x) => x instanceof UserRejectedRequestError);
    setError(rejected ? "Approval cancelled in wallet." : (e as BaseError).shortMessage ?? "Approval failed.");
  } finally {
    busyRef.current = false;
    setStep("idle");
  }
}

const label = {
  idle: "Approve",
  signing: "Confirm in wallet...",
  confirming: "Approving...",
  syncing: "Updating...",
}[step];

<>
  <button disabled={busy} onClick={approve}>{label}</button>
  {error && <p role="alert">{error}</p>}
</>
```

How this fixes each ticket:
- **Ticket 1:** the button stays disabled from the click until the tx is mined and the allowance has been reloaded. Then the UI swaps Approve for Stake, so there's never an enabled "Approve" to click a second time.
- **Ticket 2:** on rejection, the `catch` shows "Approval cancelled" and `finally` puts the button back to idle right away. No reload needed.

The same approach works with `useWaitForTransactionReceipt({ hash })` instead of `waitForTransactionReceipt`. The rule is the same: busy = signing ∨ waiting for receipt ∨ refetching, and the Stake step appears only after the fresh read. Apply the same pattern to the Stake button.
