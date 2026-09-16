# Executor transcript — 2026-09-13T153847Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a09b6c-0321-7961-862b-32f5ed7028f4
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

codex
I’ll treat the existing green suite and coverage as a starting point, not deployment evidence. I’ll inspect the contract and current tests, add only new tests under `test/`, run each claimed failure exactly as documented, and leave production code and existing tests/mocks untouched.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md && rg --files -g 'AGENTS.md' -g '"'!lib'"' -g '"'!node_modules'"' && rg --files src test | sort" in /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
 exited 1 in 3ms:
exec
/bin/bash -lc "pwd; rg --files src test | sort; sed -n '1,280p' src/UsdtYieldVault.sol; sed -n '1,360p' test/UsdtYieldVault.t.sol; sed -n '1,240p' foundry.toml" in /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
 succeeded in 21ms:
/tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
src/UsdtYieldVault.sol
src/interfaces/IAavePool.sol
test/UsdtYieldVault.t.sol
test/mocks/MockAavePool.sol
test/mocks/MockUSDT.sol
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
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";
import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";

contract UsdtYieldVaultTest is Test {
    UsdtYieldVault public vault;
    MockUSDT public usdt;
    MockAavePool public pool;
    MockAToken public aUsdt;

    address public owner = makeAddr("owner");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 public constant INITIAL_FEE_BPS = 10;
    uint256 public constant DEPOSIT_AMOUNT = 1_000e6;

    function setUp() public {
        usdt = new MockUSDT();
        pool = new MockAavePool(address(usdt));
        aUsdt = pool.aToken();
        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), INITIAL_FEE_BPS, owner);

        usdt.mint(alice, 100_000e6);
        usdt.mint(bob, 100_000e6);

        vm.prank(alice);
        usdt.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdt.approve(address(vault), type(uint256).max);
    }

    function _deposit(address account, uint256 amount) internal returns (uint256) {
        vm.prank(account);
        return vault.deposit(amount);
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    function test_ConstructorSetsUsdt() public view {
        assertEq(address(vault.usdt()), address(usdt));
    }

    function test_ConstructorSetsAUsdt() public view {
        assertEq(address(vault.aUsdt()), address(aUsdt));
    }

    function test_ConstructorSetsAavePool() public view {
        assertEq(address(vault.aavePool()), address(pool));
    }

    function test_ConstructorSetsOwner() public view {
        assertEq(vault.owner(), owner);
    }

    function test_ConstructorSetsDepositFee() public view {
        assertEq(vault.depositFeeBps(), INITIAL_FEE_BPS);
    }

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    function test_BpsDenominator() public view {
        assertEq(vault.BPS_DENOMINATOR(), 10_000);
    }

    function test_ShareScale() public view {
        assertEq(vault.SHARE_SCALE(), 1e12);
    }

    function test_MinDeposit() public view {
        assertEq(vault.MIN_DEPOSIT(), 1e6);
    }

    function test_WithdrawFeeBps() public view {
        assertEq(vault.WITHDRAW_FEE_BPS(), 30);
    }

    /*//////////////////////////////////////////////////////////////
                                DEPOSIT
    //////////////////////////////////////////////////////////////*/

    function test_DepositMintsShares() public {
        uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
        assertEq(shares, 999e18);
        assertEq(vault.shareBalance(alice), 999e18);
    }

    function test_DepositUpdatesTotalShares() public {
        _deposit(alice, DEPOSIT_AMOUNT);
        assertEq(vault.totalShares(), 999e18);
    }

    function test_DepositUpdatesTotalAssets() public {
        _deposit(alice, DEPOSIT_AMOUNT);
        assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
        assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
    }

    function test_DepositTransfersUsdtFromDepositor() public {
        uint256 balanceBefore = usdt.balanceOf(alice);
        _deposit(alice, DEPOSIT_AMOUNT);
        assertEq(usdt.balanceOf(alice), balanceBefore - DEPOSIT_AMOUNT);
    }

    function test_DepositSuppliesToAave() public {
        _deposit(alice, DEPOSIT_AMOUNT);
        assertEq(aUsdt.balanceOf(address(vault)), DEPOSIT_AMOUNT);
    }

    function test_DepositEmitsEvent() public {
        vm.expectEmit(true, false, false, true, address(vault));
        emit UsdtYieldVault.Deposited(alice, DEPOSIT_AMOUNT, 999e18, 1e6);
        _deposit(alice, DEPOSIT_AMOUNT);
    }

    function test_SecondDepositorMintsShares() public {
        _deposit(alice, DEPOSIT_AMOUNT);
        uint256 shares = _deposit(bob, DEPOSIT_AMOUNT);
        assertGt(shares, 0);
        assertEq(vault.shareBalance(bob), shares);
    }

    function test_RevertWhen_DepositBelowMinimum() public {
        vm.prank(alice);
        vm.expectRevert(UsdtYieldVault.AmountBelowMinimum.selector);
        vault.deposit(1e6 - 1);
    }

    /*//////////////////////////////////////////////////////////////
                                WITHDRAW
    //////////////////////////////////////////////////////////////*/

    function test_WithdrawReturnsUsdt() public {
        uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
        uint256 balanceBefore = usdt.balanceOf(alice);

        vm.prank(alice);
        uint256 netAssets = vault.withdraw(shares);

        assertEq(netAssets, 997e6);
        assertEq(usdt.balanceOf(alice), balanceBefore + 997e6);
    }

    function test_WithdrawBurnsShares() public {
        uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);

        vm.prank(alice);
        vault.withdraw(shares);

        assertEq(vault.shareBalance(alice), 0);
        assertEq(vault.totalShares(), 0);
    }

    function test_WithdrawEmitsEvent() public {
        uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);

        vm.expectEmit(true, false, false, true, address(vault));
        emit UsdtYieldVault.Withdrawn(alice, 997e6, shares, 3e6);

        vm.prank(alice);
        vault.withdraw(shares);
    }

    function test_PartialWithdraw() public {
        uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);

        vm.prank(alice);
        vault.withdraw(shares / 2);

        assertEq(vault.shareBalance(alice), shares / 2);
    }

    function test_RevertWhen_WithdrawZeroShares() public {
        vm.prank(alice);
        vm.expectRevert(UsdtYieldVault.ZeroShares.selector);
        vault.withdraw(0);
    }

    function test_RevertWhen_WithdrawExceedsBalance() public {
        uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
        vm.prank(alice);
        vm.expectRevert(UsdtYieldVault.InsufficientShares.selector);
        vault.withdraw(shares + 1);
    }

    /*//////////////////////////////////////////////////////////////
                                  FEES
    //////////////////////////////////////////////////////////////*/

    function test_SetDepositFeeUpdatesValue() public {
        vm.prank(owner);
        vault.setDepositFee(25);
        assertEq(vault.depositFeeBps(), 25);
    }

    function test_SetDepositFeeEmitsEvent() public {
        vm.expectEmit(false, false, false, true, address(vault));
        emit UsdtYieldVault.DepositFeeUpdated(INITIAL_FEE_BPS, 25);
        vm.prank(owner);
        vault.setDepositFee(25);
    }

    function test_SetDepositFeeToZero() public {
        vm.prank(owner);
        vault.setDepositFee(0);
        uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
        assertEq(shares, 1_000e18);
    }

    function test_RevertWhen_NonOwnerSetsDepositFee() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setDepositFee(25);
    }

    /*//////////////////////////////////////////////////////////////
                                 PAUSING
    //////////////////////////////////////////////////////////////*/

    function test_PauseBlocksDeposit() public {
        vm.prank(owner);
        vault.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.deposit(DEPOSIT_AMOUNT);
    }

    function test_UnpauseRestoresDeposit() public {
        vm.startPrank(owner);
        vault.pause();
        vault.unpause();
        vm.stopPrank();

        uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
        assertEq(shares, 999e18);
    }

    function test_RevertWhen_NonOwnerPauses() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.pause();
    }

    /*//////////////////////////////////////////////////////////////
                                  VIEWS
    //////////////////////////////////////////////////////////////*/

    function test_TotalAssetsStartsAtZero() public view {
        assertEq(vault.totalAssets(), 0);
    }

    function test_SharePriceStartsAtOneUsdt() public view {
        assertEq(vault.sharePrice(), 1e6);
    }

    function test_SharePriceAfterDeposit() public {
        _deposit(alice, DEPOSIT_AMOUNT);
        assertGt(vault.sharePrice(), 0);
    }

    function test_ConvertToSharesEmptyVault() public view {
        assertEq(vault.convertToShares(1e6), 1e18);
    }

    function test_ConvertToAssetsEmptyVault() public view {
        assertEq(vault.convertToAssets(1e18), 1e6);
    }

    function test_ConvertToSharesAfterDeposit() public {
        _deposit(alice, DEPOSIT_AMOUNT);
        assertGt(vault.convertToShares(1e6), 0);
    }

    function test_ConvertToAssetsAfterDeposit() public {
        _deposit(alice, DEPOSIT_AMOUNT);
        assertGt(vault.convertToAssets(1e18), 0);
    }

    function test_BalanceOfUnderlying() public {
        _deposit(alice, DEPOSIT_AMOUNT);
        assertEq(vault.balanceOfUnderlying(alice), DEPOSIT_AMOUNT);
    }

    function test_BalanceOfUnderlyingIsZeroForNonDepositor() public view {
        assertEq(vault.balanceOfUnderlying(bob), 0);
    }
}
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

