# Why the approval only fails for USDT, and only after the first run

## Short answer

USDT's `approve()` contains a non-standard guard that **reverts when you change a
non-zero allowance to another non-zero value**. Your strategy under-spends, so a
non-zero leftover allowance is sitting there on every run after the first — which is
exactly the condition that trips the guard.

The low-level call doesn't avoid this. The revert inside USDT makes `ok == false`,
so you fail at `require(ok, "approve failed")` before any transfer. USDC has no such
guard, so it never fails.

## The mechanism in detail

USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) is a 2017-era `StandardToken`
descendant. Its approve is, in essence:

```solidity
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32) {
    // "To change the approve amount you first have to reduce the addresses`
    //  allowance to zero by calling `approve(_spender, 0)`"
    require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
    allowed[msg.sender][_spender] = _value;
    Approval(msg.sender, _spender, _value);   // note: returns nothing
}
```

Two separate non-standard behaviours are in play, and it's worth keeping them apart
because your team has already been bitten by both:

1. **No return value.** `approve()` (and `transfer()`) are declared `returns ()`.
   A plain `IERC20(token).approve(...)` call generates ABI decoding of a `bool` from
   zero-length returndata, which reverts. *That* is the failure the earlier version
   hit, and it's why someone reached for the low-level call. The low-level call does
   fix this one.

2. **Zero-first allowance guard.** This is the current failure, and the low-level
   call does nothing about it. It is a state-dependent revert inside the token:

   | Run | Allowance before | `approve(strategy, amount)` | Result |
   |-----|------------------|------------------------------|--------|
   | 1   | 0                | `_value != 0 && 0 != 0` → false | passes, allowance set |
   | 2+  | leftover > 0     | `_value != 0 && leftover != 0` → true | **reverts** |

   This matches the symptoms precisely: first run succeeded, every run since reverts,
   always at the `require`, always before any transfer, and only for USDT. If the
   strategy had happened to spend the full allowance down to exactly zero, the next
   run would have worked — which is why the "frequently spends less than approved"
   detail is the tell, not a side note.

Nothing about gas, pausing, blocklists or amounts is involved. The guard is purely
`allowance != 0`, so the five-figure sums are irrelevant.

## A second, latent bug in the same two lines

`token.call(...)` returning `ok == true` is **not** proof the approval happened:

- If `token` is an EOA or a self-destructed/never-deployed address, the call to a
  codeless address succeeds with empty returndata and `ok == true`. The router would
  proceed as if it had an allowance.
- If the token returns `false` instead of reverting (the other half of the
  non-standard-ERC20 zoo), you ignore the returned data entirely and treat it as
  success.

So the current code trades one bug for two. Don't hand-roll this.

## Minimal fix

Use OpenZeppelin v5's `SafeERC20.forceApprove`. It does exactly the right thing:
attempts `approve(spender, value)`, and if that call fails *or* returns false, it
retries as `approve(spender, 0)` followed by `approve(spender, value)`. It also
tolerates missing return values and reverts if the target has no code.

```diff
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
 contract TreasuryRouter {
+    using SafeERC20 for IERC20;
 ...
-        (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
-        require(ok, "approve failed");
+        IERC20(token).forceApprove(strategy, amount);
```

That is the whole change. `token` should be typed `IERC20` (or cast at the call
site); no other router logic needs to move.

**Do not reach for `safeApprove`** — OpenZeppelin removed it in v5.0 precisely
because it reverted on a non-zero-to-non-zero change instead of handling it.
`forceApprove` is its replacement. (Any checklist or snippet in your notes that
still says `safeApprove` is pre-v5 and will not compile against the version you're
on.)

If you want to keep it dependency-free, the equivalent explicit form is:

```solidity
IERC20(token).safeApprove... // ✗ not in v5
// explicit equivalent of forceApprove:
IERC20 t = IERC20(token);
if (t.allowance(address(this), strategy) != 0) {
    t.forceApprove(strategy, 0);   // or a raw approve(0) via SafeERC20's _callOptionalReturn
}
t.forceApprove(strategy, amount);
```

but there's no reason to: `forceApprove` already encodes this, and it's cheaper
because it only pays for the reset when the first attempt actually fails.

## What to do about the leftover allowance in general

`forceApprove` stops the revert, but a standing allowance to the strategy is a real
exposure, not just an inconvenience. Treat the allowance as something the router
grants for the duration of one run and takes back at the end.

**Recommended pattern — approve exactly, then revoke:**

```solidity
function run(IERC20 token, uint256 amount) external onlyOperator {
    token.forceApprove(strategy, amount);

    uint256 balBefore = token.balanceOf(address(this));
    IStrategy(strategy).deposit(address(token), amount);   // pulls what it needs

    // hand nothing back to the strategy for later
    token.forceApprove(strategy, 0);

    emit Run(address(token), amount, balBefore - token.balanceOf(address(this)));
}
```

Why this and not the alternatives:

- **Revoking after the run** means a compromised or upgraded strategy can never pull
  funds outside a run the operator initiated. The "leftover allowance sitting there"
  you describe today is a live, unbounded-in-time authorization to move treasury
  funds. That's the actual finding here; the USDT revert is just what made it
  visible.
- **Never use `type(uint256).max`.** It is the tempting "fix" for this exact
  symptom — approve infinity once, never touch it again, and USDT's guard never
  fires after the first run. It converts an intermittent revert into a permanent
  total-balance exposure to the strategy contract. Don't.
- **Don't try to `safeIncreaseAllowance` up to the target.** USDT supports
  `increaseApproval`/`decreaseApproval`, but OZ's `safeIncreaseAllowance` reads the
  current allowance and calls `approve` with the sum — which walks straight back into
  the zero-first guard on any token that has it. `forceApprove` is the correct tool.
- **If you do keep a standing allowance** (e.g. for gas reasons on a high-frequency
  router), at least top it up with `forceApprove` to a bounded amount — a small
  multiple of one run's size, never unbounded — and add an operator-callable
  `revoke(token)` that does `forceApprove(strategy, 0)` so you can kill it instantly
  if the strategy is ever suspect.

One caveat to note either way: the revoke-after pattern assumes the strategy pulls
within the same transaction. If your strategy is pull-based across transactions, the
approval must outlive the call — in that case keep it bounded and revoke on the next
run's start rather than at the end of the current one.

## Related checks worth running while you're in here

- Both USDC and USDT are **6 decimals**, not 18. Confirm the router isn't scaling by
  `1e18` anywhere on these paths.
- Both are **blocklist tokens** and USDC is **pausable**; a transfer can revert for
  reasons unrelated to allowance. Make sure the failure is surfaced with a
  distinguishable error rather than a generic string, or the next incident will take
  three weeks too.
- Restrict who can call the run function and emit an event on every approval change,
  so a standing allowance is visible offchain.
