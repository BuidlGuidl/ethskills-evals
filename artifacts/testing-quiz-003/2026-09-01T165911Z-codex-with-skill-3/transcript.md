# Executor transcript — 2026-09-01T165911Z-codex-with-skill-3

**executor**: codex  |  **model**: cli default  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-01T165911Z-codex-with-skill-3/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-01T165911Z-codex-with-skill-3/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a05df9-f8d6-78c1-a08b-35eb0e54f0a4
--------
user
Our vault routes deposits into Aave V3. The suite runs against a MockERC20 for the
underlying and a MockAavePool for the pool — 39 tests, all green, and they have been
green since the first commit.

We deployed to mainnet with USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) as the
underlying. Every deposit reverts on-chain. The revert carries no reason string. The
relevant lines are:

    usdt.safeTransferFrom(msg.sender, address(this), amount);
    usdt.approve(address(aavePool), amount);
    aavePool.supply(address(usdt), amount, address(this), 0);

where `usdt` is declared as an OpenZeppelin `IERC20` and the contract does
`using SafeERC20 for IERC20`. Our MockERC20 is a stock OpenZeppelin ERC20 with
6 decimals.

Note the first line uses the token and succeeds; the failure is further down.

Explain why this reverts against the real deployed USDT but never against the mock,
why the SafeERC20 usage did not protect the failing line, and why no amount of extra
mock-based tests would have surfaced it. Then give both fixes: the code change, and
the change in testing practice that would have caught this before mainnet.

Write your answer to answer.md in this directory.

2026-09-01T17:17:38.626565Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a05df9-f8d6-78c1-a08b-35eb0e54f0a4.tmp-1788283058405607797: line 2547: syntax error near unexpected token `('

codex
I’m using the smart-contract testing skill because the key issue is the gap between ERC-20 mocks and forked mainnet behavior. I’ll inspect its guidance, then write the diagnosis and both fixes to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-01T165911Z-codex-with-skill-3/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: testing
description: Smart contract testing with Foundry — unit tests, fuzz testing, fork testing, invariant testing. Use when writing tests for a smart contract.
---

# Smart Contract Testing

## What You Probably Got Wrong

**You test getters and trivial functions.** Testing that `name()` returns the name is worthless. Test edge cases, failure modes, and economic invariants — the things that lose money when they break.

**You don't fuzz.** `forge test` finds the bugs you thought of. Fuzzing finds the ones you didn't. If your contract does math, fuzz it. If it handles user input, fuzz it. If it moves value, definitely fuzz it.

**You don't fork-test.** If your contract calls Uniswap, Aave, or any external protocol (verified addresses: `addresses/SKILL.md`), test against their real deployed contracts on a fork. Mocking them hides integration bugs that only appear with real state.

**You write tests that mirror the implementation.** Testing that `deposit(100)` sets `balance[user] = 100` is tautological — you're testing that Solidity assignments work. Test properties: "after deposit and withdraw, user gets their tokens back." Test invariants: "total deposits always equals contract balance."

**You skip invariant testing for stateful protocols.** If your contract has multiple interacting functions that change state over time (vaults, AMMs, lending), you need invariant tests. Unit tests check one path; invariant tests check that properties hold across thousands of random sequences.

---

## Unit Testing with Foundry

### Test File Structure

```solidity
// test/MyContract.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MyToken} from "../src/MyToken.sol";

contract MyTokenTest is Test {
    MyToken public token;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        token = new MyToken("Test", "TST", 1_000_000e18);
        // Give alice some tokens for testing
        token.transfer(alice, 10_000e18);
    }

    function test_TransferUpdatesBalances() public {
        vm.prank(alice);
        token.transfer(bob, 1_000e18);

        assertEq(token.balanceOf(alice), 9_000e18);
        assertEq(token.balanceOf(bob), 1_000e18);
    }

    function test_TransferEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Transfer(alice, bob, 500e18);

        vm.prank(alice);
        token.transfer(bob, 500e18);
    }

    function test_RevertWhen_TransferExceedsBalance() public {
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(bob, 999_999e18); // More than alice has
    }

    function test_RevertWhen_TransferToZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(address(0), 100e18);
    }
}
```

### Key Assertion Patterns

```solidity
// Equality
assertEq(actual, expected);
assertEq(actual, expected, "descriptive error message");

