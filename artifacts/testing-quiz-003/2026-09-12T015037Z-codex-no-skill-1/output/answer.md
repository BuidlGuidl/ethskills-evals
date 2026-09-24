# Why the USDT deposit reverts

The failing call is the direct `approve`:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a non-standard ERC-20. Its `approve` function does not return the `bool` value required by the `IERC20` interface. Because the call is compiled through `IERC20.approve`, Solidity expects and ABI-decodes a 32-byte Boolean return value. USDT returns no data, so the token call itself can succeed but the caller then reverts while decoding the empty return data. That ABI-decoding failure commonly has no reason string. Execution therefore never reaches `aavePool.supply`.

The mock never exposes this because OpenZeppelin's stock `ERC20` is standards-compliant: its `approve` returns `true`. Matching USDT's decimals does not reproduce USDT's unusual call/return behavior. Running more tests against the same mock only exercises the same compliant implementation, so no number of those tests can reveal an incompatibility absent from the model.

`using SafeERC20 for IERC20` only makes the library's extension methods available; it does not rewrite ordinary ERC-20 method calls. The first line is protected because it explicitly calls `safeTransferFrom`. The second line calls raw `approve`, so none of `SafeERC20`'s optional-return handling is used.

## Code fix

Use `SafeERC20` for the allowance operation as well:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` uses SafeERC20's low-level optional-return handling, so an empty return value is accepted when the call succeeds. It also supports tokens such as USDT that may require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. If the project's OpenZeppelin version predates `forceApprove`, perform the equivalent safe zero-then-set sequence with that version's SafeERC20 facilities, or upgrade OpenZeppelin; do not replace this with another raw `approve`.

## Testing-practice fix

Add a mainnet-fork integration test using the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real Aave V3 Pool (with a pinned block for reproducibility). Fund or impersonate an account holding USDT, call the vault's deposit path, and verify that Aave receives the supply and the vault receives the corresponding position/aToken balance.

Unit tests should also include adversarial ERC-20 test doubles—especially a no-return token and a zero-first-approval token—but such mocks are only approximations. A fork test against the exact production token and protocol is what would have caught this deployment-specific incompatibility before mainnet.
