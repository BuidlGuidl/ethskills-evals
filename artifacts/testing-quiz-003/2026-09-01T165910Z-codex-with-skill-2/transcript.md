# Executor transcript — 2026-09-01T165910Z-codex-with-skill-2

**executor**: codex  |  **model**: cli default  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-01T165910Z-codex-with-skill-2/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-01T165910Z-codex-with-skill-2/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a05df9-b81a-7f91-8969-e89856fce8a6
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

2026-09-01T17:17:22.048887Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a05df9-b81a-7f91-8969-e89856fce8a6.tmp-1788283041828661245: line 2547: syntax error near unexpected token `('

codex
I’m using the smart-contract testing skill because this is specifically about a mock-vs-mainnet failure and the test practice needed to catch it.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-01T165910Z-codex-with-skill-2/testing-quiz-003
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
/bin/bash -lc "sed -n '241,520p' .agents/skills/testing/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-01T165910Z-codex-with-skill-2/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device

- **Always:** Any contract that calls an external protocol (Uniswap, Aave, Chainlink)
- **Always:** Any contract that handles tokens with quirks (USDT, fee-on-transfer, rebasing)
- **Always:** Any contract that reads oracle prices
- **Never:** Pure logic contracts with no external calls — use unit tests

### Running Fork Tests

```bash
# Fork from RPC URL
forge test --fork-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Fork at specific block (reproducible)
forge test --fork-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY --fork-block-number 19000000

# Set in foundry.toml to avoid CLI flags
# [rpc_endpoints]
# mainnet = "${MAINNET_RPC_URL}"
```

---

## Invariant Testing

Invariant tests verify that properties hold across thousands of random function call sequences. Essential for stateful protocols.

### What Are Invariants?

Invariants are properties that must ALWAYS be true, no matter what sequence of actions users take:

- "Total supply equals sum of all balances" (ERC-20)
- "Total deposits equals total shares times share price" (vault)
- "x * y >= k after every swap" (AMM)
- "User can always withdraw what they deposited" (escrow)

### Basic Invariant Test

```solidity
contract VaultInvariantTest is Test {
    MyVault public vault;
    IERC20 public token;
    VaultHandler public handler;

    function setUp() public {
        token = new MockERC20("Test", "TST", 18);
        vault = new MyVault(token);
        handler = new VaultHandler(vault, token);

        // Tell Foundry which contract to call randomly
        targetContract(address(handler));
    }

    // This runs after every random sequence
    function invariant_TotalAssetsMatchesBalance() public view {
        assertEq(
            vault.totalAssets(),
            token.balanceOf(address(vault)),
            "Total assets must equal actual balance"
        );
    }

    function invariant_SharePriceNeverZero() public view {
        if (vault.totalSupply() > 0) {
            assertGt(vault.convertToAssets(1e18), 0, "Share price must never be zero");
        }
    }
}

// Handler: guided random actions
contract VaultHandler is Test {
    MyVault public vault;
    IERC20 public token;

    constructor(MyVault _vault, IERC20 _token) {
        vault = _vault;
        token = _token;
    }

    function deposit(uint256 amount) public {
        amount = bound(amount, 1, 1e24);
        deal(address(token), msg.sender, amount);

        vm.startPrank(msg.sender);
        token.approve(address(vault), amount);
        vault.deposit(amount, msg.sender);
        vm.stopPrank();
    }

    function withdraw(uint256 shares) public {
        uint256 maxShares = vault.balanceOf(msg.sender);
        if (maxShares == 0) return;
        shares = bound(shares, 1, maxShares);

        vm.prank(msg.sender);
        vault.redeem(shares, msg.sender, msg.sender);
    }
}
```

### Running Invariant Tests

```bash
# Default depth (15 calls per sequence, 256 sequences)
forge test

# Deeper exploration
forge test --fuzz-runs 1000

