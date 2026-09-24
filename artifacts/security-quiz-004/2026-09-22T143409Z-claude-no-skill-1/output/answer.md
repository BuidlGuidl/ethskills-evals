# Why the USDT approval reverts (and only after the first run)

## Short version

USDT's `approve` refuses to overwrite a **non-zero** allowance with another
**non-zero** value. Because your strategy usually spends less than it was
approved for, run #2 onward always starts with leftover allowance, so
`approve(strategy, amount)` hits that guard, reverts, the low-level call
returns `ok == false`, and your `require(ok, "approve failed")` fires.

Run #1 worked because the starting allowance was 0.

## The actual code

Mainnet USDT (`0xdAC17F958D2ee523a2206206994597C13D831ec7`) is a pre-ERC20-final
`TetherToken`. Its approve is:

```solidity
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32) {
    // To change the approve amount you first have to reduce the addresses`
    // allowance to zero by calling `approve(_spender, 0)` if it is not
    // already 0 to mitigate the race condition described here:
    // https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
    require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));

    allowed[msg.sender][_spender] = _value;
    Approval(msg.sender, _spender, _value);
}
```

Two things to notice, and they are exactly the two things that bit you:

1. **The `require` with no message.** It is a plain `require(...)` in Solidity
   0.4.x, so it reverts with empty returndata. Your low-level call swallows it
   into `ok == false`, and your own `"approve failed"` message replaces it —
   which is why the failure looks opaque and identical on every run.
2. **No `returns (bool)`.** USDT's `approve` returns nothing. That is the
   original bug you were working around: `IERC20(token).approve(...)` makes the
   compiler `abi.decode` 32 bytes of returndata that USDT never writes, so it
   reverts in the decoder. You fixed the symptom (decode revert) by dropping to
   `.call`, but that also discarded the correctness check, and it did nothing
   about the zero-first rule.

USDC (`0xA0b8...eB48`) is a normal, spec-compliant ERC20: it returns `bool` and
happily overwrites a non-zero allowance. Hence "USDC always works."

## Trace of what you observed

| Run | allowance before | USDT approve | result |
|-----|------------------|--------------|--------|
| 1 | 0 | `_value != 0 && 0 != 0` → false → passes | succeeds |
| 2 | leftover > 0 | `_value != 0 && leftover != 0` → true → `require` fails | reverts at `require(ok, ...)` |
| 3+ | still the leftover (the revert rolled back everything) | same | reverts forever |

It is self-sustaining: because the approve reverts, the allowance is never
updated and never consumed, so the next run finds the same leftover. That
matches "every run since reverts, always at that require, before any transfer."

The other listed facts (gas, pause, blocklist, amount size) are correctly ruled
out — none of them are approve-path conditions, and a blocklist/pause would also
have broken run #1 or the transfer, not the approve on every run after the first.

## A second, latent bug in the same two lines

`require(ok, ...)` is not a sufficient success check even once the zero-first
problem is gone:

- `ok` is `true` for a call to an address with **no code at all**. If `token` is
  ever mis-set or points at a self-destructed/not-yet-deployed address, the
  router proceeds as if approval succeeded.
- Some tokens *return `false`* instead of reverting on failure. `ok` is still
  `true`; you ignore the returndata entirely.

So the fix should also validate returndata, not just `ok`.

## Minimal change

OpenZeppelin v5 has exactly this. `SafeERC20.forceApprove` does
"try `approve(spender, value)`; if that fails, `approve(spender, 0)` then
`approve(spender, value)`", and `_callOptionalReturn` handles the
no-return-value case *and* requires the target to have code.

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TreasuryRouter {
    using SafeERC20 for IERC20;

    ...
-       (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
-       require(ok, "approve failed");
+       IERC20(token).forceApprove(strategy, amount);
```

That is the whole change. It fixes USDT, keeps USDC working, removes the decode
revert that sent you to `.call` in the first place, and restores the
success/returndata check you lost.

Two notes on the v5 API specifically:

- `safeApprove` **no longer exists** in v5 (removed in 5.0). Don't reach for it;
  `forceApprove` is the replacement, and unlike the old `safeApprove` it does not
  require you to zero the allowance yourself.
- Use `SafeERC20.safeTransfer` / `safeTransferFrom` for the pull and forward legs
  too — USDT's `transfer`/`transferFrom` are non-returning in the same way, so if
  any of those are also raw `.call`s or raw `IERC20` calls they have the same
  class of bug waiting.

If you cannot take the dependency, the hand-rolled equivalent is:

```solidity
function _forceApprove(address token, address spender, uint256 amount) private {
    bytes memory data = abi.encodeCall(IERC20.approve, (spender, amount));
    (bool ok, bytes memory ret) = token.call(data);
    if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) {
        // zero first, then retry — required by USDT-style tokens
        (ok, ret) = token.call(abi.encodeCall(IERC20.approve, (spender, 0)));
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "approve reset failed");
        (ok, ret) = token.call(data);
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "approve failed");
    }
    require(token.code.length > 0, "not a token");
}
```

but prefer the library — it is audited and you are already on it.

## What to do about the leftover allowance in general

`forceApprove` makes the leftover harmless *for the transaction*, but leaving a
standing allowance is the real design smell. The router keeps an open-ended
spending right against its own balance for an arbitrary third-party contract
between runs. If the strategy is upgradeable, or is ever compromised, or has a
bug that lets someone else drive its `transferFrom`, that leftover is drainable
with no further action from you.

Ranked, best first:

1. **Don't approve at all — push instead of pull.** If you control the strategy's
   interface, `safeTransfer` the tokens to it and call a `notifyDeposit(amount)`
   (or a `deposit(amount)` that reads its own balance delta). No allowance ever
   exists, so there is nothing to leak and nothing to reset. This deletes the
   whole problem class.
2. **If it must pull, approve exactly and zero it in the same transaction.**
   Wrap the run so the allowance's lifetime is one call:

   ```solidity
   IERC20(token).forceApprove(strategy, amount);
   IStrategy(strategy).run(token, amount);
   IERC20(token).forceApprove(strategy, 0);   // unconditional, same tx
   ```

   The trailing zeroing is the important half and is the direct answer to
   "what about the leftover": **clear it, in the same transaction that set it, on
   both the spent-in-full and spent-partially paths.** Then every run starts from
   a clean 0 and the state is auditable off-chain (allowance should be 0 between
   runs — worth an alert on).
3. **Do not "fix" this with infinite approval.** `type(uint256).max` makes the
   USDT revert go away after one reset and is the tempting one-liner, but it
   converts a bounded leak into an unbounded one and is the single most common
   root cause in drained-router incidents. Explicitly not the answer here.
4. **Add a guarded sweep.** An owner/timelock-only
   `revokeAllowance(address token, address spender)` calling `forceApprove(.., 0)`,
   so you can clear a stuck allowance if a run reverts mid-way and skips step 2's
   cleanup.

One caveat to state plainly: the zero-then-set inside `forceApprove` is the same
pattern EIP-20's race-condition note warns about — between the `approve(0)` and
the `approve(amount)` there is, in principle, a window. In practice both live in
one atomic transaction here, so no other party can interleave, and the only
exposure would be if the strategy could re-enter the router mid-approval. Keeping
the approve→use→zero block free of untrusted callbacks (or under a
`ReentrancyGuard`) closes that.

## Summary

- **Cause:** mainnet USDT's `approve` reverts on non-zero → non-zero. Partial
  spending leaves a non-zero allowance, so every run after the first hits it.
  USDC has no such guard. Your `.call` turns the messageless revert into
  `ok == false`.
- **Fix:** `using SafeERC20 for IERC20;` + `IERC20(token).forceApprove(strategy, amount);`
  — also restores the return-value/code check the raw `.call` threw away.
  (`safeApprove` is gone in OZ v5.)
- **Leftover allowance:** prefer transfer-then-notify so no allowance exists;
  otherwise set it and zero it in the same transaction, with an owner-only
  revoke as a backstop. Never paper over it with an infinite approval.