// Comparisons
assertGt(a, b);   // a > b
assertGe(a, b);   // a >= b
assertLt(a, b);   // a < b
assertLe(a, b);   // a <= b

// Approximate equality (for math with rounding)
assertApproxEqAbs(actual, expected, maxDelta);
assertApproxEqRel(actual, expected, maxPercentDelta); // in WAD (1e18 = 100%)

// Revert expectations
vm.expectRevert();                           // Any revert
vm.expectRevert("Insufficient balance");     // Specific message
vm.expectRevert(MyContract.CustomError.selector); // Custom error

// Event expectations
vm.expectEmit(true, true, false, true);      // (topic1, topic2, topic3, data)
emit MyEvent(expectedArg1, expectedArg2);
```

### What to Actually Test

```solidity
// ✅ TEST: Edge cases that lose money
function test_TransferZeroAmount() public { /* ... */ }
function test_TransferEntireBalance() public { /* ... */ }
function test_TransferToSelf() public { /* ... */ }
function test_ApproveOverwrite() public { /* ... */ }
function test_TransferFromWithExactAllowance() public { /* ... */ }

// ✅ TEST: Access control
function test_RevertWhen_NonOwnerCallsAdminFunction() public { /* ... */ }
function test_OwnerCanPause() public { /* ... */ }

// ✅ TEST: Failure modes
function test_RevertWhen_DepositZero() public { /* ... */ }
function test_RevertWhen_WithdrawMoreThanDeposited() public { /* ... */ }
function test_RevertWhen_ContractPaused() public { /* ... */ }

// ❌ DON'T TEST: OpenZeppelin internals
// function test_NameReturnsName() — they already tested this
// function test_SymbolReturnsSymbol() — waste of time
// function test_DecimalsReturns18() — it does, trust it
```

---

## Fuzz Testing

Foundry automatically fuzzes any test function with parameters. Instead of testing one value, it tests hundreds of random values.

### Basic Fuzz Test

```solidity
// Foundry calls this with random amounts
function testFuzz_DepositWithdrawRoundtrip(uint256 amount) public {
    // Bound input to valid range
    amount = bound(amount, 1, token.balanceOf(alice));

    uint256 balanceBefore = token.balanceOf(alice);

    vm.startPrank(alice);
    token.approve(address(vault), amount);
    vault.deposit(amount, alice);
    vault.withdraw(vault.balanceOf(alice), alice, alice);
    vm.stopPrank();

    // Property: user gets back what they deposited (minus any fees)
    assertGe(token.balanceOf(alice), balanceBefore - 1); // Allow 1 wei rounding
}
```

### Bounding Inputs

```solidity
// bound() is preferred over vm.assume() — bound reshapes, assume discards
function testFuzz_Fee(uint256 amount, uint256 feeBps) public {
    amount = bound(amount, 1e6, 1e30);       // Reasonable token amounts
    feeBps = bound(feeBps, 1, 10_000);       // 0.01% to 100%

    uint256 fee = (amount * feeBps) / 10_000;
    uint256 afterFee = amount - fee;

    // Property: fee + remainder always equals original
    assertEq(fee + afterFee, amount);
}

// vm.assume() discards inputs — use sparingly
function testFuzz_Division(uint256 a, uint256 b) public {
    vm.assume(b > 0); // Skip zero (would revert)
    // ...
}
```

### Run with More Iterations

```bash
# Default: 256 runs
forge test

# More thorough: 10,000 runs
forge test --fuzz-runs 10000

