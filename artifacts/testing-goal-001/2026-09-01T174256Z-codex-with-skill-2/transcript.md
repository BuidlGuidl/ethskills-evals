# Executor transcript — 2026-09-01T174256Z-codex-with-skill-2

**executor**: codex  |  **model**: cli default  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a05e11-5454-7003-b4bc-7c15c42c09ba
--------
user
This workspace is our USDT yield vault. It is code-complete and we ship Monday.

The team considers it done: `forge test` is green at 39 passing, and `forge coverage`
reports 100% of the lines and 100% of the functions on src/UsdtYieldVault.sol. I am
the one who has to sign off, and a green tick is not what I want to sign off on.

On Monday this holds real user deposits on mainnet. The underlying is the real USDT
at 0xdAC17F958D2ee523a2206206994597C13D831ec7, supplied into Aave V3 through the pool
at 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2. Convince me it is safe to do that — or
convince me it is not.

Ground rules, because I want evidence I can check rather than conclusions I have to
take on trust:

  - Do not change anything under src/. I want to see this contract fail as it stands
    today, not a repaired version of it passing.
  - Leave test/UsdtYieldVault.t.sol and everything under test/mocks/ as it is. Put
    anything you write in new files under test/.
  - For every problem you claim, paste into FINDINGS.md the actual command you ran
    and its real output, showing the failure against the code as it stands. Copy it
    from your terminal verbatim. I will re-run each one myself, and anything I cannot
    reproduce I will treat as not found.

Then write FINDINGS.md: what you found, how you found it, the evidence, and what you
would change to fix each one. Describe the fixes — do not apply them.

2026-09-01T17:43:09.384481Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a05e11-5454-7003-b4bc-7c15c42c09ba.tmp-1788284589166228004: line 2547: syntax error near unexpected token `('

codex
I’m using the `testing` skill because this is an adversarial Foundry review: I’ll preserve the production contract and existing tests, add only new tests under `test/`, and record reproducible terminal commands and verbatim failures in `FINDINGS.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md && rg --files -g 'AGENTS.md' -g '"'!lib'"' -g '"'!node_modules'"' && rg --files src test | sort" in /home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001
 exited 1 in 0ms:
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
/bin/bash -lc "sed -n '241,520p' .agents/skills/testing/SKILL.md; find .. -name AGENTS.md -print; printf '%s\\n' 'FILES'; rg --files src test | sort; printf '%s\\n' 'CONFIG'; sed -n '1,240p' foundry.toml; printf '%s\\n' 'CONTRACT'; sed -n '1,320p' src/UsdtYieldVault.sol" in /home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001
 succeeded in 13ms:
FILES
src/UsdtYieldVault.sol
src/interfaces/IAavePool.sol
test/UsdtYieldVault.t.sol
test/mocks/MockAavePool.sol
test/mocks/MockUSDT.sol
CONFIG
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.28"
optimizer = true
optimizer_runs = 200

[fmt]
line_length = 120
tab_width = 4
CONTRACT
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IAavePool} from "./interfaces/IAavePool.sol";

/// @title UsdtYieldVault
/// @notice Pooled USDT vault that routes deposits into Aave V3 and tracks
///         depositor ownership with internal shares.
/// @dev Shares carry 18 decimals while USDT carries 6, so the first depositor
///      mints at `SHARE_SCALE`. Both fees stay supplied in Aave and accrue to
///      the remaining shareholders rather than being swept to the owner.
contract UsdtYieldVault is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    /// @notice Denominator for all basis-point maths.
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Scaling factor between 6-decimal USDT and 18-decimal shares.
    uint256 public constant SHARE_SCALE = 1e12;

    /// @notice Smallest accepted deposit, in USDT base units (1 USDT).
    uint256 public constant MIN_DEPOSIT = 1e6;

    /// @notice Fee charged on withdrawal, in basis points.
    uint256 public constant WITHDRAW_FEE_BPS = 30;

    uint16 private constant AAVE_REFERRAL_CODE = 0;

    /// @notice The underlying asset (USDT).
    IERC20 public immutable usdt;

    /// @notice The interest-bearing Aave receipt token for `usdt`.
    IERC20 public immutable aUsdt;

    /// @notice The Aave V3 lending pool deposits are routed through.
    IAavePool public immutable aavePool;

    /// @notice Fee charged on deposit, in basis points.
    uint256 public depositFeeBps;

    /// @notice Total shares outstanding across all depositors.
    uint256 public totalShares;

    /// @notice Vault-tracked USDT supplied to Aave, in USDT base units.
    uint256 public totalAssetsStored;

    /// @notice Shares held per depositor.
    mapping(address account => uint256 shares) public shareBalance;

    event Deposited(address indexed account, uint256 assets, uint256 shares, uint256 fee);
    event Withdrawn(address indexed account, uint256 assets, uint256 shares, uint256 fee);
    event DepositFeeUpdated(uint256 previousFeeBps, uint256 newFeeBps);

    error AmountBelowMinimum();
    error NoSharesMinted();
    error ZeroShares();
    error InsufficientShares();

    /// @param _usdt The underlying USDT token.
    /// @param _aUsdt The Aave aUSDT receipt token.
    /// @param _aavePool The Aave V3 pool.
    /// @param _depositFeeBps Initial deposit fee in basis points.
    /// @param initialOwner Address granted ownership.
    constructor(address _usdt, address _aUsdt, address _aavePool, uint256 _depositFeeBps, address initialOwner)
        Ownable(initialOwner)
    {
        usdt = IERC20(_usdt);
        aUsdt = IERC20(_aUsdt);
        aavePool = IAavePool(_aavePool);
        depositFeeBps = _depositFeeBps;
    }

    /// @notice Supplies `amount` of USDT into the vault and mints shares to the caller.
    /// @param amount Amount of USDT to deposit, in base units.
    /// @return shares Number of shares minted to the caller.
    function deposit(uint256 amount) external whenNotPaused nonReentrant returns (uint256 shares) {
        if (amount < MIN_DEPOSIT) revert AmountBelowMinimum();

        uint256 fee = (amount * depositFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = amount - fee;

        shares = convertToShares(netAmount);
        if (shares == 0) revert NoSharesMinted();

        usdt.safeTransferFrom(msg.sender, address(this), amount);
        usdt.approve(address(aavePool), amount);
        aavePool.supply(address(usdt), amount, address(this), AAVE_REFERRAL_CODE);

        totalAssetsStored += amount;
        totalShares += shares;
        shareBalance[msg.sender] += shares;

        emit Deposited(msg.sender, amount, shares, fee);
    }

    /// @notice Burns `shares` and returns the underlying USDT, net of the withdrawal fee.
    /// @param shares Number of shares to burn.
    /// @return netAssets USDT sent to the caller, in base units.
    function withdraw(uint256 shares) external whenNotPaused nonReentrant returns (uint256 netAssets) {
        if (shares == 0) revert ZeroShares();
        if (shareBalance[msg.sender] < shares) revert InsufficientShares();

        uint256 grossAssets = convertToAssets(shares);
        uint256 fee = (grossAssets * WITHDRAW_FEE_BPS) / BPS_DENOMINATOR;
        netAssets = grossAssets - fee;

        shareBalance[msg.sender] -= shares;
        totalShares -= shares;
        totalAssetsStored -= grossAssets;

        aavePool.withdraw(address(usdt), netAssets, msg.sender);

        emit Withdrawn(msg.sender, netAssets, shares, fee);
    }

    /// @notice Updates the deposit fee.
    /// @param newFeeBps New deposit fee in basis points.
    function setDepositFee(uint256 newFeeBps) external onlyOwner {
        uint256 previousFeeBps = depositFeeBps;
        depositFeeBps = newFeeBps;
        emit DepositFeeUpdated(previousFeeBps, newFeeBps);
    }

    /// @notice Pauses deposits and withdrawals.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resumes deposits and withdrawals.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice USDT currently tracked by the vault, in base units.
    function totalAssets() public view returns (uint256) {
        return totalAssetsStored;
    }

    /// @notice Converts a USDT amount into shares at the current share price.
    /// @param assets USDT amount in base units.
    /// @return Shares corresponding to `assets`.
    function convertToShares(uint256 assets) public view returns (uint256) {
        if (totalShares == 0) {
            return assets * SHARE_SCALE;
        }
        return assets.mulDiv(totalShares, totalAssetsStored);
    }

    /// @notice Converts shares into a USDT amount at the current share price.
    /// @param shares Share amount.
    /// @return USDT in base units corresponding to `shares`.
    function convertToAssets(uint256 shares) public view returns (uint256) {
        if (totalShares == 0) {
            return shares / SHARE_SCALE;
        }
        return shares.mulDiv(totalAssetsStored, totalShares);
    }

    /// @notice USDT value currently redeemable by `account`, before the withdrawal fee.
    function balanceOfUnderlying(address account) external view returns (uint256) {
        return convertToAssets(shareBalance[account]);
    }

    /// @notice Current share price, expressed as USDT base units per 1e18 shares.
    function sharePrice() external view returns (uint256) {
        if (totalShares == 0) return 1e18 / SHARE_SCALE;
        return totalAssetsStored.mulDiv(1e18, totalShares);
    }
}

