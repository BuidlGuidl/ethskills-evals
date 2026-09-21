The deposit reverts because the second token call is not actually using
`SafeERC20`.

`safeTransferFrom` succeeds because it is a `SafeERC20` wrapper call:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

OpenZeppelin's `SafeERC20` handles non-standard ERC-20s whose `transfer` or
`transferFrom` do not return a boolean, as long as the low-level call itself
does not revert.

But this line:

```solidity
usdt.approve(address(aavePool), amount);
```

is a direct call to `IERC20.approve`, not a `SafeERC20` call. Since `approve`
exists on `IERC20`, Solidity resolves it to the interface function, not to a
library helper. The declared interface says `approve` returns `bool`, so the
high-level external call expects ABI-encoded return data.

Real mainnet USDT is non-standard: its `approve` does not return a `bool`.
So the call executes on USDT, receives no return data, and then the caller fails
while trying to decode the missing boolean. That produces a revert with no
reason string. The failure happens before the Aave `supply` call.

The OpenZeppelin mock never exposes this because it is a standard ERC-20. Its
`approve` returns `true`, exactly as `IERC20` declares. No matter how many tests
use that mock, they only test the behavior of a standard token. They cannot find
a mismatch between the interface and USDT's deployed behavior, because the mock
does not contain that mismatch.

The code fix is to use the `SafeERC20` allowance helper too:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` is the right default for USDT-style tokens because it handles
optional return values and also handles tokens that require allowance to be set
to zero before being changed to a new non-zero value.

If using an older OpenZeppelin version without `forceApprove`, use the available
safe allowance pattern for that version, typically zeroing first and then using
the safe approve wrapper:

```solidity
usdt.safeApprove(address(aavePool), 0);
usdt.safeApprove(address(aavePool), amount);
```

The testing fix is to add a pinned mainnet fork test that exercises the deployed
integration against the real USDT contract and the real Aave V3 pool, or at
least against the real USDT contract plus the exact pool call path. External
integrations and quirky tokens need fork coverage because mocks encode the
assumptions of the test author. A stock `MockERC20` proves the vault works with
a standard ERC-20; it does not prove the vault works with USDT.
