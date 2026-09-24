# Why the USDT approval reverts after the first run

## Short version

USDT's `approve()` has an extra guard that standard ERC-20s don't:

```solidity
// Tether (0xdAC1...1ec7), approve() via the ERC20 base it inherits
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32) {
    // To change the approve amount you first have to reduce the addresses`
    // allowance to zero by calling `approve(_spender, 0)` if it is not
    // already 0 ...
    require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
    ...
}
```

That `require` is a **non-zero → non-zero transition block**. It was added as a
mitigation for the well-known ERC-20 approve race (a spender who watches the
mempool can front-run an allowance change and spend the old allowance *and*
the new one).

Map that onto the observed behaviour exactly:

- **Run 1:** `allowance(router, strategy) == 0`, so `_value != 0 && allowed != 0`
  is false. The guard passes. The approval succeeds. ✅
- **The strategy then spends less than it was approved for**, so a non-zero
  remainder is left sitting in `allowed[router][strategy]`.
- **Run 2 onwards:** the router calls `approve(strategy, newAmount)` with
  `newAmount != 0` while the leftover is still `!= 0`. The guard's `require`
  fires, USDT reverts, the low-level call returns `ok == false`, and the router
  hits `require(ok, "approve failed")` — *before* any transfer, which is what
  you see. ❌

USDC has no such guard (it's a plain OZ-style `approve`), so overwriting a
non-zero allowance is fine there and every run succeeds. Nothing about ETH
balance, pausing, blocklists, or amount size is involved — the failure is purely
a function of the *previous* allowance being non-zero.

The 3-week pattern is the fingerprint: the *first* USDT run is the only one that
ever started from a zero allowance.

## A second, separate bug hiding in the same line

The low-level call was introduced because "an earlier version reverted while
decoding the return value of some tokens." That diagnosis was right — USDT's
`approve` is declared with **no return value**, so an `IERC20(token).approve(...)`
call against it reverts in the ABI decoder under Solidity ≥0.4.22.

But the replacement over-corrects. `(bool ok, )` ignores the returndata
entirely, which means the router will also treat as success:

- a token whose `approve` returns `false` instead of reverting (the "ok but
  false" family), and
- a call to an address with **no code at all** — the EVM returns success for a
  call to an EOA/empty account. A misconfigured or self-destructed `token`
  address silently "approves".

So even once the revert is fixed, this line shouldn't stay as a raw `call`.

## The minimal fix

You're already on `@openzeppelin/contracts` v5, which ships exactly the right
primitive. Replace the low-level call with `SafeERC20.forceApprove`:

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TreasuryRouter {
    using SafeERC20 for IERC20;

    function _approveStrategy(address token, address strategy, uint256 amount) internal {
-       (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
-       require(ok, "approve failed");
+       IERC20(token).forceApprove(strategy, amount);
    }
}
```

`forceApprove` does precisely what USDT needs:

```solidity
function forceApprove(IERC20 token, address spender, uint256 value) internal {
    bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));
    if (!_callOptionalReturnBool(token, approvalCall)) {
        _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
        _callOptionalReturn(token, approvalCall);
    }
}
```

1. Tries the approve. On USDT-with-leftover this fails, so it
2. approves `0` first (always allowed by the guard — `_value == 0` short-circuits it),
3. then re-approves the real amount.

And it fixes the return-decoding problem properly at the same time:
`_callOptionalReturn` tolerates *no* returndata (USDT) but still rejects
`false` returndata, and it reverts on a token address with no code — so you get
the non-standard-token tolerance you wanted without the silent-success hole.

Two notes on the v5 API specifically:

- **`safeApprove` no longer exists** in OZ v5 (removed in 4.x/5.0 cleanup).
  Don't reach for it; `forceApprove` is the replacement.
- If you'd rather not depend on `forceApprove`'s try/fallback, the equivalent
  hand-rolled minimal change is a double approve, which is also safe on USDC:

  ```solidity
  IERC20(token).safeApprove... // ✗ gone in v5
  IERC20(token).forceApprove(strategy, 0);      // ✓ explicit
  IERC20(token).forceApprove(strategy, amount);
  ```

  `forceApprove` does this only on failure, so it's one SSTORE cheaper in the
  common case. Prefer it.

## What to do about the leftover allowance in general

Fixing the revert is not the same as fixing the standing allowance, and the
leftover is the more interesting problem. A treasury router that leaves a
non-zero allowance to a strategy between runs is holding a permanently open
door: **any** bug, upgrade, admin key compromise, or malicious proxy
implementation on the strategy side can drain up to that remainder from the
router at any time, with no further action from you. The allowance is live
24/7; the strategy only needs it for the seconds it's actually pulling.

The rule: **allowances should be scoped to a single run and closed at the end of it.**

Concretely, in order of preference:

1. **Best — don't approve at all; push instead.** If the strategy exposes a
   `deposit(amount)`-style entrypoint that can be fed directly, use
   `safeTransfer` to move the tokens and have the strategy account for what it
   received. No allowance ever exists. This removes the whole class of problem
   and is usually a small change on the strategy side.

2. **If you must approve — approve exactly, then zero it in the same transaction.**

   ```solidity
   IERC20(token).forceApprove(strategy, amount);
   IStrategy(strategy).run(token, amount);          // may spend < amount
   IERC20(token).forceApprove(strategy, 0);         // always, unconditionally
   ```

   The trailing zeroing is the important line. Do it unconditionally rather
   than `if (allowance != 0)` — the branch costs more than it saves once you
   account for the SLOAD, and unconditional is easier to audit. This also means
   every subsequent run starts from a zero allowance, so the USDT guard is
   never even reached.

   If `run` can revert and you swallow that with try/catch, make sure the
   zeroing still happens on the failure path.

3. **Never use `type(uint256).max` ("infinite approve") here.** It's a common
   gas optimisation for user-facing routers where the user is approving *their
   own* router, but for a treasury contract approving a separate strategy it
   converts a bounded, per-run exposure into an unbounded, permanent one worth
   the router's entire balance of that token. Not a trade worth making for a
   treasury.

4. **Clean up the existing leftovers.** You have live non-zero USDT (and
   possibly USDC) allowances sitting on mainnet right now from the runs that
   already happened. Add a one-off `forceApprove(strategy, 0)` sweep, or fold it
   into the first run after the fix deploys — `forceApprove` will do it for you
   as step 2 of its fallback, but only for the tokens you actually run next.
   Anything you've stopped routing should be zeroed explicitly.

5. **Assert what you expect.** If the strategy is supposed to be exact-spend, a
   post-run `require(IERC20(token).allowance(address(this), strategy) == 0)`
   before you zero it turns "strategy quietly under-spent" into a visible
   signal instead of a silently accumulating remainder.

## Summary

| | |
|---|---|
| **Root cause** | USDT's `approve` reverts on any non-zero → non-zero allowance change; the strategy under-spends, so a non-zero leftover persists and every run after the first hits that guard. |
| **Why USDC is fine** | Standard `approve`, no such guard. |
| **Minimal fix** | Replace the raw `call` with OZ v5 `SafeERC20.forceApprove` (zeroes first on failure, and correctly handles USDT's missing return value). Note `safeApprove` is gone in v5. |
| **Bonus bug fixed** | The `(bool ok, )` pattern accepted `false` returns and calls to codeless addresses as success; `_callOptionalReturn` does not. |
| **Leftover allowance** | Don't carry one across runs. Prefer a push/`safeTransfer` design; otherwise approve the exact amount and unconditionally `forceApprove(strategy, 0)` after the run. Never infinite-approve from a treasury. Zero out the allowances already standing on mainnet. |