codex
The first material risk is at the real-token boundary, so I’m checking both the existing mock assumptions and whether this workspace has a mainnet RPC available for a pinned fork. I’ll also probe the vault’s accounting invariants—especially Aave interest and the “fees stay supplied” claim—rather than treating line coverage as behavioral coverage.
exec
/bin/bash -lc "sed -n '1,360p' test/UsdtYieldVault.t.sol; printf '%s\\n' 'MOCK USDT'; sed -n '1,260p' test/mocks/MockUSDT.sol; printf '%s\\n' 'MOCK AAVE'; sed -n '1,320p' test/mocks/MockAavePool.sol; printf '%s\\n' 'ENV RPC NAMES'; env | sed -n 's/=.*//p' | rg -i 'rpc|alchemy|infura|ethereum|mainnet' || true; printf '%s\\n' 'GIT'; git status --short" in /home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001
 succeeded in 10ms:
GIT

exec
/bin/bash -lc 'cast block-number --rpc-url https://ethereum-rpc.publicnode.com' in /home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001
 succeeded in 589ms:
25884006

codex
The real USDT/Aave path is reachable on a pinned public mainnet fork, so I can test the exact deployed contracts rather than infer compatibility from mocks. Separately, the accounting review has identified two properties worth turning into executable counterexamples: accrued aUSDT must benefit shareholders, and retained withdrawal fees must remain attributable to someone.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultAdversarial.t.sol
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4b9b82908a6fa5de1f2f675662a2433fad8b824f
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,106 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultAdversarialTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address user, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(user);
+        shares = vault.deposit(amount);
+    }
+
+    function test_AaveYieldMustIncreaseRedeemableAssets() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 100e6);
+        usdt.mint(address(pool), 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "100 USDT of Aave yield is invisible");
+
+        vm.prank(alice);
+        uint256 received = vault.withdraw(shares);
+        assertEq(received, 1_096_700_000, "shareholder cannot withdraw accrued yield net of fee");
+    }
+
+    function test_WithdrawalFeeMustAccrueToRemainingShareholders() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        _deposit(bob, 1_000e6);
+        uint256 bobBefore = vault.balanceOfUnderlying(bob);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares);
+
+        assertEq(
+            vault.balanceOfUnderlying(bob), bobBefore + 3e6, "withdrawal fee is stranded instead of accruing to Bob"
+        );
+    }
+
+    function test_LastWithdrawalMustNotLeaveUnownedAUsdt() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        assertEq(aUsdt.balanceOf(address(vault)), 0, "fee remains in Aave after every share is burned");
+    }
+
+    function test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+    }
+}
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_884_006;
+
+    function test_RealUsdtCanBeSuppliedToRealAavePool() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", FORK_BLOCK);
+        address user = makeAddr("mainnet depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+
+        deal(USDT, user, 1_000e6);
+        vm.startPrank(user);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), 1_000e6));
+        require(approved, "USDT approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 1_000e18);
+        assertApproxEqAbs(vault.aUsdt().balanceOf(address(vault)), 1_000e6, 2);
+    }
+}

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4b9b82908a6fa5de1f2f675662a2433fad8b824f
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,106 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultAdversarialTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address user, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(user);
+        shares = vault.deposit(amount);
+    }
+
+    function test_AaveYieldMustIncreaseRedeemableAssets() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 100e6);
+        usdt.mint(address(pool), 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "100 USDT of Aave yield is invisible");
+
+        vm.prank(alice);
+        uint256 received = vault.withdraw(shares);
+        assertEq(received, 1_096_700_000, "shareholder cannot withdraw accrued yield net of fee");
+    }
+
+    function test_WithdrawalFeeMustAccrueToRemainingShareholders() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        _deposit(bob, 1_000e6);
+        uint256 bobBefore = vault.balanceOfUnderlying(bob);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares);
+
+        assertEq(
+            vault.balanceOfUnderlying(bob), bobBefore + 3e6, "withdrawal fee is stranded instead of accruing to Bob"
+        );
+    }
+
+    function test_LastWithdrawalMustNotLeaveUnownedAUsdt() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        assertEq(aUsdt.balanceOf(address(vault)), 0, "fee remains in Aave after every share is burned");
+    }
+
+    function test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+    }
+}
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_884_006;
+
+    function test_RealUsdtCanBeSuppliedToRealAavePool() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", FORK_BLOCK);
+        address user = makeAddr("mainnet depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+
+        deal(USDT, user, 1_000e6);
+        vm.startPrank(user);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), 1_000e6));
+        require(approved, "USDT approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 1_000e18);
+        assertApproxEqAbs(vault.aUsdt().balanceOf(address(vault)), 1_000e6, 2);
+    }
+}

exec
/bin/bash -lc 'forge fmt test/UsdtYieldVaultAdversarial.t.sol && forge test --match-contract UsdtYieldVaultMainnetForkTest -vv && forge test --match-test test_AaveYieldMustIncreaseRedeemableAssets -vv' in /home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001
2026-09-01T17:45:51.552905Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 4198ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 1.17s
Compiler run successful!
2026-09-01T17:45:49.181660Z  WARN evm::traces::external: etherscan config not found
2026-09-01T17:45:49.445607Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25884006"

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToRealAavePool() (gas: 1120364)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.35s (2.35s CPU time)
2026-09-01T17:45:51.532578Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25884006")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)

Ran 1 test suite in 2.35s (2.35s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToRealAavePool() (gas: 1120364)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4b9b82908a6fa5de1f2f675662a2433fad8b824f
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,106 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultAdversarialTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address user, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(user);
+        shares = vault.deposit(amount);
+    }
+
+    function test_AaveYieldMustIncreaseRedeemableAssets() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 100e6);
+        usdt.mint(address(pool), 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "100 USDT of Aave yield is invisible");
+
+        vm.prank(alice);
+        uint256 received = vault.withdraw(shares);
+        assertEq(received, 1_096_700_000, "shareholder cannot withdraw accrued yield net of fee");
+    }
+
+    function test_WithdrawalFeeMustAccrueToRemainingShareholders() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        _deposit(bob, 1_000e6);
+        uint256 bobBefore = vault.balanceOfUnderlying(bob);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares);
+
+        assertEq(
+            vault.balanceOfUnderlying(bob), bobBefore + 3e6, "withdrawal fee is stranded instead of accruing to Bob"
+        );
+    }
+
+    function test_LastWithdrawalMustNotLeaveUnownedAUsdt() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        assertEq(aUsdt.balanceOf(address(vault)), 0, "fee remains in Aave after every share is burned");
+    }
+
+    function test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+    }
+}
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_884_006;
+
+    function test_RealUsdtCanBeSuppliedToRealAavePool() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", FORK_BLOCK);
+        address user = makeAddr("mainnet depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+
+        deal(USDT, user, 1_000e6);
+        vm.startPrank(user);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), 1_000e6));
+        require(approved, "USDT approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 1_000e18);
+        assertApproxEqAbs(vault.aUsdt().balanceOf(address(vault)), 1_000e6, 2);
+    }
+}

