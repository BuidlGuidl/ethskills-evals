The failure is USDT's non-standard allowance rule, not gas, pausing,
blocklisting, or amount size.

The router is doing this before every run:

```solidity
(bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
require(ok, "approve failed");
```

That works for USDC because USDC allows changing an existing allowance directly
from one nonzero value to another nonzero value.

USDT does not. Mainnet USDT requires the current allowance to be zero before a
new nonzero approval is set. The first run succeeded because the router's
allowance to the strategy started at zero. Later runs fail because the strategy
often spends less than the approved amount, leaving a nonzero allowance behind.
The next `approve(strategy, amount)` is therefore a nonzero-to-nonzero approval,
so USDT reverts and the low-level call returns `ok == false`.

Since this repo is on OpenZeppelin Contracts v5, the minimal router change is to
stop hand-rolling the low-level approval and use `SafeERC20.forceApprove`:

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;

// Before calling the strategy:
IERC20(token).forceApprove(strategy, amount);
```

`forceApprove` still handles tokens like USDT that do not return a normal ERC-20
boolean. If the direct approval fails, it sets the allowance to zero and then
sets the requested amount.

The router should also treat leftover allowance as something to remove, not as
state to carry between runs. Approve the exact amount needed immediately before
the strategy call, then after the strategy finishes successfully clear the
allowance:

```solidity
IERC20(token).forceApprove(strategy, amount);
strategy.run(...);
IERC20(token).forceApprove(strategy, 0);
```

That fixes the USDT repeat-run failure and reduces exposure if the strategy is
buggy, compromised, or later upgraded. The router should not leave ordinary
leftover allowances sitting around, and it should not use unlimited approvals
for this workflow.
