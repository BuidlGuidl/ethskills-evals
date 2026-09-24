USDT fails because its `approve` implementation is stricter than normal
ERC-20s such as USDC. It rejects changing an allowance directly from one
nonzero value to another nonzero value.

The first USDT run worked because the router's allowance to the strategy was
initially zero:

```solidity
approve(strategy, amount) // zero -> nonzero: OK
```

After that run, the strategy often spent less than the approved amount, so the
router still had a nonzero USDT allowance outstanding. The next run tried:

```solidity
approve(strategy, amount) // nonzero -> nonzero: USDT reverts
```

The low-level call only avoids Solidity trying to decode a missing or odd
return value. It does not make a reverting token approval succeed. For USDT,
the token call itself reverts, so `ok` is false and the router hits
`require(ok, "approve failed")`.

The minimal fix on OpenZeppelin Contracts v5 is to use `SafeERC20.forceApprove`
instead of the raw call:

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

`forceApprove` handles tokens like USDT by attempting the requested approval
and, if needed, first setting the allowance to zero and then setting it to the
requested value. It also keeps the optional-return handling that was the reason
for using a low-level call in the first place.

In general, the router should not leave stale allowance around unnecessarily.
Prefer exact, short-lived approvals: approve only the amount needed for the
current run, let the strategy spend it, and clear the allowance back to zero
afterward when practical:

```solidity
IERC20(token).forceApprove(strategy, amount);
strategy.run(...);
IERC20(token).forceApprove(strategy, 0);
```

Clearing the leftover allowance avoids the USDT nonzero-to-nonzero problem and
also reduces the damage if the strategy address or its spending path is later
compromised. If clearing after every run is too expensive for the design, the
router must still use `forceApprove` before changing an allowance that might
already be nonzero, but the safer default is to remove unused allowance.