codex
The pinned fork produced a stronger result than the mock analysis: the exact real-USDT/real-Aave deposit path reverts. I’m tracing the call now to identify whether the failure is token approval, reserve configuration, or the pool interaction, and I’ll preserve the full reproducer output.
exec
/bin/bash -lc 'forge test --match-contract UsdtYieldVaultMainnetForkTest -vvvv' in /home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001
2026-09-01T17:46:14.396911Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 2403ms:
No files changed, compilation skipped
2026-09-01T17:46:12.102460Z  WARN evm::traces::external: etherscan config not found
2026-09-01T17:46:12.289583Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25884006"

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToRealAavePool() (gas: 1120364)
2026-09-01T17:46:14.373435Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25884006")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
Traces:
  [1120364] UsdtYieldVaultMainnetForkTest::test_RealUsdtCanBeSuppliedToRealAavePool()
    ├─ [0] VM::createSelectFork("<rpc url>", 25884006 [2.588e7])
    │   └─ ← [Return] 0
    ├─ [0] VM::addr(<pk>) [staticcall]
    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
    │   └─ ← [Return]
    ├─ [768792] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: UsdtYieldVaultMainnetForkTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
    │   └─ ← [Return] 3596 bytes of code
    ├─ [5031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::record()
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::accesses(0xdAC17F958D2ee523a2206206994597C13D831ec7) [staticcall]
    │   └─ ← [Return] [0x000000000000000000000000000000000000000000000000000000000000000a, 0xb83363bfebe19fff7e69a03af07359b336ba21829ed602dbf310080eba9656c6], []
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xb83363bfebe19fff7e69a03af07359b336ba21829ed602dbf310080eba9656c6) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ emit WARNING_UninitedSlot(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, slot: 83316361786704064033457414848321383690126234214795746551738436466339996915398 [8.331e76])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xb83363bfebe19fff7e69a03af07359b336ba21829ed602dbf310080eba9656c6) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xb83363bfebe19fff7e69a03af07359b336ba21829ed602dbf310080eba9656c6, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]) [staticcall]
    │   └─ ← [Return] 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77]
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xb83363bfebe19fff7e69a03af07359b336ba21829ed602dbf310080eba9656c6, 0x0000000000000000000000000000000000000000000000000000000000000000)
    │   └─ ← [Return]
    ├─ emit SlotFound(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, fsig: 0x70a08231, keysHash: 0xc6ca77b13bea8384868da65de73f449218ca5c751acfb0b1e291a35406cf239d, slot: 83316361786704064033457414848321383690126234214795746551738436466339996915398 [8.331e76])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xb83363bfebe19fff7e69a03af07359b336ba21829ed602dbf310080eba9656c6) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xb83363bfebe19fff7e69a03af07359b336ba21829ed602dbf310080eba9656c6, 0x000000000000000000000000000000000000000000000000000000003b9aca00)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]) [staticcall]
    │   └─ ← [Return] 1000000000 [1e9]
    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
    │   └─ ← [Return]
    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
    │   └─ ← [Stop]
    ├─ [64468] UsdtYieldVault::deposit(1000000000 [1e9])
    │   ├─ [35224] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
    │   │   ├─ emit Transfer(from: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   └─ ← [Revert] EvmError: Revert
    └─ ← [Revert] EvmError: Revert

Backtrace:
  at UsdtYieldVault.deposit
  at UsdtYieldVaultMainnetForkTest.test_RealUsdtCanBeSuppliedToRealAavePool

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.27s (2.27s CPU time)

Ran 1 test suite in 2.28s (2.27s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToRealAavePool() (gas: 1120364)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4b9b82908a6fa5de1f2f675662a2433fad8b824f
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,106 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultAdversarialTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address user, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(user);
+        shares = vault.deposit(amount);
+    }
+
+    function test_AaveYieldMustIncreaseRedeemableAssets() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 100e6);
+        usdt.mint(address(pool), 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "100 USDT of Aave yield is invisible");
+
+        vm.prank(alice);
+        uint256 received = vault.withdraw(shares);
+        assertEq(received, 1_096_700_000, "shareholder cannot withdraw accrued yield net of fee");
+    }
+
+    function test_WithdrawalFeeMustAccrueToRemainingShareholders() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        _deposit(bob, 1_000e6);
+        uint256 bobBefore = vault.balanceOfUnderlying(bob);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares);
+
+        assertEq(
+            vault.balanceOfUnderlying(bob), bobBefore + 3e6, "withdrawal fee is stranded instead of accruing to Bob"
+        );
+    }
+
+    function test_LastWithdrawalMustNotLeaveUnownedAUsdt() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        assertEq(aUsdt.balanceOf(address(vault)), 0, "fee remains in Aave after every share is burned");
+    }
+
+    function test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+    }
+}
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_884_006;
+
+    function test_RealUsdtCanBeSuppliedToRealAavePool() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", FORK_BLOCK);
+        address user = makeAddr("mainnet depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+
+        deal(USDT, user, 1_000e6);
+        vm.startPrank(user);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), 1_000e6));
+        require(approved, "USDT approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 1_000e18);
+        assertApproxEqAbs(vault.aUsdt().balanceOf(address(vault)), 1_000e6, 2);
+    }
+}

exec
/bin/bash -lc 'forge test --match-path test/UsdtYieldVault.t.sol; forge test --match-test test_AaveYieldMustIncreaseRedeemableAssets -vv; forge test --match-test test_WithdrawalFeeMustAccrueToRemainingShareholders -vv; forge test --match-test test_LastWithdrawalMustNotLeaveUnownedAUsdt -vv; forge test --match-test test_FeeConfigurationMustNotAllowOwnerToBrickDeposits -vv' in /home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001
2026-09-01T17:46:33.343389Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 705ms:
No files changed, compilation skipped
2026-09-01T17:46:32.756385Z  WARN evm::traces::external: etherscan config not found

Ran 39 tests for test/UsdtYieldVault.t.sol:UsdtYieldVaultTest
[PASS] test_BalanceOfUnderlying() (gas: 188628)
[PASS] test_BalanceOfUnderlyingIsZeroForNonDepositor() (gas: 12247)
[PASS] test_BpsDenominator() (gas: 5605)
[PASS] test_ConstructorSetsAUsdt() (gas: 7868)
[PASS] test_ConstructorSetsAavePool() (gas: 7911)
[PASS] test_ConstructorSetsDepositFee() (gas: 7640)
[PASS] test_ConstructorSetsOwner() (gas: 10023)
[PASS] test_ConstructorSetsUsdt() (gas: 7891)
[PASS] test_ConvertToAssetsAfterDeposit() (gas: 188208)
[PASS] test_ConvertToAssetsEmptyVault() (gas: 7751)
[PASS] test_ConvertToSharesAfterDeposit() (gas: 188262)
[PASS] test_ConvertToSharesEmptyVault() (gas: 7870)
[PASS] test_DepositEmitsEvent() (gas: 189496)
[PASS] test_DepositMintsShares() (gas: 188002)
[PASS] test_DepositSuppliesToAave() (gas: 189964)
[PASS] test_DepositTransfersUsdtFromDepositor() (gas: 191195)
[PASS] test_DepositUpdatesTotalAssets() (gas: 188609)
[PASS] test_DepositUpdatesTotalShares() (gas: 187721)
[PASS] test_MinDeposit() (gas: 5627)
[PASS] test_PartialWithdraw() (gas: 202104)
[PASS] test_PauseBlocksDeposit() (gas: 20742)
[PASS] test_RevertWhen_DepositBelowMinimum() (gas: 18229)
[PASS] test_RevertWhen_NonOwnerPauses() (gas: 13510)
[PASS] test_RevertWhen_NonOwnerSetsDepositFee() (gas: 13517)
[PASS] test_RevertWhen_WithdrawExceedsBalance() (gas: 191993)
[PASS] test_RevertWhen_WithdrawZeroShares() (gas: 18215)
[PASS] test_SecondDepositorMintsShares() (gas: 256582)
[PASS] test_SetDepositFeeEmitsEvent() (gas: 21001)
[PASS] test_SetDepositFeeToZero() (gas: 189786)
[PASS] test_SetDepositFeeUpdatesValue() (gas: 19909)
[PASS] test_SharePriceAfterDeposit() (gas: 188139)
[PASS] test_SharePriceStartsAtOneUsdt() (gas: 7781)
[PASS] test_ShareScale() (gas: 5650)
[PASS] test_TotalAssetsStartsAtZero() (gas: 7671)
[PASS] test_UnpauseRestoresDeposit() (gas: 194451)
[PASS] test_WithdrawBurnsShares() (gas: 194521)
[PASS] test_WithdrawEmitsEvent() (gas: 194960)
[PASS] test_WithdrawFeeBps() (gas: 5540)
[PASS] test_WithdrawReturnsUsdt() (gas: 196362)
Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 1.71ms (5.28ms CPU time)

Ran 1 test suite in 8.09ms (1.71ms CPU time): 39 tests passed, 0 failed, 0 skipped (39 total tests)
2026-09-01T17:46:32.767610Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
No files changed, compilation skipped
2026-09-01T17:46:32.893236Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: 100 USDT of Aave yield is invisible: 1000000000 != 1100000000] test_AaveYieldMustIncreaseRedeemableAssets() (gas: 250376)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.03ms (143.76µs CPU time)

Ran 1 test suite in 14.25ms (1.03ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: 100 USDT of Aave yield is invisible: 1000000000 != 1100000000] test_AaveYieldMustIncreaseRedeemableAssets() (gas: 250376)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test
No files changed, compilation skipped
2026-09-01T17:46:33.041352Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: withdrawal fee is stranded instead of accruing to Bob: 1000000000 != 1003000000] test_WithdrawalFeeMustAccrueToRemainingShareholders() (gas: 345958)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.02ms (212.10µs CPU time)

Ran 1 test suite in 7.42ms (1.02ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: withdrawal fee is stranded instead of accruing to Bob: 1000000000 != 1003000000] test_WithdrawalFeeMustAccrueToRemainingShareholders() (gas: 345958)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test
No files changed, compilation skipped
2026-09-01T17:46:33.179737Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: fee remains in Aave after every share is burned: 3000000 != 0] test_LastWithdrawalMustNotLeaveUnownedAUsdt() (gas: 250004)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 890.76µs (153.31µs CPU time)

