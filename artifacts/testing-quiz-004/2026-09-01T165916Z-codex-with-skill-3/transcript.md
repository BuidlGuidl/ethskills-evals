# Executor transcript — 2026-09-01T165916Z-codex-with-skill-3

**executor**: codex  |  **model**: cli default  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-01T165916Z-codex-with-skill-3/testing-quiz-004

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-01T165916Z-codex-with-skill-3/testing-quiz-004
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a05dfb-fa03-7d62-91b0-e52af296f550
--------
user
Our fork tests have been green in CI on every PR for four months. This morning three
of them went red — the ones that assert on a Chainlink price and on a Uniswap pool's
reserves. Nobody touched the code, the dependencies, or the CI config. Re-running the
job turns them green again sometimes; the same commit passes and fails.

Two other things we had been ignoring, in case they are related: the fork tests have
been getting steadily slower over those four months, and last week we started seeing
sporadic HTTP 429s from our RPC provider.

setUp does exactly this:

    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));

Explain what ties all four symptoms together — the sudden reds, the flakiness on
re-run, the slowdown, and the 429s — and give the change that makes these tests
deterministic.

One constraint on your answer: MAINNET_RPC_URL is a free-tier endpoint. Say plainly
whether your fix works against it, and if it needs something that endpoint may not
provide, name what and say how we'd tell.

Write your answer to answer.md in this directory.

