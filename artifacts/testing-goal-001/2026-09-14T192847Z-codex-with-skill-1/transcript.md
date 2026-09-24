# Executor transcript — 2026-09-14T192847Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001

## session

````text
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "/tmp" (codex_home: AbsolutePathBuf("/tmp/ethskills-eval-harness-codex"))
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0a169-5b31-7301-8866-0842838bc871
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
I’m using the `testing` skill because this is a Foundry test sufficiency and deployment-readiness review. I’ll first read its full workflow, then inspect the vault and existing suite, add only new test files, and preserve verbatim failing command output for `FINDINGS.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
 succeeded in 2ms:
exec
/bin/bash -lc "pwd && rg --files -g '"'!*cache*'"' -g '"'!out/**'"' && sed -n '1,260p' src/UsdtYieldVault.sol && sed -n '1,320p' test/UsdtYieldVault.t.sol && sed -n '1,200p' foundry.toml && git status --short" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
 succeeded in 18ms:
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
foundry.toml
TASK.md
package.json
README.md
remappings.txt
test/UsdtYieldVault.t.sol
test/mocks/MockUSDT.sol
test/mocks/MockAavePool.sol
src/interfaces/IAavePool.sol
src/UsdtYieldVault.sol
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
The initial inspection already shows why line/function coverage is misleading: most existing assertions replay constants, constructor assignments, or merely check `> 0`; none search fee bounds, multi-step accounting drift, real USDT behavior, or Aave yield reconciliation. I’m now checking the available pinned-mainnet endpoint and building focused regressions around those risk classes.
exec
/bin/bash -lc "env | cut -d= -f1 | sort | rg 'RPC|ETH|MAINNET|ALCHEMY|INFURA' || true
sed -n '1,260p' test/mocks/MockAavePool.sol
sed -n '1,180p' test/mocks/MockUSDT.sol
sed -n '1,160p' src/interfaces/IAavePool.sol
forge test" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
 succeeded in 116ms:
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
No files changed, compilation skipped
2026-09-14T19:34:18.739914Z  WARN evm::traces::external: etherscan config not found

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
Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 1.96ms (6.84ms CPU time)

Ran 1 test suite in 8.19ms (1.96ms CPU time): 39 tests passed, 0 failed, 0 skipped (39 total tests)
2026-09-14T19:34:18.750642Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

exec
/bin/bash -lc "sed -n '1,240p' README.md
sed -n '1,240p' TASK.md
command -v slither || true
command -v cast || true" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
 succeeded in 5ms:
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
/home/damu/.local/bin/slither
/home/damu/.foundry/bin/cast

exec
/bin/bash -lc 'cast block-number --rpc-url https://ethereum-rpc.publicnode.com' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
 succeeded in 590ms:
25977816

exec
/bin/bash -lc "cast call 0xdAC17F958D2ee523a2206206994597C13D831ec7 'balanceOf(address)(uint256)' 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 --block 23000000 --rpc-url https://ethereum-rpc.publicnode.com" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
 exited 1 in 562ms:
Error: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode"},"id":2}

exec
/bin/bash -lc "cast call 0xdAC17F958D2ee523a2206206994597C13D831ec7 'balanceOf(address)(uint256)' 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 --block 25977816 --rpc-url https://ethereum-rpc.publicnode.com" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
 succeeded in 564ms:
173356416 [1.733e8]

codex
A pinned block is usable on the public endpoint (`25,977,816` answered a historical USDT `eth_call`); an older archive block was explicitly rejected, so I won’t use it. The regression set will include a real-USDT/Aave fork plus deterministic accounting and fee-domain tests, each runnable independently so every finding has a small reproducible command.
apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultFindings.t.sol
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol
diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..583d566362e89410fcb448a0d45edd33d0d5e858
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,84 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function testFail_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function testFail_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function testFail_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function testFail_DepositFeeBoundaryRemainsUsable() public {
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+
+        _deposit(alice, 1_000e6);
+    }
+
+    function testFail_FuzzOwnerFeeCannotBrickDeposits(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        _deposit(alice, 1_000e6);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..19a74808ee2e3b23f69114ac6b4a4324141fcd8f
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,30 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function testFail_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+
+        vm.prank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..583d566362e89410fcb448a0d45edd33d0d5e858
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,84 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function testFail_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function testFail_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function testFail_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function testFail_DepositFeeBoundaryRemainsUsable() public {
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+
+        _deposit(alice, 1_000e6);
+    }
+
+    function testFail_FuzzOwnerFeeCannotBrickDeposits(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        _deposit(alice, 1_000e6);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..19a74808ee2e3b23f69114ac6b4a4324141fcd8f
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,30 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function testFail_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+
+        vm.prank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultFindings.t.sol
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol
diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3876073b97553ff82ef58548ff780529bd0531a3
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49318775419d7f8c93c2179359e47c1ab96b31a7
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3876073b97553ff82ef58548ff780529bd0531a3
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49318775419d7f8c93c2179359e47c1ab96b31a7
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge fmt test/UsdtYieldVaultFindings.t.sol test/UsdtYieldVaultMainnetFork.t.sol
forge test --match-contract UsdtYieldVaultFindingsTest' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
 exited 1 in 1639ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 919.76ms
Compiler run successful!
2026-09-14T19:36:10.332163Z  WARN evm::traces::external: etherscan config not found

Ran 5 tests for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
[FAIL: next call did not revert as expected; counterexample: calldata=0xda6fd608000000000000001dec188aac75412802b86fab2cb1604199ad67dca253478f60 args=[187825004115812167514781598885994099358358178135536361246560 [1.878e59]]] testFuzz_UnusableDepositFeesAreRejected(uint256) (runs: 0, μ: 0, ~: 0)
[FAIL: Aave yield is ignored: 1000000000 != 1050000000] test_AaveYieldIsReflectedInVaultAccounting() (gas: 240165)
[FAIL: next call did not revert as expected] test_DepositFeeBoundaryIsRejected() (gas: 10688)
[FAIL: first depositor owns the fee too: 1000000000 != 999000000] test_FirstDepositorActuallyPaysAdvertisedDepositFee() (gas: 233291)
[FAIL: withdrawal fees vanished from accounting: 1003000000 != 1000000001] test_TwoWithdrawalsDoNotCreateUnaccountedCustody() (gas: 363262)
Suite result: FAILED. 0 passed; 5 failed; 0 skipped; finished in 2.30ms (2.38ms CPU time)

Ran 1 test suite in 13.23ms (2.30ms CPU time): 0 tests passed, 5 failed, 0 skipped (5 total tests)

Failing tests:
Encountered 5 failing tests in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
[FAIL: next call did not revert as expected; counterexample: calldata=0xda6fd608000000000000001dec188aac75412802b86fab2cb1604199ad67dca253478f60 args=[187825004115812167514781598885994099358358178135536361246560 [1.878e59]]] testFuzz_UnusableDepositFeesAreRejected(uint256) (runs: 0, μ: 0, ~: 0)
[FAIL: Aave yield is ignored: 1000000000 != 1050000000] test_AaveYieldIsReflectedInVaultAccounting() (gas: 240165)
[FAIL: next call did not revert as expected] test_DepositFeeBoundaryIsRejected() (gas: 10688)
[FAIL: first depositor owns the fee too: 1000000000 != 999000000] test_FirstDepositorActuallyPaysAdvertisedDepositFee() (gas: 233291)
[FAIL: withdrawal fees vanished from accounting: 1003000000 != 1000000001] test_TwoWithdrawalsDoNotCreateUnaccountedCustody() (gas: 363262)

Encountered a total of 5 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 5 failed tests

diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3876073b97553ff82ef58548ff780529bd0531a3
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49318775419d7f8c93c2179359e47c1ab96b31a7
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge test --match-contract UsdtYieldVaultMainnetForkTest --match-test test_RealUsdtCanBeDepositedIntoAave -vvv' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
2026-09-14T19:36:18.715312Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 4130ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 891.30ms
Compiler run successful!
2026-09-14T19:36:16.129657Z  WARN evm::traces::external: etherscan config not found
2026-09-14T19:36:16.322237Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25977816"

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeDepositedIntoAave() (gas: 1140239)
2026-09-14T19:36:18.693881Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25977816")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
Traces:
  [1140239] UsdtYieldVaultMainnetForkTest::test_RealUsdtCanBeDepositedIntoAave()
    ├─ [0] VM::createSelectFork("<rpc url>", 25977816 [2.597e7])
    │   └─ ← [Return] 0
    ├─ [0] VM::addr(<pk>) [staticcall]
    │   └─ ← [Return] depositor: [0x1Ffc33f5E217b1CF95e713DB49Fcd86C8195666C]
    ├─ [0] VM::label(depositor: [0x1Ffc33f5E217b1CF95e713DB49Fcd86C8195666C], "depositor")
    │   └─ ← [Return]
    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: UsdtYieldVaultMainnetForkTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
    │   └─ ← [Return] 3596 bytes of code
    ├─ [5031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(depositor: [0x1Ffc33f5E217b1CF95e713DB49Fcd86C8195666C]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::record()
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(depositor: [0x1Ffc33f5E217b1CF95e713DB49Fcd86C8195666C]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::accesses(0xdAC17F958D2ee523a2206206994597C13D831ec7) [staticcall]
    │   └─ ← [Return] [0x000000000000000000000000000000000000000000000000000000000000000a, 0xe2e90b7930db7820279b881facde1bfd5c055f92dc961798b13157de5e63687d], []
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xe2e90b7930db7820279b881facde1bfd5c055f92dc961798b13157de5e63687d) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ emit WARNING_UninitedSlot(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, slot: 102634458332420203151601067259180512244481734467676682775018729023786061097085 [1.026e77])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xe2e90b7930db7820279b881facde1bfd5c055f92dc961798b13157de5e63687d) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(depositor: [0x1Ffc33f5E217b1CF95e713DB49Fcd86C8195666C]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xe2e90b7930db7820279b881facde1bfd5c055f92dc961798b13157de5e63687d, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(depositor: [0x1Ffc33f5E217b1CF95e713DB49Fcd86C8195666C]) [staticcall]
    │   └─ ← [Return] 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77]
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xe2e90b7930db7820279b881facde1bfd5c055f92dc961798b13157de5e63687d, 0x0000000000000000000000000000000000000000000000000000000000000000)
    │   └─ ← [Return]
    ├─ emit SlotFound(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, fsig: 0x70a08231, keysHash: 0x3bb6bec4197792282430db659eb88c35c4b3547c9e52eabc1445bebc201be65a, slot: 102634458332420203151601067259180512244481734467676682775018729023786061097085 [1.026e77])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xe2e90b7930db7820279b881facde1bfd5c055f92dc961798b13157de5e63687d) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xe2e90b7930db7820279b881facde1bfd5c055f92dc961798b13157de5e63687d, 0x000000000000000000000000000000000000000000000000000000003b9aca00)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(depositor: [0x1Ffc33f5E217b1CF95e713DB49Fcd86C8195666C]) [staticcall]
    │   └─ ← [Return] 1000000000 [1e9]
    ├─ [0] VM::prank(depositor: [0x1Ffc33f5E217b1CF95e713DB49Fcd86C8195666C])
    │   └─ ← [Return]
    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   ├─ emit Approval(owner: depositor: [0x1Ffc33f5E217b1CF95e713DB49Fcd86C8195666C], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   └─ ← [Stop]
    ├─ [0] VM::prank(depositor: [0x1Ffc33f5E217b1CF95e713DB49Fcd86C8195666C])
    │   └─ ← [Return]
    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
    │   ├─ [34830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(depositor: [0x1Ffc33f5E217b1CF95e713DB49Fcd86C8195666C], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
    │   │   ├─ emit Transfer(from: depositor: [0x1Ffc33f5E217b1CF95e713DB49Fcd86C8195666C], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   └─ ← [Revert] EvmError: Revert
    └─ ← [Revert] EvmError: Revert

Backtrace:
  at UsdtYieldVault.deposit
  at UsdtYieldVaultMainnetForkTest.test_RealUsdtCanBeDepositedIntoAave

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.56s (2.56s CPU time)

Ran 1 test suite in 2.57s (2.56s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeDepositedIntoAave() (gas: 1140239)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3876073b97553ff82ef58548ff780529bd0531a3
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49318775419d7f8c93c2179359e47c1ab96b31a7
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'slither .' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
 exited 1 in 97ms:
Traceback (most recent call last):
  File "/home/damu/.local/bin/slither", line 5, in <module>
    from slither.__main__ import main
ModuleNotFoundError: No module named 'slither'

diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3876073b97553ff82ef58548ff780529bd0531a3
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49318775419d7f8c93c2179359e47c1ab96b31a7
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

codex
The fork produced the decisive integration failure: real USDT’s `approve` succeeds with no return data, then the vault’s typed `IERC20.approve` call reverts while decoding that empty return, before Aave `supply` is reached. I’ve also reproduced four independent local failures: first-depositor fee bypass, accumulated withdrawal-fee/accounting drift, ignored Aave balance growth, and unrestricted unusable fee settings.
exec
/bin/bash -lc 'forge test --match-test test_FirstDepositorActuallyPaysAdvertisedDepositFee' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
exec
/bin/bash -lc 'forge test --match-test test_TwoWithdrawalsDoNotCreateUnaccountedCustody' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
exec
/bin/bash -lc 'forge test --match-test test_AaveYieldIsReflectedInVaultAccounting' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
exec
/bin/bash -lc "forge test --match-test 'test_(DepositFeeBoundaryIsRejected|Fuzz_UnusableDepositFeesAreRejected)'" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
 exited 1 in 174ms:
No files changed, compilation skipped
2026-09-14T19:36:33.856423Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
[FAIL: withdrawal fees vanished from accounting: 1003000000 != 1000000001] test_TwoWithdrawalsDoNotCreateUnaccountedCustody() (gas: 363262)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.08ms (278.40µs CPU time)

Ran 1 test suite in 8.08ms (1.08ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
[FAIL: withdrawal fees vanished from accounting: 1003000000 != 1000000001] test_TwoWithdrawalsDoNotCreateUnaccountedCustody() (gas: 363262)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

 exited 1 in 176ms:
No files changed, compilation skipped
2026-09-14T19:36:33.858350Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
[FAIL: Aave yield is ignored: 1000000000 != 1050000000] test_AaveYieldIsReflectedInVaultAccounting() (gas: 240165)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 997.02µs (161.47µs CPU time)

Ran 1 test suite in 8.52ms (997.02µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
[FAIL: Aave yield is ignored: 1000000000 != 1050000000] test_AaveYieldIsReflectedInVaultAccounting() (gas: 240165)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

 exited 1 in 177ms:
No files changed, compilation skipped
2026-09-14T19:36:33.859475Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
[FAIL: first depositor owns the fee too: 1000000000 != 999000000] test_FirstDepositorActuallyPaysAdvertisedDepositFee() (gas: 233291)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 918.63µs (144.84µs CPU time)

Ran 1 test suite in 8.80ms (918.63µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
[FAIL: first depositor owns the fee too: 1000000000 != 999000000] test_FirstDepositorActuallyPaysAdvertisedDepositFee() (gas: 233291)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

 exited 1 in 174ms:
No files changed, compilation skipped
2026-09-14T19:36:33.866353Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
[FAIL: next call did not revert as expected] test_DepositFeeBoundaryIsRejected() (gas: 10688)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 901.65µs (51.31µs CPU time)

Ran 1 test suite in 8.30ms (901.65µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
[FAIL: next call did not revert as expected] test_DepositFeeBoundaryIsRejected() (gas: 10688)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3876073b97553ff82ef58548ff780529bd0531a3
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49318775419d7f8c93c2179359e47c1ab96b31a7
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge test --match-test testFuzz_UnusableDepositFeesAreRejected' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
 exited 1 in 130ms:
No files changed, compilation skipped
2026-09-14T19:36:38.576456Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
[FAIL: next call did not revert as expected; counterexample: calldata=0xda6fd608000000000000001dec188aac75412802b86fab2cb1604199ad67dca253478f60 args=[187825004115812167514781598885994099358358178135536361246560 [1.878e59]]] testFuzz_UnusableDepositFeesAreRejected(uint256) (runs: 0, μ: 0, ~: 0)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.79ms (918.49µs CPU time)

Ran 1 test suite in 7.57ms (1.79ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
[FAIL: next call did not revert as expected; counterexample: calldata=0xda6fd608000000000000001dec188aac75412802b86fab2cb1604199ad67dca253478f60 args=[187825004115812167514781598885994099358358178135536361246560 [1.878e59]]] testFuzz_UnusableDepositFeesAreRejected(uint256) (runs: 0, μ: 0, ~: 0)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3876073b97553ff82ef58548ff780529bd0531a3
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,82 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49318775419d7f8c93c2179359e47c1ab96b31a7
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultFindings.t.sol
diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2b4ccfea4e8afbecce622f1ccf56c5f3aa18f99
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 assets) external {
+        assets = bound(assets, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vault.deposit(assets);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 balance = vault.shareBalance(address(this));
+        if (balance == 0) return;
+        shares = bound(shares, 1, balance);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
+
+contract UsdtYieldVaultAccountingInvariantTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    VaultHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new VaultHandler(vault, usdt);
+        usdt.mint(address(handler), type(uint128).max);
+        targetContract(address(handler));
+    }
+
+    function invariant_AccountingEqualsAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "accounting drifted from custody");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49318775419d7f8c93c2179359e47c1ab96b31a7
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2b4ccfea4e8afbecce622f1ccf56c5f3aa18f99
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 assets) external {
+        assets = bound(assets, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vault.deposit(assets);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 balance = vault.shareBalance(address(this));
+        if (balance == 0) return;
+        shares = bound(shares, 1, balance);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
+
+contract UsdtYieldVaultAccountingInvariantTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    VaultHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new VaultHandler(vault, usdt);
+        usdt.mint(address(handler), type(uint128).max);
+        targetContract(address(handler));
+    }
+
+    function invariant_AccountingEqualsAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "accounting drifted from custody");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49318775419d7f8c93c2179359e47c1ab96b31a7
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge fmt test/UsdtYieldVaultFindings.t.sol && forge test --match-contract UsdtYieldVaultAccountingInvariantTest -vv' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
 exited 1 in 2423ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 1.18s
Compiler run successful!
2026-09-14T19:37:00.218572Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultAccountingInvariantTest
[FAIL: accounting drifted from custody: 20546739581 != 23485099368]
	[Sequence] (original: 6, shrunk: 2)
		sender=0x000000000000000000000000000000000000079D addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[1961]
		sender=0x0000000000000000000000000000000000000141 addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[1240146030762142547955718389113744236152357902594957878309060823780220290822 [1.24e75]]
 invariant_AccountingEqualsAaveCustody() (runs: 0, calls: 0, reverts: 0)

╭--------------+----------+-------+---------+----------╮
| Contract     | Selector | Calls | Reverts | Discards |
+======================================================+
| VaultHandler | deposit  | 2     | 0       | 0        |
|--------------+----------+-------+---------+----------|
| VaultHandler | withdraw | 4     | 0       | 0        |
╰--------------+----------+-------+---------+----------╯

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 538.22ms (537.00ms CPU time)

Ran 1 test suite in 539.04ms (538.22ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultAccountingInvariantTest
[FAIL: accounting drifted from custody: 20546739581 != 23485099368]
	[Sequence] (original: 6, shrunk: 2)
		sender=0x000000000000000000000000000000000000079D addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[1961]
		sender=0x0000000000000000000000000000000000000141 addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[1240146030762142547955718389113744236152357902594957878309060823780220290822 [1.24e75]]
 invariant_AccountingEqualsAaveCustody() (runs: 0, calls: 0, reverts: 0)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2b4ccfea4e8afbecce622f1ccf56c5f3aa18f99
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 assets) external {
+        assets = bound(assets, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vault.deposit(assets);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 balance = vault.shareBalance(address(this));
+        if (balance == 0) return;
+        shares = bound(shares, 1, balance);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
+
+contract UsdtYieldVaultAccountingInvariantTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    VaultHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new VaultHandler(vault, usdt);
+        usdt.mint(address(handler), type(uint128).max);
+        targetContract(address(handler));
+    }
+
+    function invariant_AccountingEqualsAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "accounting drifted from custody");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49318775419d7f8c93c2179359e47c1ab96b31a7
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol
diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2b4ccfea4e8afbecce622f1ccf56c5f3aa18f99
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 assets) external {
+        assets = bound(assets, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vault.deposit(assets);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 balance = vault.shareBalance(address(this));
+        if (balance == 0) return;
+        shares = bound(shares, 1, balance);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
+
+contract UsdtYieldVaultAccountingInvariantTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    VaultHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new VaultHandler(vault, usdt);
+        usdt.mint(address(handler), type(uint128).max);
+        targetContract(address(handler));
+    }
+
+    function invariant_AccountingEqualsAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "accounting drifted from custody");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..022ab6f96484c4897b05c93123d347141a2c3d21
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        (bool depositSucceeded,) = address(vault).call(abi.encodeCall(vault.deposit, (1_000e6)));
+
+        assertTrue(depositSucceeded, "real USDT deposit reverted before Aave supply");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2b4ccfea4e8afbecce622f1ccf56c5f3aa18f99
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 assets) external {
+        assets = bound(assets, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vault.deposit(assets);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 balance = vault.shareBalance(address(this));
+        if (balance == 0) return;
+        shares = bound(shares, 1, balance);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
+
+contract UsdtYieldVaultAccountingInvariantTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    VaultHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new VaultHandler(vault, usdt);
+        usdt.mint(address(handler), type(uint128).max);
+        targetContract(address(handler));
+    }
+
+    function invariant_AccountingEqualsAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "accounting drifted from custody");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..022ab6f96484c4897b05c93123d347141a2c3d21
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        (bool depositSucceeded,) = address(vault).call(abi.encodeCall(vault.deposit, (1_000e6)));
+
+        assertTrue(depositSucceeded, "real USDT deposit reverted before Aave supply");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge fmt test/UsdtYieldVaultMainnetFork.t.sol && forge test --match-contract UsdtYieldVaultMainnetForkTest --match-test test_RealUsdtCanBeDepositedIntoAave' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
2026-09-14T19:37:32.089196Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 4180ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 908.17ms
Compiler run successful!
2026-09-14T19:37:29.466709Z  WARN evm::traces::external: etherscan config not found
2026-09-14T19:37:29.962227Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25977816"

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: real USDT deposit reverted before Aave supply] test_RealUsdtCanBeDepositedIntoAave() (gas: 1141223)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.61s (2.61s CPU time)
2026-09-14T19:37:32.074607Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25977816")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)

Ran 1 test suite in 2.61s (2.61s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: real USDT deposit reverted before Aave supply] test_RealUsdtCanBeDepositedIntoAave() (gas: 1141223)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2b4ccfea4e8afbecce622f1ccf56c5f3aa18f99
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 assets) external {
+        assets = bound(assets, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vault.deposit(assets);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 balance = vault.shareBalance(address(this));
+        if (balance == 0) return;
+        shares = bound(shares, 1, balance);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
+
+contract UsdtYieldVaultAccountingInvariantTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    VaultHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new VaultHandler(vault, usdt);
+        usdt.mint(address(handler), type(uint128).max);
+        targetContract(address(handler));
+    }
+
+    function invariant_AccountingEqualsAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "accounting drifted from custody");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..022ab6f96484c4897b05c93123d347141a2c3d21
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork("https://ethereum-rpc.publicnode.com", PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        (bool depositSucceeded,) = address(vault).call(abi.encodeCall(vault.deposit, (1_000e6)));
+
+        assertTrue(depositSucceeded, "real USDT deposit reverted before Aave supply");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol
diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2b4ccfea4e8afbecce622f1ccf56c5f3aa18f99
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 assets) external {
+        assets = bound(assets, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vault.deposit(assets);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 balance = vault.shareBalance(address(this));
+        if (balance == 0) return;
+        shares = bound(shares, 1, balance);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
+
+contract UsdtYieldVaultAccountingInvariantTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    VaultHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new VaultHandler(vault, usdt);
+        usdt.mint(address(handler), type(uint128).max);
+        targetContract(address(handler));
+    }
+
+    function invariant_AccountingEqualsAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "accounting drifted from custody");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24c33034a10f647d1bf54f6ea71c7fdd69b9ec78
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        (bool depositSucceeded,) = address(vault).call(abi.encodeCall(vault.deposit, (1_000e6)));
+
+        assertTrue(depositSucceeded, "real USDT deposit reverted before Aave supply");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2b4ccfea4e8afbecce622f1ccf56c5f3aa18f99
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 assets) external {
+        assets = bound(assets, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vault.deposit(assets);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 balance = vault.shareBalance(address(this));
+        if (balance == 0) return;
+        shares = bound(shares, 1, balance);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
+
+contract UsdtYieldVaultAccountingInvariantTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    VaultHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new VaultHandler(vault, usdt);
+        usdt.mint(address(handler), type(uint128).max);
+        targetContract(address(handler));
+    }
+
+    function invariant_AccountingEqualsAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "accounting drifted from custody");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24c33034a10f647d1bf54f6ea71c7fdd69b9ec78
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        (bool depositSucceeded,) = address(vault).call(abi.encodeCall(vault.deposit, (1_000e6)));
+
+        assertTrue(depositSucceeded, "real USDT deposit reverted before Aave supply");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-contract UsdtYieldVaultMainnetForkTest --match-test test_RealUsdtCanBeDepositedIntoAave' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
2026-09-14T19:37:48.008446Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 3909ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 886.46ms
Compiler run successful!
2026-09-14T19:37:45.617435Z  WARN evm::traces::external: etherscan config not found
2026-09-14T19:37:45.832470Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25977816"

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: real USDT deposit reverted before Aave supply] test_RealUsdtCanBeDepositedIntoAave() (gas: 1142124)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.37s (2.37s CPU time)
2026-09-14T19:37:47.989234Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25977816")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)

Ran 1 test suite in 2.37s (2.37s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: real USDT deposit reverted before Aave supply] test_RealUsdtCanBeDepositedIntoAave() (gas: 1142124)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2b4ccfea4e8afbecce622f1ccf56c5f3aa18f99
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 assets) external {
+        assets = bound(assets, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vault.deposit(assets);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 balance = vault.shareBalance(address(this));
+        if (balance == 0) return;
+        shares = bound(shares, 1, balance);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
+
+contract UsdtYieldVaultAccountingInvariantTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    VaultHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new VaultHandler(vault, usdt);
+        usdt.mint(address(handler), type(uint128).max);
+        targetContract(address(handler));
+    }
+
+    function invariant_AccountingEqualsAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "accounting drifted from custody");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24c33034a10f647d1bf54f6ea71c7fdd69b9ec78
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        (bool depositSucceeded,) = address(vault).call(abi.encodeCall(vault.deposit, (1_000e6)));
+
+        assertTrue(depositSucceeded, "real USDT deposit reverted before Aave supply");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

codex
The stateful handler invariant also fails and shrinks to a two-call deposit/withdraw sequence with zero handler reverts, so the accounting issue is not dependent on a hand-picked example. I’m assembling the report now with severity, impact, proposed fixes (described only), exact commands, and captured terminal output.
apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001/FINDINGS.md
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..a973e6a5f4c6192cff6a18b8fe06a404084d4154
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,235 @@
+# UsdtYieldVault deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract.** The mainnet integration cannot accept a deposit at all, and the internal accounting neither credits Aave yield nor retains withdrawal fees for the remaining shareholders as documented. The existing 39 tests use standard ERC-20/Aave mocks and mostly check assignments or weak `> 0` conditions, so their 100% line/function coverage does not exercise these properties.
+
+All added evidence is in new files under `test/`. No file under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit using real mainnet USDT reverts
+
+`deposit()` transfers the USDT into the vault and then calls `usdt.approve(...)` through the standard `IERC20` interface. Mainnet USDT's `approve` succeeds with empty return data. Solidity's typed call expects a Boolean return and reverts while decoding the empty data. The entire transaction rolls back before `aavePool.supply()`.
+
+The fork test uses the stated USDT, Aave Pool, and aUSDT addresses at pinned block `25,977,816`. Its low-level user approval deliberately accepts USDT's empty return data; the subsequent call through the unmodified vault fails.
+
+Command and verbatim output:
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-contract UsdtYieldVaultMainnetForkTest --match-test test_RealUsdtCanBeDepositedIntoAave
+stty: 'standard input': Inappropriate ioctl for device
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 886.46ms
+Compiler run successful!
+2026-09-14T19:37:45.617435Z  WARN evm::traces::external: etherscan config not found
+2026-09-14T19:37:45.832470Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25977816"
+
+Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: real USDT deposit reverted before Aave supply] test_RealUsdtCanBeDepositedIntoAave() (gas: 1142124)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.37s (2.37s CPU time)
+2026-09-14T19:37:47.989234Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25977816")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+
+Ran 1 test suite in 2.37s (2.37s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: real USDT deposit reverted before Aave supply] test_RealUsdtCanBeDepositedIntoAave() (gas: 1142124)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: replace the raw typed approval with `SafeERC20.forceApprove(address(aavePool), amount)` (or an equivalent optional-return-safe zero-then-set approval). Add the pinned mainnet fork test permanently and use an archive-capable `MAINNET_RPC_URL` when block `25,977,816` is no longer in a node's recent-state window.
+
+## 2. High — Aave yield is ignored and becomes unclaimable
+
+`totalAssets()`, conversions, share price, deposits, and withdrawals use only `totalAssetsStored`. Nothing reconciles it with the vault's growing aUSDT balance. Aave yield therefore never raises the share price and cannot be withdrawn by users. The test models the balance-based accrual semantics of aTokens by increasing the vault's aUSDT balance by 50 USDT after a 1,000 USDT deposit.
+
+Command and verbatim output:
+
+```text
+$ forge test --match-test test_AaveYieldIsReflectedInVaultAccounting
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.858350Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: Aave yield is ignored: 1000000000 != 1050000000] test_AaveYieldIsReflectedInVaultAccounting() (gas: 240165)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 997.02µs (161.47µs CPU time)
+
+Ran 1 test suite in 8.52ms (997.02µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: Aave yield is ignored: 1000000000 != 1050000000] test_AaveYieldIsReflectedInVaultAccounting() (gas: 240165)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: base asset accounting and conversions on actual recoverable custody (normally aUSDT balance plus any idle USDT), with carefully specified rounding and donation behavior. If cached accounting is retained, add an explicit, permissionless synchronization mechanism before every value-changing conversion. Test accrued yield on the pinned fork by advancing time/blocks.
+
+## 3. High — withdrawal fees disappear from accounting and become stranded
+
+On withdrawal the vault burns claims for `grossAssets`, reduces `totalAssetsStored` by the same gross amount, but asks Aave to return only `netAssets`. The fee stays as aUSDT while being removed from all accounting. It therefore does not accrue to remaining shareholders as promised. Two fee-bearing withdrawals leave 1,003,000,000 units in Aave while the vault reports 1,000,000,001 units.
+
+Command and verbatim output:
+
+```text
+$ forge test --match-test test_TwoWithdrawalsDoNotCreateUnaccountedCustody
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.856423Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: withdrawal fees vanished from accounting: 1003000000 != 1000000001] test_TwoWithdrawalsDoNotCreateUnaccountedCustody() (gas: 363262)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.08ms (278.40µs CPU time)
+
+Ran 1 test suite in 8.08ms (1.08ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: withdrawal fees vanished from accounting: 1003000000 != 1000000001] test_TwoWithdrawalsDoNotCreateUnaccountedCustody() (gas: 363262)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+The handler-driven invariant independently searches sequences rather than relying on that example. It reaches real state transitions with zero reverts and shrinks the failure to one deposit and one withdrawal:
+
+```text
+$ forge test --match-contract UsdtYieldVaultAccountingInvariantTest -vv
+stty: 'standard input': Inappropriate ioctl for device
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.18s
+Compiler run successful!
+2026-09-14T19:37:00.218572Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultAccountingInvariantTest
+[FAIL: accounting drifted from custody: 20546739581 != 23485099368]
+	[Sequence] (original: 6, shrunk: 2)
+		sender=0x000000000000000000000000000000000000079D addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[1961]
+		sender=0x0000000000000000000000000000000000000141 addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[1240146030762142547955718389113744236152357902594957878309060823780220290822 [1.24e75]]
+ invariant_AccountingEqualsAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 2     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 4     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 538.22ms (537.00ms CPU time)
+
+Ran 1 test suite in 539.04ms (538.22ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultAccountingInvariantTest
+[FAIL: accounting drifted from custody: 20546739581 != 23485099368]
+	[Sequence] (original: 6, shrunk: 2)
+		sender=0x000000000000000000000000000000000000079D addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[1961]
+		sender=0x0000000000000000000000000000000000000141 addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[1240146030762142547955718389113744236152357902594957878309060823780220290822 [1.24e75]]
+ invariant_AccountingEqualsAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: if the fee is meant to remain for current shareholders, reduce accounted assets only by `netAssets`, not `grossAssets`, and define what happens when the final shareholder exits so assets cannot remain behind with zero shares. A simpler policy is to withdraw the gross amount and transfer the fee to an explicit fee recipient. In either design, maintain an exact custody/accounting invariant and cover the last-share case.
+
+## 4. Medium — the first depositor does not pay the advertised deposit fee
+
+The first depositor receives fewer nominal shares, but owns 100% of all shares while the full gross deposit is recorded. Consequently `convertToAssets(shares)` immediately returns the entire 1,000 USDT, not the documented 999 USDT net of the 10 bps fee. Reducing the only holder's share count cannot transfer value to anyone else.
+
+Command and verbatim output:
+
+```text
+$ forge test --match-test test_FirstDepositorActuallyPaysAdvertisedDepositFee
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.859475Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: first depositor owns the fee too: 1000000000 != 999000000] test_FirstDepositorActuallyPaysAdvertisedDepositFee() (gas: 233291)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 918.63µs (144.84µs CPU time)
+
+Ran 1 test suite in 8.80ms (918.63µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: first depositor owns the fee too: 1000000000 != 999000000] test_FirstDepositorActuallyPaysAdvertisedDepositFee() (gas: 233291)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: specify the economics for an empty vault. Either waive the fee when no prior shareholders exist, route the fee to a recipient, or use a carefully reviewed virtual-share/seed-liquidity design that has an actual beneficiary. Assert asset entitlement, not just the nominal shares minted.
+
+## 5. Medium — owner-controlled fee accepts values that disable deposits
+
+Neither the constructor nor `setDepositFee()` bounds `depositFeeBps`. Exactly 10,000 bps makes every deposit calculate zero shares and revert `NoSharesMinted`; values above 10,000 generally underflow or overflow during fee math. An accidental owner transaction can silently configure a bricked vault. The exact boundary and the full unusable domain are separate tests.
+
+Commands and verbatim outputs:
+
+```text
+$ forge test --match-test test_DepositFeeBoundaryIsRejected
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.866353Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected] test_DepositFeeBoundaryIsRejected() (gas: 10688)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 901.65µs (51.31µs CPU time)
+
+Ran 1 test suite in 8.30ms (901.65µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected] test_DepositFeeBoundaryIsRejected() (gas: 10688)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+```text
+$ forge test --match-test testFuzz_UnusableDepositFeesAreRejected
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:38.576456Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0xda6fd608000000000000001dec188aac75412802b86fab2cb1604199ad67dca253478f60 args=[187825004115812167514781598885994099358358178135536361246560 [1.878e59]]] testFuzz_UnusableDepositFeesAreRejected(uint256) (runs: 0, μ: 0, ~: 0)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.79ms (918.49µs CPU time)
+
+Ran 1 test suite in 7.57ms (1.79ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0xda6fd608000000000000001dec188aac75412802b86fab2cb1604199ad67dca253478f60 args=[187825004115812167514781598885994099358358178135536361246560 [1.878e59]]] testFuzz_UnusableDepositFeesAreRejected(uint256) (runs: 0, μ: 0, ~: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: impose an explicit conservative maximum fee below 10,000 bps and enforce it in both the constructor and setter with a custom error. Keep boundary tests for the maximum valid value, first invalid value, 10,000, and values above it; fuzz the entire setter input domain.
+
+## Additional tooling note
+
+I attempted the pre-deployment static-analysis check, but the installed launcher is broken, so this is not evidence of a clean Slither run and should remain a release blocker until repaired:
+
+```text
+$ slither .
+stty: 'standard input': Inappropriate ioctl for device
+Traceback (most recent call last):
+  File "/home/damu/.local/bin/slither", line 5, in <module>
+    from slither.__main__ import main
+ModuleNotFoundError: No module named 'slither'
+```
+
diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2b4ccfea4e8afbecce622f1ccf56c5f3aa18f99
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 assets) external {
+        assets = bound(assets, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vault.deposit(assets);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 balance = vault.shareBalance(address(this));
+        if (balance == 0) return;
+        shares = bound(shares, 1, balance);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
+
+contract UsdtYieldVaultAccountingInvariantTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    VaultHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new VaultHandler(vault, usdt);
+        usdt.mint(address(handler), type(uint128).max);
+        targetContract(address(handler));
+    }
+
+    function invariant_AccountingEqualsAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "accounting drifted from custody");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24c33034a10f647d1bf54f6ea71c7fdd69b9ec78
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        (bool depositSucceeded,) = address(vault).call(abi.encodeCall(vault.deposit, (1_000e6)));
+
+        assertTrue(depositSucceeded, "real USDT deposit reverted before Aave supply");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..a973e6a5f4c6192cff6a18b8fe06a404084d4154
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,235 @@
+# UsdtYieldVault deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract.** The mainnet integration cannot accept a deposit at all, and the internal accounting neither credits Aave yield nor retains withdrawal fees for the remaining shareholders as documented. The existing 39 tests use standard ERC-20/Aave mocks and mostly check assignments or weak `> 0` conditions, so their 100% line/function coverage does not exercise these properties.
+
+All added evidence is in new files under `test/`. No file under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit using real mainnet USDT reverts
+
+`deposit()` transfers the USDT into the vault and then calls `usdt.approve(...)` through the standard `IERC20` interface. Mainnet USDT's `approve` succeeds with empty return data. Solidity's typed call expects a Boolean return and reverts while decoding the empty data. The entire transaction rolls back before `aavePool.supply()`.
+
+The fork test uses the stated USDT, Aave Pool, and aUSDT addresses at pinned block `25,977,816`. Its low-level user approval deliberately accepts USDT's empty return data; the subsequent call through the unmodified vault fails.
+
+Command and verbatim output:
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-contract UsdtYieldVaultMainnetForkTest --match-test test_RealUsdtCanBeDepositedIntoAave
+stty: 'standard input': Inappropriate ioctl for device
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 886.46ms
+Compiler run successful!
+2026-09-14T19:37:45.617435Z  WARN evm::traces::external: etherscan config not found
+2026-09-14T19:37:45.832470Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25977816"
+
+Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: real USDT deposit reverted before Aave supply] test_RealUsdtCanBeDepositedIntoAave() (gas: 1142124)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.37s (2.37s CPU time)
+2026-09-14T19:37:47.989234Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25977816")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+
+Ran 1 test suite in 2.37s (2.37s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: real USDT deposit reverted before Aave supply] test_RealUsdtCanBeDepositedIntoAave() (gas: 1142124)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: replace the raw typed approval with `SafeERC20.forceApprove(address(aavePool), amount)` (or an equivalent optional-return-safe zero-then-set approval). Add the pinned mainnet fork test permanently and use an archive-capable `MAINNET_RPC_URL` when block `25,977,816` is no longer in a node's recent-state window.
+
+## 2. High — Aave yield is ignored and becomes unclaimable
+
+`totalAssets()`, conversions, share price, deposits, and withdrawals use only `totalAssetsStored`. Nothing reconciles it with the vault's growing aUSDT balance. Aave yield therefore never raises the share price and cannot be withdrawn by users. The test models the balance-based accrual semantics of aTokens by increasing the vault's aUSDT balance by 50 USDT after a 1,000 USDT deposit.
+
+Command and verbatim output:
+
+```text
+$ forge test --match-test test_AaveYieldIsReflectedInVaultAccounting
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.858350Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: Aave yield is ignored: 1000000000 != 1050000000] test_AaveYieldIsReflectedInVaultAccounting() (gas: 240165)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 997.02µs (161.47µs CPU time)
+
+Ran 1 test suite in 8.52ms (997.02µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: Aave yield is ignored: 1000000000 != 1050000000] test_AaveYieldIsReflectedInVaultAccounting() (gas: 240165)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: base asset accounting and conversions on actual recoverable custody (normally aUSDT balance plus any idle USDT), with carefully specified rounding and donation behavior. If cached accounting is retained, add an explicit, permissionless synchronization mechanism before every value-changing conversion. Test accrued yield on the pinned fork by advancing time/blocks.
+
+## 3. High — withdrawal fees disappear from accounting and become stranded
+
+On withdrawal the vault burns claims for `grossAssets`, reduces `totalAssetsStored` by the same gross amount, but asks Aave to return only `netAssets`. The fee stays as aUSDT while being removed from all accounting. It therefore does not accrue to remaining shareholders as promised. Two fee-bearing withdrawals leave 1,003,000,000 units in Aave while the vault reports 1,000,000,001 units.
+
+Command and verbatim output:
+
+```text
+$ forge test --match-test test_TwoWithdrawalsDoNotCreateUnaccountedCustody
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.856423Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: withdrawal fees vanished from accounting: 1003000000 != 1000000001] test_TwoWithdrawalsDoNotCreateUnaccountedCustody() (gas: 363262)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.08ms (278.40µs CPU time)
+
+Ran 1 test suite in 8.08ms (1.08ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: withdrawal fees vanished from accounting: 1003000000 != 1000000001] test_TwoWithdrawalsDoNotCreateUnaccountedCustody() (gas: 363262)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+The handler-driven invariant independently searches sequences rather than relying on that example. It reaches real state transitions with zero reverts and shrinks the failure to one deposit and one withdrawal:
+
+```text
+$ forge test --match-contract UsdtYieldVaultAccountingInvariantTest -vv
+stty: 'standard input': Inappropriate ioctl for device
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.18s
+Compiler run successful!
+2026-09-14T19:37:00.218572Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultAccountingInvariantTest
+[FAIL: accounting drifted from custody: 20546739581 != 23485099368]
+	[Sequence] (original: 6, shrunk: 2)
+		sender=0x000000000000000000000000000000000000079D addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[1961]
+		sender=0x0000000000000000000000000000000000000141 addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[1240146030762142547955718389113744236152357902594957878309060823780220290822 [1.24e75]]
+ invariant_AccountingEqualsAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 2     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 4     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 538.22ms (537.00ms CPU time)
+
+Ran 1 test suite in 539.04ms (538.22ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultAccountingInvariantTest
+[FAIL: accounting drifted from custody: 20546739581 != 23485099368]
+	[Sequence] (original: 6, shrunk: 2)
+		sender=0x000000000000000000000000000000000000079D addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[1961]
+		sender=0x0000000000000000000000000000000000000141 addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[1240146030762142547955718389113744236152357902594957878309060823780220290822 [1.24e75]]
+ invariant_AccountingEqualsAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: if the fee is meant to remain for current shareholders, reduce accounted assets only by `netAssets`, not `grossAssets`, and define what happens when the final shareholder exits so assets cannot remain behind with zero shares. A simpler policy is to withdraw the gross amount and transfer the fee to an explicit fee recipient. In either design, maintain an exact custody/accounting invariant and cover the last-share case.
+
+## 4. Medium — the first depositor does not pay the advertised deposit fee
+
+The first depositor receives fewer nominal shares, but owns 100% of all shares while the full gross deposit is recorded. Consequently `convertToAssets(shares)` immediately returns the entire 1,000 USDT, not the documented 999 USDT net of the 10 bps fee. Reducing the only holder's share count cannot transfer value to anyone else.
+
+Command and verbatim output:
+
+```text
+$ forge test --match-test test_FirstDepositorActuallyPaysAdvertisedDepositFee
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.859475Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: first depositor owns the fee too: 1000000000 != 999000000] test_FirstDepositorActuallyPaysAdvertisedDepositFee() (gas: 233291)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 918.63µs (144.84µs CPU time)
+
+Ran 1 test suite in 8.80ms (918.63µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: first depositor owns the fee too: 1000000000 != 999000000] test_FirstDepositorActuallyPaysAdvertisedDepositFee() (gas: 233291)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: specify the economics for an empty vault. Either waive the fee when no prior shareholders exist, route the fee to a recipient, or use a carefully reviewed virtual-share/seed-liquidity design that has an actual beneficiary. Assert asset entitlement, not just the nominal shares minted.
+
+## 5. Medium — owner-controlled fee accepts values that disable deposits
+
+Neither the constructor nor `setDepositFee()` bounds `depositFeeBps`. Exactly 10,000 bps makes every deposit calculate zero shares and revert `NoSharesMinted`; values above 10,000 generally underflow or overflow during fee math. An accidental owner transaction can silently configure a bricked vault. The exact boundary and the full unusable domain are separate tests.
+
+Commands and verbatim outputs:
+
+```text
+$ forge test --match-test test_DepositFeeBoundaryIsRejected
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.866353Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected] test_DepositFeeBoundaryIsRejected() (gas: 10688)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 901.65µs (51.31µs CPU time)
+
+Ran 1 test suite in 8.30ms (901.65µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected] test_DepositFeeBoundaryIsRejected() (gas: 10688)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+```text
+$ forge test --match-test testFuzz_UnusableDepositFeesAreRejected
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:38.576456Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0xda6fd608000000000000001dec188aac75412802b86fab2cb1604199ad67dca253478f60 args=[187825004115812167514781598885994099358358178135536361246560 [1.878e59]]] testFuzz_UnusableDepositFeesAreRejected(uint256) (runs: 0, μ: 0, ~: 0)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.79ms (918.49µs CPU time)
+
+Ran 1 test suite in 7.57ms (1.79ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0xda6fd608000000000000001dec188aac75412802b86fab2cb1604199ad67dca253478f60 args=[187825004115812167514781598885994099358358178135536361246560 [1.878e59]]] testFuzz_UnusableDepositFeesAreRejected(uint256) (runs: 0, μ: 0, ~: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: impose an explicit conservative maximum fee below 10,000 bps and enforce it in both the constructor and setter with a custom error. Keep boundary tests for the maximum valid value, first invalid value, 10,000, and values above it; fuzz the entire setter input domain.
+
+## Additional tooling note
+
+I attempted the pre-deployment static-analysis check, but the installed launcher is broken, so this is not evidence of a clean Slither run and should remain a release blocker until repaired:
+
+```text
+$ slither .
+stty: 'standard input': Inappropriate ioctl for device
+Traceback (most recent call last):
+  File "/home/damu/.local/bin/slither", line 5, in <module>
+    from slither.__main__ import main
+ModuleNotFoundError: No module named 'slither'
+```
+
diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2b4ccfea4e8afbecce622f1ccf56c5f3aa18f99
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 assets) external {
+        assets = bound(assets, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vault.deposit(assets);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 balance = vault.shareBalance(address(this));
+        if (balance == 0) return;
+        shares = bound(shares, 1, balance);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
+
+contract UsdtYieldVaultAccountingInvariantTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    VaultHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new VaultHandler(vault, usdt);
+        usdt.mint(address(handler), type(uint128).max);
+        targetContract(address(handler));
+    }
+
+    function invariant_AccountingEqualsAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "accounting drifted from custody");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24c33034a10f647d1bf54f6ea71c7fdd69b9ec78
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        (bool depositSucceeded,) = address(vault).call(abi.encodeCall(vault.deposit, (1_000e6)));
+
+        assertTrue(depositSucceeded, "real USDT deposit reverted before Aave supply");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc "git status --short
git diff -- src test/UsdtYieldVault.t.sol test/mocks
git diff --check
rg -n '"'^## |''^# '"' FINDINGS.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001
 succeeded in 0ms:
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..a973e6a5f4c6192cff6a18b8fe06a404084d4154
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,235 @@
+# UsdtYieldVault deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract.** The mainnet integration cannot accept a deposit at all, and the internal accounting neither credits Aave yield nor retains withdrawal fees for the remaining shareholders as documented. The existing 39 tests use standard ERC-20/Aave mocks and mostly check assignments or weak `> 0` conditions, so their 100% line/function coverage does not exercise these properties.
+
+All added evidence is in new files under `test/`. No file under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit using real mainnet USDT reverts
+
+`deposit()` transfers the USDT into the vault and then calls `usdt.approve(...)` through the standard `IERC20` interface. Mainnet USDT's `approve` succeeds with empty return data. Solidity's typed call expects a Boolean return and reverts while decoding the empty data. The entire transaction rolls back before `aavePool.supply()`.
+
+The fork test uses the stated USDT, Aave Pool, and aUSDT addresses at pinned block `25,977,816`. Its low-level user approval deliberately accepts USDT's empty return data; the subsequent call through the unmodified vault fails.
+
+Command and verbatim output:
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-contract UsdtYieldVaultMainnetForkTest --match-test test_RealUsdtCanBeDepositedIntoAave
+stty: 'standard input': Inappropriate ioctl for device
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 886.46ms
+Compiler run successful!
+2026-09-14T19:37:45.617435Z  WARN evm::traces::external: etherscan config not found
+2026-09-14T19:37:45.832470Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25977816"
+
+Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: real USDT deposit reverted before Aave supply] test_RealUsdtCanBeDepositedIntoAave() (gas: 1142124)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.37s (2.37s CPU time)
+2026-09-14T19:37:47.989234Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25977816")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+
+Ran 1 test suite in 2.37s (2.37s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: real USDT deposit reverted before Aave supply] test_RealUsdtCanBeDepositedIntoAave() (gas: 1142124)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: replace the raw typed approval with `SafeERC20.forceApprove(address(aavePool), amount)` (or an equivalent optional-return-safe zero-then-set approval). Add the pinned mainnet fork test permanently and use an archive-capable `MAINNET_RPC_URL` when block `25,977,816` is no longer in a node's recent-state window.
+
+## 2. High — Aave yield is ignored and becomes unclaimable
+
+`totalAssets()`, conversions, share price, deposits, and withdrawals use only `totalAssetsStored`. Nothing reconciles it with the vault's growing aUSDT balance. Aave yield therefore never raises the share price and cannot be withdrawn by users. The test models the balance-based accrual semantics of aTokens by increasing the vault's aUSDT balance by 50 USDT after a 1,000 USDT deposit.
+
+Command and verbatim output:
+
+```text
+$ forge test --match-test test_AaveYieldIsReflectedInVaultAccounting
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.858350Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: Aave yield is ignored: 1000000000 != 1050000000] test_AaveYieldIsReflectedInVaultAccounting() (gas: 240165)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 997.02µs (161.47µs CPU time)
+
+Ran 1 test suite in 8.52ms (997.02µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: Aave yield is ignored: 1000000000 != 1050000000] test_AaveYieldIsReflectedInVaultAccounting() (gas: 240165)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: base asset accounting and conversions on actual recoverable custody (normally aUSDT balance plus any idle USDT), with carefully specified rounding and donation behavior. If cached accounting is retained, add an explicit, permissionless synchronization mechanism before every value-changing conversion. Test accrued yield on the pinned fork by advancing time/blocks.
+
+## 3. High — withdrawal fees disappear from accounting and become stranded
+
+On withdrawal the vault burns claims for `grossAssets`, reduces `totalAssetsStored` by the same gross amount, but asks Aave to return only `netAssets`. The fee stays as aUSDT while being removed from all accounting. It therefore does not accrue to remaining shareholders as promised. Two fee-bearing withdrawals leave 1,003,000,000 units in Aave while the vault reports 1,000,000,001 units.
+
+Command and verbatim output:
+
+```text
+$ forge test --match-test test_TwoWithdrawalsDoNotCreateUnaccountedCustody
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.856423Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: withdrawal fees vanished from accounting: 1003000000 != 1000000001] test_TwoWithdrawalsDoNotCreateUnaccountedCustody() (gas: 363262)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.08ms (278.40µs CPU time)
+
+Ran 1 test suite in 8.08ms (1.08ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: withdrawal fees vanished from accounting: 1003000000 != 1000000001] test_TwoWithdrawalsDoNotCreateUnaccountedCustody() (gas: 363262)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+The handler-driven invariant independently searches sequences rather than relying on that example. It reaches real state transitions with zero reverts and shrinks the failure to one deposit and one withdrawal:
+
+```text
+$ forge test --match-contract UsdtYieldVaultAccountingInvariantTest -vv
+stty: 'standard input': Inappropriate ioctl for device
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.18s
+Compiler run successful!
+2026-09-14T19:37:00.218572Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultAccountingInvariantTest
+[FAIL: accounting drifted from custody: 20546739581 != 23485099368]
+	[Sequence] (original: 6, shrunk: 2)
+		sender=0x000000000000000000000000000000000000079D addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[1961]
+		sender=0x0000000000000000000000000000000000000141 addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[1240146030762142547955718389113744236152357902594957878309060823780220290822 [1.24e75]]
+ invariant_AccountingEqualsAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 2     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 4     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 538.22ms (537.00ms CPU time)
+
+Ran 1 test suite in 539.04ms (538.22ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultAccountingInvariantTest
+[FAIL: accounting drifted from custody: 20546739581 != 23485099368]
+	[Sequence] (original: 6, shrunk: 2)
+		sender=0x000000000000000000000000000000000000079D addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[1961]
+		sender=0x0000000000000000000000000000000000000141 addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[1240146030762142547955718389113744236152357902594957878309060823780220290822 [1.24e75]]
+ invariant_AccountingEqualsAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: if the fee is meant to remain for current shareholders, reduce accounted assets only by `netAssets`, not `grossAssets`, and define what happens when the final shareholder exits so assets cannot remain behind with zero shares. A simpler policy is to withdraw the gross amount and transfer the fee to an explicit fee recipient. In either design, maintain an exact custody/accounting invariant and cover the last-share case.
+
+## 4. Medium — the first depositor does not pay the advertised deposit fee
+
+The first depositor receives fewer nominal shares, but owns 100% of all shares while the full gross deposit is recorded. Consequently `convertToAssets(shares)` immediately returns the entire 1,000 USDT, not the documented 999 USDT net of the 10 bps fee. Reducing the only holder's share count cannot transfer value to anyone else.
+
+Command and verbatim output:
+
+```text
+$ forge test --match-test test_FirstDepositorActuallyPaysAdvertisedDepositFee
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.859475Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: first depositor owns the fee too: 1000000000 != 999000000] test_FirstDepositorActuallyPaysAdvertisedDepositFee() (gas: 233291)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 918.63µs (144.84µs CPU time)
+
+Ran 1 test suite in 8.80ms (918.63µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: first depositor owns the fee too: 1000000000 != 999000000] test_FirstDepositorActuallyPaysAdvertisedDepositFee() (gas: 233291)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: specify the economics for an empty vault. Either waive the fee when no prior shareholders exist, route the fee to a recipient, or use a carefully reviewed virtual-share/seed-liquidity design that has an actual beneficiary. Assert asset entitlement, not just the nominal shares minted.
+
+## 5. Medium — owner-controlled fee accepts values that disable deposits
+
+Neither the constructor nor `setDepositFee()` bounds `depositFeeBps`. Exactly 10,000 bps makes every deposit calculate zero shares and revert `NoSharesMinted`; values above 10,000 generally underflow or overflow during fee math. An accidental owner transaction can silently configure a bricked vault. The exact boundary and the full unusable domain are separate tests.
+
+Commands and verbatim outputs:
+
+```text
+$ forge test --match-test test_DepositFeeBoundaryIsRejected
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.866353Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected] test_DepositFeeBoundaryIsRejected() (gas: 10688)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 901.65µs (51.31µs CPU time)
+
+Ran 1 test suite in 8.30ms (901.65µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected] test_DepositFeeBoundaryIsRejected() (gas: 10688)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+```text
+$ forge test --match-test testFuzz_UnusableDepositFeesAreRejected
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:38.576456Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0xda6fd608000000000000001dec188aac75412802b86fab2cb1604199ad67dca253478f60 args=[187825004115812167514781598885994099358358178135536361246560 [1.878e59]]] testFuzz_UnusableDepositFeesAreRejected(uint256) (runs: 0, μ: 0, ~: 0)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.79ms (918.49µs CPU time)
+
+Ran 1 test suite in 7.57ms (1.79ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0xda6fd608000000000000001dec188aac75412802b86fab2cb1604199ad67dca253478f60 args=[187825004115812167514781598885994099358358178135536361246560 [1.878e59]]] testFuzz_UnusableDepositFeesAreRejected(uint256) (runs: 0, μ: 0, ~: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: impose an explicit conservative maximum fee below 10,000 bps and enforce it in both the constructor and setter with a custom error. Keep boundary tests for the maximum valid value, first invalid value, 10,000, and values above it; fuzz the entire setter input domain.
+
+## Additional tooling note
+
+I attempted the pre-deployment static-analysis check, but the installed launcher is broken, so this is not evidence of a clean Slither run and should remain a release blocker until repaired:
+
+```text
+$ slither .
+stty: 'standard input': Inappropriate ioctl for device
+Traceback (most recent call last):
+  File "/home/damu/.local/bin/slither", line 5, in <module>
+    from slither.__main__ import main
+ModuleNotFoundError: No module named 'slither'
+```
+
diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2b4ccfea4e8afbecce622f1ccf56c5f3aa18f99
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 assets) external {
+        assets = bound(assets, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vault.deposit(assets);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 balance = vault.shareBalance(address(this));
+        if (balance == 0) return;
+        shares = bound(shares, 1, balance);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
+
+contract UsdtYieldVaultAccountingInvariantTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    VaultHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new VaultHandler(vault, usdt);
+        usdt.mint(address(handler), type(uint128).max);
+        targetContract(address(handler));
+    }
+
+    function invariant_AccountingEqualsAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "accounting drifted from custody");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24c33034a10f647d1bf54f6ea71c7fdd69b9ec78
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        (bool depositSucceeded,) = address(vault).call(abi.encodeCall(vault.deposit, (1_000e6)));
+
+        assertTrue(depositSucceeded, "real USDT deposit reverted before Aave supply");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

codex
Do not ship this vault on Monday.

I added:

- [FINDINGS.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001/FINDINGS.md)
- [UsdtYieldVaultFindings.t.sol](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultFindings.t.sol)
- [UsdtYieldVaultMainnetFork.t.sol](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol)

The evidence demonstrates five defects:

- Critical: deposits revert against real mainnet USDT because its `approve` returns no data.
- High: Aave yield is excluded from vault accounting and cannot be redeemed.
- High: withdrawal fees disappear from accounting and become stranded.
- Medium: the first depositor does not actually pay the advertised deposit fee.
- Medium: unrestricted owner fee configuration can disable all deposits.

A handler-driven invariant independently found the custody/accounting divergence with zero handler reverts. The report contains the exact commands and captured failing outputs for every finding, plus proposed fixes without applying them.

No existing source, test, or mock file was changed. Slither could not run because the installed Python package is broken; the report records that as an unresolved release blocker.
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..a973e6a5f4c6192cff6a18b8fe06a404084d4154
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,235 @@
+# UsdtYieldVault deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract.** The mainnet integration cannot accept a deposit at all, and the internal accounting neither credits Aave yield nor retains withdrawal fees for the remaining shareholders as documented. The existing 39 tests use standard ERC-20/Aave mocks and mostly check assignments or weak `> 0` conditions, so their 100% line/function coverage does not exercise these properties.
+
+All added evidence is in new files under `test/`. No file under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit using real mainnet USDT reverts
+
+`deposit()` transfers the USDT into the vault and then calls `usdt.approve(...)` through the standard `IERC20` interface. Mainnet USDT's `approve` succeeds with empty return data. Solidity's typed call expects a Boolean return and reverts while decoding the empty data. The entire transaction rolls back before `aavePool.supply()`.
+
+The fork test uses the stated USDT, Aave Pool, and aUSDT addresses at pinned block `25,977,816`. Its low-level user approval deliberately accepts USDT's empty return data; the subsequent call through the unmodified vault fails.
+
+Command and verbatim output:
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-contract UsdtYieldVaultMainnetForkTest --match-test test_RealUsdtCanBeDepositedIntoAave
+stty: 'standard input': Inappropriate ioctl for device
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 886.46ms
+Compiler run successful!
+2026-09-14T19:37:45.617435Z  WARN evm::traces::external: etherscan config not found
+2026-09-14T19:37:45.832470Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25977816"
+
+Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: real USDT deposit reverted before Aave supply] test_RealUsdtCanBeDepositedIntoAave() (gas: 1142124)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.37s (2.37s CPU time)
+2026-09-14T19:37:47.989234Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25977816")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+
+Ran 1 test suite in 2.37s (2.37s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: real USDT deposit reverted before Aave supply] test_RealUsdtCanBeDepositedIntoAave() (gas: 1142124)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: replace the raw typed approval with `SafeERC20.forceApprove(address(aavePool), amount)` (or an equivalent optional-return-safe zero-then-set approval). Add the pinned mainnet fork test permanently and use an archive-capable `MAINNET_RPC_URL` when block `25,977,816` is no longer in a node's recent-state window.
+
+## 2. High — Aave yield is ignored and becomes unclaimable
+
+`totalAssets()`, conversions, share price, deposits, and withdrawals use only `totalAssetsStored`. Nothing reconciles it with the vault's growing aUSDT balance. Aave yield therefore never raises the share price and cannot be withdrawn by users. The test models the balance-based accrual semantics of aTokens by increasing the vault's aUSDT balance by 50 USDT after a 1,000 USDT deposit.
+
+Command and verbatim output:
+
+```text
+$ forge test --match-test test_AaveYieldIsReflectedInVaultAccounting
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.858350Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: Aave yield is ignored: 1000000000 != 1050000000] test_AaveYieldIsReflectedInVaultAccounting() (gas: 240165)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 997.02µs (161.47µs CPU time)
+
+Ran 1 test suite in 8.52ms (997.02µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: Aave yield is ignored: 1000000000 != 1050000000] test_AaveYieldIsReflectedInVaultAccounting() (gas: 240165)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: base asset accounting and conversions on actual recoverable custody (normally aUSDT balance plus any idle USDT), with carefully specified rounding and donation behavior. If cached accounting is retained, add an explicit, permissionless synchronization mechanism before every value-changing conversion. Test accrued yield on the pinned fork by advancing time/blocks.
+
+## 3. High — withdrawal fees disappear from accounting and become stranded
+
+On withdrawal the vault burns claims for `grossAssets`, reduces `totalAssetsStored` by the same gross amount, but asks Aave to return only `netAssets`. The fee stays as aUSDT while being removed from all accounting. It therefore does not accrue to remaining shareholders as promised. Two fee-bearing withdrawals leave 1,003,000,000 units in Aave while the vault reports 1,000,000,001 units.
+
+Command and verbatim output:
+
+```text
+$ forge test --match-test test_TwoWithdrawalsDoNotCreateUnaccountedCustody
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.856423Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: withdrawal fees vanished from accounting: 1003000000 != 1000000001] test_TwoWithdrawalsDoNotCreateUnaccountedCustody() (gas: 363262)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.08ms (278.40µs CPU time)
+
+Ran 1 test suite in 8.08ms (1.08ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: withdrawal fees vanished from accounting: 1003000000 != 1000000001] test_TwoWithdrawalsDoNotCreateUnaccountedCustody() (gas: 363262)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+The handler-driven invariant independently searches sequences rather than relying on that example. It reaches real state transitions with zero reverts and shrinks the failure to one deposit and one withdrawal:
+
+```text
+$ forge test --match-contract UsdtYieldVaultAccountingInvariantTest -vv
+stty: 'standard input': Inappropriate ioctl for device
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.18s
+Compiler run successful!
+2026-09-14T19:37:00.218572Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultAccountingInvariantTest
+[FAIL: accounting drifted from custody: 20546739581 != 23485099368]
+	[Sequence] (original: 6, shrunk: 2)
+		sender=0x000000000000000000000000000000000000079D addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[1961]
+		sender=0x0000000000000000000000000000000000000141 addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[1240146030762142547955718389113744236152357902594957878309060823780220290822 [1.24e75]]
+ invariant_AccountingEqualsAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 2     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 4     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 538.22ms (537.00ms CPU time)
+
+Ran 1 test suite in 539.04ms (538.22ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultAccountingInvariantTest
+[FAIL: accounting drifted from custody: 20546739581 != 23485099368]
+	[Sequence] (original: 6, shrunk: 2)
+		sender=0x000000000000000000000000000000000000079D addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[1961]
+		sender=0x0000000000000000000000000000000000000141 addr=[test/UsdtYieldVaultFindings.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[1240146030762142547955718389113744236152357902594957878309060823780220290822 [1.24e75]]
+ invariant_AccountingEqualsAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: if the fee is meant to remain for current shareholders, reduce accounted assets only by `netAssets`, not `grossAssets`, and define what happens when the final shareholder exits so assets cannot remain behind with zero shares. A simpler policy is to withdraw the gross amount and transfer the fee to an explicit fee recipient. In either design, maintain an exact custody/accounting invariant and cover the last-share case.
+
+## 4. Medium — the first depositor does not pay the advertised deposit fee
+
+The first depositor receives fewer nominal shares, but owns 100% of all shares while the full gross deposit is recorded. Consequently `convertToAssets(shares)` immediately returns the entire 1,000 USDT, not the documented 999 USDT net of the 10 bps fee. Reducing the only holder's share count cannot transfer value to anyone else.
+
+Command and verbatim output:
+
+```text
+$ forge test --match-test test_FirstDepositorActuallyPaysAdvertisedDepositFee
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.859475Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: first depositor owns the fee too: 1000000000 != 999000000] test_FirstDepositorActuallyPaysAdvertisedDepositFee() (gas: 233291)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 918.63µs (144.84µs CPU time)
+
+Ran 1 test suite in 8.80ms (918.63µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: first depositor owns the fee too: 1000000000 != 999000000] test_FirstDepositorActuallyPaysAdvertisedDepositFee() (gas: 233291)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: specify the economics for an empty vault. Either waive the fee when no prior shareholders exist, route the fee to a recipient, or use a carefully reviewed virtual-share/seed-liquidity design that has an actual beneficiary. Assert asset entitlement, not just the nominal shares minted.
+
+## 5. Medium — owner-controlled fee accepts values that disable deposits
+
+Neither the constructor nor `setDepositFee()` bounds `depositFeeBps`. Exactly 10,000 bps makes every deposit calculate zero shares and revert `NoSharesMinted`; values above 10,000 generally underflow or overflow during fee math. An accidental owner transaction can silently configure a bricked vault. The exact boundary and the full unusable domain are separate tests.
+
+Commands and verbatim outputs:
+
+```text
+$ forge test --match-test test_DepositFeeBoundaryIsRejected
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:33.866353Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected] test_DepositFeeBoundaryIsRejected() (gas: 10688)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 901.65µs (51.31µs CPU time)
+
+Ran 1 test suite in 8.30ms (901.65µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected] test_DepositFeeBoundaryIsRejected() (gas: 10688)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+```text
+$ forge test --match-test testFuzz_UnusableDepositFeesAreRejected
+stty: 'standard input': Inappropriate ioctl for device
+No files changed, compilation skipped
+2026-09-14T19:36:38.576456Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0xda6fd608000000000000001dec188aac75412802b86fab2cb1604199ad67dca253478f60 args=[187825004115812167514781598885994099358358178135536361246560 [1.878e59]]] testFuzz_UnusableDepositFeesAreRejected(uint256) (runs: 0, μ: 0, ~: 0)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.79ms (918.49µs CPU time)
+
+Ran 1 test suite in 7.57ms (1.79ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultFindings.t.sol:UsdtYieldVaultFindingsTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0xda6fd608000000000000001dec188aac75412802b86fab2cb1604199ad67dca253478f60 args=[187825004115812167514781598885994099358358178135536361246560 [1.878e59]]] testFuzz_UnusableDepositFeesAreRejected(uint256) (runs: 0, μ: 0, ~: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+Fix: impose an explicit conservative maximum fee below 10,000 bps and enforce it in both the constructor and setter with a custom error. Keep boundary tests for the maximum valid value, first invalid value, 10,000, and values above it; fuzz the entire setter input domain.
+
+## Additional tooling note
+
+I attempted the pre-deployment static-analysis check, but the installed launcher is broken, so this is not evidence of a clean Slither run and should remain a release blocker until repaired:
+
+```text
+$ slither .
+stty: 'standard input': Inappropriate ioctl for device
+Traceback (most recent call last):
+  File "/home/damu/.local/bin/slither", line 5, in <module>
+    from slither.__main__ import main
+ModuleNotFoundError: No module named 'slither'
+```
+
diff --git a/test/UsdtYieldVaultFindings.t.sol b/test/UsdtYieldVaultFindings.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f2b4ccfea4e8afbecce622f1ccf56c5f3aa18f99
--- /dev/null
+++ b/test/UsdtYieldVaultFindings.t.sol
@@ -0,0 +1,127 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 assets) external {
+        assets = bound(assets, vault.MIN_DEPOSIT(), 1_000_000e6);
+        vault.deposit(assets);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 balance = vault.shareBalance(address(this));
+        if (balance == 0) return;
+        shares = bound(shares, 1, balance);
+        vault.withdraw(shares);
+    }
+}
+
+contract UsdtYieldVaultFindingsTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+    address internal bob = makeAddr("bob");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 10_000e6);
+        usdt.mint(bob, 10_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vm.prank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 assets) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(assets);
+    }
+
+    function test_FirstDepositorActuallyPaysAdvertisedDepositFee() public {
+        uint256 assets = 1_000e6;
+        uint256 shares = _deposit(alice, assets);
+        uint256 advertisedFee = assets * vault.depositFeeBps() / vault.BPS_DENOMINATOR();
+
+        assertEq(vault.convertToAssets(shares), assets - advertisedFee, "first depositor owns the fee too");
+    }
+
+    function test_TwoWithdrawalsDoNotCreateUnaccountedCustody() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "withdrawal fees vanished from accounting");
+    }
+
+    function test_AaveYieldIsReflectedInVaultAccounting() public {
+        _deposit(alice, 1_000e6);
+
+        // Aave aTokens accrue by increasing balance. The mock's pool-authorized
+        // mint models that balance growth without changing vault bookkeeping.
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 50e6);
+
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is ignored");
+    }
+
+    function test_DepositFeeBoundaryIsRejected() public {
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function testFuzz_UnusableDepositFeesAreRejected(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+        vm.expectRevert();
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+    }
+}
+
+contract UsdtYieldVaultAccountingInvariantTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    VaultHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new VaultHandler(vault, usdt);
+        usdt.mint(address(handler), type(uint128).max);
+        targetContract(address(handler));
+    }
+
+    function invariant_AccountingEqualsAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "accounting drifted from custody");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..24c33034a10f647d1bf54f6ea71c7fdd69b9ec78
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,31 @@
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
+    uint256 internal constant PINNED_BLOCK = 25_977_816;
+
+    function test_RealUsdtCanBeDepositedIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+        vm.prank(depositor);
+        (bool approvalSucceeded,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approvalSucceeded);
+
+        vm.prank(depositor);
+        (bool depositSucceeded,) = address(vault).call(abi.encodeCall(vault.deposit, (1_000e6)));
+
+        assertTrue(depositSucceeded, "real USDT deposit reverted before Aave supply");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

tokens used
73,790
````

## final message

Do not ship this vault on Monday.

I added:

- [FINDINGS.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001/FINDINGS.md)
- [UsdtYieldVaultFindings.t.sol](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultFindings.t.sol)
- [UsdtYieldVaultMainnetFork.t.sol](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192847Z-codex-with-skill-1/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol)

The evidence demonstrates five defects:

- Critical: deposits revert against real mainnet USDT because its `approve` returns no data.
- High: Aave yield is excluded from vault accounting and cannot be redeemed.
- High: withdrawal fees disappear from accounting and become stranded.
- Medium: the first depositor does not actually pay the advertised deposit fee.
- Medium: unrestricted owner fee configuration can disable all deposits.

A handler-driven invariant independently found the custody/accounting divergence with zero handler reverts. The report contains the exact commands and captured failing outputs for every finding, plus proposed fixes without applying them.

No existing source, test, or mock file was changed. Slither could not run because the installed Python package is broken; the report records that as an unresolved release blocker.