Ran 1 test suite in 10.71ms (890.76µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: fee remains in Aave after every share is burned: 3000000 != 0] test_LastWithdrawalMustNotLeaveUnownedAUsdt() (gas: 250004)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test
No files changed, compilation skipped
2026-09-01T17:46:33.319519Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() (gas: 44866)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 779.90µs (51.39µs CPU time)

Ran 1 test suite in 7.60ms (779.90µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() (gas: 44866)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4b9b82908a6fa5de1f2f675662a2433fad8b824f
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,106 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultAdversarialTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address user, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(user);
+        shares = vault.deposit(amount);
+    }
+
+    function test_AaveYieldMustIncreaseRedeemableAssets() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 100e6);
+        usdt.mint(address(pool), 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "100 USDT of Aave yield is invisible");
+
+        vm.prank(alice);
+        uint256 received = vault.withdraw(shares);
+        assertEq(received, 1_096_700_000, "shareholder cannot withdraw accrued yield net of fee");
+    }
+
+    function test_WithdrawalFeeMustAccrueToRemainingShareholders() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        _deposit(bob, 1_000e6);
+        uint256 bobBefore = vault.balanceOfUnderlying(bob);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares);
+
+        assertEq(
+            vault.balanceOfUnderlying(bob), bobBefore + 3e6, "withdrawal fee is stranded instead of accruing to Bob"
+        );
+    }
+
+    function test_LastWithdrawalMustNotLeaveUnownedAUsdt() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        assertEq(aUsdt.balanceOf(address(vault)), 0, "fee remains in Aave after every share is burned");
+    }
+
+    function test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+    }
+}
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_884_006;
+
+    function test_RealUsdtCanBeSuppliedToRealAavePool() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", FORK_BLOCK);
+        address user = makeAddr("mainnet depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+
+        deal(USDT, user, 1_000e6);
+        vm.startPrank(user);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), 1_000e6));
+        require(approved, "USDT approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 1_000e18);
+        assertApproxEqAbs(vault.aUsdt().balanceOf(address(vault)), 1_000e6, 2);
+    }
+}

