The deposit is failing at the approval, not at the transfer into the vault.

Real mainnet USDT is not a normal OpenZeppelin-style ERC20. Its `transfer`,
`transferFrom`, and `approve` functions do not return a `bool` in the standard
ERC20 way. OpenZeppelin's `SafeERC20` handles that kind of token only when the
call is made through the SafeERC20 wrapper.

This line is protected:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`safeTransferFrom` performs a low-level call and accepts either a returned
`true` value or no return data. That is why the transfer from the user succeeds
with USDT.

This line is not protected:

```solidity
usdt.approve(address(aavePool), amount);
```

Even though the contract has `using SafeERC20 for IERC20`, calling
`usdt.approve(...)` still calls the raw `IERC20.approve` function. Solidity then
expects the external call to return a ABI-encoded `bool`. USDT returns no value,
so the high-level interface call fails while decoding the missing return data.
That revert has no useful reason string because it is not a normal `require`
message from your vault.

The OpenZeppelin `MockERC20` never showed this because it behaves like the
interface says it should: `approve` returns `true`. A mock like that proves the
vault works with a standards-compliant ERC20-shaped dependency. It cannot prove
the vault works with real deployed USDT, because the mock has encoded away the
very behavior that breaks production. Adding more tests against the same mock
would only retest the same assumption more times.

The code fix is to use SafeERC20 for the approval path too:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` is the most robust choice for USDT-style tokens because it both
accepts optional return data and handles tokens that require an allowance to be
set to zero before being set to another non-zero value. If using an older
OpenZeppelin version without `forceApprove`, the equivalent pattern is to make
the approval through SafeERC20-compatible calls, resetting to zero first when
needed.

The testing fix is to add a pinned mainnet-fork integration test that uses the
real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real
Aave V3 pool address for the target network. Mocks are still useful for local
unit tests, but external protocol integrations and quirky tokens need at least
one fork test against the actual deployed contracts. That fork test would have
hit the real USDT `approve` behavior before mainnet deployment.
