# Executor transcript — 2026-09-12T015056Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a095d4-f266-7ae1-8557-73406ad693ce
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
I’m using the `testing` skill because this is specifically a Foundry test-evidence and deployment-readiness review. I’ll first read its full procedure, then inspect the repository and add only new test files plus `FINDINGS.md`; `src/`, the existing vault test, and mocks will remain untouched.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: testing
description: Use when writing or reviewing Foundry tests, when deciding whether a suite is enough to deploy, or when a green run or a coverage percentage is offered as evidence that a contract is safe. Covers fuzz, fork and invariant testing with `forge`. Finding and evidencing defects by running tests is in scope; auditing source by reading it belongs to `security` and `audit`.
---

# Smart Contract Testing

A green suite and 100% coverage are not evidence of safety. Coverage records which lines ran, never whether an assertion could have failed. Before signing off, name which of the three searches below the suite actually performed. If the answer is none, it has only confirmed the cases someone already thought of.

## Make tests capable of failing

Rewrite any test that mirrors the implementation: stored state asserted against the value just written to it, a getter against the variable it returns, a constant against itself, constructor state against the constructor argument. These execute every line and constrain nothing.

Assert properties instead — round-trips, conservation between accounting and custody, monotonicity, access boundaries. Skip anything whose failure would be a bug in the compiler or in a dependency you did not write.

A bug that accumulates across a sequence cannot be seen by any test that exercises one operation in isolation, however many such tests exist. "Every operation is correct on its own" is the symptom, not the defence.

## Fuzz the domain instead of picking from it

Before deploy, every owner-settable number that feeds value math — fee basis points, ratios, caps, exchange rates — needs a fuzz test over its whole accepted domain, using `bound()` rather than `vm.assume()`. Hand-picked values walk one branch; the fuzzer finds the value nobody proposed.

Reaching a suspected bug by reading the code and then writing one test for it confirms what you already believed. It is not a substitute for the search, and it stops at the first defect you happened to imagine.

Include both sides of every bound, not just the far side. The value at the limit and the value past it usually break through different code paths and surface as different failures, so evidence for one is not evidence for the other.

## Fork against the real deployment

Always fork for a contract that calls an external protocol (Uniswap, Aave, Chainlink; verified addresses in `addresses/SKILL.md`), handles a quirky token (USDT, fee-on-transfer, rebasing), or reads an oracle. Never for pure logic.

