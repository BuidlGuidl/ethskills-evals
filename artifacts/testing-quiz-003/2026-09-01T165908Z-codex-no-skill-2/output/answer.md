# Why the USDT deposit reverts

The failure is the direct `approve` call:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return a Boolean value. By contrast, OpenZeppelin's `IERC20.approve` declares `returns (bool)`. A normal high-level Solidity call through `IERC20` therefore expects ABI-encoded return data. USDT returns no data, so Solidity's return-data decoding fails and the transaction reverts, commonly without a useful reason string.

The preceding transfer succeeds because it uses the SafeERC20 wrapper:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

SafeERC20 performs a low-level call and treats either of these as success:

- no return data, for legacy tokens such as USDT; or
- return data that decodes to `true`.

`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not intercept or modify calls to the token's own methods. Thus `safeTransferFrom` is protected, but the direct `.approve(...)` call is not.

The stock OpenZeppelin `MockERC20` is standards-compliant and returns `true` from `approve`, so it cannot reproduce this behavior. Its six decimals are irrelevant: decimals affect display/unit conventions, not the ABI behavior of `approve`. Adding more tests against that same mock would only exercise the same compliant implementation. Test quantity cannot compensate for a model that omits the production token's behavior.

## Code fix

Use SafeERC20 for the allowance operation as well. With OpenZeppelin 5.x, the robust choice is `forceApprove`, which supports optional-return tokens and tokens such as USDT that require an allowance to be reset to zero before changing one nonzero value to another:

```solidity
using SafeERC20 for IERC20;

function deposit(uint256 amount) external {
    usdt.safeTransferFrom(msg.sender, address(this), amount);
    usdt.forceApprove(address(aavePool), amount);
    aavePool.supply(address(usdt), amount, address(this), 0);
}
```

For an older OpenZeppelin version without `forceApprove`, use SafeERC20's optional-return-safe allowance operation supported by that version, resetting to zero before setting the desired amount when necessary:

```solidity
usdt.safeApprove(address(aavePool), 0);
usdt.safeApprove(address(aavePool), amount);
```

Do not replace the failing line with another raw `approve` call. Also, simply ignoring its returned Boolean would not help: the ABI decoder still expects return data.

## Testing-practice fix

Keep fast unit tests, but add a pinned mainnet-fork integration test that uses the actual deployed USDT contract and the actual Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/accounting. That test would execute USDT's real bytecode and would have failed on the raw `approve` before deployment.

A deliberately non-standard token double can supplement the fork test (no return value from `approve`, plus USDT's zero-first allowance behavior), but it should not be the sole production-compatibility check. The fork test guards against other differences in the real token and Aave integration that a hand-written mock may fail to model.