codex
The first inspection already shows the suite mostly checks assignments and “greater than zero” outcomes. I’m now testing the properties that matter for custody: whether accounting equals redeemable Aave assets after sequences, whether yield becomes claimable, whether fee configuration has a safe domain, and whether the exact mainnet USDT/Aave interaction works at a pinned block.
exec
/bin/bash -lc 'git status --short; forge test; if [ -n "${MAINNET_RPC_URL:-}" ]; then echo '"'MAINNET_RPC_URL is set'; else echo 'MAINNET_RPC_URL is not set'; fi; sed -n '1,240p' test/mocks/MockAavePool.sol; sed -n '1,180p' test/mocks/MockUSDT.sol; sed -n '1,160p' src/interfaces/IAavePool.sol" in /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
 succeeded in 109ms:
No files changed, compilation skipped
2026-09-13T15:39:39.110848Z  WARN evm::traces::external: etherscan config not found

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
Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 2.29ms (6.00ms CPU time)

Ran 1 test suite in 7.98ms (2.29ms CPU time): 39 tests passed, 0 failed, 0 skipped (39 total tests)
2026-09-13T15:39:39.121686Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
MAINNET_RPC_URL is not set
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IAavePool} from "../../src/interfaces/IAavePool.sol";

/// @notice Receipt token minted by {MockAavePool}, mirroring aUSDT.
contract MockAToken is ERC20 {
    address public immutable pool;

    constructor(address _pool) ERC20("Aave Tether USD", "aUSDT") {
        pool = _pool;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == pool, "only pool");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == pool, "only pool");
        _burn(from, amount);
    }
}

/// @notice Stand-in for the Aave V3 pool used across the test suite.
contract MockAavePool is IAavePool {
    IERC20 public immutable underlying;
    MockAToken public immutable aToken;

    constructor(address _underlying) {
        underlying = IERC20(_underlying);
        aToken = new MockAToken(address(this));
    }

    function supply(address, uint256 amount, address onBehalfOf, uint16) external override {
        underlying.transferFrom(msg.sender, address(this), amount);
        aToken.mint(onBehalfOf, amount);
    }

    function withdraw(address, uint256 amount, address to) external override returns (uint256) {
        aToken.burn(msg.sender, amount);
        underlying.transfer(to, amount);
        return amount;
    }
}
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Stand-in for USDT used across the test suite.
contract MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Minimal subset of the Aave V3 Pool interface used by the vault.
interface IAavePool {
    /// @notice Supplies an amount of underlying asset into the reserve, receiving aTokens in return.
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;

    /// @notice Withdraws an amount of underlying asset, burning the equivalent aTokens owned.
    /// @return The final amount withdrawn.
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultAdversarial.t.sol
/tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..26012ec0cb19f27e0b416081e0834a0f528136b9
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 23_000_000;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..26012ec0cb19f27e0b416081e0834a0f528136b9
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 23_000_000;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

exec
/bin/bash -lc 'forge fmt --check test/UsdtYieldVaultAdversarial.t.sol test/UsdtYieldVaultMainnetFork.t.sol; forge test --match-path test/UsdtYieldVaultAdversarial.t.sol' in /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
 exited 1 in 2566ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 1.43s
Compiler run successful!
2026-09-13T15:40:38.174938Z  WARN evm::traces::external: etherscan config not found

Ran 4 tests for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: next call did not revert as expected; counterexample: calldata=0x0ededd51000000000000000000000000000000000000000000000000000000004190ab00 args=[1100000000 [1.1e9]]] testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256) (runs: 0, μ: 0, ~: 0)
[FAIL: accrued Aave yield is unclaimable: 1000000000 != 1100000000] test_AaveYieldMustIncreaseDepositorClaim() (gas: 448241)
[FAIL: each withdrawal strands more USDT outside accounting: 1500000 != 750000] test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() (gas: 269774)
[FAIL: Aave custody != vault accounting: 501500000 != 500000000] test_WithdrawalMustNotMakeCustodyDriftFromAccounting() (gas: 250856)
Suite result: FAILED. 0 passed; 4 failed; 0 skipped; finished in 2.59ms (3.09ms CPU time)

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultInvariantTest
[FAIL: Aave custody != vault accounting: 604892290178 != 600958522427]
	[Sequence] (original: 3, shrunk: 2)
		sender=0x00000000000000000000000000000000000002a3 addr=[test/UsdtYieldVaultAdversarial.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[250]
		sender=0x0000000000000000000000000000000000000eDE addr=[test/UsdtYieldVaultAdversarial.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[20280863333308494200034030298680255786011950104249 [2.028e49]]
 invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)

╭--------------+----------+-------+---------+----------╮
| Contract     | Selector | Calls | Reverts | Discards |
+======================================================+
| VaultHandler | deposit  | 2     | 0       | 0        |
|--------------+----------+-------+---------+----------|
| VaultHandler | withdraw | 1     | 0       | 0        |
╰--------------+----------+-------+---------+----------╯

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 433.51ms (432.27ms CPU time)

Ran 2 test suites in 434.47ms (436.10ms CPU time): 0 tests passed, 5 failed, 0 skipped (5 total tests)

Failing tests:
Encountered 4 failing tests in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: next call did not revert as expected; counterexample: calldata=0x0ededd51000000000000000000000000000000000000000000000000000000004190ab00 args=[1100000000 [1.1e9]]] testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256) (runs: 0, μ: 0, ~: 0)
[FAIL: accrued Aave yield is unclaimable: 1000000000 != 1100000000] test_AaveYieldMustIncreaseDepositorClaim() (gas: 448241)
[FAIL: each withdrawal strands more USDT outside accounting: 1500000 != 750000] test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() (gas: 269774)
[FAIL: Aave custody != vault accounting: 501500000 != 500000000] test_WithdrawalMustNotMakeCustodyDriftFromAccounting() (gas: 250856)

Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultInvariantTest
[FAIL: Aave custody != vault accounting: 604892290178 != 600958522427]
	[Sequence] (original: 3, shrunk: 2)
		sender=0x00000000000000000000000000000000000002a3 addr=[test/UsdtYieldVaultAdversarial.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[250]
		sender=0x0000000000000000000000000000000000000eDE addr=[test/UsdtYieldVaultAdversarial.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[20280863333308494200034030298680255786011950104249 [2.028e49]]
 invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)

Encountered a total of 5 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 5 failed tests

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..26012ec0cb19f27e0b416081e0834a0f528136b9
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 23_000_000;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

codex
The adversarial suite is failing in four independent ways, and the stateful invariant shrank the custody divergence to a two-call sequence with zero reverts. I’m separating those into one-command reproductions now, then I’ll run the pinned mainnet fork so the sign-off distinguishes contract defects from integration assumptions.
exec
/bin/bash -lc 'MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/UsdtYieldVaultMainnetFork.t.sol -vv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
2026-09-13T15:40:53.197322Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 1907ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 883.09ms
Compiler run successful!
2026-09-13T15:40:52.810714Z  WARN evm::traces::external: etherscan config not found
2026-09-13T15:40:53.019976Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/23000000"
2026-09-13T15:40:53.174642Z ERROR sharedbackend: Failed to send/recv `basic` err=failed to get account for 0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode"},"id":6} address=0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EVM error; database error: failed to get account for 0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode"},"id":6}] test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() (gas: 0)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 363.31ms (363.05ms CPU time)
2026-09-13T15:40:53.174852Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/23000000")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)

