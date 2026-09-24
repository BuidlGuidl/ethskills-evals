The mock is lying by being well-behaved.

The real mainnet USDT contract is not a normal ERC-20 by modern expectations. In
particular, its `approve` function does not return the `bool` value required by
the ERC-20 interface. OpenZeppelin's stock `ERC20` mock does return `bool`, so the
same call works there.

This line is safe:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

It goes through `SafeERC20`, which performs a low-level call and accepts either:

- returned data that decodes to `true`, or
- no returned data at all.

That is exactly why it can handle USDT-style non-standard tokens.

But this line is not safe:

```solidity
usdt.approve(address(aavePool), amount);
```

Even though the contract has:

```solidity
using SafeERC20 for IERC20;
```

that does not automatically wrap every ERC-20 call. It only adds the `safe...`
methods. Calling `approve` directly is still a normal high-level Solidity call
through the `IERC20` interface. Since `IERC20.approve` says it returns `bool`,
Solidity expects return data. Mainnet USDT returns none, so the ABI decoding of
the return value fails and the call reverts without a token-provided reason
string.

The mock never catches this because it implements the happy-path ERC-20 ABI
correctly. No amount of additional tests against that same mock would expose a
behavior the mock does not have. You could test every amount, caller, and state
transition and still miss the production-only incompatibility, because the bug is
in the assumption that all ERC-20s behave like OpenZeppelin's ERC20.

The code fix is to use `SafeERC20` for the approval as well:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` is the better default for USDT-like tokens because it handles both
the missing-return-value behavior and the separate USDT allowance rule that can
require setting an allowance to zero before setting a new non-zero allowance. If
the project is on an older OpenZeppelin version without `forceApprove`, use the
safe zero-then-set pattern:

```solidity
usdt.safeApprove(address(aavePool), 0);
usdt.safeApprove(address(aavePool), amount);
```

or upgrade OpenZeppelin and use `forceApprove`.

The testing fix is to stop relying only on clean-room ERC-20 mocks for production
token integrations. Add fork tests against the real mainnet USDT contract and the
real Aave V3 pool, or at least include adversarial/non-standard ERC-20 mocks that
model known production behaviors: no return value, false return value,
fee-on-transfer, rebasing, non-zero-to-non-zero approval restrictions, unusual
decimals, and blacklist/pause behavior where relevant.

The specific test that would have caught this is a mainnet-fork deposit using
USDT at `0xdAC17F958D2ee523a2206206994597C13D831ec7` as the underlying. That test
would have reverted on the raw `approve` call before deployment.
