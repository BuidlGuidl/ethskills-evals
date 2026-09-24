# Why the approval fails only for USDT, and only after the first run

## Short answer

USDT's `approve` has a non-standard guard:

```solidity
// Tether (TetherToken.sol), inherited from the old "StandardToken" pattern
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32) {
    require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
    allowed[msg.sender][_spender] = _value;
}
```

That `require` is the original ERC-20 approval-race mitigation: you may only move an
allowance **0 → nonzero** or **nonzero → 0**. Any **nonzero → nonzero** write reverts.

Now map that onto the observed behaviour:

- **Run 1:** router's USDT allowance to the strategy is `0`. `0 → amount` is permitted, the
  call succeeds.
- **The strategy spends less than it was approved for**, so a nonzero remainder stays.
- **Run 2..n:** the router calls `approve(strategy, amount)` while `allowance != 0`. The
  guard reverts, the low-level call returns `ok == false`, and the router hits
  `require(ok, "approve failed")` — before any transfer, exactly as reported.

USDC has no such guard (it's a plain ERC-20 `approve` that just overwrites), so every run
succeeds regardless of leftover allowance. Nothing about gas, pausing, blocklists, or
amounts is involved; the discriminator is purely *token code* + *leftover allowance*.

## The red herring: the return-value problem is a different bug

The low-level call was introduced because "an earlier version reverted while decoding the
return value of some tokens". That is a real, *separate* USDT quirk: USDT's `approve`
and `transfer` declare no return value at all, so an `IERC20(token).approve(...)` call
against it reverts in the ABI decoder when the compiler expects 32 bytes of `bool`.

Dropping to `token.call(...)` fixed the decoding problem but bought two new ones:

1. It does **not** fix the nonzero → nonzero revert — that's a revert inside the token,
   and `ok` is correctly `false`. This is the failure you're seeing.
2. It is now **unsafe in the other direction**: `ok` is `true` for a call to an address
   with no code, and `true` for a token that returns `false` instead of reverting. The
   router would proceed believing it had an allowance it doesn't have. (Not your current
   symptom, but it's live in the code today.)

So the code traded a decode-revert for a silent-success hole and still didn't solve the
actual USDT constraint.

## Minimal fix

Use OpenZeppelin v5's `SafeERC20.forceApprove`. It handles both quirks: it tolerates
missing/`false` return data, and on failure it retries as `approve(spender, 0)` followed by
`approve(spender, value)` — precisely the sequence USDT's guard requires. Note `safeApprove`
was **removed** in v5; `forceApprove` is the v5 spelling.

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TreasuryRouter {
    using SafeERC20 for IERC20;

    function _run(IERC20 token, address strategy, uint256 amount) internal {
-       (bool ok, ) = address(token).call(
-           abi.encodeWithSelector(0x095ea7b3, strategy, amount)
-       );
-       require(ok, "approve failed");
+       token.forceApprove(strategy, amount);

        // ... strategy pulls funds ...
    }
}
```

That single line replacement is the whole fix. `SafeERC20` also restores the code-existence
check (`Address.functionCall` reverts on an EOA target) that the raw `call` had thrown away.

## What to do about the leftover allowance

`forceApprove` makes the *next* run work, but leaving a standing nonzero allowance to the
strategy is a lingering grant: if the strategy is ever upgraded, compromised, or has a bug,
it can pull the remainder at any later time with no further action from the router. The
router should not rely on the strategy to be well-behaved between runs.

Policy, in order of preference:

1. **Approve exactly what will be used, then zero it in the same transaction.** Wrap the run
   so the allowance never survives the call:

   ```solidity
   token.forceApprove(strategy, amount);
   IStrategy(strategy).invest(address(token), amount);
   token.forceApprove(strategy, 0);   // idempotent; nonzero → 0 is always legal on USDT
   ```

   The trailing reset is cheap, safe on every token (the USDT guard explicitly permits
   `→ 0`), and leaves no standing grant. Put the reset on the failure path too if the run
   is allowed to partially succeed.

2. **If you must leave a standing allowance**, at least keep it *bounded* — never
   `type(uint256).max` for a treasury — and re-set it with `forceApprove` each run so the
   old remainder is replaced rather than accumulated.

Two things not to do: don't "fix" this by approving `type(uint256).max` once to dodge the
guard (that converts a per-run grant into a permanent unlimited one over treasury funds),
and don't special-case USDT by address — `forceApprove` covers the whole class of tokens
with this guard (KNC, and others of the same vintage) without an address allowlist.

## Two adjacent items worth checking while you're in there

- **Transfers**: if the router calls `token.transfer` / `transferFrom` directly anywhere,
  those have the identical missing-return-value problem on USDT. Use
  `safeTransfer` / `safeTransferFrom` from the same import.
- **Accounting**: USDT is 6-decimal and has a fee-on-transfer mechanism in its code
  (currently set to zero, but owner-settable). If the router credits the *requested* amount
  rather than the observed balance delta, that's a latent discrepancy — credit from the
  balance delta, or assert the received amount matches.