# Set in foundry.toml for CI
# [fuzz]
# runs = 1000
```

---

## Fork Testing

Test your contract against real deployed protocols on a mainnet fork. This catches integration bugs that mocks can't.

### Basic Fork Test

```solidity
contract SwapTest is Test {
    // Real mainnet addresses — full verified list: addresses/SKILL.md
    address constant UNISWAP_ROUTER = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    function setUp() public {
        // Fork mainnet at a specific block for reproducibility
        vm.createSelectFork("mainnet", 19_000_000);
    }

    function test_SwapETHForUSDC() public {
        address user = makeAddr("user");
        vm.deal(user, 1 ether);

        vm.startPrank(user);

        // Build swap path
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: 3000,
                recipient: user,
                amountIn: 0.1 ether,
                amountOutMinimum: 0, // In production, NEVER set to 0
                sqrtPriceLimitX96: 0
            });

        // Execute swap
        uint256 amountOut = ISwapRouter(UNISWAP_ROUTER).exactInputSingle{value: 0.1 ether}(params);

        vm.stopPrank();

        // Verify we got USDC back
        assertGt(amountOut, 0, "Should receive USDC");
        assertGt(IERC20(USDC).balanceOf(user), 0);
    }
}
```

### When to Fork-Test

exec
/bin/bash -lc "sed -n '241,520p' .agents/skills/testing/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-01T165911Z-codex-with-skill-3/testing-quiz-003
 succeeded in 0ms:
codex
The failure is at the direct `approve` call: mainnet USDT’s legacy implementation does not return the ABI-encoded `bool` that `IERC20.approve` declares. The mock does, so it cannot reproduce this integration mismatch. I’m writing the answer with `forceApprove` as the robust fix, including USDT’s zero-first allowance behavior.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-01T165911Z-codex-with-skill-3/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5db15f428e32e698bcb0acaf044412289f535d8
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,47 @@
+# Why the mainnet deposits revert
+
+The revert occurs at:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` implementation does not return a value, even though the `IERC20` interface declares `approve(address,uint256) returns (bool)`. A direct high-level call through `IERC20` therefore expects 32 bytes of ABI-encoded return data. USDT returns no data, and Solidity's return-data decoding reverts. That decoding failure commonly has no reason string, so execution never reaches `aavePool.supply`.
+
+The OpenZeppelin mock cannot reproduce this. A stock `ERC20` implements the modern interface and returns `true` from `approve`; it also does not reproduce USDT's other approval restriction that an existing nonzero allowance must generally be reset to zero before setting another nonzero allowance. Giving the mock six decimals changes only its units, not its call/return or allowance semantics.
+
+## Why `SafeERC20` did not protect this call
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not transparently wrap every call made on an `IERC20` value.
+
+Thus:
+
+```solidity
+usdt.safeTransferFrom(...);
+```
+
+uses `SafeERC20`, whose optional-return handling accepts both a returned `true` and empty return data. But:
+
+```solidity
+usdt.approve(...);
+```
+
+selects `IERC20.approve` directly. It bypasses `SafeERC20`, so Solidity tries to decode USDT's nonexistent return value and reverts.
+
+## Code fix
+
+Use the SafeERC20 approval operation, preferably `forceApprove` in current OpenZeppelin versions:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens that return no value and tokens such as USDT that require a zero allowance before a new nonzero allowance is written. An alternative design is to grant Aave a maximum allowance once, also through `forceApprove`, subject to the project's allowance-risk policy. A raw `approve` should not be used here. In older OpenZeppelin releases without `forceApprove`, use SafeERC20's optional-return-safe approval mechanism and explicitly set the allowance to zero before setting the desired value.
+
+## Testing-practice fix
+
+Keep the mock-based unit tests, but add a mainnet-fork integration test using the actual deployed USDT and the actual Aave V3 Pool, pinned to a specific block. Fund a test user with USDT (for example with Foundry's token `deal` facility or by impersonating a funded account), approve the vault, execute a deposit, and assert that Aave receives the supply or that the vault receives the expected aToken/accounting change.
+
+No number of additional tests against the same OpenZeppelin mock would expose this bug: every invocation still exercises the mock's standards-compliant `approve` implementation, not USDT's bytecode and return-data behavior. Fuzzing more amounts or call sequences expands inputs but does not change the implementation under test. A fork test crosses the real integration boundary and would have failed before deployment at the direct `approve` call. For important supported assets, the suite should include pinned fork tests for each real token/protocol combination, especially known non-standard tokens such as USDT.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5db15f428e32e698bcb0acaf044412289f535d8
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,47 @@
+# Why the mainnet deposits revert
+
+The revert occurs at:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` implementation does not return a value, even though the `IERC20` interface declares `approve(address,uint256) returns (bool)`. A direct high-level call through `IERC20` therefore expects 32 bytes of ABI-encoded return data. USDT returns no data, and Solidity's return-data decoding reverts. That decoding failure commonly has no reason string, so execution never reaches `aavePool.supply`.
+
+The OpenZeppelin mock cannot reproduce this. A stock `ERC20` implements the modern interface and returns `true` from `approve`; it also does not reproduce USDT's other approval restriction that an existing nonzero allowance must generally be reset to zero before setting another nonzero allowance. Giving the mock six decimals changes only its units, not its call/return or allowance semantics.
+
+## Why `SafeERC20` did not protect this call
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not transparently wrap every call made on an `IERC20` value.
+
+Thus:
+
+```solidity
+usdt.safeTransferFrom(...);
+```
+
+uses `SafeERC20`, whose optional-return handling accepts both a returned `true` and empty return data. But:
+
+```solidity
+usdt.approve(...);
+```
+
+selects `IERC20.approve` directly. It bypasses `SafeERC20`, so Solidity tries to decode USDT's nonexistent return value and reverts.
+
+## Code fix
+
+Use the SafeERC20 approval operation, preferably `forceApprove` in current OpenZeppelin versions:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens that return no value and tokens such as USDT that require a zero allowance before a new nonzero allowance is written. An alternative design is to grant Aave a maximum allowance once, also through `forceApprove`, subject to the project's allowance-risk policy. A raw `approve` should not be used here. In older OpenZeppelin releases without `forceApprove`, use SafeERC20's optional-return-safe approval mechanism and explicitly set the allowance to zero before setting the desired value.
+
+## Testing-practice fix
+
+Keep the mock-based unit tests, but add a mainnet-fork integration test using the actual deployed USDT and the actual Aave V3 Pool, pinned to a specific block. Fund a test user with USDT (for example with Foundry's token `deal` facility or by impersonating a funded account), approve the vault, execute a deposit, and assert that Aave receives the supply or that the vault receives the expected aToken/accounting change.
+
+No number of additional tests against the same OpenZeppelin mock would expose this bug: every invocation still exercises the mock's standards-compliant `approve` implementation, not USDT's bytecode and return-data behavior. Fuzzing more amounts or call sequences expands inputs but does not change the implementation under test. A fork test crosses the real integration boundary and would have failed before deployment at the direct `approve` call. For important supported assets, the suite should include pinned fork tests for each real token/protocol combination, especially known non-standard tokens such as USDT.

exec
/bin/bash -lc "sed -n '1,260p' answer.md" in /home/damu/.cache/ethskills-evals/2026-09-01T165911Z-codex-with-skill-3/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Why the mainnet deposits revert

The revert occurs at:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` implementation does not return a value, even though the `IERC20` interface declares `approve(address,uint256) returns (bool)`. A direct high-level call through `IERC20` therefore expects 32 bytes of ABI-encoded return data. USDT returns no data, and Solidity's return-data decoding reverts. That decoding failure commonly has no reason string, so execution never reaches `aavePool.supply`.

The OpenZeppelin mock cannot reproduce this. A stock `ERC20` implements the modern interface and returns `true` from `approve`; it also does not reproduce USDT's other approval restriction that an existing nonzero allowance must generally be reset to zero before setting another nonzero allowance. Giving the mock six decimals changes only its units, not its call/return or allowance semantics.

## Why `SafeERC20` did not protect this call

`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not transparently wrap every call made on an `IERC20` value.

Thus:

```solidity
usdt.safeTransferFrom(...);
```

uses `SafeERC20`, whose optional-return handling accepts both a returned `true` and empty return data. But:

```solidity
usdt.approve(...);
```

selects `IERC20.approve` directly. It bypasses `SafeERC20`, so Solidity tries to decode USDT's nonexistent return value and reverts.

## Code fix

Use the SafeERC20 approval operation, preferably `forceApprove` in current OpenZeppelin versions:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` handles tokens that return no value and tokens such as USDT that require a zero allowance before a new nonzero allowance is written. An alternative design is to grant Aave a maximum allowance once, also through `forceApprove`, subject to the project's allowance-risk policy. A raw `approve` should not be used here. In older OpenZeppelin releases without `forceApprove`, use SafeERC20's optional-return-safe approval mechanism and explicitly set the allowance to zero before setting the desired value.

## Testing-practice fix

Keep the mock-based unit tests, but add a mainnet-fork integration test using the actual deployed USDT and the actual Aave V3 Pool, pinned to a specific block. Fund a test user with USDT (for example with Foundry's token `deal` facility or by impersonating a funded account), approve the vault, execute a deposit, and assert that Aave receives the supply or that the vault receives the expected aToken/accounting change.

No number of additional tests against the same OpenZeppelin mock would expose this bug: every invocation still exercises the mock's standards-compliant `approve` implementation, not USDT's bytecode and return-data behavior. Fuzzing more amounts or call sequences expands inputs but does not change the implementation under test. A fork test crosses the real integration boundary and would have failed before deployment at the direct `approve` call. For important supported assets, the suite should include pinned fork tests for each real token/protocol combination, especially known non-standard tokens such as USDT.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5db15f428e32e698bcb0acaf044412289f535d8
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,47 @@
+# Why the mainnet deposits revert
+
+The revert occurs at:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` implementation does not return a value, even though the `IERC20` interface declares `approve(address,uint256) returns (bool)`. A direct high-level call through `IERC20` therefore expects 32 bytes of ABI-encoded return data. USDT returns no data, and Solidity's return-data decoding reverts. That decoding failure commonly has no reason string, so execution never reaches `aavePool.supply`.
+
+The OpenZeppelin mock cannot reproduce this. A stock `ERC20` implements the modern interface and returns `true` from `approve`; it also does not reproduce USDT's other approval restriction that an existing nonzero allowance must generally be reset to zero before setting another nonzero allowance. Giving the mock six decimals changes only its units, not its call/return or allowance semantics.
+
+## Why `SafeERC20` did not protect this call
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not transparently wrap every call made on an `IERC20` value.
+
+Thus:
+
+```solidity
+usdt.safeTransferFrom(...);
+```
+
+uses `SafeERC20`, whose optional-return handling accepts both a returned `true` and empty return data. But:
+
+```solidity
+usdt.approve(...);
+```
+
+selects `IERC20.approve` directly. It bypasses `SafeERC20`, so Solidity tries to decode USDT's nonexistent return value and reverts.
+
+## Code fix
+
+Use the SafeERC20 approval operation, preferably `forceApprove` in current OpenZeppelin versions:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens that return no value and tokens such as USDT that require a zero allowance before a new nonzero allowance is written. An alternative design is to grant Aave a maximum allowance once, also through `forceApprove`, subject to the project's allowance-risk policy. A raw `approve` should not be used here. In older OpenZeppelin releases without `forceApprove`, use SafeERC20's optional-return-safe approval mechanism and explicitly set the allowance to zero before setting the desired value.
+
+## Testing-practice fix
+
+Keep the mock-based unit tests, but add a mainnet-fork integration test using the actual deployed USDT and the actual Aave V3 Pool, pinned to a specific block. Fund a test user with USDT (for example with Foundry's token `deal` facility or by impersonating a funded account), approve the vault, execute a deposit, and assert that Aave receives the supply or that the vault receives the expected aToken/accounting change.
+
+No number of additional tests against the same OpenZeppelin mock would expose this bug: every invocation still exercises the mock's standards-compliant `approve` implementation, not USDT's bytecode and return-data behavior. Fuzzing more amounts or call sequences expands inputs but does not change the implementation under test. A fork test crosses the real integration boundary and would have failed before deployment at the direct `approve` call. For important supported assets, the suite should include pinned fork tests for each real token/protocol combination, especially known non-standard tokens such as USDT.

codex
Created [answer.md](/home/damu/.cache/ethskills-evals/2026-09-01T165911Z-codex-with-skill-3/testing-quiz-003/answer.md) with the root cause, `forceApprove` fix, and mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..d5db15f428e32e698bcb0acaf044412289f535d8
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,47 @@
+# Why the mainnet deposits revert
+
+The revert occurs at:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` implementation does not return a value, even though the `IERC20` interface declares `approve(address,uint256) returns (bool)`. A direct high-level call through `IERC20` therefore expects 32 bytes of ABI-encoded return data. USDT returns no data, and Solidity's return-data decoding reverts. That decoding failure commonly has no reason string, so execution never reaches `aavePool.supply`.
+
+The OpenZeppelin mock cannot reproduce this. A stock `ERC20` implements the modern interface and returns `true` from `approve`; it also does not reproduce USDT's other approval restriction that an existing nonzero allowance must generally be reset to zero before setting another nonzero allowance. Giving the mock six decimals changes only its units, not its call/return or allowance semantics.
+
+## Why `SafeERC20` did not protect this call
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not transparently wrap every call made on an `IERC20` value.
+
+Thus:
+
+```solidity
+usdt.safeTransferFrom(...);
+```
+
+uses `SafeERC20`, whose optional-return handling accepts both a returned `true` and empty return data. But:
+
+```solidity
+usdt.approve(...);
+```
+
+selects `IERC20.approve` directly. It bypasses `SafeERC20`, so Solidity tries to decode USDT's nonexistent return value and reverts.
+
+## Code fix
+
+Use the SafeERC20 approval operation, preferably `forceApprove` in current OpenZeppelin versions:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens that return no value and tokens such as USDT that require a zero allowance before a new nonzero allowance is written. An alternative design is to grant Aave a maximum allowance once, also through `forceApprove`, subject to the project's allowance-risk policy. A raw `approve` should not be used here. In older OpenZeppelin releases without `forceApprove`, use SafeERC20's optional-return-safe approval mechanism and explicitly set the allowance to zero before setting the desired value.
+
+## Testing-practice fix
+
+Keep the mock-based unit tests, but add a mainnet-fork integration test using the actual deployed USDT and the actual Aave V3 Pool, pinned to a specific block. Fund a test user with USDT (for example with Foundry's token `deal` facility or by impersonating a funded account), approve the vault, execute a deposit, and assert that Aave receives the supply or that the vault receives the expected aToken/accounting change.
+
+No number of additional tests against the same OpenZeppelin mock would expose this bug: every invocation still exercises the mock's standards-compliant `approve` implementation, not USDT's bytecode and return-data behavior. Fuzzing more amounts or call sequences expands inputs but does not change the implementation under test. A fork test crosses the real integration boundary and would have failed before deployment at the direct `approve` call. For important supported assets, the suite should include pinned fork tests for each real token/protocol combination, especially known non-standard tokens such as USDT.

tokens used
21,738
````

## final message

Created [answer.md](/home/damu/.cache/ethskills-evals/2026-09-01T165911Z-codex-with-skill-3/testing-quiz-003/answer.md) with the root cause, `forceApprove` fix, and mainnet-fork testing recommendation.
