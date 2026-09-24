# Approve button: two bugs, one cause

Both tickets come from one wrong assumption: **"once `writeContractAsync` is done, the approval is done."**

- `writeContractAsync` resolves as soon as the wallet **returns the tx hash** (tx signed and broadcast). The tx is not mined yet at that point.
- `isPending` goes `false` at the same moment. It only covers "waiting for the wallet"; it knows nothing about the chain.
- If the user rejects, `writeContractAsync` **throws** (`UserRejectedRequestError`). There is no `try/finally`, so nothing after the `await` runs.
- `useReadContract` with default options **does not poll**. It refetches only on mount, on window refocus, or when you call `refetch()` / invalidate it. Nothing in this code tells it an approval just happened.

---

## Ticket 1: two identical approvals, seconds apart

The button unlocks after the hash comes back but **before** the allowance changes. So it shows "Approve" again, clickable, while the first approval is still waiting to be mined.

Timeline on mainnet (12s blocks):

| t | Event | `isPending` | `submitting` | allowance read | Button |
|---|---|---|---|---|---|
| 0s | Click. `setSubmitting(true)`, wallet popup opens | true | true | 0 | disabled, "Approving..." |
| ~3s | User confirms in wallet, wallet broadcasts tx, returns hash. `writeContractAsync` resolves, `setSubmitting(false)` | **false** | **false** | 0 | **enabled, "Approve"** |
| ~3s | Wallet popup closes, window refocuses, allowance refetch runs, still 0 (tx is only in the mempool) | false | false | 0 | enabled, "Approve" |
| ~5s | User sees "Approve" again, thinks the first click failed, clicks again. Second popup, confirms | true then false | true then false | 0 | enabled again |
| ~12–24s | Both approvals mined (same args, so same allowance, gas paid twice) | false | false | still 0 in cache | still "Approve" |
| later | Allowance only updates on the next refocus/remount. Until then the button can be clicked a 3rd time | | | | |

So the "dead zone" is: from **hash returned** to **tx mined** (about 1 block, 12s or more), plus from **mined** to **allowance cache refreshed** (unbounded here, since nothing polls). The code covers neither gap. Two approvals seconds apart match a user clicking again right after the first hash came back.

## Ticket 2: rejected approval, button dead until reload

| t | Event | `isPending` | `submitting` | Button |
|---|---|---|---|---|
| 0s | Click. `setSubmitting(true)`, wallet popup | true | true | disabled, "Approving..." |
| ~2s | User clicks Reject. Mutation errors, `writeContractAsync` **throws** | **false** | **true** | disabled, label goes back to "Approve" |
| ~2s+ | `await` threw, so `setSubmitting(false)` never runs. Unhandled promise rejection, no error shown | false | **true forever** | **disabled "Approve", no feedback** |

`disabled={isPending || submitting}` stays `true` because `submitting` is stuck. Only a remount (page reload) resets `useState`. The label says "Approve" (it only reads `isPending`), so the button looks normal but does nothing. That is the "dead button".

---

## Fix: track the whole lifecycle, always release on failure

The button must stay locked through **all** of these, and unlock on **any** failure:

1. **Waiting for wallet**: click until hash or rejection
2. **Confirming**: hash until receipt (tx mined)
3. **Syncing**: receipt until the allowance read actually shows the new value

```tsx
const { writeContractAsync } = useWriteContract();
const publicClient = usePublicClient();
const { data: allowance, refetch: refetchAllowance } = useReadContract(allowanceArgs);

type ApproveStep = "idle" | "wallet" | "confirming" | "syncing";
const [step, setStep] = useState<ApproveStep>("idle");
const [error, setError] = useState<string | null>(null);
const inFlight = useRef(false); // sync guard: blocks a 2nd click before React re-renders

const needsApproval = allowance === undefined || allowance < amount;

async function onApprove() {
  if (inFlight.current) return;
  inFlight.current = true;
  setError(null);
  setStep("wallet");
  try {
    const hash = await writeContractAsync(approveArgs);           // throws on reject
    setStep("confirming");
    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Approval reverted");
    setStep("syncing");
    await refetchAllowance();   // pull fresh allowance, don't wait for a refocus
  } catch (e) {
    setError(parseTxError(e));  // "Approval rejected in wallet", revert reason, etc.
  } finally {
    inFlight.current = false;   // always release, including on rejection
    setStep("idle");
  }
}

const busy = step !== "idle";
const label = {
  idle: "Approve",
  wallet: "Confirm in wallet...",
  confirming: "Approving...",
  syncing: "Approving...",
}[step];

{needsApproval ? (
  <>
    <button disabled={busy} onClick={onApprove}>{label}</button>
    {error && <p role="alert">{error}</p>}
  </>
) : (
  <StakeButton />
)}
```

Why each part matters:

- **`try/catch/finally`**: fixes ticket 2. A reject (or revert, or RPC error) always returns to `idle`, and the user sees an error message instead of a silent dead button.
- **Wait for the receipt before unlocking** (`waitForTransactionReceipt`, or `useWaitForTransactionReceipt({ hash })` if you prefer hooks): fixes the main part of ticket 1. The button stays locked for the 12s+ the tx needs to be mined, not just until the hash returns.
- **`await refetchAllowance()` before unlocking**: closes the second gap. With default `useReadContract` options nothing refetches by itself. After this, `needsApproval` is `false` and the UI swaps straight to Stake, so "Approve" is never clickable again for this approval. If your RPC can lag behind the block it just reported, add a short cooldown/re-check (e.g. keep `syncing` until `allowance >= amount` or ~4s pass, then refetch once more).
- **`useRef` guard**: `useState` updates only take effect on the next render. A ref blocks a very fast double click in the same tick.
- **Label from `step`, not `isPending`**: the label and disabled state come from one source, so the button can never look ready while it is locked, or look locked while it is ready.
- **Check `receipt.status`**: a reverted approval should show an error and re-enable Approve, not go to "syncing" as if it worked.

Also worth doing: when there's a wrong-network or not-connected state, check it before this approval branch (Connect → Switch Network → Approve → Stake), so the button never tries to approve on the wrong chain.