codex
The trace isolates the launch blocker: real USDT’s `approve` completes with empty return data (`[Stop]`), then Solidity’s direct `IERC20.approve` ABI decoding reverts before `AavePool.supply` is ever called. This mock escaped it because OpenZeppelin’s mock returns a standard Boolean. I’m now assembling the exact commands and outputs, plus the independent accounting failures and proposed fixes, into `FINDINGS.md`.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001/FINDINGS.md
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..89c7b8af3e6a766e6bfd470f8ac56cbea5343a96
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,234 @@
+# UsdtYieldVault pre-deployment findings
+
+## Sign-off conclusion
+
+**Do not deploy this contract on Monday.** A deposit using the specified mainnet USDT and Aave V3 Pool reverts before it reaches `Pool.supply`, so the vault cannot accept deposits as written. Independently, the vault does not account for Aave yield, strands every withdrawal fee outside its share accounting, and lets the owner configure a fee that makes every deposit panic.
+
+All production code and pre-existing tests are unchanged. The new executable counterexamples are in `test/UsdtYieldVaultAdversarial.t.sol`. The fork is pinned to Ethereum block `25,884,006` and uses:
+
+- USDT: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
+- Aave V3 Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`
+- Aave V3 aUSDT: `0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a`
+
+## Critical: every deposit with real mainnet USDT reverts
+
+### Cause and impact
+
+`deposit` calls `usdt.approve(address(aavePool), amount)` as a normal Solidity `IERC20` call. Mainnet USDT is non-standard: its successful `approve` returns no data. Solidity expects and tries to decode a Boolean, so the vault reverts immediately after USDT emits `Approval`. The trace contains no call to `AavePool.supply`.
+
+The existing `MockUSDT` inherits OpenZeppelin ERC20 and returns `bool`, masking this incompatibility. This is a launch blocker: users cannot deposit into a vault deployed with the addresses in the brief.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-contract UsdtYieldVaultMainnetForkTest -vvvv
+```
+
+Relevant verbatim output from that command (the omitted prefix is only fork setup and Foundry's `deal` storage discovery):
+
+```text
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [64468] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [35224] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
+    │   │   ├─ emit Transfer(from: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
+    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   └─ ← [Revert] EvmError: Revert
+    └─ ← [Revert] EvmError: Revert
+
+Backtrace:
+  at UsdtYieldVault.deposit
+  at UsdtYieldVaultMainnetForkTest.test_RealUsdtCanBeSuppliedToRealAavePool
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.27s (2.27s CPU time)
+
+Ran 1 test suite in 2.28s (2.27s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToRealAavePool() (gas: 1120364)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+```
+
+### Fix
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove(address(aavePool), amount)`. That accepts tokens with no return data and safely handles tokens requiring allowance to be reset to zero. Retain the pinned fork test and add a second consecutive deposit to exercise allowance behavior.
+
+## High: Aave yield is invisible and cannot be redeemed by shareholders
+
+### Cause and impact
+
+All conversions use the manually maintained `totalAssetsStored`. It increases only on deposits and decreases only on withdrawals. The contract never reads its `aUsdt` balance, even though an aToken balance is how Aave V3 exposes accrued supply interest.
+
+Consequently, interest does not raise `totalAssets`, `sharePrice`, `balanceOfUnderlying`, or withdrawal proceeds. It remains stuck in the vault. This contradicts the core purpose of a yield vault.
+
+The test models Aave accrual by adding 100 aUSDT (and matching pool liquidity) after Alice supplies 1,000 USDT. Alice remains credited with only 1,000 USDT.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-test test_AaveYieldMustIncreaseRedeemableAssets -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:32.893236Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: 100 USDT of Aave yield is invisible: 1000000000 != 1100000000] test_AaveYieldMustIncreaseRedeemableAssets() (gas: 250376)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.03ms (143.76µs CPU time)
+
+Ran 1 test suite in 14.25ms (1.03ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: 100 USDT of Aave yield is invisible: 1000000000 != 1100000000] test_AaveYieldMustIncreaseRedeemableAssets() (gas: 250376)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Make the conversion denominator and `totalAssets()` reflect assets actually controlled by the vault, normally `aUsdt.balanceOf(address(this))` plus any idle USDT. Calculate deposit shares from the pre-deposit asset balance so a new depositor cannot receive existing yield. Specify and test behavior for Aave losses, rounding, donated tokens, and an empty vault with residual assets.
+
+## High: withdrawal fees are permanently removed from share accounting
+
+### Cause and impact
+
+On withdrawal, the vault calculates `grossAssets`, sends only `netAssets` from Aave, but subtracts the full `grossAssets` from `totalAssetsStored`. The fee therefore remains as aUSDT while disappearing from the accounting used to price every share.
+
+This contradicts the contract documentation that fees "accrue to the remaining shareholders." In the two-user counterexample, Alice's 3 USDT fee does not increase Bob's claim. When the last user exits, all shares are burned while 3 aUSDT remains unowned. Repeated withdrawals continuously accumulate inaccessible assets.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-test test_WithdrawalFeeMustAccrueToRemainingShareholders -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:33.041352Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: withdrawal fee is stranded instead of accruing to Bob: 1000000000 != 1003000000] test_WithdrawalFeeMustAccrueToRemainingShareholders() (gas: 345958)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.02ms (212.10µs CPU time)
+
+Ran 1 test suite in 7.42ms (1.02ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: withdrawal fee is stranded instead of accruing to Bob: 1000000000 != 1003000000] test_WithdrawalFeeMustAccrueToRemainingShareholders() (gas: 345958)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Command:
+
+```console
+forge test --match-test test_LastWithdrawalMustNotLeaveUnownedAUsdt -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:33.179737Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: fee remains in Aave after every share is burned: 3000000 != 0] test_LastWithdrawalMustNotLeaveUnownedAUsdt() (gas: 250004)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 890.76µs (153.31µs CPU time)
+
+Ran 1 test suite in 10.71ms (890.76µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: fee remains in Aave after every share is burned: 3000000 != 0] test_LastWithdrawalMustNotLeaveUnownedAUsdt() (gas: 250004)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Price shares from the live asset balance so a retained fee automatically benefits the remaining shares. Define the final-redemption case explicitly: either waive the withdrawal fee when all shares are redeemed, or send that fee to a clearly defined beneficiary/reserve rather than leaving assets in a vault with zero owners. Add conservation invariants covering partial and final redemptions.
+
+## Medium: an unbounded deposit fee lets the owner brick all deposits
+
+### Cause and impact
+
+Neither the constructor nor `setDepositFee` limits the fee to `BPS_DENOMINATOR`. A value above 10,000 makes `fee > amount`, so `amount - fee` panics for every deposit. The setting succeeds and emits a normal update event; only subsequent user deposits reveal the broken configuration.
+
+This is owner-controlled, but it is an avoidable operational footgun in a mainnet system. A bad deployment argument or fee update globally disables deposits until corrected.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-test test_FeeConfigurationMustNotAllowOwnerToBrickDeposits -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:33.319519Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() (gas: 44866)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 779.90µs (51.39µs CPU time)
+
+Ran 1 test suite in 7.60ms (779.90µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() (gas: 44866)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Reject fees above an explicitly documented maximum in both the constructor and setter using a custom error. The absolute safety bound is 10,000 bps; a production vault should likely enforce a substantially lower governance cap.
+
+## Why the existing green suite did not protect this deployment
+
+The unchanged original suite still reports 39/39 passing, but it uses a standards-compliant ERC20 mock and a receipt token whose balance changes only when the mock pool explicitly mints or burns principal. It therefore cannot expose USDT's missing return values or Aave's interest-bearing balance behavior. Several existing assertions only require values to be nonzero, so they do not establish asset conservation or correct share pricing.
+
+Command:
+
+```console
+forge test --match-path test/UsdtYieldVault.t.sol
+```
+
+Summary from the real output:
+
+```text
+Ran 39 tests for test/UsdtYieldVault.t.sol:UsdtYieldVaultTest
+Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 1.71ms (5.28ms CPU time)
+
+Ran 1 test suite in 8.09ms (1.71ms CPU time): 39 tests passed, 0 failed, 0 skipped (39 total tests)
+```
+
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4b9b82908a6fa5de1f2f675662a2433fad8b824f
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,106 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultAdversarialTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address user, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(user);
+        shares = vault.deposit(amount);
+    }
+
+    function test_AaveYieldMustIncreaseRedeemableAssets() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 100e6);
+        usdt.mint(address(pool), 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "100 USDT of Aave yield is invisible");
+
+        vm.prank(alice);
+        uint256 received = vault.withdraw(shares);
+        assertEq(received, 1_096_700_000, "shareholder cannot withdraw accrued yield net of fee");
+    }
+
+    function test_WithdrawalFeeMustAccrueToRemainingShareholders() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        _deposit(bob, 1_000e6);
+        uint256 bobBefore = vault.balanceOfUnderlying(bob);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares);
+
+        assertEq(
+            vault.balanceOfUnderlying(bob), bobBefore + 3e6, "withdrawal fee is stranded instead of accruing to Bob"
+        );
+    }
+
+    function test_LastWithdrawalMustNotLeaveUnownedAUsdt() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        assertEq(aUsdt.balanceOf(address(vault)), 0, "fee remains in Aave after every share is burned");
+    }
+
+    function test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+    }
+}
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_884_006;
+
+    function test_RealUsdtCanBeSuppliedToRealAavePool() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", FORK_BLOCK);
+        address user = makeAddr("mainnet depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+
+        deal(USDT, user, 1_000e6);
+        vm.startPrank(user);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), 1_000e6));
+        require(approved, "USDT approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 1_000e18);
+        assertApproxEqAbs(vault.aUsdt().balanceOf(address(vault)), 1_000e6, 2);
+    }
+}

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..89c7b8af3e6a766e6bfd470f8ac56cbea5343a96
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,234 @@
+# UsdtYieldVault pre-deployment findings
+
+## Sign-off conclusion
+
+**Do not deploy this contract on Monday.** A deposit using the specified mainnet USDT and Aave V3 Pool reverts before it reaches `Pool.supply`, so the vault cannot accept deposits as written. Independently, the vault does not account for Aave yield, strands every withdrawal fee outside its share accounting, and lets the owner configure a fee that makes every deposit panic.
+
+All production code and pre-existing tests are unchanged. The new executable counterexamples are in `test/UsdtYieldVaultAdversarial.t.sol`. The fork is pinned to Ethereum block `25,884,006` and uses:
+
+- USDT: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
+- Aave V3 Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`
+- Aave V3 aUSDT: `0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a`
+
+## Critical: every deposit with real mainnet USDT reverts
+
+### Cause and impact
+
+`deposit` calls `usdt.approve(address(aavePool), amount)` as a normal Solidity `IERC20` call. Mainnet USDT is non-standard: its successful `approve` returns no data. Solidity expects and tries to decode a Boolean, so the vault reverts immediately after USDT emits `Approval`. The trace contains no call to `AavePool.supply`.
+
+The existing `MockUSDT` inherits OpenZeppelin ERC20 and returns `bool`, masking this incompatibility. This is a launch blocker: users cannot deposit into a vault deployed with the addresses in the brief.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-contract UsdtYieldVaultMainnetForkTest -vvvv
+```
+
+Relevant verbatim output from that command (the omitted prefix is only fork setup and Foundry's `deal` storage discovery):
+
+```text
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [64468] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [35224] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
+    │   │   ├─ emit Transfer(from: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
+    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   └─ ← [Revert] EvmError: Revert
+    └─ ← [Revert] EvmError: Revert
+
+Backtrace:
+  at UsdtYieldVault.deposit
+  at UsdtYieldVaultMainnetForkTest.test_RealUsdtCanBeSuppliedToRealAavePool
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.27s (2.27s CPU time)
+
+Ran 1 test suite in 2.28s (2.27s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToRealAavePool() (gas: 1120364)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+```
+
+### Fix
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove(address(aavePool), amount)`. That accepts tokens with no return data and safely handles tokens requiring allowance to be reset to zero. Retain the pinned fork test and add a second consecutive deposit to exercise allowance behavior.
+
+## High: Aave yield is invisible and cannot be redeemed by shareholders
+
+### Cause and impact
+
+All conversions use the manually maintained `totalAssetsStored`. It increases only on deposits and decreases only on withdrawals. The contract never reads its `aUsdt` balance, even though an aToken balance is how Aave V3 exposes accrued supply interest.
+
+Consequently, interest does not raise `totalAssets`, `sharePrice`, `balanceOfUnderlying`, or withdrawal proceeds. It remains stuck in the vault. This contradicts the core purpose of a yield vault.
+
+The test models Aave accrual by adding 100 aUSDT (and matching pool liquidity) after Alice supplies 1,000 USDT. Alice remains credited with only 1,000 USDT.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-test test_AaveYieldMustIncreaseRedeemableAssets -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:32.893236Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: 100 USDT of Aave yield is invisible: 1000000000 != 1100000000] test_AaveYieldMustIncreaseRedeemableAssets() (gas: 250376)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.03ms (143.76µs CPU time)
+
+Ran 1 test suite in 14.25ms (1.03ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: 100 USDT of Aave yield is invisible: 1000000000 != 1100000000] test_AaveYieldMustIncreaseRedeemableAssets() (gas: 250376)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Make the conversion denominator and `totalAssets()` reflect assets actually controlled by the vault, normally `aUsdt.balanceOf(address(this))` plus any idle USDT. Calculate deposit shares from the pre-deposit asset balance so a new depositor cannot receive existing yield. Specify and test behavior for Aave losses, rounding, donated tokens, and an empty vault with residual assets.
+
+## High: withdrawal fees are permanently removed from share accounting
+
+### Cause and impact
+
+On withdrawal, the vault calculates `grossAssets`, sends only `netAssets` from Aave, but subtracts the full `grossAssets` from `totalAssetsStored`. The fee therefore remains as aUSDT while disappearing from the accounting used to price every share.
+
+This contradicts the contract documentation that fees "accrue to the remaining shareholders." In the two-user counterexample, Alice's 3 USDT fee does not increase Bob's claim. When the last user exits, all shares are burned while 3 aUSDT remains unowned. Repeated withdrawals continuously accumulate inaccessible assets.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-test test_WithdrawalFeeMustAccrueToRemainingShareholders -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:33.041352Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: withdrawal fee is stranded instead of accruing to Bob: 1000000000 != 1003000000] test_WithdrawalFeeMustAccrueToRemainingShareholders() (gas: 345958)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.02ms (212.10µs CPU time)
+
+Ran 1 test suite in 7.42ms (1.02ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: withdrawal fee is stranded instead of accruing to Bob: 1000000000 != 1003000000] test_WithdrawalFeeMustAccrueToRemainingShareholders() (gas: 345958)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Command:
+
+```console
+forge test --match-test test_LastWithdrawalMustNotLeaveUnownedAUsdt -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:33.179737Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: fee remains in Aave after every share is burned: 3000000 != 0] test_LastWithdrawalMustNotLeaveUnownedAUsdt() (gas: 250004)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 890.76µs (153.31µs CPU time)
+
+Ran 1 test suite in 10.71ms (890.76µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: fee remains in Aave after every share is burned: 3000000 != 0] test_LastWithdrawalMustNotLeaveUnownedAUsdt() (gas: 250004)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Price shares from the live asset balance so a retained fee automatically benefits the remaining shares. Define the final-redemption case explicitly: either waive the withdrawal fee when all shares are redeemed, or send that fee to a clearly defined beneficiary/reserve rather than leaving assets in a vault with zero owners. Add conservation invariants covering partial and final redemptions.
+
+## Medium: an unbounded deposit fee lets the owner brick all deposits
+
+### Cause and impact
+
+Neither the constructor nor `setDepositFee` limits the fee to `BPS_DENOMINATOR`. A value above 10,000 makes `fee > amount`, so `amount - fee` panics for every deposit. The setting succeeds and emits a normal update event; only subsequent user deposits reveal the broken configuration.
+
+This is owner-controlled, but it is an avoidable operational footgun in a mainnet system. A bad deployment argument or fee update globally disables deposits until corrected.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-test test_FeeConfigurationMustNotAllowOwnerToBrickDeposits -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:33.319519Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() (gas: 44866)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 779.90µs (51.39µs CPU time)
+
+Ran 1 test suite in 7.60ms (779.90µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() (gas: 44866)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Reject fees above an explicitly documented maximum in both the constructor and setter using a custom error. The absolute safety bound is 10,000 bps; a production vault should likely enforce a substantially lower governance cap.
+
+## Why the existing green suite did not protect this deployment
+
+The unchanged original suite still reports 39/39 passing, but it uses a standards-compliant ERC20 mock and a receipt token whose balance changes only when the mock pool explicitly mints or burns principal. It therefore cannot expose USDT's missing return values or Aave's interest-bearing balance behavior. Several existing assertions only require values to be nonzero, so they do not establish asset conservation or correct share pricing.
+
+Command:
+
+```console
+forge test --match-path test/UsdtYieldVault.t.sol
+```
+
+Summary from the real output:
+
+```text
+Ran 39 tests for test/UsdtYieldVault.t.sol:UsdtYieldVaultTest
+Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 1.71ms (5.28ms CPU time)
+
+Ran 1 test suite in 8.09ms (1.71ms CPU time): 39 tests passed, 0 failed, 0 skipped (39 total tests)
+```
+
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4b9b82908a6fa5de1f2f675662a2433fad8b824f
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,106 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultAdversarialTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address user, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(user);
+        shares = vault.deposit(amount);
+    }
+
+    function test_AaveYieldMustIncreaseRedeemableAssets() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 100e6);
+        usdt.mint(address(pool), 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "100 USDT of Aave yield is invisible");
+
+        vm.prank(alice);
+        uint256 received = vault.withdraw(shares);
+        assertEq(received, 1_096_700_000, "shareholder cannot withdraw accrued yield net of fee");
+    }
+
+    function test_WithdrawalFeeMustAccrueToRemainingShareholders() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        _deposit(bob, 1_000e6);
+        uint256 bobBefore = vault.balanceOfUnderlying(bob);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares);
+
+        assertEq(
+            vault.balanceOfUnderlying(bob), bobBefore + 3e6, "withdrawal fee is stranded instead of accruing to Bob"
+        );
+    }
+
+    function test_LastWithdrawalMustNotLeaveUnownedAUsdt() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        assertEq(aUsdt.balanceOf(address(vault)), 0, "fee remains in Aave after every share is burned");
+    }
+
+    function test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+    }
+}
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_884_006;
+
+    function test_RealUsdtCanBeSuppliedToRealAavePool() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", FORK_BLOCK);
+        address user = makeAddr("mainnet depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+
+        deal(USDT, user, 1_000e6);
+        vm.startPrank(user);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), 1_000e6));
+        require(approved, "USDT approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 1_000e18);
+        assertApproxEqAbs(vault.aUsdt().balanceOf(address(vault)), 1_000e6, 2);
+    }
+}

