The failure is USDT's non-standard `approve` behavior.

USDC behaves like a normal ERC-20 here: an owner can replace an existing
non-zero allowance with another non-zero allowance. USDT on Ethereum mainnet
does not. Its `approve` implementation rejects this pattern:

```solidity
approve(spender, newNonZeroAmount)
```

when `allowance(owner, spender)` is already non-zero. The first run worked
because the router's allowance to the strategy started at zero. The strategy
then spent less than the approved amount, so a non-zero allowance remained.
On the next run the router tried to approve another non-zero amount over that
leftover allowance, and USDT reverted. Because the router is using a low-level
call, that revert is observed as `ok == false`, so the router reverts at:

```solidity
require(ok, "approve failed");
```

The low-level call avoided return-value decoding problems, but it did not avoid
token-specific approval rules.

The minimal fix is to zero the allowance before setting a new non-zero
allowance, or preferably use OpenZeppelin v5's `SafeERC20.forceApprove`, which
implements that compatibility path:

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

Equivalently, if keeping the low-level style, the router must do:

```solidity
_callApprove(token, strategy, 0);
_callApprove(token, strategy, amount);
```

before each run when it needs a non-zero approval. `forceApprove` is the better
minimal change in an OpenZeppelin v5 codebase because it also handles tokens
that return no boolean value.

In general the router should not leave leftover strategy allowances sitting
around. It should approve only what the strategy needs for the current run and
then clear the allowance after the strategy interaction, for example:

```solidity
IERC20(token).forceApprove(strategy, amount);
strategy.run(...);
IERC20(token).forceApprove(strategy, 0);
```

That post-run reset both prevents the next USDT approval from failing and
reduces the damage if the strategy address is later compromised or behaves
unexpectedly. The router should treat leftover allowance as stale authority,
not as reusable state.
