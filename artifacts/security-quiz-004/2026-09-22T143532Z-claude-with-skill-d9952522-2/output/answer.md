# Why the approval reverts only for USDT, and only after the first run

## Short answer

USDT (`0xdAC17F958D2ee523a2206206994597C13D831ec7`) implements the
"approval race protection" guard inside `approve`:

```solidity
// TetherToken.approve, paraphrased
require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
```

So `approve(spender, amount)` **reverts** whenever the *current* allowance is
nonzero and the *new* amount is nonzero. Going nonzero → nonzero is simply not
a legal transition on USDT; you must pass through zero.

That maps exactly onto the observed behaviour:

- **Run 1:** allowance for the strategy is `0` → `0 → amount` is allowed →
  succeeds.
- **Run 2+:** the strategy "frequently spends less than it was approved for",
  so a nonzero leftover allowance is still sitting there → `nonzero → nonzero`
  → the token reverts → the low-level call returns `ok == false` →
  `require(ok, "approve failed")` fires, before any transfer happens.
- **USDC** has a plain ERC-20 `approve` with no such guard, so overwriting a
  nonzero allowance is fine every time. That is why only USDT is affected.

The revert is inside the token, not in the router's decoding, which is why it
happens "always at that require" and why gas, pausing, blocklists and the size
of the amounts are all red herrings.

## The second bug hiding in the same two lines

The low-level call was introduced to work around USDT's *other* non-standard
trait: its `approve`/`transfer` declare no return value, so an
`IERC20(token).approve(...)` call reverts while ABI-decoding the (absent)
`bool`. That original diagnosis was right, but the replacement is unsafe in
the other direction:

- `require(ok)` only checks that the call did not revert. It never inspects the
  return data, so a token that returns `false` instead of reverting (BAT,
  older ZRX-style tokens) is treated as a success and the run proceeds with no
  allowance.
- A raw `.call` to an address with **no code** returns `ok == true`. If `token`
  is ever misconfigured or points at a not-yet-deployed address, the router
  silently "approves" nothing.

So the fix should restore correct return-data handling as well as the
zero-first sequencing. Both are exactly what `SafeERC20` exists for.

## Minimal change to the router

You are on OpenZeppelin Contracts **v5**, where `safeApprove` has been removed
and `forceApprove` is the supported primitive. It sets the allowance, and if
that call fails, retries with `approve(spender, 0)` followed by
`approve(spender, amount)` — the exact dance USDT requires. It also tolerates
missing return values and reverts if the target has no code.

Replace:

```solidity
(bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
require(ok, "approve failed");
```

with:

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;

// ...
IERC20(token).forceApprove(strategy, amount);
```

That is the whole fix for the reported failure: no storage changes, no
interface changes, no migration. Use `SafeERC20.safeTransfer` /
`safeTransferFrom` for the pull-in and forward legs too, for the same
return-value reasons.

## What to do about the leftover allowance in general

`forceApprove` stops the leftover from *reverting* the next run, but a standing
allowance is still a live grant of your treasury's balance to the strategy. If
the strategy is ever upgraded, compromised, or has a bug in a `transferFrom`
path, that residue is drainable at any later time, with no further action from
the router.

Treat the approval as scoped to the run:

1. **Approve exactly what the run needs**, immediately before the call — never
   `type(uint256).max` for a treasury router.
2. **Revoke at the end of the run**, in the same transaction:

   ```solidity
   IERC20(token).forceApprove(strategy, amount);
   strategy.execute(token, amount);          // may spend less than `amount`
   IERC20(token).forceApprove(strategy, 0);  // settle back to zero
   ```

   Zeroing unconditionally is simpler and cheaper to reason about than reading
   `allowance()` and branching; on USDT the `amount != 0` side of the guard is
   what makes `→ 0` always legal. It also means every run starts from a clean
   `0`, so the USDT path never even needs `forceApprove`'s retry branch.
3. If the strategy pulls funds via a callback, keep checks-effects-interactions
   and a reentrancy guard on the run entry point: the window in which the
   allowance is nonzero is precisely the window in which reentering the router
   is most valuable to an attacker.
4. Prefer push over pull where the strategy supports it — `safeTransfer` the
   exact amount and let the strategy account for its own balance. Then no
   allowance exists at rest at all.

## Things worth testing before redeploying

- Pinned-mainnet-fork test against real USDT: run the router twice in a row
  with the strategy deliberately underspending on the first run. This is the
  regression that the current code fails, and it only reproduces against the
  real bytecode — a standard `ERC20` mock will pass the broken code.
- Same test against USDC, and against a token that returns `false` rather than
  reverting, to confirm the return-data handling.
- Assert `allowance(router, strategy) == 0` after every run.