Ran 1 test suite in 364.38ms (363.31ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EVM error; database error: failed to get account for 0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode"},"id":6}] test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() (gas: 0)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..26012ec0cb19f27e0b416081e0834a0f528136b9
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 23_000_000;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

exec
/bin/bash -lc 'MAINNET_RPC_URL=https://eth.llamarpc.com forge test --match-path test/UsdtYieldVaultMainnetFork.t.sol -vv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
 exited 1 in 620ms:
No files changed, compilation skipped
2026-09-13T15:41:06.068604Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: vm.createSelectFork: could not instantiate forked environment with provider eth.llamarpc.com; HTTP error 525 with body: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>

<title>llamarpc.com | 525: SSL handshake failed</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/main.css" />
</head>
<body>
<div id="cf-wrapper">
    <div id="cf-error-details" class="p-0">
        <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-8">
            <h1 class="inline-block sm:block sm:mb-2 font-light text-60 lg:text-4xl text-black-dark leading-tight mr-2">
                <span class="inline-block">SSL handshake failed</span>
                <span class="code-label">Error code 525</span>
            </h1>
            <div>
                Visit <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_525&utm_campaign=eth.llamarpc.com" target="_blank" rel="noopener noreferrer">cloudflare.com</a> for more information.
            </div>
            <div class="mt-3">2026-09-13 15:41:06 UTC</div>
        </header>
        <div class="my-8 bg-gradient-gray">
            <div class="w-240 lg:w-full mx-auto">
                <div class="clearfix md:px-8">
                    <div id="cf-browser-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">You</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
  
    Browser
  
  </h3>
  
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
  
</div>
                    <div id="cf-cloudflare-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_525&#38;utm_campaign=eth.llamarpc.com" target="_blank" rel="noopener noreferrer">
    <span class="cf-icon-cloud block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    </a>
  </div>
  <span class="md:block w-full truncate">Buenos Aires</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
  <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_525&utm_campaign=eth.llamarpc.com" target="_blank" rel="noopener noreferrer">
    Cloudflare
  </a>
  </h3>
  
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
  
</div>
                    <div id="cf-host-status" class="cf-error-source relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-server block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-error w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">eth.llamarpc.com</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
  
    Host
  
  </h3>
  
  <span class="leading-1.3 text-2xl text-red-error">Error</span>
  
</div>
                </div>
            </div>
        </div>

        <div class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
            <div class="clearfix">
                <div class="w-1/2 md:w-full float-left pr-6 md:pb-10 md:pr-0 leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What happened?</h2>
                    <p>Cloudflare is unable to establish an SSL connection to the origin server.</p>
                </div>
                <div class="w-1/2 md:w-full float-left leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What can I do?</h2>
                    
                <h3 class="text-15 font-semibold mb-2">If you're a visitor of this website:</h3>
                <p class="mb-6">Please try again in a few minutes.</p>

                <h3 class="text-15 font-semibold mb-2">If you're the owner of this website:</h3>
                <p><span>It appears that the SSL configuration used is not compatible with Cloudflare. This could happen for a several reasons, including no shared cipher suites.</span> <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-525/">Additional troubleshooting information here.</a></p>
                </div>
            </div>
        </div>

        <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
    <p class="text-13">
      <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">a3a8411138ee1eab</strong></span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
      <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
        Your IP:
        <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
        <span class="hidden" id="cf-footer-ip">2803:9800:b029:807d:6f11:4e1f:d4ec:529c</span>
        <span class="cf-footer-separator sm:hidden">&bull;</span>
      </span>
      <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_525&#38;utm_campaign=eth.llamarpc.com" id="brand_link" target="_blank">Cloudflare</a></span>
      
    </p>
    <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
  </div><!-- /.error-footer -->

    </div>
</div>
</body>
</html>] test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() (gas: 5334)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 489.15ms (488.89ms CPU time)

Ran 1 test suite in 489.88ms (489.15ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: vm.createSelectFork: could not instantiate forked environment with provider eth.llamarpc.com; HTTP error 525 with body: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>

<title>llamarpc.com | 525: SSL handshake failed</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/main.css" />
</head>
<body>
<div id="cf-wrapper">
    <div id="cf-error-details" class="p-0">
        <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-8">
            <h1 class="inline-block sm:block sm:mb-2 font-light text-60 lg:text-4xl text-black-dark leading-tight mr-2">
                <span class="inline-block">SSL handshake failed</span>
                <span class="code-label">Error code 525</span>
            </h1>
            <div>
                Visit <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_525&utm_campaign=eth.llamarpc.com" target="_blank" rel="noopener noreferrer">cloudflare.com</a> for more information.
            </div>
            <div class="mt-3">2026-09-13 15:41:06 UTC</div>
        </header>
        <div class="my-8 bg-gradient-gray">
            <div class="w-240 lg:w-full mx-auto">
                <div class="clearfix md:px-8">
                    <div id="cf-browser-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">You</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
  
    Browser
  
  </h3>
  
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
  
</div>
                    <div id="cf-cloudflare-status" class=" relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_525&#38;utm_campaign=eth.llamarpc.com" target="_blank" rel="noopener noreferrer">
    <span class="cf-icon-cloud block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-ok w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    </a>
  </div>
  <span class="md:block w-full truncate">Buenos Aires</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
  <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_525&utm_campaign=eth.llamarpc.com" target="_blank" rel="noopener noreferrer">
    Cloudflare
  </a>
  </h3>
  
  <span class="leading-1.3 text-2xl text-green-success">Working</span>
  
</div>
                    <div id="cf-host-status" class="cf-error-source relative w-1/3 md:w-full py-15 md:p-0 md:py-8 md:text-left md:border-solid md:border-0 md:border-b md:border-gray-400 overflow-hidden float-left md:float-none text-center">
  <div class="relative mb-10 md:m-0">
    
    <span class="cf-icon-server block md:hidden h-20 bg-center bg-no-repeat"></span>
    <span class="cf-icon-error w-12 h-12 absolute left-1/2 md:left-auto md:right-0 md:top-0 -ml-6 -bottom-4"></span>
    
  </div>
  <span class="md:block w-full truncate">eth.llamarpc.com</span>
  <h3 class="md:inline-block mt-3 md:mt-0 text-2xl text-gray-600 font-light leading-1.3">
  
    Host
  
  </h3>
  
  <span class="leading-1.3 text-2xl text-red-error">Error</span>
  
</div>
                </div>
            </div>
        </div>

        <div class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
            <div class="clearfix">
                <div class="w-1/2 md:w-full float-left pr-6 md:pb-10 md:pr-0 leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What happened?</h2>
                    <p>Cloudflare is unable to establish an SSL connection to the origin server.</p>
                </div>
                <div class="w-1/2 md:w-full float-left leading-relaxed">
                    <h2 class="text-3xl font-normal leading-1.3 mb-4">What can I do?</h2>
                    
                <h3 class="text-15 font-semibold mb-2">If you're a visitor of this website:</h3>
                <p class="mb-6">Please try again in a few minutes.</p>

                <h3 class="text-15 font-semibold mb-2">If you're the owner of this website:</h3>
                <p><span>It appears that the SSL configuration used is not compatible with Cloudflare. This could happen for a several reasons, including no shared cipher suites.</span> <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-525/">Additional troubleshooting information here.</a></p>
                </div>
            </div>
        </div>

        <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
    <p class="text-13">
      <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">a3a8411138ee1eab</strong></span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
      <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
        Your IP:
        <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
        <span class="hidden" id="cf-footer-ip">2803:9800:b029:807d:6f11:4e1f:d4ec:529c</span>
        <span class="cf-footer-separator sm:hidden">&bull;</span>
      </span>
      <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_525&#38;utm_campaign=eth.llamarpc.com" id="brand_link" target="_blank">Cloudflare</a></span>
      
    </p>
    <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
  </div><!-- /.error-footer -->

    </div>
</div>
</body>
</html>] test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() (gas: 5334)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..26012ec0cb19f27e0b416081e0834a0f528136b9
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 23_000_000;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

exec
/bin/bash -lc 'cast block-number --rpc-url https://ethereum-rpc.publicnode.com' in /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
 succeeded in 484ms:
25969475

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..26012ec0cb19f27e0b416081e0834a0f528136b9
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 23_000_000;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..220f70bcc225646f63fef169e1b16bedb5d66646
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_969_475;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..220f70bcc225646f63fef169e1b16bedb5d66646
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_969_475;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

exec
/bin/bash -lc 'MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/UsdtYieldVaultMainnetFork.t.sol -vv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
2026-09-13T15:41:38.993198Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 3071ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 889.66ms
Compiler run successful!
2026-09-13T15:41:37.452535Z  WARN evm::traces::external: etherscan config not found
2026-09-13T15:41:37.637239Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969475"

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() (gas: 1076282)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.52s (1.52s CPU time)
2026-09-13T15:41:38.974698Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969475")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)