A mock encodes your assumption about the dependency, so more mock-based tests only re-test the assumption. Deployed tokens deviate from the interface they are called through — in what a call returns, in how much of a transfer arrives, in whether a balance stays put — and a mock written to the standard answers in the standard shape every time, so it can never surface the mismatch.

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000);
```

Pin the block. An unpinned fork follows the chain head, so live prices and reserves move between runs: assertions drift red, flake green on re-run, and the local RPC cache never hits, which grows into slow runs and provider 429s.

Pinning an old block is an archive request. A full node keeps only recent state — geth's default window is roughly the last 128 blocks — and answers anything older with an error rather than a wrong number. Whether an endpoint serves archive depth is a property of the node and the plan behind it, not something a URL tells you: confirm it answers a historical `eth_call` at your block before pinning that block, or the tests fail for a reason that has nothing to do with the contract.

## Invariant-test anything stateful

A vault, AMM, lending market or escrow does not ship on unit tests. State properties as equalities that must hold after any sequence: recorded assets equal assets actually held, total supply equals the sum of balances, `x * y >= k`.

Match the shape of the assertion to the failures it has to catch. A one-sided bound constrains one direction only — `claims <= holdings` fires on a shortfall and stays green through anything that leaves a surplus — so where value can be stranded as well as lost, the property has to be an equality or an explicit no-drift check.

Point `targetContract` at a handler, never at the contract under test. Called directly, the fuzzer supplies random senders that hold no tokens and granted no approvals, so nearly every call reverts. Reverts are discarded rather than failing the run, and the invariant is then asserted against a contract that never left its initial state — green because nothing happened.

The handler owns setup: funded and approved actors, inputs bounded to valid ranges, multiple actors where the property is about interaction between them.

Read the calls/reverts statistics in the run output every time. A revert rate near 100% means the run proved nothing; set `fail_on_revert = true` to surface it while building the handler.

## Before deploy

- [ ] No test asserts the implementation back to itself.
- [ ] Every owner-settable number feeding value math is fuzzed across its domain, both sides of each bound included.
- [ ] Every external integration and quirky token is exercised on a pinned fork against the real deployment, on an endpoint confirmed to serve that block.
- [ ] Stateful contracts have a handler-driven invariant tying accounting to custody, with a revert rate low enough that the sequences reached real states.
- [ ] Access control, zero, and max-value cases revert as intended.
- [ ] `slither .` run, with no high or medium finding left unaddressed.

exec
/bin/bash -lc "pwd && rg --files -g '"'!*cache*'"' -g '"'!out/**'"' && git status --short && sed -n '1,260p' src/UsdtYieldVault.sol && sed -n '1,320p' test/UsdtYieldVault.t.sol && sed -n '1,200p' foundry.toml" in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
 succeeded in 12ms:
foundry.toml
TASK.md
package.json
README.md
remappings.txt
test/UsdtYieldVault.t.sol
test/mocks/MockUSDT.sol
test/mocks/MockAavePool.sol
src/UsdtYieldVault.sol
src/interfaces/IAavePool.sol
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
The existing suite already reveals a coverage-quality problem: several assertions only check “greater than zero,” and the accounting tests accept the vault’s own stored value as truth. I’m now turning the meaningful properties into adversarial tests: custody equals accounting, fees remain attributable, yield reaches shareholders, and the owner-set fee domain cannot brick deposits. I’ll also probe whether a pinned mainnet fork is runnable in this environment before claiming integration evidence.
exec
/bin/bash -lc "env | cut -d= -f1 | sort | rg 'RPC|ETH|ALCHEMY|INFURA' || true
forge test --summary
forge --version
slither --version 2>/dev/null || true
git status --short" in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
 succeeded in 218ms:
No files changed, compilation skipped
2026-09-12T13:36:20.864044Z  WARN evm::traces::external: etherscan config not found

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
Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 1.82ms (5.52ms CPU time)

╭--------------------+--------+--------+---------╮
| Test Suite         | Passed | Failed | Skipped |
+================================================+
| UsdtYieldVaultTest | 39     | 0      | 0       |
╰--------------------+--------+--------+---------╯

2026-09-12T13:36:20.876001Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

exec
/bin/bash -lc "curl -sS --max-time 15 -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}' https://ethereum-rpc.publicnode.com" in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
 succeeded in 193ms:
{"jsonrpc":"2.0","result":"0x18c24c8","id":1}

exec
/bin/bash -lc "sed -n '1,280p' test/mocks/MockAavePool.sol && sed -n '1,180p' test/mocks/MockUSDT.sol && sed -n '1,120p' src/interfaces/IAavePool.sol && printf '%d\\n' "'$((0x18c24c8))' in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
 succeeded in 4ms:
apply patch
patch: completed
/tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultAdversarial.t.sol
/tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bfafadd15fb0f73af5e3073f9ffd53730d518bdb
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_000;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bfafadd15fb0f73af5e3073f9ffd53730d518bdb
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_000;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

exec
/bin/bash -lc 'forge fmt --check test/UsdtYieldVaultAdversarial.t.sol test/UsdtYieldVaultMainnetFork.t.sol && forge test --match-contract UsdtYieldVaultMainnetForkTest -vv && forge test --match-contract UsdtYieldVaultAdversarialTest -vv' in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
2026-09-12T13:37:29.757962Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 2315ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 905.26ms
Compiler run successful!
2026-09-12T13:37:29.013459Z  WARN evm::traces::external: etherscan config not found
2026-09-12T13:37:29.582579Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25961000"
2026-09-12T13:37:29.736098Z ERROR sharedbackend: Failed to send/recv `basic` err=failed to get account for 0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode"},"id":6} address=0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EVM error; database error: failed to get account for 0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode"},"id":6}] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 0)
2026-09-12T13:37:29.736237Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25961000")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 721.80ms (721.51ms CPU time)

Ran 1 test suite in 722.93ms (721.80ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EVM error; database error: failed to get account for 0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode"},"id":6}] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 0)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bfafadd15fb0f73af5e3073f9ffd53730d518bdb
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_000;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

codex
The first public endpoint correctly rejected the pinned block as an archive request, so I will not mislabel that infrastructure error as a contract failure. I’m moving the pin into the node’s retained recent-state window and explicitly checking a historical `eth_call` before rerunning the fork. The deterministic adversarial tests are separate, so their outputs won’t be contaminated by RPC availability.
exec
/bin/bash -lc "curl -sS --max-time 15 -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"0xdAC17F958D2ee523a2206206994597C13D831ec7\",\"data\":\"0x18160ddd\"},\"0x18c24b0\"],\"id\":1}' https://ethereum-rpc.publicnode.com
curl -sS --max-time 15 -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}' https://ethereum-rpc.publicnode.com" in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
 succeeded in 608ms:
{"jsonrpc":"2.0","id":1,"result":"0x0000000000000000000000000000000000000000000000000139b9d3547fc0bb"}
{"jsonrpc":"2.0","result":"0x18c24cf","id":1}

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bfafadd15fb0f73af5e3073f9ffd53730d518bdb
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_000;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

exec
/bin/bash -lc "printf '%d\\n' "'$((0x18c24b0))' in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
 succeeded in 10ms:
25961648

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bfafadd15fb0f73af5e3073f9ffd53730d518bdb
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_000;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..462b555d5f0624f386b6761977fcecf9cb3dbeec
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_648;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..462b555d5f0624f386b6761977fcecf9cb3dbeec
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_648;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

exec
/bin/bash -lc 'forge test --match-contract UsdtYieldVaultMainnetForkTest -vv' in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
2026-09-12T13:37:56.231366Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 2802ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 865.65ms
Compiler run successful!
2026-09-12T13:37:54.936676Z  WARN evm::traces::external: etherscan config not found
2026-09-12T13:37:55.116727Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25961648"

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1075650)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.27s (1.27s CPU time)
2026-09-12T13:37:56.211026Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25961648")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)

Ran 1 test suite in 1.27s (1.27s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1075650)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..462b555d5f0624f386b6761977fcecf9cb3dbeec
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_648;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

exec
/bin/bash -lc 'forge test --match-test test_RealUsdtCanBeSuppliedToAaveThroughVault -vvvv' in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
2026-09-12T13:38:07.857841Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 1929ms:
No files changed, compilation skipped
2026-09-12T13:38:06.567585Z  WARN evm::traces::external: etherscan config not found
2026-09-12T13:38:06.748592Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25961648"

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1075650)
2026-09-12T13:38:07.837576Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25961648")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
Traces:
  [1075650] UsdtYieldVaultMainnetForkTest::test_RealUsdtCanBeSuppliedToAaveThroughVault()
    ├─ [0] VM::createSelectFork("<rpc url>", 25961648 [2.596e7])
    │   └─ ← [Return] 0
    ├─ [0] VM::addr(<pk>) [staticcall]
    │   └─ ← [Return] mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC]
    ├─ [0] VM::label(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC], "mainnetDepositor")
    │   └─ ← [Return]
    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: UsdtYieldVaultMainnetForkTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
    │   └─ ← [Return] 3596 bytes of code
    ├─ [5031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::record()
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::accesses(0xdAC17F958D2ee523a2206206994597C13D831ec7) [staticcall]
    │   └─ ← [Return] [0x000000000000000000000000000000000000000000000000000000000000000a, 0xf457899d9223982ef38fa4ef89935c06d414b546cf4a20e5a5e49414871d04a6], []
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xf457899d9223982ef38fa4ef89935c06d414b546cf4a20e5a5e49414871d04a6) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ emit WARNING_UninitedSlot(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, slot: 110519000536304092547441586349870997982425256136133378531494673106125662782630 [1.105e77])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xf457899d9223982ef38fa4ef89935c06d414b546cf4a20e5a5e49414871d04a6) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xf457899d9223982ef38fa4ef89935c06d414b546cf4a20e5a5e49414871d04a6, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC]) [staticcall]
    │   └─ ← [Return] 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77]
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xf457899d9223982ef38fa4ef89935c06d414b546cf4a20e5a5e49414871d04a6, 0x0000000000000000000000000000000000000000000000000000000000000000)
    │   └─ ← [Return]
    ├─ emit SlotFound(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, fsig: 0x70a08231, keysHash: 0xc896d8ebd8c3015e9d6976c076cb4f58ddbe684229fabe6b6a3b2924025c9636, slot: 110519000536304092547441586349870997982425256136133378531494673106125662782630 [1.105e77])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xf457899d9223982ef38fa4ef89935c06d414b546cf4a20e5a5e49414871d04a6) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xf457899d9223982ef38fa4ef89935c06d414b546cf4a20e5a5e49414871d04a6, 0x000000000000000000000000000000000000000000000000000000003b9aca00)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC]) [staticcall]
    │   └─ ← [Return] 1000000000 [1e9]
    ├─ [0] VM::startPrank(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC])
    │   └─ ← [Return]
    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   ├─ emit Approval(owner: mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   └─ ← [Stop]
    └─ ← [Revert] EvmError: Revert

Backtrace:
  at UsdtYieldVaultMainnetForkTest.test_RealUsdtCanBeSuppliedToAaveThroughVault

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.27s (1.27s CPU time)

Ran 1 test suite in 1.28s (1.27s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1075650)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..462b555d5f0624f386b6761977fcecf9cb3dbeec
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_648;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..99d59a9a9406c3a529c515fd4b9cab3fee3144bd
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_648;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..99d59a9a9406c3a529c515fd4b9cab3fee3144bd
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_648;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

exec
/bin/bash -lc 'forge test --match-test test_RealUsdtCanBeSuppliedToAaveThroughVault -vvvv' in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
2026-09-12T13:38:29.021944Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 3843ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 878.22ms
Compiler run successful!
2026-09-12T13:38:26.728775Z  WARN evm::traces::external: etherscan config not found
2026-09-12T13:38:26.912534Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25961648"

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
2026-09-12T13:38:28.999835Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25961648")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
Traces:
  [1140582] UsdtYieldVaultMainnetForkTest::test_RealUsdtCanBeSuppliedToAaveThroughVault()
    ├─ [0] VM::createSelectFork("<rpc url>", 25961648 [2.596e7])
    │   └─ ← [Return] 0
    ├─ [0] VM::addr(<pk>) [staticcall]
    │   └─ ← [Return] mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC]
    ├─ [0] VM::label(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC], "mainnetDepositor")
    │   └─ ← [Return]
    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: UsdtYieldVaultMainnetForkTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
    │   └─ ← [Return] 3596 bytes of code
    ├─ [5031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::record()
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::accesses(0xdAC17F958D2ee523a2206206994597C13D831ec7) [staticcall]
    │   └─ ← [Return] [0x000000000000000000000000000000000000000000000000000000000000000a, 0xf457899d9223982ef38fa4ef89935c06d414b546cf4a20e5a5e49414871d04a6], []
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xf457899d9223982ef38fa4ef89935c06d414b546cf4a20e5a5e49414871d04a6) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ emit WARNING_UninitedSlot(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, slot: 110519000536304092547441586349870997982425256136133378531494673106125662782630 [1.105e77])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xf457899d9223982ef38fa4ef89935c06d414b546cf4a20e5a5e49414871d04a6) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xf457899d9223982ef38fa4ef89935c06d414b546cf4a20e5a5e49414871d04a6, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC]) [staticcall]
    │   └─ ← [Return] 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77]
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xf457899d9223982ef38fa4ef89935c06d414b546cf4a20e5a5e49414871d04a6, 0x0000000000000000000000000000000000000000000000000000000000000000)
    │   └─ ← [Return]
    ├─ emit SlotFound(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, fsig: 0x70a08231, keysHash: 0xc896d8ebd8c3015e9d6976c076cb4f58ddbe684229fabe6b6a3b2924025c9636, slot: 110519000536304092547441586349870997982425256136133378531494673106125662782630 [1.105e77])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xf457899d9223982ef38fa4ef89935c06d414b546cf4a20e5a5e49414871d04a6) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xf457899d9223982ef38fa4ef89935c06d414b546cf4a20e5a5e49414871d04a6, 0x000000000000000000000000000000000000000000000000000000003b9aca00)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC]) [staticcall]
    │   └─ ← [Return] 1000000000 [1e9]
    ├─ [0] VM::prank(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC])
    │   └─ ← [Return]
    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   ├─ emit Approval(owner: mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   └─ ← [Stop]
    ├─ [0] VM::startPrank(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC])
    │   └─ ← [Return]
    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
    │   ├─ [34830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
    │   │   ├─ emit Transfer(from: mainnetDepositor: [0x09fAA1fAA9F189022Bce4267f44EB3004C38E3aC], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   └─ ← [Revert] EvmError: Revert
    └─ ← [Revert] EvmError: Revert

Backtrace:
  at UsdtYieldVault.deposit
  at UsdtYieldVaultMainnetForkTest.test_RealUsdtCanBeSuppliedToAaveThroughVault

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.27s (2.27s CPU time)

Ran 1 test suite in 2.28s (2.27s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..99d59a9a9406c3a529c515fd4b9cab3fee3144bd
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_648;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

exec
/bin/bash -lc 'forge test --match-test test_DepositFeeMustReduceFirstDepositorsClaim -vv' in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
 exited 1 in 1731ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 1.05s
Compiler run successful!
2026-09-12T13:38:42.604424Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: deposit fee did not reduce depositor claim: 1000000000 != 999000000] test_DepositFeeMustReduceFirstDepositorsClaim() (gas: 231887)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 835.64µs (126.68µs CPU time)

Ran 1 test suite in 7.87ms (835.64µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: deposit fee did not reduce depositor claim: 1000000000 != 999000000] test_DepositFeeMustReduceFirstDepositorsClaim() (gas: 231887)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..99d59a9a9406c3a529c515fd4b9cab3fee3144bd
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_648;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

exec
/bin/bash -lc 'forge test --match-test test_DepositFeeAboveDenominatorMustBeRejected -vv' in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
exec
/bin/bash -lc 'forge test --match-test test_WithdrawalMustNotLeaveUnaccountedCustody -vv' in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
exec
/bin/bash -lc 'forge test --match-test test_DepositFeeAtDenominatorMustBeRejected -vv' in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
exec
/bin/bash -lc 'forge test --match-test test_AaveYieldMustIncreaseShareholderClaim -vv' in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
 exited 1 in 170ms:
No files changed, compilation skipped
2026-09-12T13:38:48.315104Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: next call did not revert as expected] test_DepositFeeAtDenominatorMustBeRejected() (gas: 10665)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 932.99µs (58.81µs CPU time)

Ran 1 test suite in 8.55ms (932.99µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: next call did not revert as expected] test_DepositFeeAtDenominatorMustBeRejected() (gas: 10665)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

 exited 1 in 174ms:
No files changed, compilation skipped
2026-09-12T13:38:48.318600Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: next call did not revert as expected] test_DepositFeeAboveDenominatorMustBeRejected() (gas: 10710)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 720.63µs (56.85µs CPU time)

Ran 1 test suite in 9.86ms (720.63µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: next call did not revert as expected] test_DepositFeeAboveDenominatorMustBeRejected() (gas: 10710)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

 exited 1 in 176ms:
No files changed, compilation skipped
2026-09-12T13:38:48.324927Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: accrued Aave yield is absent from user accounting: 1000000000 != 1100000000] test_AaveYieldMustIncreaseShareholderClaim() (gas: 447202)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.32ms (459.48µs CPU time)

Ran 1 test suite in 7.78ms (1.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: accrued Aave yield is absent from user accounting: 1000000000 != 1100000000] test_AaveYieldMustIncreaseShareholderClaim() (gas: 447202)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

 exited 1 in 181ms:
No files changed, compilation skipped
2026-09-12T13:38:48.325821Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: aUSDT custody diverged from accounting: 3000000 != 0] test_WithdrawalMustNotLeaveUnaccountedCustody() (gas: 250883)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 917.94µs (152.53µs CPU time)

Ran 1 test suite in 9.72ms (917.94µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: aUSDT custody diverged from accounting: 3000000 != 0] test_WithdrawalMustNotLeaveUnaccountedCustody() (gas: 250883)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..99d59a9a9406c3a529c515fd4b9cab3fee3144bd
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_648;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

exec
/bin/bash -lc "curl -sS --max-time 15 -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"0xdAC17F958D2ee523a2206206994597C13D831ec7\",\"data\":\"0x18160ddd\"},\"0x18c2828\"],\"id\":1}' https://eth.llamarpc.com" in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
 succeeded in 781ms:
error code: 525

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..99d59a9a9406c3a529c515fd4b9cab3fee3144bd
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_648;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

exec
/bin/bash -lc "curl -sS --max-time 15 -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"0xdAC17F958D2ee523a2206206994597C13D831ec7\",\"data\":\"0x18160ddd\"},\"0x18c2228\"],\"id\":1}' https://ethereum.publicnode.com" in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
exec
/bin/bash -lc "curl -sS --max-time 15 -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"0xdAC17F958D2ee523a2206206994597C13D831ec7\",\"data\":\"0x18160ddd\"},\"0x18c2228\"],\"id\":1}' https://rpc.flashbots.net" in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
exec
/bin/bash -lc "curl -sS --max-time 15 -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"0xdAC17F958D2ee523a2206206994597C13D831ec7\",\"data\":\"0x18160ddd\"},\"0x18c2228\"],\"id\":1}' https://eth-mainnet.public.blastapi.io" in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
 succeeded in 271ms:
{"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode"},"id":1}

 succeeded in 378ms:
{"jsonrpc":"2.0","id":1,"result":"0x0000000000000000000000000000000000000000000000000139b9d3547fc0bb"}
 succeeded in 822ms:
{"jsonrpc":"2.0","error":{"code":-32601,"message":"rpc method is not whitelisted"},"id":1}

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..99d59a9a9406c3a529c515fd4b9cab3fee3144bd
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_648;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

exec
/bin/bash -lc "printf '%d\\n' "'$((0x18c2228))' in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
25961000

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..99d59a9a9406c3a529c515fd4b9cab3fee3144bd
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_648;
+    string internal constant RPC_URL = "https://ethereum-rpc.publicnode.com";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d113d8a98fe015ee3174d6a959da73bd38f5a09
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_000;
+    string internal constant RPC_URL = "https://eth-mainnet.public.blastapi.io";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d113d8a98fe015ee3174d6a959da73bd38f5a09
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_000;
+    string internal constant RPC_URL = "https://eth-mainnet.public.blastapi.io";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

exec
/bin/bash -lc 'forge test --match-test test_RealUsdtCanBeSuppliedToAaveThroughVault -vv' in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
2026-09-12T13:39:46.124503Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 11856ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 882.45ms
Compiler run successful!
2026-09-12T13:39:35.804936Z  WARN evm::traces::external: etherscan config not found
2026-09-12T13:39:37.922099Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25961000"

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 10.30s (10.30s CPU time)
2026-09-12T13:39:46.108842Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25961000")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)

Ran 1 test suite in 10.30s (10.30s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d113d8a98fe015ee3174d6a959da73bd38f5a09
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_000;
+    string internal constant RPC_URL = "https://eth-mainnet.public.blastapi.io";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

exec
/bin/bash -lc "forge test --match-test test_RealUsdtCanBeSuppliedToAaveThroughVault -vvvv 2>&1 | rg 'UsdtYieldVault::deposit|approve\\(0x87870|← \\[Revert\\]|test_RealUsdt'" in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
 succeeded in 2586ms:
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
  [1140582] UsdtYieldVaultMainnetForkTest::test_RealUsdtCanBeSuppliedToAaveThroughVault()
    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
    │   └─ ← [Revert] EvmError: Revert
    └─ ← [Revert] EvmError: Revert
  at UsdtYieldVaultMainnetForkTest.test_RealUsdtCanBeSuppliedToAaveThroughVault
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d113d8a98fe015ee3174d6a959da73bd38f5a09
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_000;
+    string internal constant RPC_URL = "https://eth-mainnet.public.blastapi.io";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

codex
The pinned fork has now surfaced a release-blocking integration defect, not just an accounting concern: the real USDT `approve` returns no ABI-encoded boolean, while the vault calls it through raw `IERC20.approve`; the deposit reverts before Aave supply. The standard mock returns a boolean and therefore concealed this. I’m assembling the exact rerunnable commands and outputs now, alongside three independent accounting/configuration failures.
apply patch
patch: completed
/tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001/FINDINGS.md
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..99bf3b162a04a3436b7efd9679aac1ace4314dcc
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,311 @@
+# USDT Yield Vault — pre-deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet in its current form.** The configured real
+USDT/Aave path cannot accept a deposit at all. Independently, the vault does not
+credit Aave yield to shareholders, its fee accounting creates unaccounted custody,
+and its owner-set deposit fee has no valid bound.
+
+No file under `src/` was changed. The existing `test/UsdtYieldVault.t.sol` and
+everything under `test/mocks/` were left unchanged. The reproductions are in the
+new files `test/UsdtYieldVaultMainnetFork.t.sol` and
+`test/UsdtYieldVaultAdversarial.t.sol`.
+
+## 1. Critical — every real-USDT deposit reverts before reaching Aave
+
+### What happens
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard
+`IERC20` interface. Mainnet USDT's `approve` succeeds with empty return data. A
+high-level Solidity interface call expects ABI-encoded return data for the declared
+`bool`, so the vault reverts immediately after USDT emits its approval event. The
+transaction rollback means the transfer and approval are undone and Aave is never
+called.
+
+The existing mock inherits OpenZeppelin ERC20 and returns a normal boolean, so it
+cannot detect this incompatibility.
+
+The test forks Ethereum at block `25,961,000`, uses exactly the USDT and Aave Pool
+addresses specified for launch, funds a depositor, and attempts the first deposit.
+
+### Evidence
+
+Command:
+
+```console
+forge test --match-test test_RealUsdtCanBeSuppliedToAaveThroughVault -vv
+```
+
+Actual output:
+
+```text
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 882.45ms
+Compiler run successful!
+2026-09-12T13:39:35.804936Z  WARN evm::traces::external: etherscan config not found
+2026-09-12T13:39:37.922099Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25961000"
+
+Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 10.30s (10.30s CPU time)
+2026-09-12T13:39:46.108842Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25961000")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+
+Ran 1 test suite in 10.30s (10.30s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+The focused trace locates the revert:
+
+Command:
+
+```console
+forge test --match-test test_RealUsdtCanBeSuppliedToAaveThroughVault -vvvv 2>&1 | rg 'UsdtYieldVault::deposit|approve\(0x87870|← \[Revert\]|test_RealUsdt'
+```
+
+Actual output:
+
+```text
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+  [1140582] UsdtYieldVaultMainnetForkTest::test_RealUsdtCanBeSuppliedToAaveThroughVault()
+    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
+    │   └─ ← [Revert] EvmError: Revert
+    └─ ← [Revert] EvmError: Revert
+  at UsdtYieldVaultMainnetForkTest.test_RealUsdtCanBeSuppliedToAaveThroughVault
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+```
+
+### Recommended fix
+
+Use OpenZeppelin `SafeERC20.forceApprove` (or a zero-then-set safe approval flow)
+instead of raw `IERC20.approve`. Add this pinned real-USDT/Aave fork test to CI using
+an archive-capable team RPC rather than relying permanently on the public endpoint
+embedded in the reproduction.
+
+## 2. High — Aave yield is never credited to shareholders
+
+### What happens
+
+All conversions and `totalAssets()` use `totalAssetsStored`, which changes only by
+deposit and withdrawal principal. They never read the vault's accruing aUSDT
+balance. Consequently, an increase in aUSDT does not increase share value or a
+user's claim. This defeats the vault's stated yield purpose and leaves all earned
+yield outside its accounting.
+
+The test models Aave's balance growth by increasing the vault's aUSDT balance from
+1,000 to 1,100 USDT. Alice's reported claim stays at 1,000 USDT.
+
+### Evidence
+
+Command:
+
+```console
+forge test --match-test test_AaveYieldMustIncreaseShareholderClaim -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.324927Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is absent from user accounting: 1000000000 != 1100000000] test_AaveYieldMustIncreaseShareholderClaim() (gas: 447202)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.32ms (459.48µs CPU time)
+
+Ran 1 test suite in 7.78ms (1.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is absent from user accounting: 1000000000 != 1100000000] test_AaveYieldMustIncreaseShareholderClaim() (gas: 447202)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+Base share conversions and `totalAssets()` on actual managed assets—normally the
+aUSDT balance plus any idle USDT—rather than a principal-only counter. Define how
+donations and rounding are handled and test multi-user deposit/withdraw sequences
+against the equality between custody and claims.
+
+## 3. High — the advertised fees are misaccounted and assets become stranded
+
+### What happens
+
+On deposit the vault mints shares from the fee-reduced amount but adds the gross
+amount to `totalAssetsStored`. For the first depositor, this immediately makes the
+entire purported deposit fee part of that same depositor's claim, so no deposit fee
+has actually been charged.
+
+On withdrawal it subtracts the gross claim from `totalAssetsStored` but asks Aave
+to return only the net amount. After the final shareholder exits, `totalShares` and
+`totalAssetsStored` are zero while the withdrawal fee remains as aUSDT owned by the
+vault. There is no sweep or accounting path for it. The contract comment says fees
+accrue to remaining shareholders, but when there are no remaining shareholders the
+fee is orphaned; finding 2 means receipt-token balance growth is not reflected even
+when shareholders do remain.
+
+### Evidence: deposit fee not charged
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeMustReduceFirstDepositorsClaim -vv
+```
+
+Actual output:
+
+```text
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.05s
+Compiler run successful!
+2026-09-12T13:38:42.604424Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: deposit fee did not reduce depositor claim: 1000000000 != 999000000] test_DepositFeeMustReduceFirstDepositorsClaim() (gas: 231887)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 835.64µs (126.68µs CPU time)
+
+Ran 1 test suite in 7.87ms (835.64µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: deposit fee did not reduce depositor claim: 1000000000 != 999000000] test_DepositFeeMustReduceFirstDepositorsClaim() (gas: 231887)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Evidence: custody remains after all accounting reaches zero
+
+Command:
+
+```console
+forge test --match-test test_WithdrawalMustNotLeaveUnaccountedCustody -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.325821Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: aUSDT custody diverged from accounting: 3000000 != 0] test_WithdrawalMustNotLeaveUnaccountedCustody() (gas: 250883)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 917.94µs (152.53µs CPU time)
+
+Ran 1 test suite in 9.72ms (917.94µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: aUSDT custody diverged from accounting: 3000000 != 0] test_WithdrawalMustNotLeaveUnaccountedCustody() (gas: 250883)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+First specify who owns each fee. Then implement that policy consistently in both
+share minting and asset accounting. If fees belong to remaining shareholders, keep
+them in the asset base used by conversions and explicitly handle the last-share
+withdrawal so nothing becomes ownerless. If fees belong elsewhere, transfer or
+accrue an explicit claim to that recipient. Add a handler-driven invariant asserting
+that every unit in custody is represented by an intended claim after arbitrary
+multi-user sequences.
+
+## 4. Medium — the owner can set a fee that makes deposits impossible
+
+### What happens
+
+`setDepositFee` accepts every `uint256`. At exactly 10,000 bps, every otherwise
+valid deposit computes zero net assets and reverts with `NoSharesMinted`. Above
+10,000 bps, `amount - fee` underflows and panics. Both sides of the economically
+valid upper boundary are accepted by the setter, allowing an accidental or
+compromised owner action to disable all deposits.
+
+### Evidence: boundary value accepted
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeAtDenominatorMustBeRejected -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.315104Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAtDenominatorMustBeRejected() (gas: 10665)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 932.99µs (58.81µs CPU time)
+
+Ran 1 test suite in 8.55ms (932.99µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAtDenominatorMustBeRejected() (gas: 10665)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Evidence: above-boundary value accepted
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeAboveDenominatorMustBeRejected -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.318600Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAboveDenominatorMustBeRejected() (gas: 10710)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 720.63µs (56.85µs CPU time)
+
+Ran 1 test suite in 9.86ms (720.63µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAboveDenominatorMustBeRejected() (gas: 10710)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+Reject fees at or above `BPS_DENOMINATOR` in both the constructor and setter, and
+consider a substantially lower governance maximum plus timelock appropriate to the
+product. Fuzz the complete accepted domain and explicitly test zero, the maximum
+accepted value, 10,000, and 10,001 bps.
+
+## Why the original 39 green tests and 100% coverage did not protect the launch
+
+The original suite never calls the deployed USDT or Aave contracts. Its ERC20 mock
+returns standard ABI data that real USDT does not. It also asserts
+`totalAssetsStored` against itself and uses weak checks such as `assertGt(..., 0)`
+for conversions and the share price. Line/function coverage confirms those lines
+executed; it does not constrain custody, yield attribution, fee bounds, or external
+token compatibility.
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d113d8a98fe015ee3174d6a959da73bd38f5a09
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_000;
+    string internal constant RPC_URL = "https://eth-mainnet.public.blastapi.io";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..99bf3b162a04a3436b7efd9679aac1ace4314dcc
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,311 @@
+# USDT Yield Vault — pre-deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet in its current form.** The configured real
+USDT/Aave path cannot accept a deposit at all. Independently, the vault does not
+credit Aave yield to shareholders, its fee accounting creates unaccounted custody,
+and its owner-set deposit fee has no valid bound.
+
+No file under `src/` was changed. The existing `test/UsdtYieldVault.t.sol` and
+everything under `test/mocks/` were left unchanged. The reproductions are in the
+new files `test/UsdtYieldVaultMainnetFork.t.sol` and
+`test/UsdtYieldVaultAdversarial.t.sol`.
+
+## 1. Critical — every real-USDT deposit reverts before reaching Aave
+
+### What happens
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard
+`IERC20` interface. Mainnet USDT's `approve` succeeds with empty return data. A
+high-level Solidity interface call expects ABI-encoded return data for the declared
+`bool`, so the vault reverts immediately after USDT emits its approval event. The
+transaction rollback means the transfer and approval are undone and Aave is never
+called.
+
+The existing mock inherits OpenZeppelin ERC20 and returns a normal boolean, so it
+cannot detect this incompatibility.
+
+The test forks Ethereum at block `25,961,000`, uses exactly the USDT and Aave Pool
+addresses specified for launch, funds a depositor, and attempts the first deposit.
+
+### Evidence
+
+Command:
+
+```console
+forge test --match-test test_RealUsdtCanBeSuppliedToAaveThroughVault -vv
+```
+
+Actual output:
+
+```text
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 882.45ms
+Compiler run successful!
+2026-09-12T13:39:35.804936Z  WARN evm::traces::external: etherscan config not found
+2026-09-12T13:39:37.922099Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25961000"
+
+Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 10.30s (10.30s CPU time)
+2026-09-12T13:39:46.108842Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25961000")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+
+Ran 1 test suite in 10.30s (10.30s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+The focused trace locates the revert:
+
+Command:
+
+```console
+forge test --match-test test_RealUsdtCanBeSuppliedToAaveThroughVault -vvvv 2>&1 | rg 'UsdtYieldVault::deposit|approve\(0x87870|← \[Revert\]|test_RealUsdt'
+```
+
+Actual output:
+
+```text
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+  [1140582] UsdtYieldVaultMainnetForkTest::test_RealUsdtCanBeSuppliedToAaveThroughVault()
+    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
+    │   └─ ← [Revert] EvmError: Revert
+    └─ ← [Revert] EvmError: Revert
+  at UsdtYieldVaultMainnetForkTest.test_RealUsdtCanBeSuppliedToAaveThroughVault
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+```
+
+### Recommended fix
+
+Use OpenZeppelin `SafeERC20.forceApprove` (or a zero-then-set safe approval flow)
+instead of raw `IERC20.approve`. Add this pinned real-USDT/Aave fork test to CI using
+an archive-capable team RPC rather than relying permanently on the public endpoint
+embedded in the reproduction.
+
+## 2. High — Aave yield is never credited to shareholders
+
+### What happens
+
+All conversions and `totalAssets()` use `totalAssetsStored`, which changes only by
+deposit and withdrawal principal. They never read the vault's accruing aUSDT
+balance. Consequently, an increase in aUSDT does not increase share value or a
+user's claim. This defeats the vault's stated yield purpose and leaves all earned
+yield outside its accounting.
+
+The test models Aave's balance growth by increasing the vault's aUSDT balance from
+1,000 to 1,100 USDT. Alice's reported claim stays at 1,000 USDT.
+
+### Evidence
+
+Command:
+
+```console
+forge test --match-test test_AaveYieldMustIncreaseShareholderClaim -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.324927Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is absent from user accounting: 1000000000 != 1100000000] test_AaveYieldMustIncreaseShareholderClaim() (gas: 447202)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.32ms (459.48µs CPU time)
+
+Ran 1 test suite in 7.78ms (1.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is absent from user accounting: 1000000000 != 1100000000] test_AaveYieldMustIncreaseShareholderClaim() (gas: 447202)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+Base share conversions and `totalAssets()` on actual managed assets—normally the
+aUSDT balance plus any idle USDT—rather than a principal-only counter. Define how
+donations and rounding are handled and test multi-user deposit/withdraw sequences
+against the equality between custody and claims.
+
+## 3. High — the advertised fees are misaccounted and assets become stranded
+
+### What happens
+
+On deposit the vault mints shares from the fee-reduced amount but adds the gross
+amount to `totalAssetsStored`. For the first depositor, this immediately makes the
+entire purported deposit fee part of that same depositor's claim, so no deposit fee
+has actually been charged.
+
+On withdrawal it subtracts the gross claim from `totalAssetsStored` but asks Aave
+to return only the net amount. After the final shareholder exits, `totalShares` and
+`totalAssetsStored` are zero while the withdrawal fee remains as aUSDT owned by the
+vault. There is no sweep or accounting path for it. The contract comment says fees
+accrue to remaining shareholders, but when there are no remaining shareholders the
+fee is orphaned; finding 2 means receipt-token balance growth is not reflected even
+when shareholders do remain.
+
+### Evidence: deposit fee not charged
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeMustReduceFirstDepositorsClaim -vv
+```
+
+Actual output:
+
+```text
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.05s
+Compiler run successful!
+2026-09-12T13:38:42.604424Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: deposit fee did not reduce depositor claim: 1000000000 != 999000000] test_DepositFeeMustReduceFirstDepositorsClaim() (gas: 231887)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 835.64µs (126.68µs CPU time)
+
+Ran 1 test suite in 7.87ms (835.64µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: deposit fee did not reduce depositor claim: 1000000000 != 999000000] test_DepositFeeMustReduceFirstDepositorsClaim() (gas: 231887)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Evidence: custody remains after all accounting reaches zero
+
+Command:
+
+```console
+forge test --match-test test_WithdrawalMustNotLeaveUnaccountedCustody -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.325821Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: aUSDT custody diverged from accounting: 3000000 != 0] test_WithdrawalMustNotLeaveUnaccountedCustody() (gas: 250883)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 917.94µs (152.53µs CPU time)
+
+Ran 1 test suite in 9.72ms (917.94µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: aUSDT custody diverged from accounting: 3000000 != 0] test_WithdrawalMustNotLeaveUnaccountedCustody() (gas: 250883)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+First specify who owns each fee. Then implement that policy consistently in both
+share minting and asset accounting. If fees belong to remaining shareholders, keep
+them in the asset base used by conversions and explicitly handle the last-share
+withdrawal so nothing becomes ownerless. If fees belong elsewhere, transfer or
+accrue an explicit claim to that recipient. Add a handler-driven invariant asserting
+that every unit in custody is represented by an intended claim after arbitrary
+multi-user sequences.
+
+## 4. Medium — the owner can set a fee that makes deposits impossible
+
+### What happens
+
+`setDepositFee` accepts every `uint256`. At exactly 10,000 bps, every otherwise
+valid deposit computes zero net assets and reverts with `NoSharesMinted`. Above
+10,000 bps, `amount - fee` underflows and panics. Both sides of the economically
+valid upper boundary are accepted by the setter, allowing an accidental or
+compromised owner action to disable all deposits.
+
+### Evidence: boundary value accepted
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeAtDenominatorMustBeRejected -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.315104Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAtDenominatorMustBeRejected() (gas: 10665)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 932.99µs (58.81µs CPU time)
+
+Ran 1 test suite in 8.55ms (932.99µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAtDenominatorMustBeRejected() (gas: 10665)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Evidence: above-boundary value accepted
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeAboveDenominatorMustBeRejected -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.318600Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAboveDenominatorMustBeRejected() (gas: 10710)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 720.63µs (56.85µs CPU time)
+
+Ran 1 test suite in 9.86ms (720.63µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAboveDenominatorMustBeRejected() (gas: 10710)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+Reject fees at or above `BPS_DENOMINATOR` in both the constructor and setter, and
+consider a substantially lower governance maximum plus timelock appropriate to the
+product. Fuzz the complete accepted domain and explicitly test zero, the maximum
+accepted value, 10,000, and 10,001 bps.
+
+## Why the original 39 green tests and 100% coverage did not protect the launch
+
+The original suite never calls the deployed USDT or Aave contracts. Its ERC20 mock
+returns standard ABI data that real USDT does not. It also asserts
+`totalAssetsStored` against itself and uses weak checks such as `assertGt(..., 0)`
+for conversions and the share price. Line/function coverage confirms those lines
+executed; it does not constrain custody, yield attribution, fee bounds, or external
+token compatibility.
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d113d8a98fe015ee3174d6a959da73bd38f5a09
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_000;
+    string internal constant RPC_URL = "https://eth-mainnet.public.blastapi.io";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

exec
/bin/bash -lc 'forge fmt --check test/UsdtYieldVaultAdversarial.t.sol test/UsdtYieldVaultMainnetFork.t.sol && forge test --summary && git status --short && git diff -- src test/UsdtYieldVault.t.sol test/mocks && git diff --check' in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
2026-09-12T13:41:26.940751Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 3615ms:
No files changed, compilation skipped
2026-09-12T13:41:23.418424Z  WARN evm::traces::external: etherscan config not found

Ran 5 tests for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: accrued Aave yield is absent from user accounting: 1000000000 != 1100000000] test_AaveYieldMustIncreaseShareholderClaim() (gas: 447202)
[FAIL: next call did not revert as expected] test_DepositFeeAboveDenominatorMustBeRejected() (gas: 10710)
[FAIL: next call did not revert as expected] test_DepositFeeAtDenominatorMustBeRejected() (gas: 10665)
[FAIL: deposit fee did not reduce depositor claim: 1000000000 != 999000000] test_DepositFeeMustReduceFirstDepositorsClaim() (gas: 231887)
[FAIL: aUSDT custody diverged from accounting: 3000000 != 0] test_WithdrawalMustNotLeaveUnaccountedCustody() (gas: 250883)
Suite result: FAILED. 0 passed; 5 failed; 0 skipped; finished in 1.72ms (1.10ms CPU time)

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
Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 1.73ms (4.85ms CPU time)
2026-09-12T13:41:23.612755Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25961000"

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 3.50s (3.50s CPU time)
2026-09-12T13:41:26.916784Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25961000")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)

╭-------------------------------+--------+--------+---------╮
| Test Suite                    | Passed | Failed | Skipped |
+===========================================================+
| UsdtYieldVaultTest            | 39     | 0      | 0       |
|-------------------------------+--------+--------+---------|
| UsdtYieldVaultAdversarialTest | 0      | 5      | 0       |
|-------------------------------+--------+--------+---------|
| UsdtYieldVaultMainnetForkTest | 0      | 1      | 0       |
╰-------------------------------+--------+--------+---------╯


Failing tests:
Encountered 5 failing tests in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: accrued Aave yield is absent from user accounting: 1000000000 != 1100000000] test_AaveYieldMustIncreaseShareholderClaim() (gas: 447202)
[FAIL: next call did not revert as expected] test_DepositFeeAboveDenominatorMustBeRejected() (gas: 10710)
[FAIL: next call did not revert as expected] test_DepositFeeAtDenominatorMustBeRejected() (gas: 10665)
[FAIL: deposit fee did not reduce depositor claim: 1000000000 != 999000000] test_DepositFeeMustReduceFirstDepositorsClaim() (gas: 231887)
[FAIL: aUSDT custody diverged from accounting: 3000000 != 0] test_WithdrawalMustNotLeaveUnaccountedCustody() (gas: 250883)

Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)

Encountered a total of 6 failing tests, 39 tests succeeded

Tip: Run `forge test --rerun` to retry only the 6 failed tests

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..99bf3b162a04a3436b7efd9679aac1ace4314dcc
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,311 @@
+# USDT Yield Vault — pre-deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet in its current form.** The configured real
+USDT/Aave path cannot accept a deposit at all. Independently, the vault does not
+credit Aave yield to shareholders, its fee accounting creates unaccounted custody,
+and its owner-set deposit fee has no valid bound.
+
+No file under `src/` was changed. The existing `test/UsdtYieldVault.t.sol` and
+everything under `test/mocks/` were left unchanged. The reproductions are in the
+new files `test/UsdtYieldVaultMainnetFork.t.sol` and
+`test/UsdtYieldVaultAdversarial.t.sol`.
+
+## 1. Critical — every real-USDT deposit reverts before reaching Aave
+
+### What happens
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard
+`IERC20` interface. Mainnet USDT's `approve` succeeds with empty return data. A
+high-level Solidity interface call expects ABI-encoded return data for the declared
+`bool`, so the vault reverts immediately after USDT emits its approval event. The
+transaction rollback means the transfer and approval are undone and Aave is never
+called.
+
+The existing mock inherits OpenZeppelin ERC20 and returns a normal boolean, so it
+cannot detect this incompatibility.
+
+The test forks Ethereum at block `25,961,000`, uses exactly the USDT and Aave Pool
+addresses specified for launch, funds a depositor, and attempts the first deposit.
+
+### Evidence
+
+Command:
+
+```console
+forge test --match-test test_RealUsdtCanBeSuppliedToAaveThroughVault -vv
+```
+
+Actual output:
+
+```text
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 882.45ms
+Compiler run successful!
+2026-09-12T13:39:35.804936Z  WARN evm::traces::external: etherscan config not found
+2026-09-12T13:39:37.922099Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25961000"
+
+Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 10.30s (10.30s CPU time)
+2026-09-12T13:39:46.108842Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25961000")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+
+Ran 1 test suite in 10.30s (10.30s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+The focused trace locates the revert:
+
+Command:
+
+```console
+forge test --match-test test_RealUsdtCanBeSuppliedToAaveThroughVault -vvvv 2>&1 | rg 'UsdtYieldVault::deposit|approve\(0x87870|← \[Revert\]|test_RealUsdt'
+```
+
+Actual output:
+
+```text
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+  [1140582] UsdtYieldVaultMainnetForkTest::test_RealUsdtCanBeSuppliedToAaveThroughVault()
+    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
+    │   └─ ← [Revert] EvmError: Revert
+    └─ ← [Revert] EvmError: Revert
+  at UsdtYieldVaultMainnetForkTest.test_RealUsdtCanBeSuppliedToAaveThroughVault
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+```
+
+### Recommended fix
+
+Use OpenZeppelin `SafeERC20.forceApprove` (or a zero-then-set safe approval flow)
+instead of raw `IERC20.approve`. Add this pinned real-USDT/Aave fork test to CI using
+an archive-capable team RPC rather than relying permanently on the public endpoint
+embedded in the reproduction.
+
+## 2. High — Aave yield is never credited to shareholders
+
+### What happens
+
+All conversions and `totalAssets()` use `totalAssetsStored`, which changes only by
+deposit and withdrawal principal. They never read the vault's accruing aUSDT
+balance. Consequently, an increase in aUSDT does not increase share value or a
+user's claim. This defeats the vault's stated yield purpose and leaves all earned
+yield outside its accounting.
+
+The test models Aave's balance growth by increasing the vault's aUSDT balance from
+1,000 to 1,100 USDT. Alice's reported claim stays at 1,000 USDT.
+
+### Evidence
+
+Command:
+
+```console
+forge test --match-test test_AaveYieldMustIncreaseShareholderClaim -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.324927Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is absent from user accounting: 1000000000 != 1100000000] test_AaveYieldMustIncreaseShareholderClaim() (gas: 447202)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.32ms (459.48µs CPU time)
+
+Ran 1 test suite in 7.78ms (1.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is absent from user accounting: 1000000000 != 1100000000] test_AaveYieldMustIncreaseShareholderClaim() (gas: 447202)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+Base share conversions and `totalAssets()` on actual managed assets—normally the
+aUSDT balance plus any idle USDT—rather than a principal-only counter. Define how
+donations and rounding are handled and test multi-user deposit/withdraw sequences
+against the equality between custody and claims.
+
+## 3. High — the advertised fees are misaccounted and assets become stranded
+
+### What happens
+
+On deposit the vault mints shares from the fee-reduced amount but adds the gross
+amount to `totalAssetsStored`. For the first depositor, this immediately makes the
+entire purported deposit fee part of that same depositor's claim, so no deposit fee
+has actually been charged.
+
+On withdrawal it subtracts the gross claim from `totalAssetsStored` but asks Aave
+to return only the net amount. After the final shareholder exits, `totalShares` and
+`totalAssetsStored` are zero while the withdrawal fee remains as aUSDT owned by the
+vault. There is no sweep or accounting path for it. The contract comment says fees
+accrue to remaining shareholders, but when there are no remaining shareholders the
+fee is orphaned; finding 2 means receipt-token balance growth is not reflected even
+when shareholders do remain.
+
+### Evidence: deposit fee not charged
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeMustReduceFirstDepositorsClaim -vv
+```
+
+Actual output:
+
+```text
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.05s
+Compiler run successful!
+2026-09-12T13:38:42.604424Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: deposit fee did not reduce depositor claim: 1000000000 != 999000000] test_DepositFeeMustReduceFirstDepositorsClaim() (gas: 231887)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 835.64µs (126.68µs CPU time)
+
+Ran 1 test suite in 7.87ms (835.64µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: deposit fee did not reduce depositor claim: 1000000000 != 999000000] test_DepositFeeMustReduceFirstDepositorsClaim() (gas: 231887)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Evidence: custody remains after all accounting reaches zero
+
+Command:
+
+```console
+forge test --match-test test_WithdrawalMustNotLeaveUnaccountedCustody -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.325821Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: aUSDT custody diverged from accounting: 3000000 != 0] test_WithdrawalMustNotLeaveUnaccountedCustody() (gas: 250883)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 917.94µs (152.53µs CPU time)
+
+Ran 1 test suite in 9.72ms (917.94µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: aUSDT custody diverged from accounting: 3000000 != 0] test_WithdrawalMustNotLeaveUnaccountedCustody() (gas: 250883)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+First specify who owns each fee. Then implement that policy consistently in both
+share minting and asset accounting. If fees belong to remaining shareholders, keep
+them in the asset base used by conversions and explicitly handle the last-share
+withdrawal so nothing becomes ownerless. If fees belong elsewhere, transfer or
+accrue an explicit claim to that recipient. Add a handler-driven invariant asserting
+that every unit in custody is represented by an intended claim after arbitrary
+multi-user sequences.
+
+## 4. Medium — the owner can set a fee that makes deposits impossible
+
+### What happens
+
+`setDepositFee` accepts every `uint256`. At exactly 10,000 bps, every otherwise
+valid deposit computes zero net assets and reverts with `NoSharesMinted`. Above
+10,000 bps, `amount - fee` underflows and panics. Both sides of the economically
+valid upper boundary are accepted by the setter, allowing an accidental or
+compromised owner action to disable all deposits.
+
+### Evidence: boundary value accepted
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeAtDenominatorMustBeRejected -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.315104Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAtDenominatorMustBeRejected() (gas: 10665)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 932.99µs (58.81µs CPU time)
+
+Ran 1 test suite in 8.55ms (932.99µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAtDenominatorMustBeRejected() (gas: 10665)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Evidence: above-boundary value accepted
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeAboveDenominatorMustBeRejected -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.318600Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAboveDenominatorMustBeRejected() (gas: 10710)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 720.63µs (56.85µs CPU time)
+
+Ran 1 test suite in 9.86ms (720.63µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAboveDenominatorMustBeRejected() (gas: 10710)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+Reject fees at or above `BPS_DENOMINATOR` in both the constructor and setter, and
+consider a substantially lower governance maximum plus timelock appropriate to the
+product. Fuzz the complete accepted domain and explicitly test zero, the maximum
+accepted value, 10,000, and 10,001 bps.
+
+## Why the original 39 green tests and 100% coverage did not protect the launch
+
+The original suite never calls the deployed USDT or Aave contracts. Its ERC20 mock
+returns standard ABI data that real USDT does not. It also asserts
+`totalAssetsStored` against itself and uses weak checks such as `assertGt(..., 0)`
+for conversions and the share price. Line/function coverage confirms those lines
+executed; it does not constrain custody, yield attribution, fee bounds, or external
+token compatibility.
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d113d8a98fe015ee3174d6a959da73bd38f5a09
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_000;
+    string internal constant RPC_URL = "https://eth-mainnet.public.blastapi.io";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

exec
/bin/bash -lc "git status --short
git diff -- src test/UsdtYieldVault.t.sol test/mocks
git diff --check
rg -n '"'^## [1-4]'"\\.' FINDINGS.md" in /tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001
 succeeded in 0ms:
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..99bf3b162a04a3436b7efd9679aac1ace4314dcc
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,311 @@
+# USDT Yield Vault — pre-deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet in its current form.** The configured real
+USDT/Aave path cannot accept a deposit at all. Independently, the vault does not
+credit Aave yield to shareholders, its fee accounting creates unaccounted custody,
+and its owner-set deposit fee has no valid bound.
+
+No file under `src/` was changed. The existing `test/UsdtYieldVault.t.sol` and
+everything under `test/mocks/` were left unchanged. The reproductions are in the
+new files `test/UsdtYieldVaultMainnetFork.t.sol` and
+`test/UsdtYieldVaultAdversarial.t.sol`.
+
+## 1. Critical — every real-USDT deposit reverts before reaching Aave
+
+### What happens
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard
+`IERC20` interface. Mainnet USDT's `approve` succeeds with empty return data. A
+high-level Solidity interface call expects ABI-encoded return data for the declared
+`bool`, so the vault reverts immediately after USDT emits its approval event. The
+transaction rollback means the transfer and approval are undone and Aave is never
+called.
+
+The existing mock inherits OpenZeppelin ERC20 and returns a normal boolean, so it
+cannot detect this incompatibility.
+
+The test forks Ethereum at block `25,961,000`, uses exactly the USDT and Aave Pool
+addresses specified for launch, funds a depositor, and attempts the first deposit.
+
+### Evidence
+
+Command:
+
+```console
+forge test --match-test test_RealUsdtCanBeSuppliedToAaveThroughVault -vv
+```
+
+Actual output:
+
+```text
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 882.45ms
+Compiler run successful!
+2026-09-12T13:39:35.804936Z  WARN evm::traces::external: etherscan config not found
+2026-09-12T13:39:37.922099Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25961000"
+
+Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 10.30s (10.30s CPU time)
+2026-09-12T13:39:46.108842Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25961000")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+
+Ran 1 test suite in 10.30s (10.30s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+The focused trace locates the revert:
+
+Command:
+
+```console
+forge test --match-test test_RealUsdtCanBeSuppliedToAaveThroughVault -vvvv 2>&1 | rg 'UsdtYieldVault::deposit|approve\(0x87870|← \[Revert\]|test_RealUsdt'
+```
+
+Actual output:
+
+```text
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+  [1140582] UsdtYieldVaultMainnetForkTest::test_RealUsdtCanBeSuppliedToAaveThroughVault()
+    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
+    │   └─ ← [Revert] EvmError: Revert
+    └─ ← [Revert] EvmError: Revert
+  at UsdtYieldVaultMainnetForkTest.test_RealUsdtCanBeSuppliedToAaveThroughVault
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+```
+
+### Recommended fix
+
+Use OpenZeppelin `SafeERC20.forceApprove` (or a zero-then-set safe approval flow)
+instead of raw `IERC20.approve`. Add this pinned real-USDT/Aave fork test to CI using
+an archive-capable team RPC rather than relying permanently on the public endpoint
+embedded in the reproduction.
+
+## 2. High — Aave yield is never credited to shareholders
+
+### What happens
+
+All conversions and `totalAssets()` use `totalAssetsStored`, which changes only by
+deposit and withdrawal principal. They never read the vault's accruing aUSDT
+balance. Consequently, an increase in aUSDT does not increase share value or a
+user's claim. This defeats the vault's stated yield purpose and leaves all earned
+yield outside its accounting.
+
+The test models Aave's balance growth by increasing the vault's aUSDT balance from
+1,000 to 1,100 USDT. Alice's reported claim stays at 1,000 USDT.
+
+### Evidence
+
+Command:
+
+```console
+forge test --match-test test_AaveYieldMustIncreaseShareholderClaim -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.324927Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is absent from user accounting: 1000000000 != 1100000000] test_AaveYieldMustIncreaseShareholderClaim() (gas: 447202)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.32ms (459.48µs CPU time)
+
+Ran 1 test suite in 7.78ms (1.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is absent from user accounting: 1000000000 != 1100000000] test_AaveYieldMustIncreaseShareholderClaim() (gas: 447202)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+Base share conversions and `totalAssets()` on actual managed assets—normally the
+aUSDT balance plus any idle USDT—rather than a principal-only counter. Define how
+donations and rounding are handled and test multi-user deposit/withdraw sequences
+against the equality between custody and claims.
+
+## 3. High — the advertised fees are misaccounted and assets become stranded
+
+### What happens
+
+On deposit the vault mints shares from the fee-reduced amount but adds the gross
+amount to `totalAssetsStored`. For the first depositor, this immediately makes the
+entire purported deposit fee part of that same depositor's claim, so no deposit fee
+has actually been charged.
+
+On withdrawal it subtracts the gross claim from `totalAssetsStored` but asks Aave
+to return only the net amount. After the final shareholder exits, `totalShares` and
+`totalAssetsStored` are zero while the withdrawal fee remains as aUSDT owned by the
+vault. There is no sweep or accounting path for it. The contract comment says fees
+accrue to remaining shareholders, but when there are no remaining shareholders the
+fee is orphaned; finding 2 means receipt-token balance growth is not reflected even
+when shareholders do remain.
+
+### Evidence: deposit fee not charged
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeMustReduceFirstDepositorsClaim -vv
+```
+
+Actual output:
+
+```text
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.05s
+Compiler run successful!
+2026-09-12T13:38:42.604424Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: deposit fee did not reduce depositor claim: 1000000000 != 999000000] test_DepositFeeMustReduceFirstDepositorsClaim() (gas: 231887)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 835.64µs (126.68µs CPU time)
+
+Ran 1 test suite in 7.87ms (835.64µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: deposit fee did not reduce depositor claim: 1000000000 != 999000000] test_DepositFeeMustReduceFirstDepositorsClaim() (gas: 231887)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Evidence: custody remains after all accounting reaches zero
+
+Command:
+
+```console
+forge test --match-test test_WithdrawalMustNotLeaveUnaccountedCustody -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.325821Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: aUSDT custody diverged from accounting: 3000000 != 0] test_WithdrawalMustNotLeaveUnaccountedCustody() (gas: 250883)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 917.94µs (152.53µs CPU time)
+
+Ran 1 test suite in 9.72ms (917.94µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: aUSDT custody diverged from accounting: 3000000 != 0] test_WithdrawalMustNotLeaveUnaccountedCustody() (gas: 250883)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+First specify who owns each fee. Then implement that policy consistently in both
+share minting and asset accounting. If fees belong to remaining shareholders, keep
+them in the asset base used by conversions and explicitly handle the last-share
+withdrawal so nothing becomes ownerless. If fees belong elsewhere, transfer or
+accrue an explicit claim to that recipient. Add a handler-driven invariant asserting
+that every unit in custody is represented by an intended claim after arbitrary
+multi-user sequences.
+
+## 4. Medium — the owner can set a fee that makes deposits impossible
+
+### What happens
+
+`setDepositFee` accepts every `uint256`. At exactly 10,000 bps, every otherwise
+valid deposit computes zero net assets and reverts with `NoSharesMinted`. Above
+10,000 bps, `amount - fee` underflows and panics. Both sides of the economically
+valid upper boundary are accepted by the setter, allowing an accidental or
+compromised owner action to disable all deposits.
+
+### Evidence: boundary value accepted
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeAtDenominatorMustBeRejected -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.315104Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAtDenominatorMustBeRejected() (gas: 10665)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 932.99µs (58.81µs CPU time)
+
+Ran 1 test suite in 8.55ms (932.99µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAtDenominatorMustBeRejected() (gas: 10665)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Evidence: above-boundary value accepted
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeAboveDenominatorMustBeRejected -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.318600Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAboveDenominatorMustBeRejected() (gas: 10710)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 720.63µs (56.85µs CPU time)
+
+Ran 1 test suite in 9.86ms (720.63µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAboveDenominatorMustBeRejected() (gas: 10710)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+Reject fees at or above `BPS_DENOMINATOR` in both the constructor and setter, and
+consider a substantially lower governance maximum plus timelock appropriate to the
+product. Fuzz the complete accepted domain and explicitly test zero, the maximum
+accepted value, 10,000, and 10,001 bps.
+
+## Why the original 39 green tests and 100% coverage did not protect the launch
+
+The original suite never calls the deployed USDT or Aave contracts. Its ERC20 mock
+returns standard ABI data that real USDT does not. It also asserts
+`totalAssetsStored` against itself and uses weak checks such as `assertGt(..., 0)`
+for conversions and the share price. Line/function coverage confirms those lines
+executed; it does not constrain custody, yield attribution, fee bounds, or external
+token compatibility.
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d113d8a98fe015ee3174d6a959da73bd38f5a09
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_000;
+    string internal constant RPC_URL = "https://eth-mainnet.public.blastapi.io";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

codex
Do not ship this vault Monday.

I added:

- [FINDINGS.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001/FINDINGS.md)
- [UsdtYieldVaultAdversarial.t.sol](/tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultAdversarial.t.sol)
- [UsdtYieldVaultMainnetFork.t.sol](/tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol)

Four findings are documented with exact commands, terminal output, impact, and proposed fixes:

1. Critical: real USDT deposits revert because raw `IERC20.approve` cannot decode USDT’s empty return data.
2. High: accrued aUSDT yield never enters shareholder accounting.
3. High: deposit fees are not actually charged as described, while withdrawal fees become unaccounted, stranded aUSDT.
4. Medium: the owner can set fees at or above 10,000 bps and disable deposits.

Final test result: the original 39 tests still pass, while the six new safety checks fail against the unchanged contract. No files under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` were modified.
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..99bf3b162a04a3436b7efd9679aac1ace4314dcc
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,311 @@
+# USDT Yield Vault — pre-deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet in its current form.** The configured real
+USDT/Aave path cannot accept a deposit at all. Independently, the vault does not
+credit Aave yield to shareholders, its fee accounting creates unaccounted custody,
+and its owner-set deposit fee has no valid bound.
+
+No file under `src/` was changed. The existing `test/UsdtYieldVault.t.sol` and
+everything under `test/mocks/` were left unchanged. The reproductions are in the
+new files `test/UsdtYieldVaultMainnetFork.t.sol` and
+`test/UsdtYieldVaultAdversarial.t.sol`.
+
+## 1. Critical — every real-USDT deposit reverts before reaching Aave
+
+### What happens
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard
+`IERC20` interface. Mainnet USDT's `approve` succeeds with empty return data. A
+high-level Solidity interface call expects ABI-encoded return data for the declared
+`bool`, so the vault reverts immediately after USDT emits its approval event. The
+transaction rollback means the transfer and approval are undone and Aave is never
+called.
+
+The existing mock inherits OpenZeppelin ERC20 and returns a normal boolean, so it
+cannot detect this incompatibility.
+
+The test forks Ethereum at block `25,961,000`, uses exactly the USDT and Aave Pool
+addresses specified for launch, funds a depositor, and attempts the first deposit.
+
+### Evidence
+
+Command:
+
+```console
+forge test --match-test test_RealUsdtCanBeSuppliedToAaveThroughVault -vv
+```
+
+Actual output:
+
+```text
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 882.45ms
+Compiler run successful!
+2026-09-12T13:39:35.804936Z  WARN evm::traces::external: etherscan config not found
+2026-09-12T13:39:37.922099Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25961000"
+
+Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 10.30s (10.30s CPU time)
+2026-09-12T13:39:46.108842Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25961000")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+
+Ran 1 test suite in 10.30s (10.30s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+The focused trace locates the revert:
+
+Command:
+
+```console
+forge test --match-test test_RealUsdtCanBeSuppliedToAaveThroughVault -vvvv 2>&1 | rg 'UsdtYieldVault::deposit|approve\(0x87870|← \[Revert\]|test_RealUsdt'
+```
+
+Actual output:
+
+```text
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+  [1140582] UsdtYieldVaultMainnetForkTest::test_RealUsdtCanBeSuppliedToAaveThroughVault()
+    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
+    │   └─ ← [Revert] EvmError: Revert
+    └─ ← [Revert] EvmError: Revert
+  at UsdtYieldVaultMainnetForkTest.test_RealUsdtCanBeSuppliedToAaveThroughVault
+[FAIL: EvmError: Revert] test_RealUsdtCanBeSuppliedToAaveThroughVault() (gas: 1140582)
+```
+
+### Recommended fix
+
+Use OpenZeppelin `SafeERC20.forceApprove` (or a zero-then-set safe approval flow)
+instead of raw `IERC20.approve`. Add this pinned real-USDT/Aave fork test to CI using
+an archive-capable team RPC rather than relying permanently on the public endpoint
+embedded in the reproduction.
+
+## 2. High — Aave yield is never credited to shareholders
+
+### What happens
+
+All conversions and `totalAssets()` use `totalAssetsStored`, which changes only by
+deposit and withdrawal principal. They never read the vault's accruing aUSDT
+balance. Consequently, an increase in aUSDT does not increase share value or a
+user's claim. This defeats the vault's stated yield purpose and leaves all earned
+yield outside its accounting.
+
+The test models Aave's balance growth by increasing the vault's aUSDT balance from
+1,000 to 1,100 USDT. Alice's reported claim stays at 1,000 USDT.
+
+### Evidence
+
+Command:
+
+```console
+forge test --match-test test_AaveYieldMustIncreaseShareholderClaim -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.324927Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is absent from user accounting: 1000000000 != 1100000000] test_AaveYieldMustIncreaseShareholderClaim() (gas: 447202)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.32ms (459.48µs CPU time)
+
+Ran 1 test suite in 7.78ms (1.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: accrued Aave yield is absent from user accounting: 1000000000 != 1100000000] test_AaveYieldMustIncreaseShareholderClaim() (gas: 447202)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+Base share conversions and `totalAssets()` on actual managed assets—normally the
+aUSDT balance plus any idle USDT—rather than a principal-only counter. Define how
+donations and rounding are handled and test multi-user deposit/withdraw sequences
+against the equality between custody and claims.
+
+## 3. High — the advertised fees are misaccounted and assets become stranded
+
+### What happens
+
+On deposit the vault mints shares from the fee-reduced amount but adds the gross
+amount to `totalAssetsStored`. For the first depositor, this immediately makes the
+entire purported deposit fee part of that same depositor's claim, so no deposit fee
+has actually been charged.
+
+On withdrawal it subtracts the gross claim from `totalAssetsStored` but asks Aave
+to return only the net amount. After the final shareholder exits, `totalShares` and
+`totalAssetsStored` are zero while the withdrawal fee remains as aUSDT owned by the
+vault. There is no sweep or accounting path for it. The contract comment says fees
+accrue to remaining shareholders, but when there are no remaining shareholders the
+fee is orphaned; finding 2 means receipt-token balance growth is not reflected even
+when shareholders do remain.
+
+### Evidence: deposit fee not charged
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeMustReduceFirstDepositorsClaim -vv
+```
+
+Actual output:
+
+```text
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.05s
+Compiler run successful!
+2026-09-12T13:38:42.604424Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: deposit fee did not reduce depositor claim: 1000000000 != 999000000] test_DepositFeeMustReduceFirstDepositorsClaim() (gas: 231887)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 835.64µs (126.68µs CPU time)
+
+Ran 1 test suite in 7.87ms (835.64µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: deposit fee did not reduce depositor claim: 1000000000 != 999000000] test_DepositFeeMustReduceFirstDepositorsClaim() (gas: 231887)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Evidence: custody remains after all accounting reaches zero
+
+Command:
+
+```console
+forge test --match-test test_WithdrawalMustNotLeaveUnaccountedCustody -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.325821Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: aUSDT custody diverged from accounting: 3000000 != 0] test_WithdrawalMustNotLeaveUnaccountedCustody() (gas: 250883)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 917.94µs (152.53µs CPU time)
+
+Ran 1 test suite in 9.72ms (917.94µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: aUSDT custody diverged from accounting: 3000000 != 0] test_WithdrawalMustNotLeaveUnaccountedCustody() (gas: 250883)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+First specify who owns each fee. Then implement that policy consistently in both
+share minting and asset accounting. If fees belong to remaining shareholders, keep
+them in the asset base used by conversions and explicitly handle the last-share
+withdrawal so nothing becomes ownerless. If fees belong elsewhere, transfer or
+accrue an explicit claim to that recipient. Add a handler-driven invariant asserting
+that every unit in custody is represented by an intended claim after arbitrary
+multi-user sequences.
+
+## 4. Medium — the owner can set a fee that makes deposits impossible
+
+### What happens
+
+`setDepositFee` accepts every `uint256`. At exactly 10,000 bps, every otherwise
+valid deposit computes zero net assets and reverts with `NoSharesMinted`. Above
+10,000 bps, `amount - fee` underflows and panics. Both sides of the economically
+valid upper boundary are accepted by the setter, allowing an accidental or
+compromised owner action to disable all deposits.
+
+### Evidence: boundary value accepted
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeAtDenominatorMustBeRejected -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.315104Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAtDenominatorMustBeRejected() (gas: 10665)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 932.99µs (58.81µs CPU time)
+
+Ran 1 test suite in 8.55ms (932.99µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAtDenominatorMustBeRejected() (gas: 10665)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Evidence: above-boundary value accepted
+
+Command:
+
+```console
+forge test --match-test test_DepositFeeAboveDenominatorMustBeRejected -vv
+```
+
+Actual output:
+
+```text
+No files changed, compilation skipped
+2026-09-12T13:38:48.318600Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAboveDenominatorMustBeRejected() (gas: 10710)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 720.63µs (56.85µs CPU time)
+
+Ran 1 test suite in 9.86ms (720.63µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
+[FAIL: next call did not revert as expected] test_DepositFeeAboveDenominatorMustBeRejected() (gas: 10710)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Recommended fix
+
+Reject fees at or above `BPS_DENOMINATOR` in both the constructor and setter, and
+consider a substantially lower governance maximum plus timelock appropriate to the
+product. Fuzz the complete accepted domain and explicitly test zero, the maximum
+accepted value, 10,000, and 10,001 bps.
+
+## Why the original 39 green tests and 100% coverage did not protect the launch
+
+The original suite never calls the deployed USDT or Aave contracts. Its ERC20 mock
+returns standard ABI data that real USDT does not. It also asserts
+`totalAssetsStored` against itself and uses weak checks such as `assertGt(..., 0)`
+for conversions and the share price. Line/function coverage confirms those lines
+executed; it does not constrain custody, yield attribution, fee bounds, or external
+token compatibility.
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..632fa59a1556a0aa582872e9d2eae6181c3641ed
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,72 @@
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
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+
+    address internal owner = makeAddr("owner");
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    function test_DepositFeeMustReduceFirstDepositorsClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // A 10 bps deposit fee means Alice's pre-withdrawal claim must be 999 USDT.
+        assertEq(vault.balanceOfUnderlying(alice), 999e6, "deposit fee did not reduce depositor claim");
+    }
+
+    function test_WithdrawalMustNotLeaveUnaccountedCustody() public {
+        uint256 shares = _deposit(alice, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares);
+
+        // With no shares left, no user funds should remain silently held by the vault.
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "aUSDT custody diverged from accounting");
+    }
+
+    function test_AaveYieldMustIncreaseShareholderClaim() public {
+        _deposit(alice, 1_000e6);
+
+        // Model Aave interest by increasing the vault's receipt-token balance by 100 USDT.
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), 1_100e6, "accrued Aave yield is absent from user accounting");
+    }
+
+    function test_DepositFeeAtDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR());
+    }
+
+    function test_DepositFeeAboveDenominatorMustBeRejected() public {
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8d113d8a98fe015ee3174d6a959da73bd38f5a09
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
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant FORK_BLOCK = 25_961_000;
+    string internal constant RPC_URL = "https://eth-mainnet.public.blastapi.io";
+
+    function test_RealUsdtCanBeSuppliedToAaveThroughVault() public {
+        vm.createSelectFork(RPC_URL, FORK_BLOCK);
+
+        address depositor = makeAddr("mainnetDepositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, depositor, 1_000e6);
+
+        vm.prank(depositor);
+        (bool approved,) = USDT.call(abi.encodeCall(IERC20.approve, (address(vault), type(uint256).max)));
+        assertTrue(approved, "depositor approval failed");
+
+        vm.startPrank(depositor);
+        uint256 shares = vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(shares, 999e18);
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+        assertEq(IERC20(USDT).balanceOf(depositor), 0);
+    }
+}

tokens used
50,112
````

## final message

Do not ship this vault Monday.

I added:

- [FINDINGS.md](/tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001/FINDINGS.md)
- [UsdtYieldVaultAdversarial.t.sol](/tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultAdversarial.t.sol)
- [UsdtYieldVaultMainnetFork.t.sol](/tmp/ethskills-pr101-workspaces/2026-09-12T015056Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol)

Four findings are documented with exact commands, terminal output, impact, and proposed fixes:

1. Critical: real USDT deposits revert because raw `IERC20.approve` cannot decode USDT’s empty return data.
2. High: accrued aUSDT yield never enters shareholder accounting.
3. High: deposit fees are not actually charged as described, while withdrawal fees become unaccounted, stranded aUSDT.
4. Medium: the owner can set fees at or above 10,000 bps and disable deposits.

Final test result: the original 39 tests still pass, while the six new safety checks fail against the unchanged contract. No files under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` were modified.
