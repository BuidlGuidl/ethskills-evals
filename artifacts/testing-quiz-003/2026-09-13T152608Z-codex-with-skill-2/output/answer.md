# Why the USDT deposit reverts

The failing call is the raw `approve`, not `safeTransferFrom`:

```solidity
usdt.approve(address(aavePool), amount);
```

Ethereum mainnet USDT predates the ERC-20 behavior assumed by OpenZeppelin's `IERC20`. Its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. The token can execute the approval, but the caller then tries to decode empty return data as a `bool`. That ABI decode fails and reverts without a token-provided reason string. The revert rolls back the whole transaction, including the approval and the preceding transfer, so `aavePool.supply` is never reached.

The mock cannot reproduce this. A stock OpenZeppelin `ERC20` implements `approve` with the standard `returns (bool)` ABI and returns `true`, so the same high-level call decodes successfully. Matching USDT's six decimals only matches denomination; it says nothing about call/return behavior. The real token also has the well-known rule that a nonzero allowance must generally be reset to zero before it is changed to another nonzero value, another behavior a stock OpenZeppelin mock does not model.

`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or replace every method on `IERC20`. Thus `safeTransferFrom(...)` uses `SafeERC20`'s low-level-call logic, which accepts either `true` or no return data, and succeeds with USDT. `approve(...)` is still the ordinary interface call and receives none of that protection.

## Code fix

Use the SafeERC20 allowance operation as well:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` is the appropriate OpenZeppelin helper for USDT-like tokens: it tolerates optional return data and, when necessary, performs the zero-then-value allowance update. With an older OpenZeppelin release that lacks `forceApprove`, upgrade it or implement the equivalent through SafeERC20-style optional-return calls; merely changing the line to another raw `approve` is not sufficient.

An alternative design is to establish a maximum allowance once (also via `forceApprove`) and let Aave consume from it, subject to the protocol's allowance-risk policy. Per-deposit `forceApprove` is the direct correction to the shown code.

## Testing-practice fix

Add a pinned Ethereum-mainnet fork integration test using the actual USDT address and the actual Aave V3 pool, fund a test actor with USDT on the fork, approve the vault, and execute a real deposit. Assert the resulting Aave position/vault accounting, not merely that the call did not revert. Pinning the block makes the dependency state reproducible, and the RPC endpoint must support historical state at that block.

No number of tests against these two mocks could discover this mismatch: a mock is executable documentation of the assumptions encoded by its author. Here both mocks implement the standard behavior the production dependencies were assumed to have, while the defect exists specifically in behavior omitted from the mocks. A purpose-built non-returning/zero-first token mock would be a useful regression test after discovery, but it still would not replace the pre-deployment pinned-fork test for an external protocol and a quirky deployed token.
