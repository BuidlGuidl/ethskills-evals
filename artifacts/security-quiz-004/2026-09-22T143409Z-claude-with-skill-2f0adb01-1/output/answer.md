# Why the approval fails for USDT, and only after the first run

## Short answer

USDT's `approve()` has a non-standard guard that **rejects any non-zero → non-zero
allowance change**. Your strategy leaves a leftover allowance behind, so from the
second run onward the current allowance is non-zero and the new approval is also
non-zero — USDT reverts, the low-level call returns `ok == false`, and you hit
`require(ok, "approve failed")`.

USDC has no such guard, so it never fails.

## The reasoning, step by step

### 1. The symptom fingerprints the cause

The failure is:

- token-specific (USDT only),
- state-dependent (first run fine, every run after fails),
- before any transfer,
- unrelated to gas, pausing, blocklists, or amount size.

The only state that differs between run 1 and run 2 at that exact line is the
**existing allowance** `allowance(router, strategy)`. Run 1 starts from 0. Runs
2+ start from the leftover the strategy did not spend. So the approve is going
`non-zero → non-zero`.

### 2. USDT's `approve` has an extra require

Tether on mainnet (`0xdAC17F958D2ee523a2206206994597C13D831ec7`) implements, in
its `approve`:

```solidity
// To change the approve amount you first have to reduce the addresses`
// allowance to zero by calling `approve(_spender, 0)` if it is not
// already 0 to mitigate the race condition described here:
// https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
```

This is an opinionated mitigation for the classic ERC-20 approval front-running
race (spender can sandwich an allowance change and spend old + new). It is not
part of ERC-20, and USDC does not implement it.

Truth table for your router:

| Run | Current allowance | New value | USDT `approve` | Result |
|-----|-------------------|-----------|----------------|--------|
| 1 | 0 | 50_000e6 | passes the require | success |
| 2 | leftover > 0 | 50_000e6 | `_value != 0 && allowed != 0` → **revert** | `ok == false` → `"approve failed"` |
| n | leftover > 0 | 50_000e6 | revert | `"approve failed"` |

That matches the observed history exactly: first run succeeded, every run since
reverts, always at the `require`.

Note that a *bare revert* (no reason string) from USDT is exactly what a
low-level `call` reports as `ok == false` — so your `require` message is
misleading: the approval didn't "fail" for a return-value reason, the token
actively rejected the transition.

### 3. Why the low-level call was there in the first place

USDT's `approve` and `transfer` also **return nothing** (no `bool`). That is the
bug the earlier version hit: an `IERC20(token).approve(...)` call with a `bool`
return type makes the compiler `abi.decode` 0 bytes of returndata and revert.
Switching to `token.call(...)` dodged that, but it swapped one bug for two:

- it silently ignores the `non-zero → non-zero` rejection semantics (this bug), and
- `ok` is `true` for a call to an address with **no code at all**. If `token`
  were ever misconfigured or pointed at an EOA, `require(ok)` passes and the
  router proceeds as if the approval had happened. Never trust a raw `call`
  without also checking `returndata` and code presence.

## The minimal fix

Use OpenZeppelin v5's `SafeERC20.forceApprove`. It handles *both* quirks: it
tolerates tokens that return no data (and rejects tokens with no code), and on
failure it automatically retries as `approve(spender, 0)` followed by
`approve(spender, amount)`, which is precisely the USDT dance.

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TreasuryRouter {
    using SafeERC20 for IERC20;

    function _approveStrategy(IERC20 token, address strategy, uint256 amount) internal {
        // replaces:
        //   (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
        //   require(ok, "approve failed");
        token.forceApprove(strategy, amount);
    }
}
```

That single line is the whole fix. Do **not** reach for `safeApprove` — it was
removed in OpenZeppelin Contracts v5 precisely because it reverted on the
non-zero → non-zero case instead of handling it. `forceApprove` is its
replacement. (If you are ever pinned to v4, the hand-rolled equivalent is
`safeApprove(spender, 0)` then `safeApprove(spender, amount)`.)

If you want to keep the raw-call style for some reason, the correct shape is:

```solidity
function _rawApprove(address token, address spender, uint256 value) private {
    (bool ok, bytes memory ret) = token.call(
        abi.encodeCall(IERC20.approve, (spender, value))
    );
    require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "approve failed");
}

_rawApprove(token, strategy, 0);       // clear first — required by USDT
_rawApprove(token, strategy, amount);
```
…but this still misses the "token has no code" check, so `forceApprove` is
strictly better.

## What to do about the leftover allowance

**Don't leave one.** Treat the approval as scoped to a single run:

```solidity
function runStrategy(IERC20 token, uint256 amount) external onlyOperator {
    token.forceApprove(strategy, amount);   // exact amount, not type(uint256).max
    IStrategy(strategy).execute(token, amount);
    token.forceApprove(strategy, 0);        // revoke the unspent remainder
}
```

Reasons this matters beyond the USDT revert:

- **Standing allowance is standing risk.** Any leftover is a live claim on
  treasury funds that survives between runs. If the strategy is upgradeable, has
  a bug, or is ever compromised, it can pull that amount at any later time with
  no further action from you. The exposure window should be the length of one
  transaction, not three weeks.
- **It makes the USDT path deterministic.** Starting every run from a zero
  allowance means you are always in the `0 → non-zero` case that every token
  accepts, including Tether. `forceApprove` would cover you anyway, but
  zero-on-exit removes the dependency.
- **Never use infinite approval as the "fix".** `approve(strategy, type(uint256).max)`
  would make the symptom disappear (USDT's guard only bites when you change a
  non-zero allowance, and `max` is effectively never decremented in some
  implementations) — but it hands the strategy an unlimited claim on the entire
  treasury balance forever. That is the worst possible resolution to this ticket.

If the strategy genuinely needs to pull across multiple transactions, prefer
approving the exact amount for the current tranche and revoking at the end of the
run, or invert the flow: have the router `safeTransfer` exactly what the strategy
needs and let the strategy account for its own balance — no allowance at all.

### While you're in there

- Reconcile the *actual* spend: read `token.allowance(address(this), strategy)`
  after `execute` and emit it, so an under-spending strategy is visible offchain
  rather than silently accumulating.
- Apply the same `SafeERC20` treatment to the pull-in leg (`safeTransferFrom`)
  and the forward leg (`safeTransfer`) — USDT's missing return value breaks those
  the same way it broke `approve`.
- Both USDC and USDT are 6-decimal tokens; make sure "ordinary five-figure sums"
  are built from `10 ** IERC20Metadata(token).decimals()`, not a hardcoded `1e18`.
