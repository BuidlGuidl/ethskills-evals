The deposit fails because mainnet USDT is not a normal OpenZeppelin-style ERC20.
Its `approve` function does not return a `bool`, and it also has the old USDT
allowance rule that rejects changing a non-zero allowance directly to another
non-zero allowance.

The first line succeeds:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

That call really is using OpenZeppelin `SafeERC20`. `SafeERC20` performs a
low-level call and accepts either a decoded `true` return value or no return data
at all, which is exactly what is needed for USDT-style tokens.

The failing line is different:

```solidity
usdt.approve(address(aavePool), amount);
```

Even though the contract has `using SafeERC20 for IERC20`, this line does not use
SafeERC20. It calls `IERC20.approve` directly. Since the `IERC20` interface says
`approve` returns `bool`, Solidity expects return data from the token call. Real
mainnet USDT returns no boolean, so the high-level ABI decoding can revert with no
useful reason string. If there is already a non-zero allowance, USDT can also
revert because it requires resetting the allowance to zero before setting a new
non-zero value.

The mock never caught this because the mock is a stock OpenZeppelin ERC20. It
returns `bool` from `approve` and follows the modern ERC20 behavior that most
tests assume. Adding more tests against that same mock only proves compatibility
with that mock. It cannot reveal behavior the mock does not model: missing return
values, USDT's zero-first approval rule, and the exact deployed token bytecode
used on mainnet.

The code fix is to use SafeERC20 for the approval too, preferably with
`forceApprove`:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` handles tokens like USDT by using SafeERC20's optional-return
handling and, when needed, resetting the allowance to zero before setting the
desired allowance. On older OpenZeppelin versions without `forceApprove`, the
equivalent workaround is to safely approve zero first and then safely approve the
amount.

The testing fix is to add integration tests against the real assets, not only
mocks. A mainnet-fork test using the deployed USDT contract and the deployed Aave
V3 pool would have reproduced the revert before deployment. A secondary useful
practice is to include adversarial token mocks that model known non-standard ERC20
behavior, but the main protection here is fork testing against the real token and
protocol contracts that production will call.
