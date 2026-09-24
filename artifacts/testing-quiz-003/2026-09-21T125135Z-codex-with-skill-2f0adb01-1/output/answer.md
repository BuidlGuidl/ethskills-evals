The on-chain failure is caused by USDT not behaving like the OpenZeppelin mock.

Ethereum mainnet USDT is a non-standard ERC-20. In particular, its `approve`,
`transfer`, and `transferFrom` functions do not return a normal ABI-encoded
`bool` the way `IERC20` says they should. OpenZeppelin's `MockERC20` does return
`bool`, so a high-level Solidity call through `IERC20` works against the mock.

This line succeeds:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

because it actually uses `SafeERC20`. `SafeERC20` performs a low-level call and
accepts either a decoded `true` return value or no return data at all. That is
why it handles USDT correctly.

This line is different:

```solidity
usdt.approve(address(aavePool), amount);
```

Even though the contract has `using SafeERC20 for IERC20`, this is still a raw
high-level `IERC20.approve` call. Solidity expects the call to return a `bool`.
USDT returns no data, so the ABI return-data check/decoding fails and the caller
reverts. That revert has no reason string because it is not a revert message
from your vault or Aave; it is the low-level consequence of calling a
non-standard token through a standard interface.

USDT also has the classic allowance quirk where changing a non-zero allowance to
another non-zero allowance must go through zero first. A robust fix should handle
that too.

The code fix is to use the SafeERC20 allowance helper, not raw `approve`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

If the OpenZeppelin version in use does not have `forceApprove`, upgrade it or
use the older zero-then-set pattern through SafeERC20:

```solidity
usdt.safeApprove(address(aavePool), 0);
usdt.safeApprove(address(aavePool), amount);
```

Do not use raw `approve` for arbitrary production tokens.

No amount of additional tests against the current `MockERC20` would have found
this. The mock implements the ERC-20 interface exactly as OpenZeppelin defines
it, so every test continues to exercise a token that returns `bool` and has
standard allowance behavior. More mock-based cases only give more confidence in
the mock's behavior, not in USDT's deployed behavior.

The testing-practice fix is to add an integration test on a mainnet fork against
the real deployed contracts: real USDT at
`0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real Aave V3 pool. Fork at
a fixed block, fund or impersonate a USDT holder, approve the vault from that
user, and call `deposit`. That test would have reverted before deployment.

Mocks are still useful for fast unit tests, but external integrations need fork
tests, especially when the dependency is a real token with known quirks such as
USDT.
