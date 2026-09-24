# USDT approval failure

The low-level call only avoids decoding the return value. It does not make every
token behave like a standard ERC-20.

USDT has the old approval rule that a nonzero allowance cannot be changed
directly to another nonzero allowance. The allowance must first be set to zero.

That matches the run history:

- On the first USDT run, the router's allowance to the strategy was zero, so
  `approve(strategy, amount)` succeeded.
- The strategy often spends less than the approved amount, so after that run the
  router still had a nonzero USDT allowance for the strategy.
- On the next run, the router tried to call `approve(strategy, amount)` again
  while the existing allowance was still nonzero. USDT rejects that pattern, so
  the low-level call returned `ok == false` and the router reverted at
  `require(ok, "approve failed")`.
- USDC succeeds because it allows changing an existing nonzero allowance
  directly.

The minimal router change is to use OpenZeppelin v5's `SafeERC20.forceApprove`,
or to implement the same zero-then-set behavior. Since the repo already uses
OpenZeppelin v5, the smallest clean version is:

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

`forceApprove` handles both families of tokens: for ordinary tokens it approves
the requested amount directly, and for USDT-style tokens it falls back to
`approve(spender, 0)` followed by `approve(spender, amount)`. It also handles
tokens that do not return a boolean.

In general, the router should not intentionally leave a stale allowance sitting
around after the strategy has finished its pull. Approve only the amount needed
for the current run, let the strategy spend during that same transaction, and
then clear the leftover allowance back to zero:

```solidity
IERC20(token).forceApprove(strategy, amount);
strategy.run(...);
IERC20(token).forceApprove(strategy, 0);
```

That zeroing is both safer, because the strategy cannot later pull an accidental
leftover balance, and more compatible with USDT-style approval rules on the next
run. If the design requires the strategy to spend later instead of within the
same transaction, the router should avoid relying on reusable leftover approvals
and should redesign the flow around exact transfers or deliberate, bounded
allowances.