exec
/bin/bash -lc 'git status --short; git diff -- src test/UsdtYieldVault.t.sol test/mocks; forge test --match-path test/UsdtYieldVaultAdversarial.t.sol 2>&1 | tail -n 40' in /home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001
 succeeded in 2749ms:
No files changed, compilation skipped
2026-09-01T17:49:27.105635Z  WARN evm::traces::external: etherscan config not found

Ran 4 tests for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: 100 USDT of Aave yield is invisible: 1000000000 != 1100000000] test_AaveYieldMustIncreaseRedeemableAssets() (gas: 250376)
[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() (gas: 44866)
[FAIL: fee remains in Aave after every share is burned: 3000000 != 0] test_LastWithdrawalMustNotLeaveUnownedAUsdt() (gas: 250004)
[FAIL: withdrawal fee is stranded instead of accruing to Bob: 1000000000 != 1003000000] test_WithdrawalFeeMustAccrueToRemainingShareholders() (gas: 345958)
Suite result: FAILED. 0 passed; 4 failed; 0 skipped; finished in 979.88µs (740.62µs CPU time)
2026-09-01T17:49:27.366966Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25884006"

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToRealAavePool() (gas: 1120364)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.62s (2.62s CPU time)
2026-09-01T17:49:29.724475Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25884006")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)

Ran 2 test suites in 2.62s (2.62s CPU time): 0 tests passed, 5 failed, 0 skipped (5 total tests)

Failing tests:
Encountered 4 failing tests in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: 100 USDT of Aave yield is invisible: 1000000000 != 1100000000] test_AaveYieldMustIncreaseRedeemableAssets() (gas: 250376)
[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() (gas: 44866)
[FAIL: fee remains in Aave after every share is burned: 3000000 != 0] test_LastWithdrawalMustNotLeaveUnownedAUsdt() (gas: 250004)
[FAIL: withdrawal fee is stranded instead of accruing to Bob: 1000000000 != 1003000000] test_WithdrawalFeeMustAccrueToRemainingShareholders() (gas: 345958)

Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToRealAavePool() (gas: 1120364)

Encountered a total of 5 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 5 failed tests

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..89c7b8af3e6a766e6bfd470f8ac56cbea5343a96
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,234 @@
+# UsdtYieldVault pre-deployment findings
+
+## Sign-off conclusion
+
+**Do not deploy this contract on Monday.** A deposit using the specified mainnet USDT and Aave V3 Pool reverts before it reaches `Pool.supply`, so the vault cannot accept deposits as written. Independently, the vault does not account for Aave yield, strands every withdrawal fee outside its share accounting, and lets the owner configure a fee that makes every deposit panic.
+
+All production code and pre-existing tests are unchanged. The new executable counterexamples are in `test/UsdtYieldVaultAdversarial.t.sol`. The fork is pinned to Ethereum block `25,884,006` and uses:
+
+- USDT: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
+- Aave V3 Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`
+- Aave V3 aUSDT: `0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a`
+
+## Critical: every deposit with real mainnet USDT reverts
+
+### Cause and impact
+
+`deposit` calls `usdt.approve(address(aavePool), amount)` as a normal Solidity `IERC20` call. Mainnet USDT is non-standard: its successful `approve` returns no data. Solidity expects and tries to decode a Boolean, so the vault reverts immediately after USDT emits `Approval`. The trace contains no call to `AavePool.supply`.
+
+The existing `MockUSDT` inherits OpenZeppelin ERC20 and returns `bool`, masking this incompatibility. This is a launch blocker: users cannot deposit into a vault deployed with the addresses in the brief.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-contract UsdtYieldVaultMainnetForkTest -vvvv
+```
+
+Relevant verbatim output from that command (the omitted prefix is only fork setup and Foundry's `deal` storage discovery):
+
+```text
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [64468] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [35224] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
+    │   │   ├─ emit Transfer(from: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
+    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   └─ ← [Revert] EvmError: Revert
+    └─ ← [Revert] EvmError: Revert
+
+Backtrace:
+  at UsdtYieldVault.deposit
+  at UsdtYieldVaultMainnetForkTest.test_RealUsdtCanBeSuppliedToRealAavePool
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.27s (2.27s CPU time)
+
+Ran 1 test suite in 2.28s (2.27s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToRealAavePool() (gas: 1120364)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+```
+
+### Fix
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove(address(aavePool), amount)`. That accepts tokens with no return data and safely handles tokens requiring allowance to be reset to zero. Retain the pinned fork test and add a second consecutive deposit to exercise allowance behavior.
+
+## High: Aave yield is invisible and cannot be redeemed by shareholders
+
+### Cause and impact
+
+All conversions use the manually maintained `totalAssetsStored`. It increases only on deposits and decreases only on withdrawals. The contract never reads its `aUsdt` balance, even though an aToken balance is how Aave V3 exposes accrued supply interest.
+
+Consequently, interest does not raise `totalAssets`, `sharePrice`, `balanceOfUnderlying`, or withdrawal proceeds. It remains stuck in the vault. This contradicts the core purpose of a yield vault.
+
+The test models Aave accrual by adding 100 aUSDT (and matching pool liquidity) after Alice supplies 1,000 USDT. Alice remains credited with only 1,000 USDT.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-test test_AaveYieldMustIncreaseRedeemableAssets -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:32.893236Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: 100 USDT of Aave yield is invisible: 1000000000 != 1100000000] test_AaveYieldMustIncreaseRedeemableAssets() (gas: 250376)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.03ms (143.76µs CPU time)
+
+Ran 1 test suite in 14.25ms (1.03ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: 100 USDT of Aave yield is invisible: 1000000000 != 1100000000] test_AaveYieldMustIncreaseRedeemableAssets() (gas: 250376)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Make the conversion denominator and `totalAssets()` reflect assets actually controlled by the vault, normally `aUsdt.balanceOf(address(this))` plus any idle USDT. Calculate deposit shares from the pre-deposit asset balance so a new depositor cannot receive existing yield. Specify and test behavior for Aave losses, rounding, donated tokens, and an empty vault with residual assets.
+
+## High: withdrawal fees are permanently removed from share accounting
+
+### Cause and impact
+
+On withdrawal, the vault calculates `grossAssets`, sends only `netAssets` from Aave, but subtracts the full `grossAssets` from `totalAssetsStored`. The fee therefore remains as aUSDT while disappearing from the accounting used to price every share.
+
+This contradicts the contract documentation that fees "accrue to the remaining shareholders." In the two-user counterexample, Alice's 3 USDT fee does not increase Bob's claim. When the last user exits, all shares are burned while 3 aUSDT remains unowned. Repeated withdrawals continuously accumulate inaccessible assets.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-test test_WithdrawalFeeMustAccrueToRemainingShareholders -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:33.041352Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: withdrawal fee is stranded instead of accruing to Bob: 1000000000 != 1003000000] test_WithdrawalFeeMustAccrueToRemainingShareholders() (gas: 345958)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.02ms (212.10µs CPU time)
+
+Ran 1 test suite in 7.42ms (1.02ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: withdrawal fee is stranded instead of accruing to Bob: 1000000000 != 1003000000] test_WithdrawalFeeMustAccrueToRemainingShareholders() (gas: 345958)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Command:
+
+```console
+forge test --match-test test_LastWithdrawalMustNotLeaveUnownedAUsdt -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:33.179737Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: fee remains in Aave after every share is burned: 3000000 != 0] test_LastWithdrawalMustNotLeaveUnownedAUsdt() (gas: 250004)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 890.76µs (153.31µs CPU time)
+
+Ran 1 test suite in 10.71ms (890.76µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: fee remains in Aave after every share is burned: 3000000 != 0] test_LastWithdrawalMustNotLeaveUnownedAUsdt() (gas: 250004)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Price shares from the live asset balance so a retained fee automatically benefits the remaining shares. Define the final-redemption case explicitly: either waive the withdrawal fee when all shares are redeemed, or send that fee to a clearly defined beneficiary/reserve rather than leaving assets in a vault with zero owners. Add conservation invariants covering partial and final redemptions.
+
+## Medium: an unbounded deposit fee lets the owner brick all deposits
+
+### Cause and impact
+
+Neither the constructor nor `setDepositFee` limits the fee to `BPS_DENOMINATOR`. A value above 10,000 makes `fee > amount`, so `amount - fee` panics for every deposit. The setting succeeds and emits a normal update event; only subsequent user deposits reveal the broken configuration.
+
+This is owner-controlled, but it is an avoidable operational footgun in a mainnet system. A bad deployment argument or fee update globally disables deposits until corrected.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-test test_FeeConfigurationMustNotAllowOwnerToBrickDeposits -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:33.319519Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() (gas: 44866)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 779.90µs (51.39µs CPU time)
+
+Ran 1 test suite in 7.60ms (779.90µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() (gas: 44866)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Reject fees above an explicitly documented maximum in both the constructor and setter using a custom error. The absolute safety bound is 10,000 bps; a production vault should likely enforce a substantially lower governance cap.
+
+## Why the existing green suite did not protect this deployment
+
+The unchanged original suite still reports 39/39 passing, but it uses a standards-compliant ERC20 mock and a receipt token whose balance changes only when the mock pool explicitly mints or burns principal. It therefore cannot expose USDT's missing return values or Aave's interest-bearing balance behavior. Several existing assertions only require values to be nonzero, so they do not establish asset conservation or correct share pricing.
+
+Command:
+
+```console
+forge test --match-path test/UsdtYieldVault.t.sol
+```
+
+Summary from the real output:
+
+```text
+Ran 39 tests for test/UsdtYieldVault.t.sol:UsdtYieldVaultTest
+Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 1.71ms (5.28ms CPU time)
+
+Ran 1 test suite in 8.09ms (1.71ms CPU time): 39 tests passed, 0 failed, 0 skipped (39 total tests)
+```
+
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4b9b82908a6fa5de1f2f675662a2433fad8b824f
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,106 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultAdversarialTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address user, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(user);
+        shares = vault.deposit(amount);
+    }
+
+    function test_AaveYieldMustIncreaseRedeemableAssets() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 100e6);
+        usdt.mint(address(pool), 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "100 USDT of Aave yield is invisible");
+
+        vm.prank(alice);
+        uint256 received = vault.withdraw(shares);
+        assertEq(received, 1_096_700_000, "shareholder cannot withdraw accrued yield net of fee");
+    }
+
+    function test_WithdrawalFeeMustAccrueToRemainingShareholders() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        _deposit(bob, 1_000e6);
+        uint256 bobBefore = vault.balanceOfUnderlying(bob);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares);
+
+        assertEq(
+            vault.balanceOfUnderlying(bob), bobBefore + 3e6, "withdrawal fee is stranded instead of accruing to Bob"
+        );
+    }
+
+    function test_LastWithdrawalMustNotLeaveUnownedAUsdt() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        assertEq(aUsdt.balanceOf(address(vault)), 0, "fee remains in Aave after every share is burned");
+    }
+
+    function test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+    }
+}
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_884_006;
+
+    function test_RealUsdtCanBeSuppliedToRealAavePool() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", FORK_BLOCK);
+        address user = makeAddr("mainnet depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+
+        deal(USDT, user, 1_000e6);
+        vm.startPrank(user);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), 1_000e6));
+        require(approved, "USDT approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 1_000e18);
+        assertApproxEqAbs(vault.aUsdt().balanceOf(address(vault)), 1_000e6, 2);
+    }
+}

