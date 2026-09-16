# Why the mainnet deposit reverts

The failing operation is the direct call to `approve`:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT predates the final ERC-20 convention and its `approve` function does not return a value. By contrast, OpenZeppelin's `IERC20.approve` declaration says it returns `bool`, and the stock OpenZeppelin `MockERC20` actually returns that boolean. A normal Solidity interface call therefore tries to ABI-decode a boolean from USDT's empty return data. That decoding fails and the transaction reverts, commonly without a useful reason string.

The preceding transfer succeeds precisely because it uses the SafeERC20 wrapper:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`SafeERC20` treats empty return data as success, while still requiring a returned value to be `true` when a token does return one. Merely declaring `using SafeERC20 for IERC20` does not automatically intercept every IERC20 call. The failing line invokes `approve` directly, so none of SafeERC20's optional-return handling protects it.

There is a second USDT compatibility detail: changing an existing nonzero allowance directly to another nonzero value is rejected. A robust fix must account for both the missing return value and this zero-first allowance rule.

## Code fix

With an OpenZeppelin version that provides it, use `forceApprove`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` uses SafeERC20's optional-return logic and, for tokens such as USDT, falls back to setting the allowance to zero before setting the requested value. An equivalent implementation on an older OpenZeppelin release is to make both approvals through SafeERC20-compatible optional-return calls—approve zero, then approve `amount`—or upgrade OpenZeppelin and use `forceApprove`. A raw `approve` should not be used here. Depending on the OpenZeppelin version, `safeApprove` may exist, but it is deprecated/restricted and `forceApprove` is the clearer solution for USDT-style tokens.

## Testing-practice fix

Add a mainnet-fork integration test that uses the actual deployed USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual Aave V3 pool, at a pinned block. Fund or impersonate a real USDT holder, approve the vault, execute a deposit, and assert that Aave receives the supply position. The test should also exercise a repeated deposit or a pre-existing allowance so the zero-first behavior is covered.

Unit tests with the stock OpenZeppelin mock cannot reveal this incompatibility, regardless of their number, because every one executes the mock's standards-compliant `approve` implementation, which returns `bool` and permits allowance changes that real USDT may reject. More mock-based tests only repeat the same incorrect behavioral assumption. A deliberately non-standard USDT-like mock could test the compatibility code, but it must explicitly reproduce empty return data and the zero-first rule; a fork test is what verifies the integration against the exact production bytecode and Aave deployment before mainnet.
