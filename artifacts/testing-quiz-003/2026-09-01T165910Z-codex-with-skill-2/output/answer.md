# Why the USDT deposit reverts

Mainnet USDT is not a fully standard ERC-20. In particular, its `approve` function does not return the `bool` value declared by `IERC20.approve`.

This line is therefore the failure:

```solidity
usdt.approve(address(aavePool), amount);
```

Because the call is made through OpenZeppelin's `IERC20` interface, Solidity expects and ABI-decodes a 32-byte Boolean return value. Real USDT returns no data. The external token call can succeed internally, but the caller then fails while decoding the empty return data as a `bool`, producing a low-level revert that commonly has no reason string.

The mock never exposes the problem because OpenZeppelin's `ERC20.approve` is standards-compliant and returns `true`. Giving it six decimals changes only amount display/scaling; it does not reproduce USDT's unusual call/return behavior. Every number of tests against that same mock exercises the same compatible implementation, so more cases, fuzz inputs, and assertions cannot reveal an integration incompatibility absent from the test double.

`using SafeERC20 for IERC20` does not automatically make every token operation safe. It only adds explicitly named library methods to the type. The transfer uses `safeTransferFrom`, but the approval uses the raw `approve` method, bypassing `SafeERC20` entirely.

## Code fix

Use `SafeERC20.forceApprove`:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` performs approval through SafeERC20's optional-return handling, so both tokens returning `true` and tokens such as USDT returning no data are supported. It also handles USDT-style tokens that require an existing nonzero allowance to be set to zero before assigning another nonzero allowance. If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent safe sequence with SafeERC20-compatible calls: try the desired approval and, if necessary, approve zero before approving the desired amount. A raw `approve(0)` followed by raw `approve(amount)` still has the same missing-return-data problem.

## Testing-practice fix

Keep mocks for fast unit tests, but add a Foundry mainnet-fork integration test using:

- the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7`;
- the real Aave V3 Pool (or its mainnet Pool proxy); and
- a fixed mainnet block number for reproducibility.

Fund a test user with real forked USDT state (for example with Foundry's `deal` token overload), approve the vault, call `deposit`, and assert that Aave receives/supplies the assets and the vault receives the expected position. Run this fork test in CI with a mainnet RPC endpoint.

A custom USDT-like mock that returns no data and enforces zero-before-nonzero approval is also useful as a fast regression test. It is not a substitute for the fork test: the fork validates the exact deployed token, Aave contracts, proxy configuration, reserve state, and ABI behavior that production will use.
