The router is running into USDT's non-standard `approve` rule, not a gas,
pause, blocklist, or transfer problem.

USDT on mainnet does not allow changing an allowance directly from one
non-zero value to another non-zero value. If the current allowance from the
router to the strategy is non-zero, `approve(strategy, amount)` reverts unless
`amount` is zero. USDC allows overwriting the allowance, so the same pattern
keeps working there.

That explains the timing:

1. Before the first USDT run, the router's allowance to the strategy was zero.
2. The router called `approve(strategy, amount)`, so USDT accepted it.
3. The strategy spent less than `amount`, leaving a non-zero allowance behind.
4. On the next run, the router tried another non-zero `approve(strategy, amount)`
   while the old allowance was still non-zero.
5. USDT reverted inside `approve`, so the low-level call returned `ok == false`
   and the router hit `require(ok, "approve failed")` before any transfer.

The low-level call only avoids Solidity trying to decode a missing return
value. It does not make a token-side revert succeed.

The minimal router change is to stop hand-rolling the low-level approval and
use OpenZeppelin v5's `SafeERC20.forceApprove`, which is designed for exactly
this USDT-style behavior:

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

`forceApprove` first tries the desired approval. If that does not work, it
sets the allowance to zero and then sets it to the desired amount, while also
handling tokens that return no boolean value.

In general, the router should not treat leftover allowance as useful state.
Approve only the amount needed for the current run, and clear the allowance
back to zero after the strategy interaction when practical. At minimum, every
new approval path must be able to handle an existing non-zero allowance by
zeroing it before setting the next non-zero amount. Leaving stale allowances
around increases blast radius if the strategy is upgraded, compromised, or
called in an unexpected way.
