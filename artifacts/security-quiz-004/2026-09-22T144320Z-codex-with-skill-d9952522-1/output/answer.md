USDT is failing because its `approve` behavior is not the same as USDC's.

The router currently does this:

```solidity
(bool ok, ) = token.call(
    abi.encodeWithSelector(0x095ea7b3, strategy, amount)
);
require(ok, "approve failed");
```

That avoids decoding problems for tokens that return no boolean, but it does
not make a reverted `approve` succeed.

USDT rejects changing a nonzero allowance directly to another nonzero
allowance. Its approval rule is effectively:

```solidity
require(value == 0 || allowance[msg.sender][spender] == 0);
```

So the sequence is:

1. First run: router's allowance to the strategy is `0`, so
   `approve(strategy, amount)` succeeds.
2. The strategy spends less than `amount`, leaving a nonzero allowance.
3. Next run: the router calls `approve(strategy, newAmount)` while the old
   allowance is still nonzero.
4. USDT reverts, `token.call(...)` returns `ok == false`, and the router hits
   `require(ok, "approve failed")`.

USDC succeeds because it supports overwriting a nonzero allowance with another
nonzero allowance. USDT does not.

The minimal router change is to stop doing the raw `approve` call and use
OpenZeppelin v5's `SafeERC20.forceApprove`, which handles USDT-style tokens by
falling back to zeroing the allowance before setting the new value:

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

Equivalently, if the token is already typed as `IERC20`:

```solidity
token.forceApprove(strategy, amount);
```

The router should also clear leftover allowance after the strategy has finished
spending, unless the strategy truly needs persistent pull rights:

```solidity
IERC20(token).forceApprove(strategy, amount);
strategy.run(...);
IERC20(token).forceApprove(strategy, 0);
```

In general, leftover allowance should be treated as unnecessary authority.
Approve only the amount needed for the current run, and revoke any residual
allowance after the run completes. If the design requires an allowance to remain
for asynchronous spending, keep it bounded to the actual remaining need and use
`forceApprove` for every allowance change so USDT and similar tokens are handled
correctly.
