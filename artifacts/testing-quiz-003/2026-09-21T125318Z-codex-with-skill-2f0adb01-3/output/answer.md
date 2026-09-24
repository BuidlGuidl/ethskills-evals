The deposit fails because mainnet USDT is not a standard OpenZeppelin-style ERC20.

USDT's `transfer`, `transferFrom`, and `approve` do not return a `bool`. A stock
OpenZeppelin `ERC20` mock does return `bool`, so this line works forever in the
mock suite:

```solidity
usdt.approve(address(aavePool), amount);
```

But `usdt` is typed as `IERC20`, whose `approve` signature says it returns
`bool`. A high-level Solidity call through that interface expects return data
matching the ABI. Mainnet USDT returns no data, so the ABI return-data handling
reverts. There is no USDT revert string because USDT did not revert with one; the
caller side fails while trying to handle a return value that is not there.

The first line succeeds because it actually uses `SafeERC20`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

OpenZeppelin's `SafeERC20` deliberately treats missing return data as success, as
long as the low-level call itself did not revert. That is exactly why it works
with USDT. The failing line does not use `SafeERC20`; it calls `approve` directly,
so none of that optional-return compatibility is applied. `using SafeERC20 for
IERC20` only adds the safe helper methods. It does not magically rewrite raw
`approve`, `transfer`, or `transferFrom` calls.

No amount of extra testing against the existing mock would have found this,
because the mock does not model the behavior that matters. It is a standards-
compliant OpenZeppelin token with normal return values. You could add 1,000 more
mock-based deposit tests, fuzz the amount, and cover every local branch, and they
would still all call a token whose `approve` behaves unlike USDT. The bug is in
the integration boundary with a real deployed token implementation, not in the
vault's internal arithmetic or the mock Aave pool.

The code fix is to use `SafeERC20` for the approval too. Prefer `forceApprove`
for USDT-like tokens because it also handles tokens that require resetting an
existing non-zero allowance to zero before setting a new non-zero allowance:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

If the OpenZeppelin version does not have `forceApprove`, upgrade it or implement
the same pattern with safe low-level calls: try approving the target amount, and
if that fails, safely approve zero first and then safely approve the target
amount.

The testing fix is to add fork integration tests against real mainnet contracts,
at a pinned block, using the actual USDT address and the actual Aave V3 pool.
Mocks are still useful for fast unit tests, but any production path involving
Aave and USDT needs at least one mainnet-fork deposit test that executes the real
token's `transferFrom`/`approve` behavior and the real pool's `supply` path. That
fork test would have reverted before deployment.
