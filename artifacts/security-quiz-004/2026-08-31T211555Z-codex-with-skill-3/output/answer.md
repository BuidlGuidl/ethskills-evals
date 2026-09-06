The failure pattern matches **USDT's non-standard `approve` behavior**.

Reasoning:

1. The router is calling `approve(strategy, amount)` before each run.
2. On the first USDT run, the prior allowance was presumably `0`, so the approval succeeded.
3. After that run, the strategy often spent **less** than the approved amount, so the router was left with a **non-zero allowance** to the strategy.
4. USDT does not reliably allow changing a non-zero allowance directly to another non-zero allowance. Its approval flow effectively requires:
   - first set allowance to `0`
   - then set the new non-zero allowance
5. Because the router uses a low-level call and only checks `ok`, the second and later USDT runs fail exactly at:

```solidity
require(ok, "approve failed");
```

That also explains why:

- **USDC keeps working**: USDC allows ordinary repeated `approve(spender, amount)` updates.
- **USDT fails only after the first run**: only then is there usually a leftover non-zero allowance.

The minimal router change is to use OpenZeppelin's USDT-compatible approval helper instead of the raw low-level `approve` call:

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

`forceApprove` in OpenZeppelin v5 handles the exact USDT case by falling back to:

1. `approve(spender, 0)`
2. `approve(spender, amount)`

when a direct approval update does not work.

If the router wants to stay with manual calls, the equivalent minimal logic is:

```solidity
IERC20 erc20 = IERC20(token);
uint256 current = erc20.allowance(address(this), strategy);
if (current != 0) {
    erc20.forceApprove(strategy, 0);
}
erc20.forceApprove(strategy, amount);
```

But with OZ v5, the cleaner minimal fix is simply:

```solidity
IERC20(token).forceApprove(strategy, amount);
```

About leftover allowance in general:

- The router should **not assume leftover allowance is harmless**.
- Any unused allowance is standing permission for the strategy to pull more tokens later.
- Best practice is to grant only the allowance needed for the current run, and after the strategy finishes, **reset leftover allowance back to `0`** unless there is a deliberate reason to keep it.

So the general policy should be:

- before use: set the exact allowance needed, using `forceApprove`
- after use: clear any remaining allowance back to `0`

That minimizes approval risk and also avoids USDT's zero-first approval requirement causing future runs to revert.
