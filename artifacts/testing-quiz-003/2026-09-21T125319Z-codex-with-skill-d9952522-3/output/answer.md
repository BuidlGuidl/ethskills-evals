The deposit fails at:

```solidity
usdt.approve(address(aavePool), amount);
```

because mainnet USDT is not a standard OpenZeppelin-style ERC20. Its `approve`,
`transfer`, and `transferFrom` functions do not return a `bool`, even though the
`IERC20` interface says they do.

So this line:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

works because it actually uses OpenZeppelin `SafeERC20`. `SafeERC20` performs a
low-level call and treats empty return data as success, which is exactly what is
needed for old non-standard tokens like USDT.

But this line:

```solidity
usdt.approve(address(aavePool), amount);
```

does not use `SafeERC20`. The statement `using SafeERC20 for IERC20` only makes
the safe helper methods available; it does not automatically wrap or replace
plain ERC20 calls. A direct high-level Solidity call through `IERC20.approve`
expects ABI-encoded return data for a `bool`. Mainnet USDT returns no data, so
Solidity's return-data decoding fails and the transaction reverts. That is why
the revert has no useful reason string: the token call itself did not return a
Solidity revert reason; the caller failed while trying to decode an absent return
value.

The mock never showed this because the mock is an OpenZeppelin ERC20. It behaves
exactly like the interface says: `approve` returns `true`. No matter how many
more tests are written against that same mock, they only exercise the assumption
that the underlying token is a standard ERC20. They cannot discover that the real
deployed USDT has different ABI behavior, because the mock does not model that
behavior.

The code fix is to use the `SafeERC20` approval helper, not raw `approve`.
Depending on the OpenZeppelin version, use one of:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

or, on older OpenZeppelin versions:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.safeApprove(address(aavePool), 0);
usdt.safeApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` is preferable where available because it handles tokens like USDT
that require resetting allowance to zero before setting a new non-zero allowance.
An even cleaner pattern is to approve the Aave pool once for the maximum amount
during setup, using the safe helper, rather than approving on every deposit.

The testing fix is to add a pinned mainnet fork test that uses the real USDT
contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real Aave V3
pool address. This is an external protocol integration with a quirky token, so a
mock-only suite is not sufficient evidence. A fork test would have executed the
actual USDT bytecode and surfaced the missing-return-value behavior before
mainnet deployment.
