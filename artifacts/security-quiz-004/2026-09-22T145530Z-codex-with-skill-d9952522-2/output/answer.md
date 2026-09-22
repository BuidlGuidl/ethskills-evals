# USDT approval failure

The low-level call only checks whether the token call reverted. It does not fix the token's approval semantics.

USDT is the outlier because its `approve` implementation rejects changing an existing nonzero allowance directly to another nonzero allowance. The first router run starts from allowance `0`, so:

```solidity
approve(strategy, amount)
```

succeeds. If the strategy spends less than `amount`, the router is left with a nonzero allowance to the strategy. On the next run the router again tries to approve a five-figure nonzero `amount`, so USDT sees:

```text
current allowance != 0 && new allowance != 0
```

and reverts. That makes `token.call(...)` return `ok == false`, so the router fails at `require(ok, "approve failed")` before any transfer happens. USDC does not have this zero-first approval rule, so the same pattern keeps working there.

The minimal fix, since the repo uses OpenZeppelin Contracts v5, is to stop hand-rolling the approval call and use `SafeERC20.forceApprove`:

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

`forceApprove` handles USDT-style tokens by trying the approval and, if needed, setting the allowance to `0` before setting it to `amount`.

The router should also avoid leaving stale allowance behind. After the strategy has finished the run, clear any leftover approval back to zero:

```solidity
IERC20(token).forceApprove(strategy, 0);
```

Leftover allowance is not tied to the particular run's funds. If the router later receives more tokens, a compromised or buggy strategy with standing allowance may be able to pull them. The safest general pattern is: approve only the amount needed for the current operation, execute the operation, then revoke the remaining allowance when practical.