# Configure in foundry.toml
# [invariant]
# runs = 512
# depth = 50
```

---

## What NOT to Test

- **OpenZeppelin internals.** Don't test that `ERC20.transfer` works. It's been audited by dozens of firms and used by thousands of contracts. Test YOUR logic on top of it.
- **Solidity language features.** Don't test that `require` reverts or that `mapping` stores values. The compiler works.
- **Every getter.** If `name()` returns the name you passed to the constructor, that's not a test — it's a tautology.
- **Happy path only.** The happy path probably works. Test the unhappy paths: what happens with zero? Max uint? Unauthorized callers? Reentrancy?

**Focus your testing effort on:** Custom business logic, mathematical operations, integration points with external protocols, access control boundaries, and economic edge cases.

---

## Pre-Deploy Test Checklist

- [ ] All custom logic has unit tests with edge cases
- [ ] Zero amounts, max uint, empty arrays, self-transfers tested
- [ ] Access control verified — unauthorized calls revert
- [ ] Fuzz tests on all mathematical operations (minimum 1000 runs)
- [ ] Fork tests for every external protocol integration
- [ ] Invariant tests for stateful protocols (vaults, AMMs, lending)
- [ ] Events verified with `expectEmit`
- [ ] Gas snapshots taken with `forge snapshot` to catch regressions
- [ ] Static analysis with `slither .` — no high/medium findings unaddressed
- [ ] All tests pass: `forge test -vvv`

codex
The key mismatch is ABI behavior, not decimals or Aave accounting: mainnet USDT’s `approve` is non-standard, while the OpenZeppelin mock implements the standard return value. I’ll capture the robust approval fix and a pinned mainnet-fork integration test recommendation.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-01T165910Z-codex-with-skill-2/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..cfbda48bde71ebc712f8a33ad8aa8cdc773ca377
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,41 @@
+# Why the USDT deposit reverts
+
+Mainnet USDT is not a fully standard ERC-20. In particular, its `approve` function does not return the `bool` value declared by `IERC20.approve`.
+
+This line is therefore the failure:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Because the call is made through OpenZeppelin's `IERC20` interface, Solidity expects and ABI-decodes a 32-byte Boolean return value. Real USDT returns no data. The external token call can succeed internally, but the caller then fails while decoding the empty return data as a `bool`, producing a low-level revert that commonly has no reason string.
+
+The mock never exposes the problem because OpenZeppelin's `ERC20.approve` is standards-compliant and returns `true`. Giving it six decimals changes only amount display/scaling; it does not reproduce USDT's unusual call/return behavior. Every number of tests against that same mock exercises the same compatible implementation, so more cases, fuzz inputs, and assertions cannot reveal an integration incompatibility absent from the test double.
+
+`using SafeERC20 for IERC20` does not automatically make every token operation safe. It only adds explicitly named library methods to the type. The transfer uses `safeTransferFrom`, but the approval uses the raw `approve` method, bypassing `SafeERC20` entirely.
+
+## Code fix
+
+Use `SafeERC20.forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` performs approval through SafeERC20's optional-return handling, so both tokens returning `true` and tokens such as USDT returning no data are supported. It also handles USDT-style tokens that require an existing nonzero allowance to be set to zero before assigning another nonzero allowance. If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent safe sequence with SafeERC20-compatible calls: try the desired approval and, if necessary, approve zero before approving the desired amount. A raw `approve(0)` followed by raw `approve(amount)` still has the same missing-return-data problem.
+
+## Testing-practice fix
+
+Keep mocks for fast unit tests, but add a Foundry mainnet-fork integration test using:
+
+- the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7`;
+- the real Aave V3 Pool (or its mainnet Pool proxy); and
+- a fixed mainnet block number for reproducibility.
+
+Fund a test user with real forked USDT state (for example with Foundry's `deal` token overload), approve the vault, call `deposit`, and assert that Aave receives/supplies the assets and the vault receives the expected position. Run this fork test in CI with a mainnet RPC endpoint.
+
+A custom USDT-like mock that returns no data and enforces zero-before-nonzero approval is also useful as a fast regression test. It is not a substitute for the fork test: the fork validates the exact deployed token, Aave contracts, proxy configuration, reserve state, and ABI behavior that production will use.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..cfbda48bde71ebc712f8a33ad8aa8cdc773ca377
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,41 @@
+# Why the USDT deposit reverts
+
+Mainnet USDT is not a fully standard ERC-20. In particular, its `approve` function does not return the `bool` value declared by `IERC20.approve`.
+
+This line is therefore the failure:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Because the call is made through OpenZeppelin's `IERC20` interface, Solidity expects and ABI-decodes a 32-byte Boolean return value. Real USDT returns no data. The external token call can succeed internally, but the caller then fails while decoding the empty return data as a `bool`, producing a low-level revert that commonly has no reason string.
+
+The mock never exposes the problem because OpenZeppelin's `ERC20.approve` is standards-compliant and returns `true`. Giving it six decimals changes only amount display/scaling; it does not reproduce USDT's unusual call/return behavior. Every number of tests against that same mock exercises the same compatible implementation, so more cases, fuzz inputs, and assertions cannot reveal an integration incompatibility absent from the test double.
+
+`using SafeERC20 for IERC20` does not automatically make every token operation safe. It only adds explicitly named library methods to the type. The transfer uses `safeTransferFrom`, but the approval uses the raw `approve` method, bypassing `SafeERC20` entirely.
+
+## Code fix
+
+Use `SafeERC20.forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` performs approval through SafeERC20's optional-return handling, so both tokens returning `true` and tokens such as USDT returning no data are supported. It also handles USDT-style tokens that require an existing nonzero allowance to be set to zero before assigning another nonzero allowance. If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent safe sequence with SafeERC20-compatible calls: try the desired approval and, if necessary, approve zero before approving the desired amount. A raw `approve(0)` followed by raw `approve(amount)` still has the same missing-return-data problem.
+
+## Testing-practice fix
+
+Keep mocks for fast unit tests, but add a Foundry mainnet-fork integration test using:
+
+- the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7`;
+- the real Aave V3 Pool (or its mainnet Pool proxy); and
+- a fixed mainnet block number for reproducibility.
+
+Fund a test user with real forked USDT state (for example with Foundry's `deal` token overload), approve the vault, call `deposit`, and assert that Aave receives/supplies the assets and the vault receives the expected position. Run this fork test in CI with a mainnet RPC endpoint.
+
+A custom USDT-like mock that returns no data and enforces zero-before-nonzero approval is also useful as a fast regression test. It is not a substitute for the fork test: the fork validates the exact deployed token, Aave contracts, proxy configuration, reserve state, and ABI behavior that production will use.

exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /home/damu/.cache/ethskills-evals/2026-09-01T165910Z-codex-with-skill-2/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
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

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..cfbda48bde71ebc712f8a33ad8aa8cdc773ca377
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,41 @@
+# Why the USDT deposit reverts
+
+Mainnet USDT is not a fully standard ERC-20. In particular, its `approve` function does not return the `bool` value declared by `IERC20.approve`.
+
+This line is therefore the failure:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Because the call is made through OpenZeppelin's `IERC20` interface, Solidity expects and ABI-decodes a 32-byte Boolean return value. Real USDT returns no data. The external token call can succeed internally, but the caller then fails while decoding the empty return data as a `bool`, producing a low-level revert that commonly has no reason string.
+
+The mock never exposes the problem because OpenZeppelin's `ERC20.approve` is standards-compliant and returns `true`. Giving it six decimals changes only amount display/scaling; it does not reproduce USDT's unusual call/return behavior. Every number of tests against that same mock exercises the same compatible implementation, so more cases, fuzz inputs, and assertions cannot reveal an integration incompatibility absent from the test double.
+
+`using SafeERC20 for IERC20` does not automatically make every token operation safe. It only adds explicitly named library methods to the type. The transfer uses `safeTransferFrom`, but the approval uses the raw `approve` method, bypassing `SafeERC20` entirely.
+
+## Code fix
+
+Use `SafeERC20.forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` performs approval through SafeERC20's optional-return handling, so both tokens returning `true` and tokens such as USDT returning no data are supported. It also handles USDT-style tokens that require an existing nonzero allowance to be set to zero before assigning another nonzero allowance. If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent safe sequence with SafeERC20-compatible calls: try the desired approval and, if necessary, approve zero before approving the desired amount. A raw `approve(0)` followed by raw `approve(amount)` still has the same missing-return-data problem.
+
+## Testing-practice fix
+
+Keep mocks for fast unit tests, but add a Foundry mainnet-fork integration test using:
+
+- the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7`;
+- the real Aave V3 Pool (or its mainnet Pool proxy); and
+- a fixed mainnet block number for reproducibility.
+
+Fund a test user with real forked USDT state (for example with Foundry's `deal` token overload), approve the vault, call `deposit`, and assert that Aave receives/supplies the assets and the vault receives the expected position. Run this fork test in CI with a mainnet RPC endpoint.
+
+A custom USDT-like mock that returns no data and enforces zero-before-nonzero approval is also useful as a fast regression test. It is not a substitute for the fork test: the fork validates the exact deployed token, Aave contracts, proxy configuration, reserve state, and ABI behavior that production will use.

codex
Created [answer.md](/home/damu/.cache/ethskills-evals/2026-09-01T165910Z-codex-with-skill-2/testing-quiz-003/answer.md) explaining the USDT `approve` incompatibility, `SafeERC20` bypass, `forceApprove` fix, and mainnet-fork testing practice.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..cfbda48bde71ebc712f8a33ad8aa8cdc773ca377
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,41 @@
+# Why the USDT deposit reverts
+
+Mainnet USDT is not a fully standard ERC-20. In particular, its `approve` function does not return the `bool` value declared by `IERC20.approve`.
+
+This line is therefore the failure:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Because the call is made through OpenZeppelin's `IERC20` interface, Solidity expects and ABI-decodes a 32-byte Boolean return value. Real USDT returns no data. The external token call can succeed internally, but the caller then fails while decoding the empty return data as a `bool`, producing a low-level revert that commonly has no reason string.
+
+The mock never exposes the problem because OpenZeppelin's `ERC20.approve` is standards-compliant and returns `true`. Giving it six decimals changes only amount display/scaling; it does not reproduce USDT's unusual call/return behavior. Every number of tests against that same mock exercises the same compatible implementation, so more cases, fuzz inputs, and assertions cannot reveal an integration incompatibility absent from the test double.
+
+`using SafeERC20 for IERC20` does not automatically make every token operation safe. It only adds explicitly named library methods to the type. The transfer uses `safeTransferFrom`, but the approval uses the raw `approve` method, bypassing `SafeERC20` entirely.
+
+## Code fix
+
+Use `SafeERC20.forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` performs approval through SafeERC20's optional-return handling, so both tokens returning `true` and tokens such as USDT returning no data are supported. It also handles USDT-style tokens that require an existing nonzero allowance to be set to zero before assigning another nonzero allowance. If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent safe sequence with SafeERC20-compatible calls: try the desired approval and, if necessary, approve zero before approving the desired amount. A raw `approve(0)` followed by raw `approve(amount)` still has the same missing-return-data problem.
+
+## Testing-practice fix
+
+Keep mocks for fast unit tests, but add a Foundry mainnet-fork integration test using:
+
+- the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7`;
+- the real Aave V3 Pool (or its mainnet Pool proxy); and
+- a fixed mainnet block number for reproducibility.
+
+Fund a test user with real forked USDT state (for example with Foundry's `deal` token overload), approve the vault, call `deposit`, and assert that Aave receives/supplies the assets and the vault receives the expected position. Run this fork test in CI with a mainnet RPC endpoint.
+
+A custom USDT-like mock that returns no data and enforces zero-before-nonzero approval is also useful as a fast regression test. It is not a substitute for the fork test: the fork validates the exact deployed token, Aave contracts, proxy configuration, reserve state, and ABI behavior that production will use.

tokens used
13,189
````

## final message

Created [answer.md](/home/damu/.cache/ethskills-evals/2026-09-01T165910Z-codex-with-skill-2/testing-quiz-003/answer.md) explaining the USDT `approve` incompatibility, `SafeERC20` bypass, `forceApprove` fix, and mainnet-fork testing practice.
