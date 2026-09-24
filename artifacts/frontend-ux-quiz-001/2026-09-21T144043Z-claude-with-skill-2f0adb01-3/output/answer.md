# Approve button: double approval + dead button

## Key facts about the code

- `writeContractAsync` **resolves when the wallet returns the tx hash** (signed and broadcast), **not when the tx is mined**. It **throws** if the user rejects.
- `isPending` belongs to the wagmi mutation. It is `true` only while the wallet request is open. It goes back to `false` as soon as the hash comes back (success) or the request fails (error/reject).
- `useReadContract` with default options **does not poll and does not watch blocks**. It refetches only on mount, window refocus, or reconnect, or when you call it yourself (`refetch` / `invalidateQueries`). A pending tx also doesn't change `allowance` until it is in a block.
- Nothing covers the time between "hash returned" and "allowance read shows the new value". That gap is at least one block (~12s on mainnet), and with a cached read it can last forever.

---

## Ticket 1: two identical approvals, seconds apart

Cause: the button unlocks when the **hash** comes back, but the Approve→Stake switch waits for the **allowance read**. The read only changes after the block is mined and the query refetches.

Timeline (mainnet, 12s blocks):

| t | Event | `isPending` | `submitting` | allowance (cached) | Button |
|---|---|---|---|---|---|
| 0s | Click → wallet popup | true | true | 0 | disabled, "Approving..." |
| ~4s | User confirms. Wallet broadcasts and returns hash. `writeContractAsync` resolves | **false** | true → **false** (next line) | 0 | **enabled, "Approve"** |
| ~4s | Window refocuses after popup → default `refetchOnWindowFocus` refetches allowance. Tx not mined yet → still 0, cached as fresh | false | false | 0 | enabled, "Approve" |
| ~6s | User sees "Approve" again and thinks it failed → clicks again → confirms a **second identical `approve`** | true → false | true → false | 0 | enabled again |
| ~12–24s | Both txs land in block N+1/N+2. Wallet activity shows two approvals seconds apart | false | false | still 0 in cache (nothing triggers a refetch) | still "Approve" |
| later | Only a refocus/remount refetches → finally flips to Stake | | | ≥ amount | Stake |

So both `disabled` flags are already `false` for the whole ~12s+ confirmation window, and after that too, until the read refetches. The UI still shows "Approve" as if nothing happened, so a second click is the natural thing to do.

## Ticket 2: rejection → button dead until reload

Cause: `setSubmitting(false)` is only reached on the success path. There is no `try/finally`.

| t | Event | `isPending` | `submitting` | Button |
|---|---|---|---|---|
| 0s | Click → wallet popup | true | true | disabled, "Approving..." |
| ~3s | User clicks Reject. Mutation goes to error state. `writeContractAsync` **throws** `UserRejectedRequestError` | **false** | **true (stuck)** | disabled, label "Approve" |
| ~3s | `await` throws → `setSubmitting(false)` never runs. The promise rejection goes unhandled (onClick handler). No error shown | false | true | disabled |
| forever | No code path ever resets `submitting`. Blocks don't matter here: no tx exists. Only a remount (page reload) resets state | false | true | **dead** |

It looks idle (label comes from `isPending`, which is now `false`, so it says "Approve"), but `disabled={isPending || submitting}` stays `true`.

---

## Fix: state handling

The button must be locked from click until **the allowance read confirms it**, and unlocked on **every** failure path.

Phases, all included in `disabled`:

1. **`submitting`**: set on click, cleared in `finally` (covers wallet popup. Always released, including on reject/error).
2. **`approveHash` set + receipt pending**: `useWaitForTransactionReceipt({ hash })` covers broadcast → mined (~12s+).
3. **Mined but allowance not refetched yet**: after a successful receipt, call `refetch()` on the allowance read (or invalidate its query key). Keep the button locked until the read shows enough allowance. Then the UI switches to Stake and the Approve button unmounts.
4. **Failure** (reject, send error, reverted receipt): clear everything, show an inline error, and let the button work again.

Also use a ref guard so a fast double-click can't fire two requests before React re-renders.

```tsx
import { useRef, useState, useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { UserRejectedRequestError } from "viem";

const { data: allowance = 0n, refetch: refetchAllowance } = useReadContract(allowanceArgs);
const needsApproval = allowance < amount;

const { writeContractAsync } = useWriteContract();
const [submitting, setSubmitting] = useState(false);          // click -> hash (or failure)
const [approveHash, setApproveHash] = useState<`0x${string}`>(); // hash -> allowance updated
const [error, setError] = useState<string>();
const inFlight = useRef(false);                                // sync double-click guard

const receipt = useWaitForTransactionReceipt({ hash: approveHash });

useEffect(() => {
  if (!approveHash) return;
  if (receipt.isError || receipt.data?.status === "reverted") {
    setError("Approval failed onchain");
    setApproveHash(undefined);          // unlock
  } else if (receipt.data?.status === "success") {
    refetchAllowance();                 // default read won't refresh on its own
  }
}, [approveHash, receipt.isError, receipt.data, refetchAllowance]);

// Release lock only once fresh chain state shows the approval
useEffect(() => {
  if (approveHash && receipt.data?.status === "success" && !needsApproval) {
    setApproveHash(undefined);
  }
}, [approveHash, receipt.data, needsApproval]);

const approving = submitting || !!approveHash;

<button
  disabled={approving}
  onClick={async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(undefined);
    try {
      const hash = await writeContractAsync(approveArgs);
      setApproveHash(hash);             // set before submitting clears -> no unlocked gap
    } catch (e) {
      setError(e instanceof UserRejectedRequestError ||
               (e as any)?.cause instanceof UserRejectedRequestError
        ? "Approval rejected in wallet"
        : "Could not send approval");
    } finally {
      setSubmitting(false);             // always runs -> fixes ticket 2
      inFlight.current = false;
    }
  }}
>
  {submitting ? "Confirm in wallet..." : approveHash ? "Approving..." : "Approve"}
</button>
{error && <p role="alert">{error}</p>}
```

Why this fixes both tickets:

- **Ticket 1**: `setApproveHash(hash)` runs in the same handler before `finally` clears `submitting`, and React batches both updates. So there is never a render where both are false. The button stays locked through the ~12s block wait and the allowance refetch, and only unlocks when the component switches to Stake. The label says "Approving..." the whole time, so the user doesn't think the click failed. The explicit `refetchAllowance()` after the receipt makes the switch happen right away, instead of waiting for a random refocus.
- **Ticket 2**: `finally` always clears `submitting`/`inFlight`. On reject, `approveHash` is never set, so the button unlocks right away and shows an inline "rejected" message. No reload needed.

Optional hardening: give the allowance read a `query: { refetchInterval: 4_000 }` (or `enabled` polling only while `approveHash` is set) as a fallback in case the post-receipt refetch hits a lagging RPC node that hasn't seen the block yet.