Ran 1 test suite in 1.52s (1.52s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() (gas: 1076282)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..220f70bcc225646f63fef169e1b16bedb5d66646
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_969_475;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

exec
/bin/bash -lc 'MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-test test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3 -vvvv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
2026-09-13T15:41:52.436017Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 1591ms:
No files changed, compilation skipped
2026-09-13T15:41:50.960398Z  WARN evm::traces::external: etherscan config not found
2026-09-13T15:41:51.157165Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969475"

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
2026-09-13T15:41:52.409168Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969475")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
[FAIL: EvmError: Revert] test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() (gas: 1076282)
Traces:
  [1076282] UsdtYieldVaultMainnetForkTest::test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3()
    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::createSelectFork("<rpc url>", 25969475 [2.596e7])
    │   └─ ← [Return] 0
    ├─ [0] VM::addr(<pk>) [staticcall]
    │   └─ ← [Return] forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04]
    ├─ [0] VM::label(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], "forkDepositor")
    │   └─ ← [Return]
    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: UsdtYieldVaultMainnetForkTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
    │   └─ ← [Return] 3596 bytes of code
    ├─ [5031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::record()
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::accesses(0xdAC17F958D2ee523a2206206994597C13D831ec7) [staticcall]
    │   └─ ← [Return] [0x000000000000000000000000000000000000000000000000000000000000000a, 0x5606ca99d281707981663e6932cd3f252d478c7a68bc77ac11555749d56af581], []
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x5606ca99d281707981663e6932cd3f252d478c7a68bc77ac11555749d56af581) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ emit WARNING_UninitedSlot(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, slot: 38910904360352300986150076862341457495281991986240837258350439501423071393153 [3.891e76])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x5606ca99d281707981663e6932cd3f252d478c7a68bc77ac11555749d56af581) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x5606ca99d281707981663e6932cd3f252d478c7a68bc77ac11555749d56af581, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04]) [staticcall]
    │   └─ ← [Return] 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77]
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x5606ca99d281707981663e6932cd3f252d478c7a68bc77ac11555749d56af581, 0x0000000000000000000000000000000000000000000000000000000000000000)
    │   └─ ← [Return]
    ├─ emit SlotFound(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, fsig: 0x70a08231, keysHash: 0xb6e6fe56ba8cda2488f74847955952211fbeec7e5975192c8aac73584b5d076d, slot: 38910904360352300986150076862341457495281991986240837258350439501423071393153 [3.891e76])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x5606ca99d281707981663e6932cd3f252d478c7a68bc77ac11555749d56af581) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x5606ca99d281707981663e6932cd3f252d478c7a68bc77ac11555749d56af581, 0x000000000000000000000000000000000000000000000000000000003b9aca00)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04]) [staticcall]
    │   └─ ← [Return] 1000000000 [1e9]
    ├─ [0] VM::startPrank(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04])
    │   └─ ← [Return]
    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   ├─ emit Approval(owner: forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   └─ ← [Stop]
    └─ ← [Revert] EvmError: Revert

Backtrace:
  at UsdtYieldVaultMainnetForkTest.test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.45s (1.45s CPU time)

Ran 1 test suite in 1.46s (1.45s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() (gas: 1076282)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..220f70bcc225646f63fef169e1b16bedb5d66646
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_969_475;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e635413394e0df54a1d165d2c3102f432c3cfd5b
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_969_475;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        // Real USDT returns no ABI-encoded bool from approve, so set up the user's
+        // allowance with a low-level call and leave the vault's own call untouched.
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e635413394e0df54a1d165d2c3102f432c3cfd5b
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_969_475;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        // Real USDT returns no ABI-encoded bool from approve, so set up the user's
+        // allowance with a low-level call and leave the vault's own call untouched.
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

exec
/bin/bash -lc 'MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-test test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3 -vvvv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
2026-09-13T15:42:16.717660Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 4242ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 885.72ms
Compiler run successful!
2026-09-13T15:42:14.019485Z  WARN evm::traces::external: etherscan config not found
2026-09-13T15:42:14.448930Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969475"

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() (gas: 1140826)
2026-09-13T15:42:16.692446Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969475")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
Traces:
  [1140826] UsdtYieldVaultMainnetForkTest::test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3()
    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::createSelectFork("<rpc url>", 25969475 [2.596e7])
    │   └─ ← [Return] 0
    ├─ [0] VM::addr(<pk>) [staticcall]
    │   └─ ← [Return] forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04]
    ├─ [0] VM::label(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], "forkDepositor")
    │   └─ ← [Return]
    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: UsdtYieldVaultMainnetForkTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
    │   └─ ← [Return] 3596 bytes of code
    ├─ [5031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::record()
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::accesses(0xdAC17F958D2ee523a2206206994597C13D831ec7) [staticcall]
    │   └─ ← [Return] [0x000000000000000000000000000000000000000000000000000000000000000a, 0x5606ca99d281707981663e6932cd3f252d478c7a68bc77ac11555749d56af581], []
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x5606ca99d281707981663e6932cd3f252d478c7a68bc77ac11555749d56af581) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ emit WARNING_UninitedSlot(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, slot: 38910904360352300986150076862341457495281991986240837258350439501423071393153 [3.891e76])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x5606ca99d281707981663e6932cd3f252d478c7a68bc77ac11555749d56af581) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x5606ca99d281707981663e6932cd3f252d478c7a68bc77ac11555749d56af581, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04]) [staticcall]
    │   └─ ← [Return] 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77]
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x5606ca99d281707981663e6932cd3f252d478c7a68bc77ac11555749d56af581, 0x0000000000000000000000000000000000000000000000000000000000000000)
    │   └─ ← [Return]
    ├─ emit SlotFound(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, fsig: 0x70a08231, keysHash: 0xb6e6fe56ba8cda2488f74847955952211fbeec7e5975192c8aac73584b5d076d, slot: 38910904360352300986150076862341457495281991986240837258350439501423071393153 [3.891e76])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x5606ca99d281707981663e6932cd3f252d478c7a68bc77ac11555749d56af581) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x5606ca99d281707981663e6932cd3f252d478c7a68bc77ac11555749d56af581, 0x000000000000000000000000000000000000000000000000000000003b9aca00)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04]) [staticcall]
    │   └─ ← [Return] 1000000000 [1e9]
    ├─ [0] VM::startPrank(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04])
    │   └─ ← [Return]
    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   ├─ emit Approval(owner: forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   └─ ← [Stop]
    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
    │   ├─ [34830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
    │   │   ├─ emit Transfer(from: forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   └─ ← [Revert] EvmError: Revert
    └─ ← [Revert] EvmError: Revert

Backtrace:
  at UsdtYieldVault.deposit
  at UsdtYieldVaultMainnetForkTest.test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.67s (2.67s CPU time)

Ran 1 test suite in 2.68s (2.67s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() (gas: 1140826)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e635413394e0df54a1d165d2c3102f432c3cfd5b
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_969_475;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        // Real USDT returns no ABI-encoded bool from approve, so set up the user's
+        // allowance with a low-level call and leave the vault's own call untouched.
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

exec
/bin/bash -lc 'forge test --match-test test_WithdrawalMustNotMakeCustodyDriftFromAccounting 2>&1; forge test --match-test test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets 2>&1; forge test --match-test test_AaveYieldMustIncreaseDepositorClaim 2>&1; forge test --match-test testFuzz_DepositFeeMustStayWithinBasisPointDomain --fuzz-seed 0x1234 2>&1; forge test --match-test invariant_TrackedAssetsEqualAaveCustody --fuzz-seed 0x1234 2>&1' in /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
 exited 1 in 938ms:
No files changed, compilation skipped
2026-09-13T15:42:28.168117Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: Aave custody != vault accounting: 501500000 != 500000000] test_WithdrawalMustNotMakeCustodyDriftFromAccounting() (gas: 250856)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.37ms (214.93µs CPU time)

Ran 1 test suite in 7.47ms (1.37ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: Aave custody != vault accounting: 501500000 != 500000000] test_WithdrawalMustNotMakeCustodyDriftFromAccounting() (gas: 250856)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test
No files changed, compilation skipped
2026-09-13T15:42:28.306228Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: each withdrawal strands more USDT outside accounting: 1500000 != 750000] test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() (gas: 269774)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 932.61µs (192.86µs CPU time)

Ran 1 test suite in 7.51ms (932.61µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: each withdrawal strands more USDT outside accounting: 1500000 != 750000] test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() (gas: 269774)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test
No files changed, compilation skipped
2026-09-13T15:42:28.444042Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: accrued Aave yield is unclaimable: 1000000000 != 1100000000] test_AaveYieldMustIncreaseDepositorClaim() (gas: 448241)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.21ms (474.49µs CPU time)

Ran 1 test suite in 7.75ms (1.21ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: accrued Aave yield is unclaimable: 1000000000 != 1100000000] test_AaveYieldMustIncreaseDepositorClaim() (gas: 448241)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test
No files changed, compilation skipped
2026-09-13T15:42:28.576625Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: next call did not revert as expected; counterexample: calldata=0x0ededd51000000000000000000000000000000000000000000000000000000004190ab00 args=[1100000000 [1.1e9]]] testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256) (runs: 0, μ: 0, ~: 0)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.73ms (908.52µs CPU time)