2026-09-01T17:19:49.991609Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a05dfb-fa03-7d62-91b0-e52af296f550.tmp-1788283189777974704: line 2547: syntax error near unexpected token `('

codex
I’m using the smart-contract testing skill because this is specifically a Foundry fork-test determinism issue. I’ll inspect its guidance, then write the diagnosis and concrete fix to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-01T165916Z-codex-with-skill-3/testing-quiz-004
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
/bin/bash -lc "sed -n '241,520p' .agents/skills/testing/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-01T165916Z-codex-with-skill-3/testing-quiz-004
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
The testing guidance confirms the key requirement: a fork test is reproducible only when it selects a specific block. I’m making the endpoint caveat explicit, because a fixed block eventually becomes historical and may require archive-state access that a free tier does not guarantee.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-01T165916Z-codex-with-skill-3/testing-quiz-004/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f4bc65fe0aa68668a35a1b0226914c4cc605ab2d
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,36 @@
+# Diagnosis
+
+All four symptoms come from forking an **unpinned, moving chain head**:
+
+```solidity
+vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
+```
+
+With no block number, each test run forks whatever block the RPC endpoint considers `latest` at that moment. Chainlink answers and Uniswap reserves are live on-chain state, so the same commit is not actually being tested against the same inputs. A new oracle update, swap, liquidity change, or even a provider node being a block or two behind can change the asserted values. That explains both the sudden failures and why rerunning the identical commit can pass.
+
+It also defeats stable fork caching. Foundry fetches fork state lazily through RPC. As `latest` advances, runs address different block state instead of consistently reusing data for one block, causing more cold RPC reads. The growing/less-reusable workload makes the suite slower and increases request volume; on a free-tier endpoint that eventually produces HTTP 429 rate-limit responses. A 429 or inconsistent responses from load-balanced RPC nodes can add still more flakiness, but it is not the underlying determinism problem.
+
+# Deterministic change
+
+Choose an explicit mainnet block whose state has the expected Chainlink price and Uniswap reserves, and keep it in source control:
+
+```solidity
+uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // replace with the chosen block
+
+function setUp() public {
+    vm.createSelectFork(
+        vm.envString("MAINNET_RPC_URL"),
+        MAINNET_FORK_BLOCK
+    );
+}
+```
+
+Then derive the expected oracle and pool values from that same block (or assert appropriate properties against that fixed state). Do not periodically replace the number merely to use a recent block; changing it is an intentional fixture update and should be reviewed together with changed expectations.
+
+# Free-tier constraint
+
+**This fix does not necessarily work against the existing free-tier `MAINNET_RPC_URL`.** A permanently pinned block eventually requires the provider to serve **archive/historical state**, not merely old block headers. Some free tiers retain state for only a recent window or do not offer archive access at all.
+
+We can tell by querying contract state at the chosen block through that exact URL—for example, run the fork test or use `cast call`/`cast storage` with `--block 19000000`. If it returns the value, the endpoint currently supports that historical state. Errors such as `missing trie node`, `historical state unavailable`, `header not found`, an unsupported-block-range message, or a plan/permission error mean it does not. A recent pinned block passing today is not proof of long-term archive support; repeat the check with a block older than the provider's advertised retention window or verify the provider's plan documentation.
+
+For durable CI, use an archive-capable RPC endpoint/plan (and enough rate-limit capacity), or run an appropriately retained node. Pinning supplies determinism; archive access ensures the pinned fixture remains retrievable. Foundry's local RPC cache can reduce repeat traffic after a successful fetch, but CI caches are often ephemeral and must not be treated as a substitute for an archive-capable source.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f4bc65fe0aa68668a35a1b0226914c4cc605ab2d
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,36 @@
+# Diagnosis
+
+All four symptoms come from forking an **unpinned, moving chain head**:
+
+```solidity
+vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
+```
+
+With no block number, each test run forks whatever block the RPC endpoint considers `latest` at that moment. Chainlink answers and Uniswap reserves are live on-chain state, so the same commit is not actually being tested against the same inputs. A new oracle update, swap, liquidity change, or even a provider node being a block or two behind can change the asserted values. That explains both the sudden failures and why rerunning the identical commit can pass.
+
+It also defeats stable fork caching. Foundry fetches fork state lazily through RPC. As `latest` advances, runs address different block state instead of consistently reusing data for one block, causing more cold RPC reads. The growing/less-reusable workload makes the suite slower and increases request volume; on a free-tier endpoint that eventually produces HTTP 429 rate-limit responses. A 429 or inconsistent responses from load-balanced RPC nodes can add still more flakiness, but it is not the underlying determinism problem.
+
+# Deterministic change
+
+Choose an explicit mainnet block whose state has the expected Chainlink price and Uniswap reserves, and keep it in source control:
+
+```solidity
+uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // replace with the chosen block
+
+function setUp() public {
+    vm.createSelectFork(
+        vm.envString("MAINNET_RPC_URL"),
+        MAINNET_FORK_BLOCK
+    );
+}
+```
+
+Then derive the expected oracle and pool values from that same block (or assert appropriate properties against that fixed state). Do not periodically replace the number merely to use a recent block; changing it is an intentional fixture update and should be reviewed together with changed expectations.
+
+# Free-tier constraint
+
+**This fix does not necessarily work against the existing free-tier `MAINNET_RPC_URL`.** A permanently pinned block eventually requires the provider to serve **archive/historical state**, not merely old block headers. Some free tiers retain state for only a recent window or do not offer archive access at all.
+
+We can tell by querying contract state at the chosen block through that exact URL—for example, run the fork test or use `cast call`/`cast storage` with `--block 19000000`. If it returns the value, the endpoint currently supports that historical state. Errors such as `missing trie node`, `historical state unavailable`, `header not found`, an unsupported-block-range message, or a plan/permission error mean it does not. A recent pinned block passing today is not proof of long-term archive support; repeat the check with a block older than the provider's advertised retention window or verify the provider's plan documentation.
+
+For durable CI, use an archive-capable RPC endpoint/plan (and enough rate-limit capacity), or run an appropriately retained node. Pinning supplies determinism; archive access ensures the pinned fixture remains retrievable. Foundry's local RPC cache can reduce repeat traffic after a successful fetch, but CI caches are often ephemeral and must not be treated as a substitute for an archive-capable source.

exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /home/damu/.cache/ethskills-evals/2026-09-01T165916Z-codex-with-skill-3/testing-quiz-004
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Diagnosis

All four symptoms come from forking an **unpinned, moving chain head**:

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

With no block number, each test run forks whatever block the RPC endpoint considers `latest` at that moment. Chainlink answers and Uniswap reserves are live on-chain state, so the same commit is not actually being tested against the same inputs. A new oracle update, swap, liquidity change, or even a provider node being a block or two behind can change the asserted values. That explains both the sudden failures and why rerunning the identical commit can pass.

It also defeats stable fork caching. Foundry fetches fork state lazily through RPC. As `latest` advances, runs address different block state instead of consistently reusing data for one block, causing more cold RPC reads. The growing/less-reusable workload makes the suite slower and increases request volume; on a free-tier endpoint that eventually produces HTTP 429 rate-limit responses. A 429 or inconsistent responses from load-balanced RPC nodes can add still more flakiness, but it is not the underlying determinism problem.

# Deterministic change

Choose an explicit mainnet block whose state has the expected Chainlink price and Uniswap reserves, and keep it in source control:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // replace with the chosen block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

Then derive the expected oracle and pool values from that same block (or assert appropriate properties against that fixed state). Do not periodically replace the number merely to use a recent block; changing it is an intentional fixture update and should be reviewed together with changed expectations.

# Free-tier constraint

**This fix does not necessarily work against the existing free-tier `MAINNET_RPC_URL`.** A permanently pinned block eventually requires the provider to serve **archive/historical state**, not merely old block headers. Some free tiers retain state for only a recent window or do not offer archive access at all.

We can tell by querying contract state at the chosen block through that exact URL—for example, run the fork test or use `cast call`/`cast storage` with `--block 19000000`. If it returns the value, the endpoint currently supports that historical state. Errors such as `missing trie node`, `historical state unavailable`, `header not found`, an unsupported-block-range message, or a plan/permission error mean it does not. A recent pinned block passing today is not proof of long-term archive support; repeat the check with a block older than the provider's advertised retention window or verify the provider's plan documentation.

For durable CI, use an archive-capable RPC endpoint/plan (and enough rate-limit capacity), or run an appropriately retained node. Pinning supplies determinism; archive access ensures the pinned fixture remains retrievable. Foundry's local RPC cache can reduce repeat traffic after a successful fetch, but CI caches are often ephemeral and must not be treated as a substitute for an archive-capable source.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f4bc65fe0aa68668a35a1b0226914c4cc605ab2d
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,36 @@
+# Diagnosis
+
+All four symptoms come from forking an **unpinned, moving chain head**:
+
+```solidity
+vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
+```
+
+With no block number, each test run forks whatever block the RPC endpoint considers `latest` at that moment. Chainlink answers and Uniswap reserves are live on-chain state, so the same commit is not actually being tested against the same inputs. A new oracle update, swap, liquidity change, or even a provider node being a block or two behind can change the asserted values. That explains both the sudden failures and why rerunning the identical commit can pass.
+
+It also defeats stable fork caching. Foundry fetches fork state lazily through RPC. As `latest` advances, runs address different block state instead of consistently reusing data for one block, causing more cold RPC reads. The growing/less-reusable workload makes the suite slower and increases request volume; on a free-tier endpoint that eventually produces HTTP 429 rate-limit responses. A 429 or inconsistent responses from load-balanced RPC nodes can add still more flakiness, but it is not the underlying determinism problem.
+
+# Deterministic change
+
+Choose an explicit mainnet block whose state has the expected Chainlink price and Uniswap reserves, and keep it in source control:
+
+```solidity
+uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // replace with the chosen block
+
+function setUp() public {
+    vm.createSelectFork(
+        vm.envString("MAINNET_RPC_URL"),
+        MAINNET_FORK_BLOCK
+    );
+}
+```
+
+Then derive the expected oracle and pool values from that same block (or assert appropriate properties against that fixed state). Do not periodically replace the number merely to use a recent block; changing it is an intentional fixture update and should be reviewed together with changed expectations.
+
+# Free-tier constraint
+
+**This fix does not necessarily work against the existing free-tier `MAINNET_RPC_URL`.** A permanently pinned block eventually requires the provider to serve **archive/historical state**, not merely old block headers. Some free tiers retain state for only a recent window or do not offer archive access at all.
+
+We can tell by querying contract state at the chosen block through that exact URL—for example, run the fork test or use `cast call`/`cast storage` with `--block 19000000`. If it returns the value, the endpoint currently supports that historical state. Errors such as `missing trie node`, `historical state unavailable`, `header not found`, an unsupported-block-range message, or a plan/permission error mean it does not. A recent pinned block passing today is not proof of long-term archive support; repeat the check with a block older than the provider's advertised retention window or verify the provider's plan documentation.
+
+For durable CI, use an archive-capable RPC endpoint/plan (and enough rate-limit capacity), or run an appropriately retained node. Pinning supplies determinism; archive access ensures the pinned fixture remains retrievable. Foundry's local RPC cache can reduce repeat traffic after a successful fetch, but CI caches are often ephemeral and must not be treated as a substitute for an archive-capable source.

codex
Created [answer.md](/home/damu/.cache/ethskills-evals/2026-09-01T165916Z-codex-with-skill-3/testing-quiz-004/answer.md) with the diagnosis, pinned-block fix, and explicit free-tier/archive-node caveat.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f4bc65fe0aa68668a35a1b0226914c4cc605ab2d
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,36 @@
+# Diagnosis
+
+All four symptoms come from forking an **unpinned, moving chain head**:
+
+```solidity
+vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
+```
+
+With no block number, each test run forks whatever block the RPC endpoint considers `latest` at that moment. Chainlink answers and Uniswap reserves are live on-chain state, so the same commit is not actually being tested against the same inputs. A new oracle update, swap, liquidity change, or even a provider node being a block or two behind can change the asserted values. That explains both the sudden failures and why rerunning the identical commit can pass.
+
+It also defeats stable fork caching. Foundry fetches fork state lazily through RPC. As `latest` advances, runs address different block state instead of consistently reusing data for one block, causing more cold RPC reads. The growing/less-reusable workload makes the suite slower and increases request volume; on a free-tier endpoint that eventually produces HTTP 429 rate-limit responses. A 429 or inconsistent responses from load-balanced RPC nodes can add still more flakiness, but it is not the underlying determinism problem.
+
+# Deterministic change
+
+Choose an explicit mainnet block whose state has the expected Chainlink price and Uniswap reserves, and keep it in source control:
+
+```solidity
+uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // replace with the chosen block
+
+function setUp() public {
+    vm.createSelectFork(
+        vm.envString("MAINNET_RPC_URL"),
+        MAINNET_FORK_BLOCK
+    );
+}
+```
+
+Then derive the expected oracle and pool values from that same block (or assert appropriate properties against that fixed state). Do not periodically replace the number merely to use a recent block; changing it is an intentional fixture update and should be reviewed together with changed expectations.
+
+# Free-tier constraint
+
+**This fix does not necessarily work against the existing free-tier `MAINNET_RPC_URL`.** A permanently pinned block eventually requires the provider to serve **archive/historical state**, not merely old block headers. Some free tiers retain state for only a recent window or do not offer archive access at all.
+
+We can tell by querying contract state at the chosen block through that exact URL—for example, run the fork test or use `cast call`/`cast storage` with `--block 19000000`. If it returns the value, the endpoint currently supports that historical state. Errors such as `missing trie node`, `historical state unavailable`, `header not found`, an unsupported-block-range message, or a plan/permission error mean it does not. A recent pinned block passing today is not proof of long-term archive support; repeat the check with a block older than the provider's advertised retention window or verify the provider's plan documentation.
+
+For durable CI, use an archive-capable RPC endpoint/plan (and enough rate-limit capacity), or run an appropriately retained node. Pinning supplies determinism; archive access ensures the pinned fixture remains retrievable. Foundry's local RPC cache can reduce repeat traffic after a successful fetch, but CI caches are often ephemeral and must not be treated as a substitute for an archive-capable source.

tokens used
22,144
````

## final message

Created [answer.md](/home/damu/.cache/ethskills-evals/2026-09-01T165916Z-codex-with-skill-3/testing-quiz-004/answer.md) with the diagnosis, pinned-block fix, and explicit free-tier/archive-node caveat.