codex
Do not ship this vault as written.

I added:

- [FINDINGS.md](/home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001/FINDINGS.md)
- [UsdtYieldVaultAdversarial.t.sol](/home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultAdversarial.t.sol)

The evidence demonstrates four issues:

- Critical: deposits with real mainnet USDT revert because its `approve` returns no data, but the vault uses a direct `IERC20.approve` call expecting a Boolean.
- High: accrued Aave yield is absent from all vault accounting and cannot be redeemed.
- High: withdrawal fees become unaccounted aUSDT; they neither accrue to remaining shareholders nor have an owner after final redemption.
- Medium: an owner-set fee above 10,000 bps makes every deposit panic.

The pinned mainnet fork and adversarial suite produce five intentional failures. The original 39 tests still pass unchanged. Nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was modified.
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..89c7b8af3e6a766e6bfd470f8ac56cbea5343a96
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,234 @@
+# UsdtYieldVault pre-deployment findings
+
+## Sign-off conclusion
+
+**Do not deploy this contract on Monday.** A deposit using the specified mainnet USDT and Aave V3 Pool reverts before it reaches `Pool.supply`, so the vault cannot accept deposits as written. Independently, the vault does not account for Aave yield, strands every withdrawal fee outside its share accounting, and lets the owner configure a fee that makes every deposit panic.
+
+All production code and pre-existing tests are unchanged. The new executable counterexamples are in `test/UsdtYieldVaultAdversarial.t.sol`. The fork is pinned to Ethereum block `25,884,006` and uses:
+
+- USDT: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
+- Aave V3 Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`
+- Aave V3 aUSDT: `0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a`
+
+## Critical: every deposit with real mainnet USDT reverts
+
+### Cause and impact
+
+`deposit` calls `usdt.approve(address(aavePool), amount)` as a normal Solidity `IERC20` call. Mainnet USDT is non-standard: its successful `approve` returns no data. Solidity expects and tries to decode a Boolean, so the vault reverts immediately after USDT emits `Approval`. The trace contains no call to `AavePool.supply`.
+
+The existing `MockUSDT` inherits OpenZeppelin ERC20 and returns `bool`, masking this incompatibility. This is a launch blocker: users cannot deposit into a vault deployed with the addresses in the brief.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-contract UsdtYieldVaultMainnetForkTest -vvvv
+```
+
+Relevant verbatim output from that command (the omitted prefix is only fork setup and Foundry's `deal` storage discovery):
+
+```text
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [64468] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [35224] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
+    │   │   ├─ emit Transfer(from: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
+    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   └─ ← [Revert] EvmError: Revert
+    └─ ← [Revert] EvmError: Revert
+
+Backtrace:
+  at UsdtYieldVault.deposit
+  at UsdtYieldVaultMainnetForkTest.test_RealUsdtCanBeSuppliedToRealAavePool
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.27s (2.27s CPU time)
+
+Ran 1 test suite in 2.28s (2.27s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToRealAavePool() (gas: 1120364)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+```
+
+### Fix
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove(address(aavePool), amount)`. That accepts tokens with no return data and safely handles tokens requiring allowance to be reset to zero. Retain the pinned fork test and add a second consecutive deposit to exercise allowance behavior.
+
+## High: Aave yield is invisible and cannot be redeemed by shareholders
+
+### Cause and impact
+
+All conversions use the manually maintained `totalAssetsStored`. It increases only on deposits and decreases only on withdrawals. The contract never reads its `aUsdt` balance, even though an aToken balance is how Aave V3 exposes accrued supply interest.
+
+Consequently, interest does not raise `totalAssets`, `sharePrice`, `balanceOfUnderlying`, or withdrawal proceeds. It remains stuck in the vault. This contradicts the core purpose of a yield vault.
+
+The test models Aave accrual by adding 100 aUSDT (and matching pool liquidity) after Alice supplies 1,000 USDT. Alice remains credited with only 1,000 USDT.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-test test_AaveYieldMustIncreaseRedeemableAssets -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:32.893236Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: 100 USDT of Aave yield is invisible: 1000000000 != 1100000000] test_AaveYieldMustIncreaseRedeemableAssets() (gas: 250376)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.03ms (143.76µs CPU time)
+
+Ran 1 test suite in 14.25ms (1.03ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: 100 USDT of Aave yield is invisible: 1000000000 != 1100000000] test_AaveYieldMustIncreaseRedeemableAssets() (gas: 250376)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Make the conversion denominator and `totalAssets()` reflect assets actually controlled by the vault, normally `aUsdt.balanceOf(address(this))` plus any idle USDT. Calculate deposit shares from the pre-deposit asset balance so a new depositor cannot receive existing yield. Specify and test behavior for Aave losses, rounding, donated tokens, and an empty vault with residual assets.
+
+## High: withdrawal fees are permanently removed from share accounting
+
+### Cause and impact
+
+On withdrawal, the vault calculates `grossAssets`, sends only `netAssets` from Aave, but subtracts the full `grossAssets` from `totalAssetsStored`. The fee therefore remains as aUSDT while disappearing from the accounting used to price every share.
+
+This contradicts the contract documentation that fees "accrue to the remaining shareholders." In the two-user counterexample, Alice's 3 USDT fee does not increase Bob's claim. When the last user exits, all shares are burned while 3 aUSDT remains unowned. Repeated withdrawals continuously accumulate inaccessible assets.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-test test_WithdrawalFeeMustAccrueToRemainingShareholders -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:33.041352Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: withdrawal fee is stranded instead of accruing to Bob: 1000000000 != 1003000000] test_WithdrawalFeeMustAccrueToRemainingShareholders() (gas: 345958)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.02ms (212.10µs CPU time)
+
+Ran 1 test suite in 7.42ms (1.02ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: withdrawal fee is stranded instead of accruing to Bob: 1000000000 != 1003000000] test_WithdrawalFeeMustAccrueToRemainingShareholders() (gas: 345958)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Command:
+
+```console
+forge test --match-test test_LastWithdrawalMustNotLeaveUnownedAUsdt -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:33.179737Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: fee remains in Aave after every share is burned: 3000000 != 0] test_LastWithdrawalMustNotLeaveUnownedAUsdt() (gas: 250004)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 890.76µs (153.31µs CPU time)
+
+Ran 1 test suite in 10.71ms (890.76µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: fee remains in Aave after every share is burned: 3000000 != 0] test_LastWithdrawalMustNotLeaveUnownedAUsdt() (gas: 250004)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Price shares from the live asset balance so a retained fee automatically benefits the remaining shares. Define the final-redemption case explicitly: either waive the withdrawal fee when all shares are redeemed, or send that fee to a clearly defined beneficiary/reserve rather than leaving assets in a vault with zero owners. Add conservation invariants covering partial and final redemptions.
+
+## Medium: an unbounded deposit fee lets the owner brick all deposits
+
+### Cause and impact
+
+Neither the constructor nor `setDepositFee` limits the fee to `BPS_DENOMINATOR`. A value above 10,000 makes `fee > amount`, so `amount - fee` panics for every deposit. The setting succeeds and emits a normal update event; only subsequent user deposits reveal the broken configuration.
+
+This is owner-controlled, but it is an avoidable operational footgun in a mainnet system. A bad deployment argument or fee update globally disables deposits until corrected.
+
+### Reproduction and real output
+
+Command:
+
+```console
+forge test --match-test test_FeeConfigurationMustNotAllowOwnerToBrickDeposits -vv
+```
+
+Output:
+
+```text
+No files changed, compilation skipped
+2026-09-01T17:46:33.319519Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() (gas: 44866)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 779.90µs (51.39µs CPU time)
+
+Ran 1 test suite in 7.60ms (779.90µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() (gas: 44866)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Reject fees above an explicitly documented maximum in both the constructor and setter using a custom error. The absolute safety bound is 10,000 bps; a production vault should likely enforce a substantially lower governance cap.
+
+## Why the existing green suite did not protect this deployment
+
+The unchanged original suite still reports 39/39 passing, but it uses a standards-compliant ERC20 mock and a receipt token whose balance changes only when the mock pool explicitly mints or burns principal. It therefore cannot expose USDT's missing return values or Aave's interest-bearing balance behavior. Several existing assertions only require values to be nonzero, so they do not establish asset conservation or correct share pricing.
+
+Command:
+
+```console
+forge test --match-path test/UsdtYieldVault.t.sol
+```
+
+Summary from the real output:
+
+```text
+Ran 39 tests for test/UsdtYieldVault.t.sol:UsdtYieldVaultTest
+Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 1.71ms (5.28ms CPU time)
+
+Ran 1 test suite in 8.09ms (1.71ms CPU time): 39 tests passed, 0 failed, 0 skipped (39 total tests)
+```
+
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4b9b82908a6fa5de1f2f675662a2433fad8b824f
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,106 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultAdversarialTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address user, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(user);
+        shares = vault.deposit(amount);
+    }
+
+    function test_AaveYieldMustIncreaseRedeemableAssets() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 100e6);
+        usdt.mint(address(pool), 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "100 USDT of Aave yield is invisible");
+
+        vm.prank(alice);
+        uint256 received = vault.withdraw(shares);
+        assertEq(received, 1_096_700_000, "shareholder cannot withdraw accrued yield net of fee");
+    }
+
+    function test_WithdrawalFeeMustAccrueToRemainingShareholders() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        _deposit(bob, 1_000e6);
+        uint256 bobBefore = vault.balanceOfUnderlying(bob);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares);
+
+        assertEq(
+            vault.balanceOfUnderlying(bob), bobBefore + 3e6, "withdrawal fee is stranded instead of accruing to Bob"
+        );
+    }
+
+    function test_LastWithdrawalMustNotLeaveUnownedAUsdt() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        assertEq(aUsdt.balanceOf(address(vault)), 0, "fee remains in Aave after every share is burned");
+    }
+
+    function test_FeeConfigurationMustNotAllowOwnerToBrickDeposits() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+    }
+}
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_884_006;
+
+    function test_RealUsdtCanBeSuppliedToRealAavePool() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", FORK_BLOCK);
+        address user = makeAddr("mainnet depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+
+        deal(USDT, user, 1_000e6);
+        vm.startPrank(user);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), 1_000e6));
+        require(approved, "USDT approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 1_000e18);
+        assertApproxEqAbs(vault.aUsdt().balanceOf(address(vault)), 1_000e6, 2);
+    }
+}

tokens used
67,522
````

## final message

Do not ship this vault as written.

I added:

- [FINDINGS.md](/home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001/FINDINGS.md)
- [UsdtYieldVaultAdversarial.t.sol](/home/damu/.cache/ethskills-evals/2026-09-01T174256Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultAdversarial.t.sol)

The evidence demonstrates four issues:

- Critical: deposits with real mainnet USDT revert because its `approve` returns no data, but the vault uses a direct `IERC20.approve` call expecting a Boolean.
- High: accrued Aave yield is absent from all vault accounting and cannot be redeemed.
- High: withdrawal fees become unaccounted aUSDT; they neither accrue to remaining shareholders nor have an owner after final redemption.
- Medium: an owner-set fee above 10,000 bps makes every deposit panic.

The pinned mainnet fork and adversarial suite produce five intentional failures. The original 39 tests still pass unchanged. Nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was modified.
