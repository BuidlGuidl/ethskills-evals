USDT is failing because its `approve` behavior is not the same as USDC's.

The first run starts with allowance `0`, so:

```solidity
approve(strategy, amount)
```

succeeds. After that run, the strategy often spends less than `amount`, so the router still has a nonzero allowance granted to the strategy. On the next run the router calls:

```solidity
approve(strategy, newAmount)
```

while the current allowance is still nonzero. USDT intentionally rejects changing a nonzero allowance directly to another nonzero allowance; it requires the allowance to be set to `0` first. That makes the low-level call return `ok == false`, so the router reverts at `require(ok, "approve failed")`.

USDC does not have that restriction, so it keeps succeeding.

The minimal fix in an OpenZeppelin Contracts v5 codebase is to stop hand-rolling the low-level approval and use `SafeERC20.forceApprove`:

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;

// before calling the strategy
IERC20(token).forceApprove(strategy, amount);
```

`forceApprove` handles tokens with optional/no return values and handles USDT-style approvals by zeroing first when needed, then setting the requested allowance.

In general, the router should not leave leftover strategy allowance sitting around unless the strategy is deliberately trusted to retain spending power between runs. Since this router approves per run and the strategy may spend less than approved, the safer pattern is:

```solidity
IERC20(token).forceApprove(strategy, amount);
strategy.run(...);
IERC20(token).forceApprove(strategy, 0);
```

That clears any residual allowance after a successful run, reduces the blast radius if the strategy is later compromised or upgraded badly, and also ensures the next USDT approval starts from zero.
