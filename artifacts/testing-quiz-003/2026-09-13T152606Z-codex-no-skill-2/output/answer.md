# Why the USDT deposit reverts

The failing operation is the raw `approve`, not Aave's `supply`:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT predates the modern ERC-20 convention and its `approve` function does not return a `bool`. Because `usdt` is statically typed as OpenZeppelin's `IERC20`, Solidity generates a normal high-level call that expects and ABI-decodes a `bool`. USDT successfully executes the approval but returns empty data; the caller then fails while decoding that empty return data. This ABI-decoding failure commonly arrives as an empty revert, which explains the absence of a reason string. `supply` is never reached.

The preceding transfer works because it is actually routed through `SafeERC20`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`SafeERC20` makes a low-level call and treats either empty return data or an encoded `true` as success. That behavior exists specifically for non-standard tokens such as USDT. Merely declaring `using SafeERC20 for IERC20` does not wrap ordinary interface calls automatically. The expression `usdt.approve(...)` selects `IERC20.approve`, so none of `SafeERC20`'s optional-return handling protects it.

The OpenZeppelin mock cannot expose this incompatibility. A stock `ERC20` implements the interface conventionally and returns `true` from `approve`, so every test—regardless of how many cases are added—continues exercising the same ABI behavior. Matching decimals is irrelevant; the incompatibility is in return data and, for allowance updates, USDT's approval rules. More coverage over an inaccurate substitute does not create fidelity to the deployed dependency.

## Code fix

Use `SafeERC20` for the approval too. With a current OpenZeppelin release, `forceApprove` is the robust choice:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` uses optional-return-safe calls and also handles tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero value. This requires an OpenZeppelin version that provides `forceApprove`; otherwise implement the same safe zero-then-set sequence using low-level optional-return handling, or upgrade OpenZeppelin. A direct `approve`, even if its returned value is ignored in source code, is not a fix because Solidity still decodes the declared return value.

## Testing-practice fix

Add a mainnet-fork integration test using the real USDT address and the real Aave V3 pool, at a pinned block. Fund or impersonate an account with USDT, approve the vault, deposit, and assert that Aave received the supply/aToken position. That test exercises the deployed token bytecode, its empty return data, its allowance behavior, and the actual pool interaction.

Keep fast unit tests, but supplement them with compatibility/adversarial token doubles that model known ERC-20 deviations—for example, a token whose `approve` and transfers return no data and a token requiring zero-before-nonzero approval. The fork test is the decisive regression test here; a stock OpenZeppelin `MockERC20` alone is not an adequate stand-in for USDT.