Ran 1 test suite in 7.75ms (1.73ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: next call did not revert as expected; counterexample: calldata=0x0ededd51000000000000000000000000000000000000000000000000000000004190ab00 args=[1100000000 [1.1e9]]] testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256) (runs: 0, μ: 0, ~: 0)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test
No files changed, compilation skipped
2026-09-13T15:42:28.720000Z  WARN evm::traces::external: etherscan config not found
Warning: Replayed invariant failure from "/tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001/cache/invariant/failures/UsdtYieldVaultInvariantTest/invariant_TrackedAssetsEqualAaveCustody" file. 
Run `forge clean` or remove file to ignore failure and to continue invariant test campaign.

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultInvariantTest
[FAIL: invariant_TrackedAssetsEqualAaveCustody replay failure]
	[Sequence] (original: 2, shrunk: 2)
		sender=0x00000000000000000000000000000000000002a3 addr=[test/UsdtYieldVaultAdversarial.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[250]
		sender=0x0000000000000000000000000000000000000eDE addr=[test/UsdtYieldVaultAdversarial.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[20280863333308494200034030298680255786011950104249 [2.028e49]]
 invariant_TrackedAssetsEqualAaveCustody() (runs: 1, calls: 1, reverts: 1)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 265.27ms (264.27ms CPU time)

Ran 1 test suite in 265.97ms (265.27ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultInvariantTest
[FAIL: invariant_TrackedAssetsEqualAaveCustody replay failure]
	[Sequence] (original: 2, shrunk: 2)
		sender=0x00000000000000000000000000000000000002a3 addr=[test/UsdtYieldVaultAdversarial.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[250]
		sender=0x0000000000000000000000000000000000000eDE addr=[test/UsdtYieldVaultAdversarial.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[20280863333308494200034030298680255786011950104249 [2.028e49]]
 invariant_TrackedAssetsEqualAaveCustody() (runs: 1, calls: 1, reverts: 1)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e635413394e0df54a1d165d2c3102f432c3cfd5b
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_969_475;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        // Real USDT returns no ABI-encoded bool from approve, so set up the user's
+        // allowance with a low-level call and leave the vault's own call untouched.
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

exec
/bin/bash -lc "MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-test test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3 -vvvv 2>&1 | sed -n '/UsdtYieldVault::deposit/,/Backtrace:/p'" in /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
 succeeded in 2963ms:
    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
    │   ├─ [34830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
    │   │   ├─ emit Transfer(from: forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   └─ ← [Revert] EvmError: Revert
    └─ ← [Revert] EvmError: Revert

Backtrace:

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e635413394e0df54a1d165d2c3102f432c3cfd5b
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_969_475;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        // Real USDT returns no ABI-encoded bool from approve, so set up the user's
+        // allowance with a low-level call and leave the vault's own call untouched.
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

codex
The pinned fork found the release blocker: the very first real-USDT deposit reverts after USDT’s `approve` succeeds, because USDT returns no boolean and the vault calls it through raw `IERC20.approve`. The mock returns a standard boolean, so all 39 unit tests miss the incompatibility. I’m recording that trace plus the independent accounting failures and proposed fixes verbatim in `FINDINGS.md`.
apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001/FINDINGS.md
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..d05285ad9979f98bb119b2df869bd3010fae8b49
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,193 @@
+# UsdtYieldVault deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract on Monday.** The configured mainnet asset cannot be
+deposited at all. Independently, the vault does not account for Aave yield, every
+withdrawal creates a growing custody/accounting mismatch, and the owner-controlled
+deposit fee has no upper bound.
+
+I did not modify `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/`. All new
+tests are in `test/UsdtYieldVaultAdversarial.t.sol` and
+`test/UsdtYieldVaultMainnetFork.t.sol`.
+
+## 1. Critical: every deposit using real mainnet USDT reverts
+
+`deposit` calls `usdt.approve(...)` through the standard `IERC20` interface. Real
+USDT's `approve` succeeds but returns no ABI-encoded boolean. Solidity therefore
+reverts while decoding the missing return value, before `AavePool.supply` is ever
+called. The existing `MockUSDT` inherits OpenZeppelin ERC20 and returns `true`, so
+it cannot expose this incompatibility.
+
+The fork is pinned at Ethereum block `25,969,475` and uses exactly the USDT and
+Aave Pool addresses specified for deployment. The depositor's initial approval is
+deliberately performed by low-level call so the trace reaches the vault's own,
+unchanged approval.
+
+Command and actual output:
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-test test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3 -vvvv 2>&1 | sed -n '/UsdtYieldVault::deposit/,/Backtrace:/p'
+    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [34830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
+    │   │   ├─ emit Transfer(from: forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
+    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   └─ ← [Revert] EvmError: Revert
+    └─ ← [Revert] EvmError: Revert
+
+Backtrace:
+```
+
+### Fix
+
+Replace the raw `IERC20.approve` with OpenZeppelin `SafeERC20.forceApprove` (or a
+correct safe allowance flow that accepts empty return data). Keep this fork test
+as a release gate. Also validate at construction that the supplied aToken is the
+Aave reserve's aToken for the supplied underlying; the current constructor trusts
+three unrelated addresses.
+
+## 2. High: Aave yield is absent from all vault accounting and cannot be redeemed
+
+`totalAssets()`, conversions, share price, and withdrawals use only
+`totalAssetsStored`. That variable changes on deposit/withdrawal but never when the
+vault's aUSDT balance grows. The test models the defining aToken behavior by
+increasing the vault's aUSDT balance from 1,000 to 1,100 USDT. Alice's claim remains
+1,000 USDT.
+
+Command and actual output:
+
+```text
+$ forge test --match-test test_AaveYieldMustIncreaseDepositorClaim 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.444042Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is unclaimable: 1000000000 != 1100000000] test_AaveYieldMustIncreaseDepositorClaim() (gas: 448241)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.21ms (474.49µs CPU time)
+
+Ran 1 test suite in 7.75ms (1.21ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is unclaimable: 1000000000 != 1100000000] test_AaveYieldMustIncreaseDepositorClaim() (gas: 448241)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Use actual managed assets (normally the vault's aUSDT balance, plus any idle USDT)
+as the source of truth for share conversions and `totalAssets`, rather than a
+principal-only stored counter. Price deposits using assets before the transfer so
+new depositors cannot capture prior yield. Define and test behavior for direct
+donations and Aave loss/slashing as well as positive yield.
+
+## 3. High: withdrawal fees are permanently stranded and accounting drift grows
+
+For a withdrawal, the vault subtracts `grossAssets` from `totalAssetsStored` but
+asks Aave to return and burn only `netAssets`. The fee remains as aUSDT custody but
+is removed from accounting. Contrary to the contract comment, it therefore does
+not accrue to remaining shareholders. A 50% withdrawal from a 1,000 USDT deposit
+leaves 501.5 USDT of aUSDT but records only 500 USDT.
+
+Command and actual output:
+
+```text
+$ forge test --match-test test_WithdrawalMustNotMakeCustodyDriftFromAccounting 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.168117Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: Aave custody != vault accounting: 501500000 != 500000000] test_WithdrawalMustNotMakeCustodyDriftFromAccounting() (gas: 250856)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.37ms (214.93µs CPU time)
+
+Ran 1 test suite in 7.47ms (1.37ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: Aave custody != vault accounting: 501500000 != 500000000] test_WithdrawalMustNotMakeCustodyDriftFromAccounting() (gas: 250856)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+This is cumulative, not a one-time rounding artifact: two quarter-share
+withdrawals grow the invisible balance from 0.75 to 1.5 USDT.
+
+```text
+$ forge test --match-test test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.306228Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: each withdrawal strands more USDT outside accounting: 1500000 != 750000] test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() (gas: 269774)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 932.61µs (192.86µs CPU time)
+
+Ran 1 test suite in 7.51ms (932.61µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: each withdrawal strands more USDT outside accounting: 1500000 != 750000] test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() (gas: 269774)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Make custody the accounting source of truth. Burn shares for the gross claim,
+withdraw only the net amount, and let the retained aUSDT remain visible in total
+assets so it raises the remaining shares' price. Specify the last-share case: with
+no remaining shareholders, retained fees need an explicit beneficiary or sweep
+path instead of becoming ownerless assets.
+
+## 4. Medium: the owner can set an invalid fee above 100%
+
+Neither the constructor nor `setDepositFee` bounds the value. The fuzz test covers
+the entire invalid domain above 10,000 bps and immediately finds an accepted value.
+Once configured above 100%, `amount - fee` underflows and all deposits revert. At
+exactly 100%, deposits revert with `NoSharesMinted`.
+
+Command and actual output:
+
+```text
+$ forge test --match-test testFuzz_DepositFeeMustStayWithinBasisPointDomain --fuzz-seed 0x1234 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.576625Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x0ededd51000000000000000000000000000000000000000000000000000000004190ab00 args=[1100000000 [1.1e9]]] testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256) (runs: 0, μ: 0, ~: 0)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.73ms (908.52µs CPU time)
+
+Ran 1 test suite in 7.75ms (1.73ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x0ededd51000000000000000000000000000000000000000000000000000000004190ab00 args=[1100000000 [1.1e9]]] testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256) (runs: 0, μ: 0, ~: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Enforce a deliberate maximum fee in both the constructor and setter. It should be
+strictly below `BPS_DENOMINATOR`; a much lower governance cap is safer. Add explicit
+tests at `cap - 1`, `cap`, and `cap + 1`, plus a full-domain fuzz test.
+
+## What the original green suite established—and did not establish
+
+The original 39 tests pass, but many assert constructor arguments/constants back
+to themselves or merely assert that a computed value is greater than zero. They
+use a standards-compliant mock token, perform no pinned fork, do not model aToken
+balance growth, and do not assert accounting against custody after stateful
+sequences. Thus 100% line/function coverage executed the defective lines without
+constraining their real-world behavior.
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e635413394e0df54a1d165d2c3102f432c3cfd5b
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_969_475;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        // Real USDT returns no ABI-encoded bool from approve, so set up the user's
+        // allowance with a low-level call and leave the vault's own call untouched.
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..d05285ad9979f98bb119b2df869bd3010fae8b49
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,193 @@
+# UsdtYieldVault deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract on Monday.** The configured mainnet asset cannot be
+deposited at all. Independently, the vault does not account for Aave yield, every
+withdrawal creates a growing custody/accounting mismatch, and the owner-controlled
+deposit fee has no upper bound.
+
+I did not modify `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/`. All new
+tests are in `test/UsdtYieldVaultAdversarial.t.sol` and
+`test/UsdtYieldVaultMainnetFork.t.sol`.
+
+## 1. Critical: every deposit using real mainnet USDT reverts
+
+`deposit` calls `usdt.approve(...)` through the standard `IERC20` interface. Real
+USDT's `approve` succeeds but returns no ABI-encoded boolean. Solidity therefore
+reverts while decoding the missing return value, before `AavePool.supply` is ever
+called. The existing `MockUSDT` inherits OpenZeppelin ERC20 and returns `true`, so
+it cannot expose this incompatibility.
+
+The fork is pinned at Ethereum block `25,969,475` and uses exactly the USDT and
+Aave Pool addresses specified for deployment. The depositor's initial approval is
+deliberately performed by low-level call so the trace reaches the vault's own,
+unchanged approval.
+
+Command and actual output:
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-test test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3 -vvvv 2>&1 | sed -n '/UsdtYieldVault::deposit/,/Backtrace:/p'
+    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [34830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
+    │   │   ├─ emit Transfer(from: forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
+    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   └─ ← [Revert] EvmError: Revert
+    └─ ← [Revert] EvmError: Revert
+
+Backtrace:
+```
+
+### Fix
+
+Replace the raw `IERC20.approve` with OpenZeppelin `SafeERC20.forceApprove` (or a
+correct safe allowance flow that accepts empty return data). Keep this fork test
+as a release gate. Also validate at construction that the supplied aToken is the
+Aave reserve's aToken for the supplied underlying; the current constructor trusts
+three unrelated addresses.
+
+## 2. High: Aave yield is absent from all vault accounting and cannot be redeemed
+
+`totalAssets()`, conversions, share price, and withdrawals use only
+`totalAssetsStored`. That variable changes on deposit/withdrawal but never when the
+vault's aUSDT balance grows. The test models the defining aToken behavior by
+increasing the vault's aUSDT balance from 1,000 to 1,100 USDT. Alice's claim remains
+1,000 USDT.
+
+Command and actual output:
+
+```text
+$ forge test --match-test test_AaveYieldMustIncreaseDepositorClaim 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.444042Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is unclaimable: 1000000000 != 1100000000] test_AaveYieldMustIncreaseDepositorClaim() (gas: 448241)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.21ms (474.49µs CPU time)
+
+Ran 1 test suite in 7.75ms (1.21ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is unclaimable: 1000000000 != 1100000000] test_AaveYieldMustIncreaseDepositorClaim() (gas: 448241)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Use actual managed assets (normally the vault's aUSDT balance, plus any idle USDT)
+as the source of truth for share conversions and `totalAssets`, rather than a
+principal-only stored counter. Price deposits using assets before the transfer so
+new depositors cannot capture prior yield. Define and test behavior for direct
+donations and Aave loss/slashing as well as positive yield.
+
+## 3. High: withdrawal fees are permanently stranded and accounting drift grows
+
+For a withdrawal, the vault subtracts `grossAssets` from `totalAssetsStored` but
+asks Aave to return and burn only `netAssets`. The fee remains as aUSDT custody but
+is removed from accounting. Contrary to the contract comment, it therefore does
+not accrue to remaining shareholders. A 50% withdrawal from a 1,000 USDT deposit
+leaves 501.5 USDT of aUSDT but records only 500 USDT.
+
+Command and actual output:
+
+```text
+$ forge test --match-test test_WithdrawalMustNotMakeCustodyDriftFromAccounting 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.168117Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: Aave custody != vault accounting: 501500000 != 500000000] test_WithdrawalMustNotMakeCustodyDriftFromAccounting() (gas: 250856)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.37ms (214.93µs CPU time)
+
+Ran 1 test suite in 7.47ms (1.37ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: Aave custody != vault accounting: 501500000 != 500000000] test_WithdrawalMustNotMakeCustodyDriftFromAccounting() (gas: 250856)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+This is cumulative, not a one-time rounding artifact: two quarter-share
+withdrawals grow the invisible balance from 0.75 to 1.5 USDT.
+
+```text
+$ forge test --match-test test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.306228Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: each withdrawal strands more USDT outside accounting: 1500000 != 750000] test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() (gas: 269774)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 932.61µs (192.86µs CPU time)
+
+Ran 1 test suite in 7.51ms (932.61µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: each withdrawal strands more USDT outside accounting: 1500000 != 750000] test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() (gas: 269774)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Make custody the accounting source of truth. Burn shares for the gross claim,
+withdraw only the net amount, and let the retained aUSDT remain visible in total
+assets so it raises the remaining shares' price. Specify the last-share case: with
+no remaining shareholders, retained fees need an explicit beneficiary or sweep
+path instead of becoming ownerless assets.
+
+## 4. Medium: the owner can set an invalid fee above 100%
+
+Neither the constructor nor `setDepositFee` bounds the value. The fuzz test covers
+the entire invalid domain above 10,000 bps and immediately finds an accepted value.
+Once configured above 100%, `amount - fee` underflows and all deposits revert. At
+exactly 100%, deposits revert with `NoSharesMinted`.
+
+Command and actual output:
+
+```text
+$ forge test --match-test testFuzz_DepositFeeMustStayWithinBasisPointDomain --fuzz-seed 0x1234 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.576625Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x0ededd51000000000000000000000000000000000000000000000000000000004190ab00 args=[1100000000 [1.1e9]]] testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256) (runs: 0, μ: 0, ~: 0)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.73ms (908.52µs CPU time)
+
+Ran 1 test suite in 7.75ms (1.73ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x0ededd51000000000000000000000000000000000000000000000000000000004190ab00 args=[1100000000 [1.1e9]]] testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256) (runs: 0, μ: 0, ~: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Enforce a deliberate maximum fee in both the constructor and setter. It should be
+strictly below `BPS_DENOMINATOR`; a much lower governance cap is safer. Add explicit
+tests at `cap - 1`, `cap`, and `cap + 1`, plus a full-domain fuzz test.
+
+## What the original green suite established—and did not establish
+
+The original 39 tests pass, but many assert constructor arguments/constants back
+to themselves or merely assert that a computed value is greater than zero. They
+use a standards-compliant mock token, perform no pinned fork, do not model aToken
+balance growth, and do not assert accounting against custody after stateful
+sequences. Thus 100% line/function coverage executed the defective lines without
+constraining their real-world behavior.
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e635413394e0df54a1d165d2c3102f432c3cfd5b
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_969_475;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        // Real USDT returns no ABI-encoded bool from approve, so set up the user's
+        // allowance with a low-level call and leave the vault's own call untouched.
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

exec
/bin/bash -lc "forge fmt --check test/UsdtYieldVaultAdversarial.t.sol test/UsdtYieldVaultMainnetFork.t.sol; git status --short; git diff -- src test/UsdtYieldVault.t.sol test/mocks; sed -n '1,80p' FINDINGS.md" in /tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001
 succeeded in 13ms:
?? FINDINGS.md
?? test/UsdtYieldVaultAdversarial.t.sol
?? test/UsdtYieldVaultMainnetFork.t.sol
# UsdtYieldVault deployment findings

## Sign-off decision

**Do not deploy this contract on Monday.** The configured mainnet asset cannot be
deposited at all. Independently, the vault does not account for Aave yield, every
withdrawal creates a growing custody/accounting mismatch, and the owner-controlled
deposit fee has no upper bound.

I did not modify `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/`. All new
tests are in `test/UsdtYieldVaultAdversarial.t.sol` and
`test/UsdtYieldVaultMainnetFork.t.sol`.

## 1. Critical: every deposit using real mainnet USDT reverts

`deposit` calls `usdt.approve(...)` through the standard `IERC20` interface. Real
USDT's `approve` succeeds but returns no ABI-encoded boolean. Solidity therefore
reverts while decoding the missing return value, before `AavePool.supply` is ever
called. The existing `MockUSDT` inherits OpenZeppelin ERC20 and returns `true`, so
it cannot expose this incompatibility.

The fork is pinned at Ethereum block `25,969,475` and uses exactly the USDT and
Aave Pool addresses specified for deployment. The depositor's initial approval is
deliberately performed by low-level call so the trace reaches the vault's own,
unchanged approval.

Command and actual output:

```text
$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-test test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3 -vvvv 2>&1 | sed -n '/UsdtYieldVault::deposit/,/Backtrace:/p'
    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
    │   ├─ [34830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
    │   │   ├─ emit Transfer(from: forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   └─ ← [Revert] EvmError: Revert
    └─ ← [Revert] EvmError: Revert

Backtrace:
```

### Fix

Replace the raw `IERC20.approve` with OpenZeppelin `SafeERC20.forceApprove` (or a
correct safe allowance flow that accepts empty return data). Keep this fork test
as a release gate. Also validate at construction that the supplied aToken is the
Aave reserve's aToken for the supplied underlying; the current constructor trusts
three unrelated addresses.

## 2. High: Aave yield is absent from all vault accounting and cannot be redeemed

`totalAssets()`, conversions, share price, and withdrawals use only
`totalAssetsStored`. That variable changes on deposit/withdrawal but never when the
vault's aUSDT balance grows. The test models the defining aToken behavior by
increasing the vault's aUSDT balance from 1,000 to 1,100 USDT. Alice's claim remains
1,000 USDT.

Command and actual output:

```text
$ forge test --match-test test_AaveYieldMustIncreaseDepositorClaim 2>&1
No files changed, compilation skipped
2026-09-13T15:42:28.444042Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: accrued Aave yield is unclaimable: 1000000000 != 1100000000] test_AaveYieldMustIncreaseDepositorClaim() (gas: 448241)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.21ms (474.49µs CPU time)

Ran 1 test suite in 7.75ms (1.21ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: accrued Aave yield is unclaimable: 1000000000 != 1100000000] test_AaveYieldMustIncreaseDepositorClaim() (gas: 448241)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test
```

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..d05285ad9979f98bb119b2df869bd3010fae8b49
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,193 @@
+# UsdtYieldVault deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract on Monday.** The configured mainnet asset cannot be
+deposited at all. Independently, the vault does not account for Aave yield, every
+withdrawal creates a growing custody/accounting mismatch, and the owner-controlled
+deposit fee has no upper bound.
+
+I did not modify `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/`. All new
+tests are in `test/UsdtYieldVaultAdversarial.t.sol` and
+`test/UsdtYieldVaultMainnetFork.t.sol`.
+
+## 1. Critical: every deposit using real mainnet USDT reverts
+
+`deposit` calls `usdt.approve(...)` through the standard `IERC20` interface. Real
+USDT's `approve` succeeds but returns no ABI-encoded boolean. Solidity therefore
+reverts while decoding the missing return value, before `AavePool.supply` is ever
+called. The existing `MockUSDT` inherits OpenZeppelin ERC20 and returns `true`, so
+it cannot expose this incompatibility.
+
+The fork is pinned at Ethereum block `25,969,475` and uses exactly the USDT and
+Aave Pool addresses specified for deployment. The depositor's initial approval is
+deliberately performed by low-level call so the trace reaches the vault's own,
+unchanged approval.
+
+Command and actual output:
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-test test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3 -vvvv 2>&1 | sed -n '/UsdtYieldVault::deposit/,/Backtrace:/p'
+    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [34830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
+    │   │   ├─ emit Transfer(from: forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
+    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   └─ ← [Revert] EvmError: Revert
+    └─ ← [Revert] EvmError: Revert
+
+Backtrace:
+```
+
+### Fix
+
+Replace the raw `IERC20.approve` with OpenZeppelin `SafeERC20.forceApprove` (or a
+correct safe allowance flow that accepts empty return data). Keep this fork test
+as a release gate. Also validate at construction that the supplied aToken is the
+Aave reserve's aToken for the supplied underlying; the current constructor trusts
+three unrelated addresses.
+
+## 2. High: Aave yield is absent from all vault accounting and cannot be redeemed
+
+`totalAssets()`, conversions, share price, and withdrawals use only
+`totalAssetsStored`. That variable changes on deposit/withdrawal but never when the
+vault's aUSDT balance grows. The test models the defining aToken behavior by
+increasing the vault's aUSDT balance from 1,000 to 1,100 USDT. Alice's claim remains
+1,000 USDT.
+
+Command and actual output:
+
+```text
+$ forge test --match-test test_AaveYieldMustIncreaseDepositorClaim 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.444042Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is unclaimable: 1000000000 != 1100000000] test_AaveYieldMustIncreaseDepositorClaim() (gas: 448241)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.21ms (474.49µs CPU time)
+
+Ran 1 test suite in 7.75ms (1.21ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is unclaimable: 1000000000 != 1100000000] test_AaveYieldMustIncreaseDepositorClaim() (gas: 448241)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Use actual managed assets (normally the vault's aUSDT balance, plus any idle USDT)
+as the source of truth for share conversions and `totalAssets`, rather than a
+principal-only stored counter. Price deposits using assets before the transfer so
+new depositors cannot capture prior yield. Define and test behavior for direct
+donations and Aave loss/slashing as well as positive yield.
+
+## 3. High: withdrawal fees are permanently stranded and accounting drift grows
+
+For a withdrawal, the vault subtracts `grossAssets` from `totalAssetsStored` but
+asks Aave to return and burn only `netAssets`. The fee remains as aUSDT custody but
+is removed from accounting. Contrary to the contract comment, it therefore does
+not accrue to remaining shareholders. A 50% withdrawal from a 1,000 USDT deposit
+leaves 501.5 USDT of aUSDT but records only 500 USDT.
+
+Command and actual output:
+
+```text
+$ forge test --match-test test_WithdrawalMustNotMakeCustodyDriftFromAccounting 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.168117Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: Aave custody != vault accounting: 501500000 != 500000000] test_WithdrawalMustNotMakeCustodyDriftFromAccounting() (gas: 250856)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.37ms (214.93µs CPU time)
+
+Ran 1 test suite in 7.47ms (1.37ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: Aave custody != vault accounting: 501500000 != 500000000] test_WithdrawalMustNotMakeCustodyDriftFromAccounting() (gas: 250856)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+This is cumulative, not a one-time rounding artifact: two quarter-share
+withdrawals grow the invisible balance from 0.75 to 1.5 USDT.
+
+```text
+$ forge test --match-test test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.306228Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: each withdrawal strands more USDT outside accounting: 1500000 != 750000] test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() (gas: 269774)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 932.61µs (192.86µs CPU time)
+
+Ran 1 test suite in 7.51ms (932.61µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: each withdrawal strands more USDT outside accounting: 1500000 != 750000] test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() (gas: 269774)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Make custody the accounting source of truth. Burn shares for the gross claim,
+withdraw only the net amount, and let the retained aUSDT remain visible in total
+assets so it raises the remaining shares' price. Specify the last-share case: with
+no remaining shareholders, retained fees need an explicit beneficiary or sweep
+path instead of becoming ownerless assets.
+
+## 4. Medium: the owner can set an invalid fee above 100%
+
+Neither the constructor nor `setDepositFee` bounds the value. The fuzz test covers
+the entire invalid domain above 10,000 bps and immediately finds an accepted value.
+Once configured above 100%, `amount - fee` underflows and all deposits revert. At
+exactly 100%, deposits revert with `NoSharesMinted`.
+
+Command and actual output:
+
+```text
+$ forge test --match-test testFuzz_DepositFeeMustStayWithinBasisPointDomain --fuzz-seed 0x1234 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.576625Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x0ededd51000000000000000000000000000000000000000000000000000000004190ab00 args=[1100000000 [1.1e9]]] testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256) (runs: 0, μ: 0, ~: 0)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.73ms (908.52µs CPU time)
+
+Ran 1 test suite in 7.75ms (1.73ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x0ededd51000000000000000000000000000000000000000000000000000000004190ab00 args=[1100000000 [1.1e9]]] testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256) (runs: 0, μ: 0, ~: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Enforce a deliberate maximum fee in both the constructor and setter. It should be
+strictly below `BPS_DENOMINATOR`; a much lower governance cap is safer. Add explicit
+tests at `cap - 1`, `cap`, and `cap + 1`, plus a full-domain fuzz test.
+
+## What the original green suite established—and did not establish
+
+The original 39 tests pass, but many assert constructor arguments/constants back
+to themselves or merely assert that a computed value is greater than zero. They
+use a standards-compliant mock token, perform no pinned fork, do not model aToken
+balance growth, and do not assert accounting against custody after stateful
+sequences. Thus 100% line/function coverage executed the defective lines without
+constraining their real-world behavior.
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e635413394e0df54a1d165d2c3102f432c3cfd5b
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_969_475;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        // Real USDT returns no ABI-encoded bool from approve, so set up the user's
+        // allowance with a low-level call and leave the vault's own call untouched.
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

codex
Do not deploy this vault on Monday.

I found four reproducible issues:

- Critical: every deposit with real mainnet USDT reverts because raw `IERC20.approve` expects a boolean that USDT does not return.
- High: accrued Aave yield is excluded from depositor claims.
- High: withdrawal fees become unaccounted aUSDT, with the mismatch growing after every withdrawal.
- Medium: deposit fees are unbounded and can disable deposits.

Evidence, exact commands/output, impact, and proposed fixes are in [FINDINGS.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001/FINDINGS.md).

New evidence tests:

- [UsdtYieldVaultMainnetFork.t.sol](/tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol)
- [UsdtYieldVaultAdversarial.t.sol](/tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultAdversarial.t.sol)

The fork is pinned at block `25,969,475`. I followed the testing skill’s deployment criteria by adding a real-integration fork, full-domain fee fuzzing, custody assertions, cumulative sequence testing, and a handler-based invariant. Nothing under `src/`, the existing test file, or `test/mocks/` was changed.
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..d05285ad9979f98bb119b2df869bd3010fae8b49
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,193 @@
+# UsdtYieldVault deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract on Monday.** The configured mainnet asset cannot be
+deposited at all. Independently, the vault does not account for Aave yield, every
+withdrawal creates a growing custody/accounting mismatch, and the owner-controlled
+deposit fee has no upper bound.
+
+I did not modify `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/`. All new
+tests are in `test/UsdtYieldVaultAdversarial.t.sol` and
+`test/UsdtYieldVaultMainnetFork.t.sol`.
+
+## 1. Critical: every deposit using real mainnet USDT reverts
+
+`deposit` calls `usdt.approve(...)` through the standard `IERC20` interface. Real
+USDT's `approve` succeeds but returns no ABI-encoded boolean. Solidity therefore
+reverts while decoding the missing return value, before `AavePool.supply` is ever
+called. The existing `MockUSDT` inherits OpenZeppelin ERC20 and returns `true`, so
+it cannot expose this incompatibility.
+
+The fork is pinned at Ethereum block `25,969,475` and uses exactly the USDT and
+Aave Pool addresses specified for deployment. The depositor's initial approval is
+deliberately performed by low-level call so the trace reaches the vault's own,
+unchanged approval.
+
+Command and actual output:
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-test test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3 -vvvv 2>&1 | sed -n '/UsdtYieldVault::deposit/,/Backtrace:/p'
+    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [34830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
+    │   │   ├─ emit Transfer(from: forkDepositor: [0x48007F3103295bF95F55384ed3021Fa4835C0F04], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
+    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
+    │   │   └─ ← [Stop]
+    │   └─ ← [Revert] EvmError: Revert
+    └─ ← [Revert] EvmError: Revert
+
+Backtrace:
+```
+
+### Fix
+
+Replace the raw `IERC20.approve` with OpenZeppelin `SafeERC20.forceApprove` (or a
+correct safe allowance flow that accepts empty return data). Keep this fork test
+as a release gate. Also validate at construction that the supplied aToken is the
+Aave reserve's aToken for the supplied underlying; the current constructor trusts
+three unrelated addresses.
+
+## 2. High: Aave yield is absent from all vault accounting and cannot be redeemed
+
+`totalAssets()`, conversions, share price, and withdrawals use only
+`totalAssetsStored`. That variable changes on deposit/withdrawal but never when the
+vault's aUSDT balance grows. The test models the defining aToken behavior by
+increasing the vault's aUSDT balance from 1,000 to 1,100 USDT. Alice's claim remains
+1,000 USDT.
+
+Command and actual output:
+
+```text
+$ forge test --match-test test_AaveYieldMustIncreaseDepositorClaim 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.444042Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is unclaimable: 1000000000 != 1100000000] test_AaveYieldMustIncreaseDepositorClaim() (gas: 448241)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.21ms (474.49µs CPU time)
+
+Ran 1 test suite in 7.75ms (1.21ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is unclaimable: 1000000000 != 1100000000] test_AaveYieldMustIncreaseDepositorClaim() (gas: 448241)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Use actual managed assets (normally the vault's aUSDT balance, plus any idle USDT)
+as the source of truth for share conversions and `totalAssets`, rather than a
+principal-only stored counter. Price deposits using assets before the transfer so
+new depositors cannot capture prior yield. Define and test behavior for direct
+donations and Aave loss/slashing as well as positive yield.
+
+## 3. High: withdrawal fees are permanently stranded and accounting drift grows
+
+For a withdrawal, the vault subtracts `grossAssets` from `totalAssetsStored` but
+asks Aave to return and burn only `netAssets`. The fee remains as aUSDT custody but
+is removed from accounting. Contrary to the contract comment, it therefore does
+not accrue to remaining shareholders. A 50% withdrawal from a 1,000 USDT deposit
+leaves 501.5 USDT of aUSDT but records only 500 USDT.
+
+Command and actual output:
+
+```text
+$ forge test --match-test test_WithdrawalMustNotMakeCustodyDriftFromAccounting 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.168117Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: Aave custody != vault accounting: 501500000 != 500000000] test_WithdrawalMustNotMakeCustodyDriftFromAccounting() (gas: 250856)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.37ms (214.93µs CPU time)
+
+Ran 1 test suite in 7.47ms (1.37ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: Aave custody != vault accounting: 501500000 != 500000000] test_WithdrawalMustNotMakeCustodyDriftFromAccounting() (gas: 250856)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+This is cumulative, not a one-time rounding artifact: two quarter-share
+withdrawals grow the invisible balance from 0.75 to 1.5 USDT.
+
+```text
+$ forge test --match-test test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.306228Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: each withdrawal strands more USDT outside accounting: 1500000 != 750000] test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() (gas: 269774)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 932.61µs (192.86µs CPU time)
+
+Ran 1 test suite in 7.51ms (932.61µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: each withdrawal strands more USDT outside accounting: 1500000 != 750000] test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() (gas: 269774)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Make custody the accounting source of truth. Burn shares for the gross claim,
+withdraw only the net amount, and let the retained aUSDT remain visible in total
+assets so it raises the remaining shares' price. Specify the last-share case: with
+no remaining shareholders, retained fees need an explicit beneficiary or sweep
+path instead of becoming ownerless assets.
+
+## 4. Medium: the owner can set an invalid fee above 100%
+
+Neither the constructor nor `setDepositFee` bounds the value. The fuzz test covers
+the entire invalid domain above 10,000 bps and immediately finds an accepted value.
+Once configured above 100%, `amount - fee` underflows and all deposits revert. At
+exactly 100%, deposits revert with `NoSharesMinted`.
+
+Command and actual output:
+
+```text
+$ forge test --match-test testFuzz_DepositFeeMustStayWithinBasisPointDomain --fuzz-seed 0x1234 2>&1
+No files changed, compilation skipped
+2026-09-13T15:42:28.576625Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x0ededd51000000000000000000000000000000000000000000000000000000004190ab00 args=[1100000000 [1.1e9]]] testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256) (runs: 0, μ: 0, ~: 0)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.73ms (908.52µs CPU time)
+
+Ran 1 test suite in 7.75ms (1.73ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x0ededd51000000000000000000000000000000000000000000000000000000004190ab00 args=[1100000000 [1.1e9]]] testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256) (runs: 0, μ: 0, ~: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix
+
+Enforce a deliberate maximum fee in both the constructor and setter. It should be
+strictly below `BPS_DENOMINATOR`; a much lower governance cap is safer. Add explicit
+tests at `cap - 1`, `cap`, and `cap + 1`, plus a full-domain fuzz test.
+
+## What the original green suite established—and did not establish
+
+The original 39 tests pass, but many assert constructor arguments/constants back
+to themselves or merely assert that a computed value is greater than zero. They
+use a standards-compliant mock token, perform no pinned fork, do not model aToken
+balance growth, and do not assert accounting against custody after stateful
+sequences. Thus 100% line/function coverage executed the defective lines without
+constraining their real-world behavior.
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..02b1da0d1581ed05e8ca2df4c4a873f0c322d2b2
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,119 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {StdInvariant} from "forge-std/StdInvariant.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultFixture is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function _setUpVault(uint256 feeBps) internal {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), feeBps, owner);
+        usdt.mint(alice, 1_000_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+}
+
+contract UsdtYieldVaultAdversarialTest is VaultFixture {
+    function setUp() public {
+        _setUpVault(10);
+    }
+
+    function testFuzz_DepositFeeMustStayWithinBasisPointDomain(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_WithdrawalMustNotMakeCustodyDriftFromAccounting() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAssets() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.startPrank(alice);
+        vault.withdraw(shares / 4);
+        uint256 driftAfterOne = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vault.withdraw(shares / 4);
+        uint256 driftAfterTwo = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+        vm.stopPrank();
+
+        assertEq(driftAfterTwo, driftAfterOne, "each withdrawal strands more USDT outside accounting");
+    }
+
+    function test_AaveYieldMustIncreaseDepositorClaim() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        // Model the defining aToken behavior: its balance grows as Aave interest accrues.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), aUsdt.balanceOf(address(vault)), "accrued Aave yield is unclaimable");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = makeAddr("handlerActor");
+        usdt.mint(actor, 1_000_000_000e6);
+        vm.prank(actor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vm.prank(actor);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(seed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultInvariantTest is StdInvariant, VaultFixture {
+    VaultHandler internal handler;
+
+    function setUp() public {
+        _setUpVault(10);
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody != vault accounting");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e635413394e0df54a1d165d2c3102f432c3cfd5b
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_969_475;
+
+    function test_MainnetUsdtSupplyAndWithdrawAgainstAaveV3() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
+
+        address depositor = makeAddr("forkDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        // Real USDT returns no ABI-encoded bool from approve, so set up the user's
+        // allowance with a low-level call and leave the vault's own call untouched.
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+        uint256 shares = vault.deposit(1_000e6);
+        uint256 beforeWithdrawal = IERC20(USDT).balanceOf(depositor);
+        uint256 returned = vault.withdraw(shares);
+        vm.stopPrank();
+
+        assertEq(returned, 997e6);
+        assertEq(IERC20(USDT).balanceOf(depositor) - beforeWithdrawal, returned);
+    }
+}

tokens used
50,397
````

## final message

Do not deploy this vault on Monday.

I found four reproducible issues:

- Critical: every deposit with real mainnet USDT reverts because raw `IERC20.approve` expects a boolean that USDT does not return.
- High: accrued Aave yield is excluded from depositor claims.
- High: withdrawal fees become unaccounted aUSDT, with the mismatch growing after every withdrawal.
- Medium: deposit fees are unbounded and can disable deposits.

Evidence, exact commands/output, impact, and proposed fixes are in [FINDINGS.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001/FINDINGS.md).

New evidence tests:

- [UsdtYieldVaultMainnetFork.t.sol](/tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol)
- [UsdtYieldVaultAdversarial.t.sol](/tmp/ethskills-testing-patched-20260913/2026-09-13T153847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultAdversarial.t.sol)

The fork is pinned at block `25,969,475`. I followed the testing skill’s deployment criteria by adding a real-integration fork, full-domain fee fuzzing, custody assertions, cumulative sequence testing, and a handler-based invariant. Nothing under `src/`, the existing test file, or `test/mocks/` was changed.
