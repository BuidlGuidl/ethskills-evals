USDT is failing because its Ethereum mainnet token contract does not behave like a normal modern ERC-20 approval implementation.

The first run starts from:

```solidity
allowance(router, strategy) == 0
```

so this succeeds:

```solidity
approve(strategy, amount)
```

After that run, the strategy often spends less than `amount`, so the router still has a non-zero allowance outstanding for the strategy. The next run tries to change USDT directly from one non-zero allowance to another non-zero allowance. Mainnet USDT rejects that pattern: it requires the current allowance to be set to zero before setting a new non-zero allowance.

That explains the exact symptom:

- USDC keeps working because it allows non-zero to non-zero allowance replacement.
- USDT's first run works because the old allowance was zero.
- Later USDT runs revert at the low-level `approve` call because the old allowance is still non-zero.
- The revert happens before any transfer because the approval is the first failing operation.

The minimal router fix should be to stop hand-rolling the low-level `approve` and use OpenZeppelin v5's `SafeERC20.forceApprove`, which exists for exactly this class of token:

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

`forceApprove` handles tokens like USDT by setting the allowance to zero and then setting the requested allowance when a direct approval is not accepted. It also handles tokens that return no boolean value, which was the reason for the old low-level call.

For leftover allowance in general, the router should not leave it sitting there after the strategy run. Approve only the amount needed for the run, let the strategy pull/spend during that run, then revoke the remaining allowance:

```solidity
IERC20(token).forceApprove(strategy, amount);
strategy.run(...);
IERC20(token).forceApprove(strategy, 0);
```

Leaving residual allowance gives the strategy continuing authority over treasury-held tokens and also causes this USDT-specific liveness failure on the next run. Clearing it back to zero after each run is both safer and compatible with USDT's approval rule.
