# Why the USDT deposit reverts

The failing call is the direct approval:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT predates the modern ERC-20 convention and its `approve` implementation does not return a Boolean value. By contrast, OpenZeppelin's `IERC20.approve` declares `returns (bool)`. A normal high-level Solidity call through that interface therefore expects and ABI-decodes a Boolean return value. USDT returns no data, so the decode fails and Solidity reverts without a reason string. The transaction rollback also undoes the approval.

The mock never reveals this because stock OpenZeppelin `ERC20.approve` is fully standards-conforming and returns `true`. Its ABI behavior is therefore materially different from the deployed token even though both contracts can be addressed through `IERC20` and both use six decimals. The interface describes how the caller expects the contract to behave; it does not make a non-conforming deployed contract conform.

`using SafeERC20 for IERC20` does not automatically wrap every call made on an `IERC20`. It only adds methods such as `safeTransferFrom` and `forceApprove`; the code must actually call those methods. The first line calls `safeTransferFrom`, whose low-level optional-return handling accepts either no return data or a decoded `true`, so it works with USDT. The second line calls the original `IERC20.approve` directly, bypassing `SafeERC20`, and therefore reverts while decoding USDT's empty return data.

## Code fix

With a current OpenZeppelin release, use `forceApprove`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` uses optional-return-safe low-level calls and, when necessary, retries by setting the allowance to zero before setting the requested nonzero allowance. That second property also handles USDT's restriction on changing an existing nonzero allowance directly to another nonzero value. It is preferable here to a raw `approve`, and more robust than relying on the pool always consuming the allowance exactly.

If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent optional-return-safe zero-then-set sequence using `SafeERC20` facilities appropriate to that version. Do not merely ignore the Boolean returned by `IERC20.approve`: Solidity still decodes it before control returns to the caller.

## Testing-practice fix

Add a Foundry integration test on a **pinned mainnet fork** that uses the actual deployed USDT and Aave V3 pool, rather than substitutes for either integration boundary. Fund a test depositor with real fork-state USDT (for example using `deal` if it correctly supports that token, or by impersonating a funded holder), approve the vault, execute a deposit, and assert that the deposit succeeds and the expected Aave position/accounting changes occur. Pin a block supported by the RPC provider so the test is reproducible.

Keep the mock tests for fast unit testing, but do not treat them as integration evidence. No number of tests against this `MockERC20` could discover the defect: every such test executes the mock's conforming `approve` implementation and receives the Boolean return that the production USDT call omits. Adding more cases only explores inputs against the same incorrect environmental assumption. A deliberately non-standard mock could reproduce a known quirk, but the pre-deployment practice that catches unknown deployed-contract differences is a fork test against the real token and protocol.
