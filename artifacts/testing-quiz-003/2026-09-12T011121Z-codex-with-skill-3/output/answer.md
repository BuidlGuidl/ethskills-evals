# Why the USDT deposit reverts

The failing operation is the direct `approve` call:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT predates the modern ERC-20 ABI. Its `approve` implementation does not
return a `bool`, even though `IERC20.approve` declares that it does. Solidity makes
the call through the `IERC20` interface and then tries to ABI-decode a 32-byte
Boolean return value. USDT returns no data, so that decode fails and the high-level
call reverts, generally without a reason string.

The mock never exhibits this behavior because OpenZeppelin's `ERC20.approve`
conforms to the current interface and returns `true`. Its decimals are irrelevant:
using six decimals makes amounts look like USDT amounts, but it does not reproduce
USDT's call/return behavior. The mock also does not reproduce USDT's requirement
that a nonzero allowance be reset to zero before it is changed to another nonzero
value.

The preceding transfer succeeds precisely because it is invoked through the
wrapper:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`SafeERC20` performs a low-level call and treats empty return data as success,
provided the call itself did not revert. Merely writing
`using SafeERC20 for IERC20` does not change the behavior of every `IERC20` method.
It only makes the library's explicitly named extension methods available. Thus
`safeTransferFrom` is protected, while the ordinary `approve` call is still a
normal Solidity interface call and still attempts to decode USDT's missing return
value.

## Code fix

Use OpenZeppelin `SafeERC20.forceApprove`:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` accepts tokens that return no value and, when necessary, performs
the USDT-compatible allowance sequence of approving zero before approving the new
nonzero amount. This makes it more robust than replacing the line with a raw
low-level call or relying only on an optional-return `safeApprove` implementation.
The exact available method depends on the installed OpenZeppelin version; upgrading
to a version that provides `forceApprove` is the preferred fix.

An alternative design is to establish a maximum allowance once, using
`forceApprove`, and let Aave consume from it. That changes the approval exposure and
should be an explicit design decision rather than an accidental workaround.

## Testing-practice fix

Add a pinned mainnet-fork integration test that uses the deployed USDT and Aave V3
pool addresses and executes the complete deposit path. Fund a test depositor with
real USDT state (for example, by impersonating a funded account or with a verified
token-deal setup), approve the vault, deposit, and assert the resulting Aave/vault
state. The test should first reproduce the revert with the old implementation and
then pass with `forceApprove`.

Pin the fork to a specific block and use an RPC endpoint that serves that historical
state so the test is reproducible.

No number of additional tests against the same stock OpenZeppelin token and pool
mock can reveal this defect. A mock is an executable statement of the test author's
assumptions; here it assumes standards-compliant Boolean return data. More inputs,
fuzz cases, assertions, or coverage against that model only exercise the same
incorrect assumption. A purpose-built non-returning token mock could reproduce this
particular known quirk, but it would only test a quirk already anticipated. The
predeployment practice that discovers mismatches with a real external integration
is a fork test against the actual deployed contracts.
