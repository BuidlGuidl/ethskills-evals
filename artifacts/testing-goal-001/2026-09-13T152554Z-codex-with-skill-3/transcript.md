# Executor transcript — 2026-09-13T152554Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a09b61-63aa-7160-a82a-2667ddb101cf
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
I’m using the `testing` skill because this is a Foundry test-evidence and deployment-readiness review. I’ll first read its full instructions, then inspect the repository and baseline tests before adding only new files under `test/`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: testing
description: Use when writing or reviewing Foundry tests, when deciding whether a suite is enough to deploy, or when a green run or a coverage percentage is offered as evidence that a contract is safe. Covers fuzz, fork and invariant testing with `forge`. Finding and evidencing defects by running tests is in scope; auditing source by reading it belongs to `security` and `audit`.
---

# Smart Contract Testing

A green suite and 100% coverage are not evidence of safety. Coverage records which lines ran, never whether an assertion could have failed. Before signing off, name which of the three searches below the suite actually performed. If the answer is none, it has only confirmed the cases someone already thought of.

For deployment sign-off, map each applicable risk to a search before concluding: configurable value math to fuzzing, stateful accounting to a handler invariant, and external integrations to a pinned fork. Run each applicable search. Inspection and targeted regression tests can confirm a suspected defect, but do not replace the search.

## Make tests capable of failing

Rewrite any test that mirrors the implementation: stored state asserted against the value just written to it, a getter against the variable it returns, a constant against itself, constructor state against the constructor argument. These execute every line and constrain nothing.

Assert properties instead — round-trips, conservation between accounting and custody, monotonicity, access boundaries. Skip anything whose failure would be a bug in the compiler or in a dependency you did not write.

A bug that accumulates across a sequence cannot be seen by any test that exercises one operation in isolation, however many such tests exist. "Every operation is correct on its own" is the symptom, not the defence.

## Fuzz the domain instead of picking from it

Before deploy, every owner-settable number that feeds value math — fee basis points, ratios, caps, exchange rates — needs a fuzz test over its whole accepted domain, using `bound()` rather than `vm.assume()`. Hand-picked values walk one branch; the fuzzer finds the value nobody proposed.

Reaching a suspected bug by reading the code and then writing one test for it confirms what you already believed. It is not a substitute for the search, and it stops at the first defect you happened to imagine.

For an integer boundary `b`, exercise `b - 1`, `b`, and `b + 1` where representable. Treat the exact boundary and the first value beyond it as separate cases and preserve evidence for each distinct failure.

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

One post-operation mismatch proves divergence, not accumulation. When claiming cumulative drift, show the gap after at least two state transitions, or provide a stateful-invariant counterexample whose call sequence demonstrates the growth.

Point `targetContract` at a handler, never at the contract under test. Called directly, the fuzzer supplies random senders that hold no tokens and granted no approvals, so nearly every call reverts. Reverts are discarded rather than failing the run, and the invariant is then asserted against a contract that never left its initial state — green because nothing happened.

The handler owns setup: funded and approved actors, inputs bounded to valid ranges, multiple actors where the property is about interaction between them.

Read the calls/reverts statistics in the run output every time. A revert rate near 100% means the run proved nothing; set `fail_on_revert = true` to surface it while building the handler.

## Before deploy

- [ ] No test asserts the implementation back to itself.
- [ ] Every owner-settable number feeding value math is fuzzed across its domain, both sides of each bound included.
- [ ] Every external integration and quirky token is exercised on a pinned fork against the real deployment, on an endpoint confirmed to serve that block.
- [ ] Stateful contracts have a handler-driven invariant tying accounting to custody, with a revert rate low enough that the sequences reached real states.
- [ ] Access control, zero, and max-value cases revert as intended.

exec
/bin/bash -lc "pwd && rg --files -g '"'!*cache*'"' -g '"'!out/**'"' && sed -n '1,260p' src/UsdtYieldVault.sol && sed -n '1,340p' test/UsdtYieldVault.t.sol && sed -n '1,200p' foundry.toml" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
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
The existing suite mostly checks implementation-shaped outputs and does not search the three deployment risks that apply here: fee-domain fuzzing, stateful accounting/custody invariants, and a pinned mainnet fork against real USDT/Aave. I’m now checking the mocks and RPC availability so each claimed defect can be backed by a standalone failing command.
exec
/bin/bash -lc "sed -n '1,280p' test/mocks/MockAavePool.sol && sed -n '1,220p' test/mocks/MockUSDT.sol && sed -n '1,200p' src/interfaces/IAavePool.sol && sed -n '1,240p' README.md && env | rg 'RPC|ETH|MAINNET|ALCHEMY|INFURA' || true && forge test" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
 succeeded in 116ms:
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
# UsdtYieldVault

Pooled USDT vault that routes deposits into Aave V3 and tracks depositor
ownership with internal shares.

Deposits and withdrawals each carry a fee in basis points. Both fees stay
supplied in Aave and accrue to the remaining shareholders — they are not swept
to the owner.

Mainnet targets:

| Contract | Address |
| --- | --- |
| USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| Aave V3 Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
| aUSDT | `0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a` |

## Development

```bash
forge build
forge test
forge coverage
```
ARWEAVE_KEY={"kty":"RSA","n":"zl_ZnM83r0muDqbdRJpvx6aVSkIla-pCmSTz4hERt6VAa3UlNTjsOtBBs398-_KkjeU8kbNmMA2v085RaLfb8K-sL95Ji1vws8YOKlDz6Ep9XPza9bBWX8CxFGQdKihiG_hnBXhWKxG1i4UmBQA9p7_gtFc-8qpWkniv0mC7XFf5ac1zSbry1Ce-6VrDJt4jH6Jc5nqvX78IGpnFVRG5q8FP1V87rgzuIX9Ln9iW8H4Sx4gJlmaB-LdqQyJag0yqGzrLW34NH0iVNEIhXh2NRThZE16WnDJImfwfBVa8z6o0wDVgJTnDXS9CwrkJ0obTw7j7uTHqVz1QOobwQja7zeO-GgghtmbAzXgAsFcU_zrH1Y2iHlsERvLuBrhjlsLMheRXHM8RlkFmIedNg2P7BdKygCyW6lFZImKZmJgTTpGCJLHjV43EnETKw6gNsG_CidIwX8H8QhnwV94vLpRroP89NrU6rm-_ZV0RyqElIfW_FnuWocq6EBOMIdGp1M6a_Q-h2qImHgXPGzqD0b65_YoZjBq3bTzQEC0hG3O8_Erume9_vEIGwTBY0RxaFoTjL2BqEurR95plucbWienO2a9DboGk1GaxmmcSHE5_i9XjFdWfJeA2RclPqy52n1IR2vNEhGd7syqU7GWcpWiQjH4HhGeREM0uJESHEVCrxrU","e":"AQAB","d":"jIntkcHzs-VDKSstR8i8EoQ46mb9QO45CD2H8A2buSpKImOWQRZQmQS1mV1aaeElepP_mWFIV7UaZez8t4ltuAyJ_9cq0kJ8OpDHmL2kPC5uDOMM4X-CcpawgKhkzA7QMSgKUElQtOfMcATujT1Kv3AFwAoiDfM-HWUepu_E5-_pI8oLlsw_DYc7lYJ_n3prBOH2zeYCg_t9s0_AeFwnyvVMPowqAi9AA4PCpkpDD-drNoJHtSp9nDibnrhIV13gAccaMWY33XP6V6opOwR47gifcHdbrWb41hRBs8sLrYfFgJdYsEET7-N9XUnRjJLQp1rT4ZxCb8KLXjACcbUAUs4R6F1iCcvXvz8kF3CtVd3qPxBGH4-r4Gd08-o49LzslfbWgQqy20swoe8raisqxclxjxRfogt3YorBB8sU2F345O9wajqxqONXeY3wmUyVdAm2i2Nzmofejsc8wXtj7I31I2judB7BCoKPFNN5306XnuR11aji4X6QtJSSaSzyaf_36rwc-2SA6KEFH-JldX9B91Do-woytDrsTBiPTttLV9JueSC-fICRpIlnfGLhqUJWOHcfA7gC6YbS0p1GLI9AugTD4GnygdMxUwXGkt-hBo5TFbmbeuI5SHkA_1KoKkws8e4NjNaJeJyz1QrZmF6-I8v65tFg4cT3T24a0gE","p":"81RiXqpNDdPt2JzNlbGNHvCWzqpAS6IUJJ5pjh9mfJmoRPCwBnquvfHm1DdQzbWoZaxuOfEazKxSxhkxcGYAVvvWRpCx7LerMrU6a6BWyi03Q26I7yKvoI6cfggLmTuxC5UGjwRgZDOUbAiOYNqzylQeL2O8OWqHOERvVEkPInGPorEBWlK_T_hqbnt8anhjBphkwpWABQ2afe1q3yXhmZLlF8_leZZxJZEpOipT9ixnKBdNeibaKdZn9h6smc0a2VmnSDrlDKdFQh0mkxLKpSffKd-AQlZ5UvGqlqSs2OdyW96xSPhIe0jZMt0jxG3n7_2PpJIsblqI7pts65rF9Q","q":"2R7ZFZPGd5TUkeQsyr7IlAt7w1rxA2AiD3nqSQqAVrX_jImKrza45u3XD9gFyPvVsrtiOuIpt5R9dXP2y-tfcYyQnIHp-TnMzTQapfg5cBWlWFpmfSLYN1GzohMCrMdhgNt-tberdJzMkq4sXtwiD52ZaVKDX63j9bANaQs0A8-hPitl-WpbbqcKXDFCtnA0MJwznUjf7SWB5JEue1rj-phRkHGDeh7yAry0fzGS44bogKV98yHVwY-NOxjXZ2Hn1CaM1Yy8DKrOQdBolaNVz2_dHKXMzSqyfcEYJ7TOX2EaIbikJYx5fqdXKHGOD8BgkbfwXgCzOOm62bHAbKvFwQ","dp":"8tIquD1KV5o9qAQSRGfCZDXCyMmtD8zWPRS4UVOUepL8EI__mPekmXhk2TG6OQ4m1g-Uj83C6KyujXFmnLutayA1XIXYiFlhRmEDw5NmCKvGkkwj6j-684ZdNIfiyy9-Jgi5Ws8LQfMXEhgXvR-Ce04mMTReCQ39knD4iCvAJqccp0XsC663q55C163zImywpUw-gM-fyWsh2LisBbNPxmmIpJKadRNkJhEOCzViRC9bYe6fKl7LJyUG6d0CcRj0yiFlhfb_y_jAbJGahPojr1xynt6ip5CT0enISjxbILkWrgc085SRADZaSR_VKZhj9GIcjiYwoI9IRpRjxVnWYQ","dq":"CpaSh5bZSuObKjIybQC4z19v_arlrgB2KMMNRdqZP6FIgRYECV9lzP00S7WBMrf1R-4TcEOvPSCkraGmG3OzB9qPAtLjEiBbeHZeBlIAmxKzKYffD6MvYCM_21uJ-dsPSjVqDHqUhe9PmqebylR55MEOxjAb8AKO52BahxDgzH7HojyDkJI7Oz4yJyTP2A3IvcYgTj9LjEkT-I2L8sAP9hyPfbfLbZ0suC1zr_A-9ZGSrRNk_QJdZj8V6BfiCUyg_ZuTqqZeVU_PFy6Oqx14BdGyur7rKeY3JiLQhr8ugUA_Af37I0micya9_V7sSqBbFUAfHLZ0BwZ-8jbU53fJAQ","qi":"R_gyI-ByjUu2ZBEu82_IcoSmQLiyWAxRgsjccZWb9APhV3tPSXyuTKTihJpshmJPBS6QWVT1JFoAoLRz5R07_0G3zO03G1t2T58GcIuez5Pulcmo4-UgG_Bj7TpkBFuRWJcNADKOhOcbz6rfcSIn0zArc87JxPIXIRVDfFSLBDdtz6W0lugb5rSUySSUsmGarftOkn7jdDb7n2t1pLs_C_FE3hJiu_AMPxgIppzAHScgte9T_b9HX76cZG4jmAEpS1gH7KWZfscacuJusguReolaRbfcQJhbwrutUSzycekCMkM1MGQFbryUNWR5V1Sn57vw--XX829mLIbL3ZDF3Q"}
No files changed, compilation skipped
2026-09-13T15:27:42.842419Z  WARN evm::traces::external: etherscan config not found

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
Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 2.66ms (6.59ms CPU time)

Ran 1 test suite in 8.11ms (2.66ms CPU time): 39 tests passed, 0 failed, 0 skipped (39 total tests)
2026-09-13T15:27:42.853489Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

exec
/bin/bash -lc 'cast block-number --rpc-url https://ethereum-rpc.publicnode.com' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
 succeeded in 207ms:
25969409

codex
The real integration exposes a particularly important hypothesis: USDT’s non-standard return behavior may make the vault’s raw `approve` call revert even though the mock succeeds. Separately, the accounting appears to remove gross assets while Aave only returns the net amount, so withdrawal fees can become permanently untracked. I’m turning both into reproducible tests, plus a whole-domain fuzz search of the owner-set fee.
apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/test/AccountingInvariantEvidence.t.sol
/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/test/FeeDomainEvidence.t.sol
/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/test/MainnetForkEvidence.t.sol
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..6f1ed429db22cc827535d3a35744a9195e0dc863
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..46038fdd7ca95c1e8d38753c4d978c2e95862617
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..6f1ed429db22cc827535d3a35744a9195e0dc863
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..46038fdd7ca95c1e8d38753c4d978c2e95862617
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge fmt --check && forge test --match-path test/FeeDomainEvidence.t.sol -vvv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
 exited 1 in 1620ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 899.65ms
Compiler run successful!
2026-09-13T15:29:02.989884Z  WARN evm::traces::external: etherscan config not found

Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
Traces:
  [37544] FeeDomainEvidenceTest::testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(14177312816443874610399604065013229075155880567552867 [1.417e52])
    ├─ [249] UsdtYieldVault::BPS_DENOMINATOR() [staticcall]
    │   └─ ← [Return] 10000 [1e4]
    ├─ [0] VM::prank(owner: [0x7c8999dC9a822c1f0Df42023113EDB4FDd543266])
    │   └─ ← [Return]
    ├─ [0] VM::expectRevert(custom error 0xf4844814)
    │   └─ ← [Return]
    ├─ [25902] UsdtYieldVault::setDepositFee(14177312816443874610399604065013229075155880567552867 [1.417e52])
    │   ├─ emit DepositFeeUpdated(previousFeeBps: 0, newFeeBps: 14177312816443874610399604065013229075155880567552867 [1.417e52])
    │   └─ ← [Stop]
    └─ ← [Revert] next call did not revert as expected

Backtrace:
  at FeeDomainEvidenceTest.testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets

[FAIL: OwnableUnauthorizedAccount(0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 13344)
Traces:
  [13344] FeeDomainEvidenceTest::test_FeeAtFirstInvalidBoundaryBricksDeposits()
    ├─ [0] VM::prank(owner: [0x7c8999dC9a822c1f0Df42023113EDB4FDd543266])
    │   └─ ← [Return]
    ├─ [249] UsdtYieldVault::BPS_DENOMINATOR() [staticcall]
    │   └─ ← [Return] 10000 [1e4]
    ├─ [2510] UsdtYieldVault::setDepositFee(10001 [1e4])
    │   └─ ← [Revert] OwnableUnauthorizedAccount(0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496)
    └─ ← [Revert] OwnableUnauthorizedAccount(0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496)

Backtrace:
  at UsdtYieldVault.setDepositFee
  at FeeDomainEvidenceTest.test_FeeAtFirstInvalidBoundaryBricksDeposits

Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 1.61ms (1.06ms CPU time)

Ran 1 test suite in 11.74ms (1.61ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)

Failing tests:
Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
[FAIL: OwnableUnauthorizedAccount(0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 13344)

Encountered a total of 2 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 2 failed tests

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..6f1ed429db22cc827535d3a35744a9195e0dc863
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        vm.prank(owner);
+        vault.setDepositFee(vault.BPS_DENOMINATOR() + 1);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..46038fdd7ca95c1e8d38753c4d978c2e95862617
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/test/FeeDomainEvidence.t.sol
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..46038fdd7ca95c1e8d38753c4d978c2e95862617
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..46038fdd7ca95c1e8d38753c4d978c2e95862617
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge test --match-path test/FeeDomainEvidence.t.sol -vvv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
 exited 1 in 1594ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 896.46ms
Compiler run successful!
2026-09-13T15:29:25.392259Z  WARN evm::traces::external: etherscan config not found

Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
Traces:
  [37544] FeeDomainEvidenceTest::testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(14177312816443874610399604065013229075155880567552867 [1.417e52])
    ├─ [249] UsdtYieldVault::BPS_DENOMINATOR() [staticcall]
    │   └─ ← [Return] 10000 [1e4]
    ├─ [0] VM::prank(owner: [0x7c8999dC9a822c1f0Df42023113EDB4FDd543266])
    │   └─ ← [Return]
    ├─ [0] VM::expectRevert(custom error 0xf4844814)
    │   └─ ← [Return]
    ├─ [25902] UsdtYieldVault::setDepositFee(14177312816443874610399604065013229075155880567552867 [1.417e52])
    │   ├─ emit DepositFeeUpdated(previousFeeBps: 0, newFeeBps: 14177312816443874610399604065013229075155880567552867 [1.417e52])
    │   └─ ← [Stop]
    └─ ← [Revert] next call did not revert as expected

Backtrace:
  at FeeDomainEvidenceTest.testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets

[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
Traces:
  [45640] FeeDomainEvidenceTest::test_FeeAtFirstInvalidBoundaryBricksDeposits()
    ├─ [249] UsdtYieldVault::BPS_DENOMINATOR() [staticcall]
    │   └─ ← [Return] 10000 [1e4]
    ├─ [0] VM::prank(owner: [0x7c8999dC9a822c1f0Df42023113EDB4FDd543266])
    │   └─ ← [Return]
    ├─ [25902] UsdtYieldVault::setDepositFee(10001 [1e4])
    │   ├─ emit DepositFeeUpdated(previousFeeBps: 0, newFeeBps: 10001 [1e4])
    │   └─ ← [Stop]
    ├─ [0] VM::prank(depositor: [0x1Ffc33f5E217b1CF95e713DB49Fcd86C8195666C])
    │   └─ ← [Return]
    ├─ [5914] UsdtYieldVault::deposit(1000000 [1e6])
    │   └─ ← [Revert] panic: arithmetic underflow or overflow (0x11)
    └─ ← [Revert] panic: arithmetic underflow or overflow (0x11)

Backtrace:
  at UsdtYieldVault.deposit
  at FeeDomainEvidenceTest.test_FeeAtFirstInvalidBoundaryBricksDeposits

Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 1.60ms (1.11ms CPU time)

Ran 1 test suite in 21.54ms (1.60ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)

Failing tests:
Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)

Encountered a total of 2 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 2 failed tests

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..46038fdd7ca95c1e8d38753c4d978c2e95862617
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge test --match-path test/AccountingInvariantEvidence.t.sol -vvv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
 exited 1 in 2064ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 1.03s
Compiler run successful!
2026-09-13T15:29:36.226020Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
[FAIL: assertion failed: 999998991734 != 999998991758]
	[Sequence] (original: 2, shrunk: 2)
		sender=0xe675D7eED4B6B668ed420ee302f78aA1F7025999 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[32]
		sender=0x9Ef640Db9cA10bC41Cf98528354f2eaBC7F0A5dF addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[8299651371146223 [8.299e15]]
 invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)

╭--------------+----------+-------+---------+----------╮
| Contract     | Selector | Calls | Reverts | Discards |
+======================================================+
| VaultHandler | deposit  | 1     | 0       | 0        |
|--------------+----------+-------+---------+----------|
| VaultHandler | withdraw | 1     | 0       | 0        |
╰--------------+----------+-------+---------+----------╯

Traces:
  [225346] VaultHandler::deposit(32)
    ├─ [2559] MockUSDT::balanceOf(VaultHandler: [0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9]) [staticcall]
    │   └─ ← [Return] 1000000000000 [1e12]
    ├─ [271] UsdtYieldVault::MIN_DEPOSIT() [staticcall]
    │   └─ ← [Return] 1000000 [1e6]
    ├─ [271] UsdtYieldVault::MIN_DEPOSIT() [staticcall]
    │   └─ ← [Return] 1000000 [1e6]
    ├─ [214573] UsdtYieldVault::deposit(999999000033 [9.999e11])
    │   ├─ [30420] MockUSDT::transferFrom(VaultHandler: [0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9], UsdtYieldVault: [0xF62849F9A0B5Bf2913b396098F7c7019b51A820a], 999999000033 [9.999e11])
    │   │   ├─ emit Transfer(from: VaultHandler: [0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9], to: UsdtYieldVault: [0xF62849F9A0B5Bf2913b396098F7c7019b51A820a], value: 999999000033 [9.999e11])
    │   │   └─ ← [Return] true
    │   ├─ [24734] MockUSDT::approve(MockAavePool: [0x2e234DAe75C793f67A35089C9d99245E1C58470b], 999999000033 [9.999e11])
    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0xF62849F9A0B5Bf2913b396098F7c7019b51A820a], spender: MockAavePool: [0x2e234DAe75C793f67A35089C9d99245E1C58470b], value: 999999000033 [9.999e11])
    │   │   └─ ← [Return] true
    │   ├─ [76664] MockAavePool::supply(MockUSDT: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 999999000033 [9.999e11], UsdtYieldVault: [0xF62849F9A0B5Bf2913b396098F7c7019b51A820a], 0)
    │   │   ├─ [26057] MockUSDT::transferFrom(UsdtYieldVault: [0xF62849F9A0B5Bf2913b396098F7c7019b51A820a], MockAavePool: [0x2e234DAe75C793f67A35089C9d99245E1C58470b], 999999000033 [9.999e11])
    │   │   │   ├─ emit Transfer(from: UsdtYieldVault: [0xF62849F9A0B5Bf2913b396098F7c7019b51A820a], to: MockAavePool: [0x2e234DAe75C793f67A35089C9d99245E1C58470b], value: 999999000033 [9.999e11])
    │   │   │   └─ ← [Return] true
    │   │   ├─ [46823] MockAToken::mint(UsdtYieldVault: [0xF62849F9A0B5Bf2913b396098F7c7019b51A820a], 999999000033 [9.999e11])
    │   │   │   ├─ emit Transfer(from: 0x0000000000000000000000000000000000000000, to: UsdtYieldVault: [0xF62849F9A0B5Bf2913b396098F7c7019b51A820a], value: 999999000033 [9.999e11])
    │   │   │   └─ ← [Stop]
    │   │   └─ ← [Stop]
    │   ├─ emit Deposited(account: VaultHandler: [0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9], assets: 999999000033 [9.999e11], shares: 999999000033000000000000 [9.999e23], fee: 0)
    │   └─ ← [Return] 0x00000000000000000000000000000000000000000000d3c20dee343d62e31000
    └─ ← [Stop]

  [65256] VaultHandler::withdraw(8299651371146223 [8.299e15])
    ├─ [2537] UsdtYieldVault::shareBalance(VaultHandler: [0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9]) [staticcall]
    │   └─ ← [Return] 999999000033000000000000 [9.999e23]
    ├─ [58952] UsdtYieldVault::withdraw(8299651371146223 [8.299e15])
    │   ├─ [31894] MockAavePool::withdraw(MockUSDT: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 8275, VaultHandler: [0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9])
    │   │   ├─ [12726] MockAToken::burn(UsdtYieldVault: [0xF62849F9A0B5Bf2913b396098F7c7019b51A820a], 8275)
    │   │   │   ├─ emit Transfer(from: UsdtYieldVault: [0xF62849F9A0B5Bf2913b396098F7c7019b51A820a], to: 0x0000000000000000000000000000000000000000, value: 8275)
    │   │   │   └─ ← [Stop]
    │   │   ├─ [12881] MockUSDT::transfer(VaultHandler: [0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9], 8275)
    │   │   │   ├─ emit Transfer(from: MockAavePool: [0x2e234DAe75C793f67A35089C9d99245E1C58470b], to: VaultHandler: [0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9], value: 8275)
    │   │   │   └─ ← [Return] true
    │   │   └─ ← [Return] 8275
    │   ├─ emit Withdrawn(account: VaultHandler: [0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9], assets: 8275, shares: 8299651371146223 [8.299e15], fee: 24)
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000002053
    └─ ← [Stop]

  [18087] AccountingInvariantEvidenceTest::invariant_TrackedAssetsEqualAaveCustody()
    ├─ [2293] UsdtYieldVault::totalAssets() [staticcall]
    │   └─ ← [Return] 999998991734 [9.999e11]
    ├─ [2559] MockAToken::balanceOf(UsdtYieldVault: [0xF62849F9A0B5Bf2913b396098F7c7019b51A820a]) [staticcall]
    │   └─ ← [Return] 999998991758 [9.999e11]
    ├─ [0] VM::assertEq(999998991734 [9.999e11], 999998991758 [9.999e11]) [staticcall]
    │   └─ ← [Revert] assertion failed: 999998991734 != 999998991758
    └─ ← [Revert] assertion failed: 999998991734 != 999998991758

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 320.11ms (319.20ms CPU time)

Ran 1 test suite in 329.02ms (320.11ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
[FAIL: assertion failed: 999998991734 != 999998991758]
	[Sequence] (original: 2, shrunk: 2)
		sender=0xe675D7eED4B6B668ed420ee302f78aA1F7025999 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[32]
		sender=0x9Ef640Db9cA10bC41Cf98528354f2eaBC7F0A5dF addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[8299651371146223 [8.299e15]]
 invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..46038fdd7ca95c1e8d38753c4d978c2e95862617
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
2026-09-13T15:29:52.764544Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 2985ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 936.73ms
Compiler run successful!
2026-09-13T15:29:51.358725Z  WARN evm::traces::external: etherscan config not found
2026-09-13T15:29:51.572614Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"

Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 1076263)
2026-09-13T15:29:52.748061Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
Traces:
  [1076263] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
    │   └─ ← [Return] 0
    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
    │   └─ ← [Return] 3596 bytes of code
    ├─ [0] VM::addr(<pk>) [staticcall]
    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
    │   └─ ← [Return]
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
    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   └─ ← [Stop]
    └─ ← [Revert] EvmError: Revert

Backtrace:
  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.39s (1.39s CPU time)

Ran 1 test suite in 1.39s (1.39s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 1076263)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..46038fdd7ca95c1e8d38753c4d978c2e95862617
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,29 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/test/MainnetForkEvidence.t.sol
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..382a9a778dfcd62f8eeced2cd781bb531327c298
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..382a9a778dfcd62f8eeced2cd781bb531327c298
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
2026-09-13T15:30:26.331307Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 4063ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 871.10ms
Compiler run successful!
2026-09-13T15:30:23.797363Z  WARN evm::traces::external: etherscan config not found
2026-09-13T15:30:24.279901Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"

Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 1140715)
2026-09-13T15:30:26.311287Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
Traces:
  [1140715] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
    │   └─ ← [Return] 0
    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
    │   └─ ← [Return] 3596 bytes of code
    ├─ [0] VM::addr(<pk>) [staticcall]
    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
    │   └─ ← [Return]
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
    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   └─ ← [Stop]
    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
    │   ├─ [34830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
    │   │   ├─ emit Transfer(from: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   └─ ← [Revert] EvmError: Revert
    └─ ← [Revert] EvmError: Revert

Backtrace:
  at UsdtYieldVault.deposit
  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.51s (2.51s CPU time)

Ran 1 test suite in 2.52s (2.51s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 1140715)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..382a9a778dfcd62f8eeced2cd781bb531327c298
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        deal(USDT, depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/test/MainnetForkEvidence.t.sol
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
2026-09-13T15:31:14.632937Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 4271ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 747.32ms
Compiler run successful!
2026-09-13T15:31:11.748176Z  WARN evm::traces::external: etherscan config not found
2026-09-13T15:31:11.935369Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"

Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
2026-09-13T15:31:14.607662Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
Traces:
  [956355] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
    │   └─ ← [Return] 0
    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
    │   └─ ← [Return] 3596 bytes of code
    ├─ [0] VM::addr(<pk>) [staticcall]
    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
    │   └─ ← [Return]
    ├─ [0] VM::prank(0x28C6c06298d514Db089934071355E5743bf21d60)
    │   └─ ← [Return]
    ├─ [41601] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transfer(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], 1000000000 [1e9])
    │   ├─ emit Transfer(from: 0x28C6c06298d514Db089934071355E5743bf21d60, to: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], value: 1000000000 [1e9])
    │   └─ ← [Stop]
    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
    │   └─ ← [Return]
    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   └─ ← [Stop]
    ├─ [58074] UsdtYieldVault::deposit(1000000000 [1e9])
    │   ├─ [28830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
    │   │   ├─ emit Transfer(from: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   └─ ← [Revert] EvmError: Revert
    └─ ← [Revert] EvmError: Revert

Backtrace:
  at UsdtYieldVault.deposit
  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.86s (2.86s CPU time)

Ran 1 test suite in 2.86s (2.86s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge test --match-path test/FeeDomainEvidence.t.sol -vv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
 exited 1 in 138ms:
No files changed, compilation skipped
2026-09-13T15:31:28.168840Z  WARN evm::traces::external: etherscan config not found

Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 1.63ms (1.19ms CPU time)

Ran 1 test suite in 8.07ms (1.63ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)

Failing tests:
Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)

Encountered a total of 2 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 2 failed tests

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge test --match-path test/AccountingInvariantEvidence.t.sol -vv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
 exited 1 in 410ms:
No files changed, compilation skipped
2026-09-13T15:31:31.266339Z  WARN evm::traces::external: etherscan config not found
Warning: Replayed invariant failure from "/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/cache/invariant/failures/AccountingInvariantEvidenceTest/invariant_TrackedAssetsEqualAaveCustody" file. 
Run `forge clean` or remove file to ignore failure and to continue invariant test campaign.

Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
[FAIL: invariant_TrackedAssetsEqualAaveCustody replay failure]
	[Sequence] (original: 2, shrunk: 2)
		sender=0xe675D7eED4B6B668ed420ee302f78aA1F7025999 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[32]
		sender=0x9Ef640Db9cA10bC41Cf98528354f2eaBC7F0A5dF addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[8299651371146223 [8.299e15]]
 invariant_TrackedAssetsEqualAaveCustody() (runs: 1, calls: 1, reverts: 1)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 282.75ms (281.69ms CPU time)

Ran 1 test suite in 283.52ms (282.75ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
[FAIL: invariant_TrackedAssetsEqualAaveCustody replay failure]
	[Sequence] (original: 2, shrunk: 2)
		sender=0xe675D7eED4B6B668ed420ee302f78aA1F7025999 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[32]
		sender=0x9Ef640Db9cA10bC41Cf98528354f2eaBC7F0A5dF addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[8299651371146223 [8.299e15]]
 invariant_TrackedAssetsEqualAaveCustody() (runs: 1, calls: 1, reverts: 1)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-20260913 forge test --match-path test/AccountingInvariantEvidence.t.sol -vv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
 exited 1 in 618ms:
No files changed, compilation skipped
2026-09-13T15:31:37.821467Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
[FAIL: assertion failed: 27576361517 != 30318296301]
	[Sequence] (original: 4, shrunk: 2)
		sender=0x00000000000000000000000000000000000008D4 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[17607219887664015101678249463641254783773605480961437 [1.76e52]]
		sender=0x000000000000000000000000000000004B637e8f addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[6588526605208955007151631902873194339062429 [6.588e42]]
 invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)

╭--------------+----------+-------+---------+----------╮
| Contract     | Selector | Calls | Reverts | Discards |
+======================================================+
| VaultHandler | deposit  | 2     | 0       | 0        |
|--------------+----------+-------+---------+----------|
| VaultHandler | withdraw | 2     | 0       | 0        |
╰--------------+----------+-------+---------+----------╯

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 481.06ms (480.33ms CPU time)

Ran 1 test suite in 481.88ms (481.06ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
[FAIL: assertion failed: 27576361517 != 30318296301]
	[Sequence] (original: 4, shrunk: 2)
		sender=0x00000000000000000000000000000000000008D4 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[17607219887664015101678249463641254783773605480961437 [1.76e52]]
		sender=0x000000000000000000000000000000004B637e8f addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[6588526605208955007151631902873194339062429 [6.588e42]]
 invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..40013b404219a494a3de9b88fc0973bff23a93eb
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,53 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/test/AccountingInvariantEvidence.t.sol
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test test_AaveBalanceGrowthMustIncreaseDepositorClaim -vv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
 exited 1 in 1802ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 1.13s
Compiler run successful!
2026-09-13T15:32:07.211413Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.66ms (744.79µs CPU time)

Ran 1 test suite in 7.59ms (1.66ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

codex
The evidence now supports a clear no-ship decision: the first real-USDT deposit reverts before reaching Aave; independent stateful testing shows custody and accounting diverge after an ordinary fee-bearing withdrawal; simulated aUSDT balance growth is invisible to depositor claims; and the owner-set fee accepts values that brick all deposits. I’m assembling `FINDINGS.md` with exact rerun commands, verbatim outputs, and fix descriptions only.
apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/FINDINGS.md
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..54906e47f4fdeb32d1154fbc0f580e9d02583e5c
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,199 @@
+# USDT Yield Vault — deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet.** The pinned-fork test shows that a deposit using the specified real USDT and Aave Pool reverts. Even after that integration defect is repaired, the vault does not account for Aave yield, withdrawal fees cause its accounting to diverge from its Aave custody, and the owner can configure a fee that bricks deposits.
+
+The pre-existing 39 tests remain untouched. All evidence tests are new files under `test/`; nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit reverts with real mainnet USDT
+
+### What I found
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard `IERC20` interface. Mainnet USDT executes `approve` but returns no ABI-encoded boolean. Solidity's generated `IERC20.approve` call then rejects the empty return data and reverts. The transaction rolls back before `aavePool.supply`, so this vault cannot accept its intended underlying at all.
+
+The test uses the exact addresses in the deployment brief and pins mainnet block `25,969,409`. It transfers genuine USDT from an account funded at that block, uses `SafeERC20` only for the depositor's approval, then calls the unmodified vault. The trace ends immediately after the vault's raw USDT `approve`; there is no Aave `supply` call.
+
+### Reproduction and terminal output
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv
+No files changed, compilation skipped
+2026-09-13T15:31:11.748176Z  WARN evm::traces::external: etherscan config not found
+2026-09-13T15:31:11.935369Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"
+
+Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+2026-09-13T15:31:14.607662Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+Traces:
+  [956355] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
+    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
+    │   └─ ← [Return] <env var value>
+    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
+    │   └─ ← [Return] 0
+    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
+    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
+    │   └─ ← [Return] 3596 bytes of code
+    ├─ [0] VM::addr(<pk>) [staticcall]
+    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
+    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
+    │   └─ ← [Return]
+    ├─ [0] VM::prank(0x28C6c06298d514Db089934071355E5743bf21d60)
+    │   └─ ← [Return]
+    ├─ [41601] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transfer(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], 1000000000 [1e9])
+    │   ├─ emit Transfer(from: 0x28C6c06298d514Db089934071355E5743bf21d60, to: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
+    │   └─ ← [Return]
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   └─ ← [Stop]
+    ├─ [58074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [28830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
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
+  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.86s (2.86s CPU time)
+
+Ran 1 test suite in 2.86s (2.86s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove`, or establish a safe maximum allowance during construction/deployment. Keep a pinned mainnet-fork regression that completes deposit and withdrawal against real USDT and Aave. Do not consider a mock-only regression sufficient.
+
+## 2. High — Aave yield is invisible to shares and withdrawal fees become stranded custody
+
+### What I found
+
+All share conversions use the manually maintained `totalAssetsStored`, never the vault's aUSDT balance. Therefore aUSDT interest growth does not increase depositor claims: after custody grows from 1,000 to 1,100 USDT, the sole depositor is still credited with only 1,000 USDT.
+
+The withdrawal path introduces another form of the same accounting split. It subtracts `grossAssets` from `totalAssetsStored`, but asks Aave to withdraw only `netAssets`. The fee remains as aUSDT while disappearing from tracked assets. Despite the source comment saying withdrawal fees accrue to remaining shareholders, those tokens are not included in any later share conversion. If all shares are withdrawn, the fee remains stranded in a vault with zero claims and no recovery path.
+
+### Yield-growth reproduction and terminal output
+
+```text
+$ forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test test_AaveBalanceGrowthMustIncreaseDepositorClaim -vv
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.13s
+Compiler run successful!
+2026-09-13T15:32:07.211413Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.66ms (744.79µs CPU time)
+
+Ran 1 test suite in 7.59ms (1.66ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Stateful fee-drift reproduction and terminal output
+
+The handler owns funded, approved state and bounds inputs to executable values. The minimized counterexample is one deposit followed by one withdrawal. Calls/reverts statistics show four real handler calls and zero reverts; this is not a vacuous invariant.
+
+```text
+$ FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-20260913 forge test --match-path test/AccountingInvariantEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:37.821467Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 27576361517 != 30318296301]
+	[Sequence] (original: 4, shrunk: 2)
+		sender=0x00000000000000000000000000000000000008D4 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[17607219887664015101678249463641254783773605480961437 [1.76e52]]
+		sender=0x000000000000000000000000000000004B637e8f addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[6588526605208955007151631902873194339062429 [6.588e42]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 2     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 2     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 481.06ms (480.33ms CPU time)
+
+Ran 1 test suite in 481.88ms (481.06ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 27576361517 != 30318296301]
+	[Sequence] (original: 4, shrunk: 2)
+		sender=0x00000000000000000000000000000000000008D4 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[17607219887664015101678249463641254783773605480961437 [1.76e52]]
+		sender=0x000000000000000000000000000000004B637e8f addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[6588526605208955007151631902873194339062429 [6.588e42]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Use actual custody as the asset-accounting source of truth (normally the current aUSDT balance, plus any idle USDT if that can exist) for conversions, with careful rounding and virtual-share/asset protection against donation attacks. On withdrawal, burn shares against gross assets but withdraw/send only the net amount so the retained fee remains part of the assets backing remaining shares. Define and test explicit behavior for the final redeemer so no assets can become ownerless. Add a handler invariant asserting equality between accounted assets and custody after arbitrary valid multi-user sequences, and fork tests that advance time/blocks to verify real aUSDT yield is reflected.
+
+## 3. High — unrestricted deposit fee can brick all deposits
+
+### What I found
+
+`setDepositFee` accepts every `uint256`. At `10,001` bps—the first value above 100%—a minimum deposit computes a fee larger than the deposit and `amount - fee` panics. Larger values can also overflow `amount * depositFeeBps`. The owner can therefore accidentally or deliberately disable deposits. The fuzz test searches the full invalid domain with `bound`; the boundary regression separately demonstrates the resulting deposit failure.
+
+### Reproduction and terminal output
+
+```text
+$ forge test --match-path test/FeeDomainEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:28.168840Z  WARN evm::traces::external: etherscan config not found
+
+Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000000000000000000000000000000000000002711 args=[10001 [1e4]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 1, μ: 26778, ~: 26778)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 2.30ms (1.75ms CPU time)
+
+Ran 1 test suite in 8.97ms (2.30ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)
+
+Failing tests:
+Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000000000000000000000000000000000000002711 args=[10001 [1e4]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 1, μ: 26778, ~: 26778)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+
+Encountered a total of 2 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 2 failed tests
+```
+
+### Fix I would make
+
+Reject `newFeeBps > BPS_DENOMINATOR` (and likely impose a much lower governance maximum appropriate for the product) in both the constructor and setter, using a dedicated custom error. Preserve fuzz coverage over `0..10,000` and rejection tests for `10,001` and `type(uint256).max`. Consider a timelock and/or bounded two-step governance process because this value directly controls depositor economics and availability.
+
+## Test files added
+
+- `test/MainnetForkEvidence.t.sol` — pinned fork against real USDT, aUSDT, and Aave V3 Pool.
+- `test/AccountingInvariantEvidence.t.sol` — handler-driven custody/accounting invariant and yield-growth property.
+- `test/FeeDomainEvidence.t.sol` — whole-domain fee fuzzing and first-invalid-boundary regression.
+
+These tests are intentionally red against the current implementation. They should turn green only after the described defects are repaired.
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..54906e47f4fdeb32d1154fbc0f580e9d02583e5c
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,199 @@
+# USDT Yield Vault — deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet.** The pinned-fork test shows that a deposit using the specified real USDT and Aave Pool reverts. Even after that integration defect is repaired, the vault does not account for Aave yield, withdrawal fees cause its accounting to diverge from its Aave custody, and the owner can configure a fee that bricks deposits.
+
+The pre-existing 39 tests remain untouched. All evidence tests are new files under `test/`; nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit reverts with real mainnet USDT
+
+### What I found
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard `IERC20` interface. Mainnet USDT executes `approve` but returns no ABI-encoded boolean. Solidity's generated `IERC20.approve` call then rejects the empty return data and reverts. The transaction rolls back before `aavePool.supply`, so this vault cannot accept its intended underlying at all.
+
+The test uses the exact addresses in the deployment brief and pins mainnet block `25,969,409`. It transfers genuine USDT from an account funded at that block, uses `SafeERC20` only for the depositor's approval, then calls the unmodified vault. The trace ends immediately after the vault's raw USDT `approve`; there is no Aave `supply` call.
+
+### Reproduction and terminal output
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv
+No files changed, compilation skipped
+2026-09-13T15:31:11.748176Z  WARN evm::traces::external: etherscan config not found
+2026-09-13T15:31:11.935369Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"
+
+Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+2026-09-13T15:31:14.607662Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+Traces:
+  [956355] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
+    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
+    │   └─ ← [Return] <env var value>
+    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
+    │   └─ ← [Return] 0
+    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
+    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
+    │   └─ ← [Return] 3596 bytes of code
+    ├─ [0] VM::addr(<pk>) [staticcall]
+    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
+    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
+    │   └─ ← [Return]
+    ├─ [0] VM::prank(0x28C6c06298d514Db089934071355E5743bf21d60)
+    │   └─ ← [Return]
+    ├─ [41601] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transfer(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], 1000000000 [1e9])
+    │   ├─ emit Transfer(from: 0x28C6c06298d514Db089934071355E5743bf21d60, to: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
+    │   └─ ← [Return]
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   └─ ← [Stop]
+    ├─ [58074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [28830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
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
+  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.86s (2.86s CPU time)
+
+Ran 1 test suite in 2.86s (2.86s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove`, or establish a safe maximum allowance during construction/deployment. Keep a pinned mainnet-fork regression that completes deposit and withdrawal against real USDT and Aave. Do not consider a mock-only regression sufficient.
+
+## 2. High — Aave yield is invisible to shares and withdrawal fees become stranded custody
+
+### What I found
+
+All share conversions use the manually maintained `totalAssetsStored`, never the vault's aUSDT balance. Therefore aUSDT interest growth does not increase depositor claims: after custody grows from 1,000 to 1,100 USDT, the sole depositor is still credited with only 1,000 USDT.
+
+The withdrawal path introduces another form of the same accounting split. It subtracts `grossAssets` from `totalAssetsStored`, but asks Aave to withdraw only `netAssets`. The fee remains as aUSDT while disappearing from tracked assets. Despite the source comment saying withdrawal fees accrue to remaining shareholders, those tokens are not included in any later share conversion. If all shares are withdrawn, the fee remains stranded in a vault with zero claims and no recovery path.
+
+### Yield-growth reproduction and terminal output
+
+```text
+$ forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test test_AaveBalanceGrowthMustIncreaseDepositorClaim -vv
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.13s
+Compiler run successful!
+2026-09-13T15:32:07.211413Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.66ms (744.79µs CPU time)
+
+Ran 1 test suite in 7.59ms (1.66ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Stateful fee-drift reproduction and terminal output
+
+The handler owns funded, approved state and bounds inputs to executable values. The minimized counterexample is one deposit followed by one withdrawal. Calls/reverts statistics show four real handler calls and zero reverts; this is not a vacuous invariant.
+
+```text
+$ FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-20260913 forge test --match-path test/AccountingInvariantEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:37.821467Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 27576361517 != 30318296301]
+	[Sequence] (original: 4, shrunk: 2)
+		sender=0x00000000000000000000000000000000000008D4 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[17607219887664015101678249463641254783773605480961437 [1.76e52]]
+		sender=0x000000000000000000000000000000004B637e8f addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[6588526605208955007151631902873194339062429 [6.588e42]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 2     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 2     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 481.06ms (480.33ms CPU time)
+
+Ran 1 test suite in 481.88ms (481.06ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 27576361517 != 30318296301]
+	[Sequence] (original: 4, shrunk: 2)
+		sender=0x00000000000000000000000000000000000008D4 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[17607219887664015101678249463641254783773605480961437 [1.76e52]]
+		sender=0x000000000000000000000000000000004B637e8f addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[6588526605208955007151631902873194339062429 [6.588e42]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Use actual custody as the asset-accounting source of truth (normally the current aUSDT balance, plus any idle USDT if that can exist) for conversions, with careful rounding and virtual-share/asset protection against donation attacks. On withdrawal, burn shares against gross assets but withdraw/send only the net amount so the retained fee remains part of the assets backing remaining shares. Define and test explicit behavior for the final redeemer so no assets can become ownerless. Add a handler invariant asserting equality between accounted assets and custody after arbitrary valid multi-user sequences, and fork tests that advance time/blocks to verify real aUSDT yield is reflected.
+
+## 3. High — unrestricted deposit fee can brick all deposits
+
+### What I found
+
+`setDepositFee` accepts every `uint256`. At `10,001` bps—the first value above 100%—a minimum deposit computes a fee larger than the deposit and `amount - fee` panics. Larger values can also overflow `amount * depositFeeBps`. The owner can therefore accidentally or deliberately disable deposits. The fuzz test searches the full invalid domain with `bound`; the boundary regression separately demonstrates the resulting deposit failure.
+
+### Reproduction and terminal output
+
+```text
+$ forge test --match-path test/FeeDomainEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:28.168840Z  WARN evm::traces::external: etherscan config not found
+
+Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000000000000000000000000000000000000002711 args=[10001 [1e4]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 1, μ: 26778, ~: 26778)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 2.30ms (1.75ms CPU time)
+
+Ran 1 test suite in 8.97ms (2.30ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)
+
+Failing tests:
+Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000000000000000000000000000000000000002711 args=[10001 [1e4]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 1, μ: 26778, ~: 26778)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+
+Encountered a total of 2 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 2 failed tests
+```
+
+### Fix I would make
+
+Reject `newFeeBps > BPS_DENOMINATOR` (and likely impose a much lower governance maximum appropriate for the product) in both the constructor and setter, using a dedicated custom error. Preserve fuzz coverage over `0..10,000` and rejection tests for `10,001` and `type(uint256).max`. Consider a timelock and/or bounded two-step governance process because this value directly controls depositor economics and availability.
+
+## Test files added
+
+- `test/MainnetForkEvidence.t.sol` — pinned fork against real USDT, aUSDT, and Aave V3 Pool.
+- `test/AccountingInvariantEvidence.t.sol` — handler-driven custody/accounting invariant and yield-growth property.
+- `test/FeeDomainEvidence.t.sol` — whole-domain fee fuzzing and first-invalid-boundary regression.
+
+These tests are intentionally red against the current implementation. They should turn green only after the described defects are repaired.
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-final forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test invariant_TrackedAssetsEqualAaveCustody -vv' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
 exited 1 in 543ms:
No files changed, compilation skipped
2026-09-13T15:33:56.915383Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
[FAIL: assertion failed: 185750211960 != 186762975876]
	[Sequence] (original: 3, shrunk: 2)
		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
 invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)

╭--------------+----------+-------+---------+----------╮
| Contract     | Selector | Calls | Reverts | Discards |
+======================================================+
| VaultHandler | deposit  | 1     | 0       | 0        |
|--------------+----------+-------+---------+----------|
| VaultHandler | withdraw | 2     | 0       | 0        |
╰--------------+----------+-------+---------+----------╯

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 417.32ms (416.57ms CPU time)

Ran 1 test suite in 418.17ms (417.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
[FAIL: assertion failed: 185750211960 != 186762975876]
	[Sequence] (original: 3, shrunk: 2)
		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
 invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..54906e47f4fdeb32d1154fbc0f580e9d02583e5c
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,199 @@
+# USDT Yield Vault — deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet.** The pinned-fork test shows that a deposit using the specified real USDT and Aave Pool reverts. Even after that integration defect is repaired, the vault does not account for Aave yield, withdrawal fees cause its accounting to diverge from its Aave custody, and the owner can configure a fee that bricks deposits.
+
+The pre-existing 39 tests remain untouched. All evidence tests are new files under `test/`; nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit reverts with real mainnet USDT
+
+### What I found
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard `IERC20` interface. Mainnet USDT executes `approve` but returns no ABI-encoded boolean. Solidity's generated `IERC20.approve` call then rejects the empty return data and reverts. The transaction rolls back before `aavePool.supply`, so this vault cannot accept its intended underlying at all.
+
+The test uses the exact addresses in the deployment brief and pins mainnet block `25,969,409`. It transfers genuine USDT from an account funded at that block, uses `SafeERC20` only for the depositor's approval, then calls the unmodified vault. The trace ends immediately after the vault's raw USDT `approve`; there is no Aave `supply` call.
+
+### Reproduction and terminal output
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv
+No files changed, compilation skipped
+2026-09-13T15:31:11.748176Z  WARN evm::traces::external: etherscan config not found
+2026-09-13T15:31:11.935369Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"
+
+Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+2026-09-13T15:31:14.607662Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+Traces:
+  [956355] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
+    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
+    │   └─ ← [Return] <env var value>
+    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
+    │   └─ ← [Return] 0
+    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
+    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
+    │   └─ ← [Return] 3596 bytes of code
+    ├─ [0] VM::addr(<pk>) [staticcall]
+    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
+    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
+    │   └─ ← [Return]
+    ├─ [0] VM::prank(0x28C6c06298d514Db089934071355E5743bf21d60)
+    │   └─ ← [Return]
+    ├─ [41601] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transfer(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], 1000000000 [1e9])
+    │   ├─ emit Transfer(from: 0x28C6c06298d514Db089934071355E5743bf21d60, to: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
+    │   └─ ← [Return]
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   └─ ← [Stop]
+    ├─ [58074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [28830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
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
+  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.86s (2.86s CPU time)
+
+Ran 1 test suite in 2.86s (2.86s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove`, or establish a safe maximum allowance during construction/deployment. Keep a pinned mainnet-fork regression that completes deposit and withdrawal against real USDT and Aave. Do not consider a mock-only regression sufficient.
+
+## 2. High — Aave yield is invisible to shares and withdrawal fees become stranded custody
+
+### What I found
+
+All share conversions use the manually maintained `totalAssetsStored`, never the vault's aUSDT balance. Therefore aUSDT interest growth does not increase depositor claims: after custody grows from 1,000 to 1,100 USDT, the sole depositor is still credited with only 1,000 USDT.
+
+The withdrawal path introduces another form of the same accounting split. It subtracts `grossAssets` from `totalAssetsStored`, but asks Aave to withdraw only `netAssets`. The fee remains as aUSDT while disappearing from tracked assets. Despite the source comment saying withdrawal fees accrue to remaining shareholders, those tokens are not included in any later share conversion. If all shares are withdrawn, the fee remains stranded in a vault with zero claims and no recovery path.
+
+### Yield-growth reproduction and terminal output
+
+```text
+$ forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test test_AaveBalanceGrowthMustIncreaseDepositorClaim -vv
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.13s
+Compiler run successful!
+2026-09-13T15:32:07.211413Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.66ms (744.79µs CPU time)
+
+Ran 1 test suite in 7.59ms (1.66ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Stateful fee-drift reproduction and terminal output
+
+The handler owns funded, approved state and bounds inputs to executable values. The minimized counterexample is one deposit followed by one withdrawal. Calls/reverts statistics show four real handler calls and zero reverts; this is not a vacuous invariant.
+
+```text
+$ FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-20260913 forge test --match-path test/AccountingInvariantEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:37.821467Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 27576361517 != 30318296301]
+	[Sequence] (original: 4, shrunk: 2)
+		sender=0x00000000000000000000000000000000000008D4 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[17607219887664015101678249463641254783773605480961437 [1.76e52]]
+		sender=0x000000000000000000000000000000004B637e8f addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[6588526605208955007151631902873194339062429 [6.588e42]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 2     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 2     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 481.06ms (480.33ms CPU time)
+
+Ran 1 test suite in 481.88ms (481.06ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 27576361517 != 30318296301]
+	[Sequence] (original: 4, shrunk: 2)
+		sender=0x00000000000000000000000000000000000008D4 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[17607219887664015101678249463641254783773605480961437 [1.76e52]]
+		sender=0x000000000000000000000000000000004B637e8f addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[6588526605208955007151631902873194339062429 [6.588e42]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Use actual custody as the asset-accounting source of truth (normally the current aUSDT balance, plus any idle USDT if that can exist) for conversions, with careful rounding and virtual-share/asset protection against donation attacks. On withdrawal, burn shares against gross assets but withdraw/send only the net amount so the retained fee remains part of the assets backing remaining shares. Define and test explicit behavior for the final redeemer so no assets can become ownerless. Add a handler invariant asserting equality between accounted assets and custody after arbitrary valid multi-user sequences, and fork tests that advance time/blocks to verify real aUSDT yield is reflected.
+
+## 3. High — unrestricted deposit fee can brick all deposits
+
+### What I found
+
+`setDepositFee` accepts every `uint256`. At `10,001` bps—the first value above 100%—a minimum deposit computes a fee larger than the deposit and `amount - fee` panics. Larger values can also overflow `amount * depositFeeBps`. The owner can therefore accidentally or deliberately disable deposits. The fuzz test searches the full invalid domain with `bound`; the boundary regression separately demonstrates the resulting deposit failure.
+
+### Reproduction and terminal output
+
+```text
+$ forge test --match-path test/FeeDomainEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:28.168840Z  WARN evm::traces::external: etherscan config not found
+
+Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000000000000000000000000000000000000002711 args=[10001 [1e4]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 1, μ: 26778, ~: 26778)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 2.30ms (1.75ms CPU time)
+
+Ran 1 test suite in 8.97ms (2.30ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)
+
+Failing tests:
+Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000000000000000000000000000000000000002711 args=[10001 [1e4]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 1, μ: 26778, ~: 26778)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+
+Encountered a total of 2 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 2 failed tests
+```
+
+### Fix I would make
+
+Reject `newFeeBps > BPS_DENOMINATOR` (and likely impose a much lower governance maximum appropriate for the product) in both the constructor and setter, using a dedicated custom error. Preserve fuzz coverage over `0..10,000` and rejection tests for `10,001` and `type(uint256).max`. Consider a timelock and/or bounded two-step governance process because this value directly controls depositor economics and availability.
+
+## Test files added
+
+- `test/MainnetForkEvidence.t.sol` — pinned fork against real USDT, aUSDT, and Aave V3 Pool.
+- `test/AccountingInvariantEvidence.t.sol` — handler-driven custody/accounting invariant and yield-growth property.
+- `test/FeeDomainEvidence.t.sol` — whole-domain fee fuzzing and first-invalid-boundary regression.
+
+These tests are intentionally red against the current implementation. They should turn green only after the described defects are repaired.
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'rg -n "FOUNDRY|275763|303182|176072|658852|10,001|calldata=0x1498" FINDINGS.md' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
119:$ FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-20260913 forge test --match-path test/AccountingInvariantEvidence.t.sol -vv
124:[FAIL: assertion failed: 27576361517 != 30318296301]
126:		sender=0x00000000000000000000000000000000000008D4 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[17607219887664015101678249463641254783773605480961437 [1.76e52]]
127:		sender=0x000000000000000000000000000000004B637e8f addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[6588526605208955007151631902873194339062429 [6.588e42]]
144:[FAIL: assertion failed: 27576361517 != 30318296301]
146:		sender=0x00000000000000000000000000000000000008D4 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[17607219887664015101678249463641254783773605480961437 [1.76e52]]
147:		sender=0x000000000000000000000000000000004B637e8f addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[6588526605208955007151631902873194339062429 [6.588e42]]
163:`setDepositFee` accepts every `uint256`. At `10,001` bps—the first value above 100%—a minimum deposit computes a fee larger than the deposit and `amount - fee` panics. Larger values can also overflow `amount * depositFeeBps`. The owner can therefore accidentally or deliberately disable deposits. The fuzz test searches the full invalid domain with `bound`; the boundary regression separately demonstrates the resulting deposit failure.
173:[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000000000000000000000000000000000000002711 args=[10001 [1e4]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 1, μ: 26778, ~: 26778)
181:[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000000000000000000000000000000000000002711 args=[10001 [1e4]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 1, μ: 26778, ~: 26778)
191:Reject `newFeeBps > BPS_DENOMINATOR` (and likely impose a much lower governance maximum appropriate for the product) in both the constructor and setter, using a dedicated custom error. Preserve fuzz coverage over `0..10,000` and rejection tests for `10,001` and `type(uint256).max`. Consider a timelock and/or bounded two-step governance process because this value directly controls depositor economics and availability.

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..54906e47f4fdeb32d1154fbc0f580e9d02583e5c
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,199 @@
+# USDT Yield Vault — deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet.** The pinned-fork test shows that a deposit using the specified real USDT and Aave Pool reverts. Even after that integration defect is repaired, the vault does not account for Aave yield, withdrawal fees cause its accounting to diverge from its Aave custody, and the owner can configure a fee that bricks deposits.
+
+The pre-existing 39 tests remain untouched. All evidence tests are new files under `test/`; nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit reverts with real mainnet USDT
+
+### What I found
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard `IERC20` interface. Mainnet USDT executes `approve` but returns no ABI-encoded boolean. Solidity's generated `IERC20.approve` call then rejects the empty return data and reverts. The transaction rolls back before `aavePool.supply`, so this vault cannot accept its intended underlying at all.
+
+The test uses the exact addresses in the deployment brief and pins mainnet block `25,969,409`. It transfers genuine USDT from an account funded at that block, uses `SafeERC20` only for the depositor's approval, then calls the unmodified vault. The trace ends immediately after the vault's raw USDT `approve`; there is no Aave `supply` call.
+
+### Reproduction and terminal output
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv
+No files changed, compilation skipped
+2026-09-13T15:31:11.748176Z  WARN evm::traces::external: etherscan config not found
+2026-09-13T15:31:11.935369Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"
+
+Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+2026-09-13T15:31:14.607662Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+Traces:
+  [956355] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
+    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
+    │   └─ ← [Return] <env var value>
+    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
+    │   └─ ← [Return] 0
+    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
+    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
+    │   └─ ← [Return] 3596 bytes of code
+    ├─ [0] VM::addr(<pk>) [staticcall]
+    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
+    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
+    │   └─ ← [Return]
+    ├─ [0] VM::prank(0x28C6c06298d514Db089934071355E5743bf21d60)
+    │   └─ ← [Return]
+    ├─ [41601] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transfer(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], 1000000000 [1e9])
+    │   ├─ emit Transfer(from: 0x28C6c06298d514Db089934071355E5743bf21d60, to: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
+    │   └─ ← [Return]
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   └─ ← [Stop]
+    ├─ [58074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [28830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
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
+  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.86s (2.86s CPU time)
+
+Ran 1 test suite in 2.86s (2.86s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove`, or establish a safe maximum allowance during construction/deployment. Keep a pinned mainnet-fork regression that completes deposit and withdrawal against real USDT and Aave. Do not consider a mock-only regression sufficient.
+
+## 2. High — Aave yield is invisible to shares and withdrawal fees become stranded custody
+
+### What I found
+
+All share conversions use the manually maintained `totalAssetsStored`, never the vault's aUSDT balance. Therefore aUSDT interest growth does not increase depositor claims: after custody grows from 1,000 to 1,100 USDT, the sole depositor is still credited with only 1,000 USDT.
+
+The withdrawal path introduces another form of the same accounting split. It subtracts `grossAssets` from `totalAssetsStored`, but asks Aave to withdraw only `netAssets`. The fee remains as aUSDT while disappearing from tracked assets. Despite the source comment saying withdrawal fees accrue to remaining shareholders, those tokens are not included in any later share conversion. If all shares are withdrawn, the fee remains stranded in a vault with zero claims and no recovery path.
+
+### Yield-growth reproduction and terminal output
+
+```text
+$ forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test test_AaveBalanceGrowthMustIncreaseDepositorClaim -vv
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.13s
+Compiler run successful!
+2026-09-13T15:32:07.211413Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.66ms (744.79µs CPU time)
+
+Ran 1 test suite in 7.59ms (1.66ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Stateful fee-drift reproduction and terminal output
+
+The handler owns funded, approved state and bounds inputs to executable values. The minimized counterexample is one deposit followed by one withdrawal. Calls/reverts statistics show four real handler calls and zero reverts; this is not a vacuous invariant.
+
+```text
+$ FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-20260913 forge test --match-path test/AccountingInvariantEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:37.821467Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 27576361517 != 30318296301]
+	[Sequence] (original: 4, shrunk: 2)
+		sender=0x00000000000000000000000000000000000008D4 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[17607219887664015101678249463641254783773605480961437 [1.76e52]]
+		sender=0x000000000000000000000000000000004B637e8f addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[6588526605208955007151631902873194339062429 [6.588e42]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 2     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 2     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 481.06ms (480.33ms CPU time)
+
+Ran 1 test suite in 481.88ms (481.06ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 27576361517 != 30318296301]
+	[Sequence] (original: 4, shrunk: 2)
+		sender=0x00000000000000000000000000000000000008D4 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[17607219887664015101678249463641254783773605480961437 [1.76e52]]
+		sender=0x000000000000000000000000000000004B637e8f addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[6588526605208955007151631902873194339062429 [6.588e42]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Use actual custody as the asset-accounting source of truth (normally the current aUSDT balance, plus any idle USDT if that can exist) for conversions, with careful rounding and virtual-share/asset protection against donation attacks. On withdrawal, burn shares against gross assets but withdraw/send only the net amount so the retained fee remains part of the assets backing remaining shares. Define and test explicit behavior for the final redeemer so no assets can become ownerless. Add a handler invariant asserting equality between accounted assets and custody after arbitrary valid multi-user sequences, and fork tests that advance time/blocks to verify real aUSDT yield is reflected.
+
+## 3. High — unrestricted deposit fee can brick all deposits
+
+### What I found
+
+`setDepositFee` accepts every `uint256`. At `10,001` bps—the first value above 100%—a minimum deposit computes a fee larger than the deposit and `amount - fee` panics. Larger values can also overflow `amount * depositFeeBps`. The owner can therefore accidentally or deliberately disable deposits. The fuzz test searches the full invalid domain with `bound`; the boundary regression separately demonstrates the resulting deposit failure.
+
+### Reproduction and terminal output
+
+```text
+$ forge test --match-path test/FeeDomainEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:28.168840Z  WARN evm::traces::external: etherscan config not found
+
+Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000000000000000000000000000000000000002711 args=[10001 [1e4]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 1, μ: 26778, ~: 26778)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 2.30ms (1.75ms CPU time)
+
+Ran 1 test suite in 8.97ms (2.30ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)
+
+Failing tests:
+Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000000000000000000000000000000000000002711 args=[10001 [1e4]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 1, μ: 26778, ~: 26778)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+
+Encountered a total of 2 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 2 failed tests
+```
+
+### Fix I would make
+
+Reject `newFeeBps > BPS_DENOMINATOR` (and likely impose a much lower governance maximum appropriate for the product) in both the constructor and setter, using a dedicated custom error. Preserve fuzz coverage over `0..10,000` and rejection tests for `10,001` and `type(uint256).max`. Consider a timelock and/or bounded two-step governance process because this value directly controls depositor economics and availability.
+
+## Test files added
+
+- `test/MainnetForkEvidence.t.sol` — pinned fork against real USDT, aUSDT, and Aave V3 Pool.
+- `test/AccountingInvariantEvidence.t.sol` — handler-driven custody/accounting invariant and yield-growth property.
+- `test/FeeDomainEvidence.t.sol` — whole-domain fee fuzzing and first-invalid-boundary regression.
+
+These tests are intentionally red against the current implementation. They should turn green only after the described defects are repaired.
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/FINDINGS.md
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..ea280f4ebc0d1a36d51fcf7c9ca5d96ce40b0b92
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,199 @@
+# USDT Yield Vault — deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet.** The pinned-fork test shows that a deposit using the specified real USDT and Aave Pool reverts. Even after that integration defect is repaired, the vault does not account for Aave yield, withdrawal fees cause its accounting to diverge from its Aave custody, and the owner can configure a fee that bricks deposits.
+
+The pre-existing 39 tests remain untouched. All evidence tests are new files under `test/`; nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit reverts with real mainnet USDT
+
+### What I found
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard `IERC20` interface. Mainnet USDT executes `approve` but returns no ABI-encoded boolean. Solidity's generated `IERC20.approve` call then rejects the empty return data and reverts. The transaction rolls back before `aavePool.supply`, so this vault cannot accept its intended underlying at all.
+
+The test uses the exact addresses in the deployment brief and pins mainnet block `25,969,409`. It transfers genuine USDT from an account funded at that block, uses `SafeERC20` only for the depositor's approval, then calls the unmodified vault. The trace ends immediately after the vault's raw USDT `approve`; there is no Aave `supply` call.
+
+### Reproduction and terminal output
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv
+No files changed, compilation skipped
+2026-09-13T15:31:11.748176Z  WARN evm::traces::external: etherscan config not found
+2026-09-13T15:31:11.935369Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"
+
+Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+2026-09-13T15:31:14.607662Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+Traces:
+  [956355] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
+    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
+    │   └─ ← [Return] <env var value>
+    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
+    │   └─ ← [Return] 0
+    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
+    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
+    │   └─ ← [Return] 3596 bytes of code
+    ├─ [0] VM::addr(<pk>) [staticcall]
+    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
+    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
+    │   └─ ← [Return]
+    ├─ [0] VM::prank(0x28C6c06298d514Db089934071355E5743bf21d60)
+    │   └─ ← [Return]
+    ├─ [41601] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transfer(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], 1000000000 [1e9])
+    │   ├─ emit Transfer(from: 0x28C6c06298d514Db089934071355E5743bf21d60, to: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
+    │   └─ ← [Return]
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   └─ ← [Stop]
+    ├─ [58074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [28830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
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
+  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.86s (2.86s CPU time)
+
+Ran 1 test suite in 2.86s (2.86s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove`, or establish a safe maximum allowance during construction/deployment. Keep a pinned mainnet-fork regression that completes deposit and withdrawal against real USDT and Aave. Do not consider a mock-only regression sufficient.
+
+## 2. High — Aave yield is invisible to shares and withdrawal fees become stranded custody
+
+### What I found
+
+All share conversions use the manually maintained `totalAssetsStored`, never the vault's aUSDT balance. Therefore aUSDT interest growth does not increase depositor claims: after custody grows from 1,000 to 1,100 USDT, the sole depositor is still credited with only 1,000 USDT.
+
+The withdrawal path introduces another form of the same accounting split. It subtracts `grossAssets` from `totalAssetsStored`, but asks Aave to withdraw only `netAssets`. The fee remains as aUSDT while disappearing from tracked assets. Despite the source comment saying withdrawal fees accrue to remaining shareholders, those tokens are not included in any later share conversion. If all shares are withdrawn, the fee remains stranded in a vault with zero claims and no recovery path.
+
+### Yield-growth reproduction and terminal output
+
+```text
+$ forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test test_AaveBalanceGrowthMustIncreaseDepositorClaim -vv
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.13s
+Compiler run successful!
+2026-09-13T15:32:07.211413Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.66ms (744.79µs CPU time)
+
+Ran 1 test suite in 7.59ms (1.66ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Stateful fee-drift reproduction and terminal output
+
+The handler owns funded, approved state and bounds inputs to executable values. The minimized counterexample is one deposit followed by one withdrawal. Calls/reverts statistics show four real handler calls and zero reverts; this is not a vacuous invariant.
+
+```text
+$ FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-final forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test invariant_TrackedAssetsEqualAaveCustody -vv
+No files changed, compilation skipped
+2026-09-13T15:33:56.915383Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 1     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 2     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 417.32ms (416.57ms CPU time)
+
+Ran 1 test suite in 418.17ms (417.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Use actual custody as the asset-accounting source of truth (normally the current aUSDT balance, plus any idle USDT if that can exist) for conversions, with careful rounding and virtual-share/asset protection against donation attacks. On withdrawal, burn shares against gross assets but withdraw/send only the net amount so the retained fee remains part of the assets backing remaining shares. Define and test explicit behavior for the final redeemer so no assets can become ownerless. Add a handler invariant asserting equality between accounted assets and custody after arbitrary valid multi-user sequences, and fork tests that advance time/blocks to verify real aUSDT yield is reflected.
+
+## 3. High — unrestricted deposit fee can brick all deposits
+
+### What I found
+
+`setDepositFee` accepts every `uint256`. At `10,001` bps—the first value above 100%—a minimum deposit computes a fee larger than the deposit and `amount - fee` panics. Larger values can also overflow `amount * depositFeeBps`. The owner can therefore accidentally or deliberately disable deposits. The fuzz test searches the full invalid domain with `bound`; the boundary regression separately demonstrates the resulting deposit failure.
+
+### Reproduction and terminal output
+
+```text
+$ forge test --match-path test/FeeDomainEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:28.168840Z  WARN evm::traces::external: etherscan config not found
+
+Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 1.63ms (1.19ms CPU time)
+
+Ran 1 test suite in 8.07ms (1.63ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)
+
+Failing tests:
+Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+
+Encountered a total of 2 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 2 failed tests
+```
+
+### Fix I would make
+
+Reject `newFeeBps > BPS_DENOMINATOR` (and likely impose a much lower governance maximum appropriate for the product) in both the constructor and setter, using a dedicated custom error. Preserve fuzz coverage over `0..10,000` and rejection tests for `10,001` and `type(uint256).max`. Consider a timelock and/or bounded two-step governance process because this value directly controls depositor economics and availability.
+
+## Test files added
+
+- `test/MainnetForkEvidence.t.sol` — pinned fork against real USDT, aUSDT, and Aave V3 Pool.
+- `test/AccountingInvariantEvidence.t.sol` — handler-driven custody/accounting invariant and yield-growth property.
+- `test/FeeDomainEvidence.t.sol` — whole-domain fee fuzzing and first-invalid-boundary regression.
+
+These tests are intentionally red against the current implementation. They should turn green only after the described defects are repaired.
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..ea280f4ebc0d1a36d51fcf7c9ca5d96ce40b0b92
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,199 @@
+# USDT Yield Vault — deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet.** The pinned-fork test shows that a deposit using the specified real USDT and Aave Pool reverts. Even after that integration defect is repaired, the vault does not account for Aave yield, withdrawal fees cause its accounting to diverge from its Aave custody, and the owner can configure a fee that bricks deposits.
+
+The pre-existing 39 tests remain untouched. All evidence tests are new files under `test/`; nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit reverts with real mainnet USDT
+
+### What I found
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard `IERC20` interface. Mainnet USDT executes `approve` but returns no ABI-encoded boolean. Solidity's generated `IERC20.approve` call then rejects the empty return data and reverts. The transaction rolls back before `aavePool.supply`, so this vault cannot accept its intended underlying at all.
+
+The test uses the exact addresses in the deployment brief and pins mainnet block `25,969,409`. It transfers genuine USDT from an account funded at that block, uses `SafeERC20` only for the depositor's approval, then calls the unmodified vault. The trace ends immediately after the vault's raw USDT `approve`; there is no Aave `supply` call.
+
+### Reproduction and terminal output
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv
+No files changed, compilation skipped
+2026-09-13T15:31:11.748176Z  WARN evm::traces::external: etherscan config not found
+2026-09-13T15:31:11.935369Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"
+
+Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+2026-09-13T15:31:14.607662Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+Traces:
+  [956355] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
+    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
+    │   └─ ← [Return] <env var value>
+    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
+    │   └─ ← [Return] 0
+    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
+    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
+    │   └─ ← [Return] 3596 bytes of code
+    ├─ [0] VM::addr(<pk>) [staticcall]
+    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
+    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
+    │   └─ ← [Return]
+    ├─ [0] VM::prank(0x28C6c06298d514Db089934071355E5743bf21d60)
+    │   └─ ← [Return]
+    ├─ [41601] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transfer(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], 1000000000 [1e9])
+    │   ├─ emit Transfer(from: 0x28C6c06298d514Db089934071355E5743bf21d60, to: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
+    │   └─ ← [Return]
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   └─ ← [Stop]
+    ├─ [58074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [28830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
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
+  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.86s (2.86s CPU time)
+
+Ran 1 test suite in 2.86s (2.86s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove`, or establish a safe maximum allowance during construction/deployment. Keep a pinned mainnet-fork regression that completes deposit and withdrawal against real USDT and Aave. Do not consider a mock-only regression sufficient.
+
+## 2. High — Aave yield is invisible to shares and withdrawal fees become stranded custody
+
+### What I found
+
+All share conversions use the manually maintained `totalAssetsStored`, never the vault's aUSDT balance. Therefore aUSDT interest growth does not increase depositor claims: after custody grows from 1,000 to 1,100 USDT, the sole depositor is still credited with only 1,000 USDT.
+
+The withdrawal path introduces another form of the same accounting split. It subtracts `grossAssets` from `totalAssetsStored`, but asks Aave to withdraw only `netAssets`. The fee remains as aUSDT while disappearing from tracked assets. Despite the source comment saying withdrawal fees accrue to remaining shareholders, those tokens are not included in any later share conversion. If all shares are withdrawn, the fee remains stranded in a vault with zero claims and no recovery path.
+
+### Yield-growth reproduction and terminal output
+
+```text
+$ forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test test_AaveBalanceGrowthMustIncreaseDepositorClaim -vv
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.13s
+Compiler run successful!
+2026-09-13T15:32:07.211413Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.66ms (744.79µs CPU time)
+
+Ran 1 test suite in 7.59ms (1.66ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Stateful fee-drift reproduction and terminal output
+
+The handler owns funded, approved state and bounds inputs to executable values. The minimized counterexample is one deposit followed by one withdrawal. Calls/reverts statistics show four real handler calls and zero reverts; this is not a vacuous invariant.
+
+```text
+$ FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-final forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test invariant_TrackedAssetsEqualAaveCustody -vv
+No files changed, compilation skipped
+2026-09-13T15:33:56.915383Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 1     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 2     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 417.32ms (416.57ms CPU time)
+
+Ran 1 test suite in 418.17ms (417.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Use actual custody as the asset-accounting source of truth (normally the current aUSDT balance, plus any idle USDT if that can exist) for conversions, with careful rounding and virtual-share/asset protection against donation attacks. On withdrawal, burn shares against gross assets but withdraw/send only the net amount so the retained fee remains part of the assets backing remaining shares. Define and test explicit behavior for the final redeemer so no assets can become ownerless. Add a handler invariant asserting equality between accounted assets and custody after arbitrary valid multi-user sequences, and fork tests that advance time/blocks to verify real aUSDT yield is reflected.
+
+## 3. High — unrestricted deposit fee can brick all deposits
+
+### What I found
+
+`setDepositFee` accepts every `uint256`. At `10,001` bps—the first value above 100%—a minimum deposit computes a fee larger than the deposit and `amount - fee` panics. Larger values can also overflow `amount * depositFeeBps`. The owner can therefore accidentally or deliberately disable deposits. The fuzz test searches the full invalid domain with `bound`; the boundary regression separately demonstrates the resulting deposit failure.
+
+### Reproduction and terminal output
+
+```text
+$ forge test --match-path test/FeeDomainEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:28.168840Z  WARN evm::traces::external: etherscan config not found
+
+Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 1.63ms (1.19ms CPU time)
+
+Ran 1 test suite in 8.07ms (1.63ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)
+
+Failing tests:
+Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+
+Encountered a total of 2 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 2 failed tests
+```
+
+### Fix I would make
+
+Reject `newFeeBps > BPS_DENOMINATOR` (and likely impose a much lower governance maximum appropriate for the product) in both the constructor and setter, using a dedicated custom error. Preserve fuzz coverage over `0..10,000` and rejection tests for `10,001` and `type(uint256).max`. Consider a timelock and/or bounded two-step governance process because this value directly controls depositor economics and availability.
+
+## Test files added
+
+- `test/MainnetForkEvidence.t.sol` — pinned fork against real USDT, aUSDT, and Aave V3 Pool.
+- `test/AccountingInvariantEvidence.t.sol` — handler-driven custody/accounting invariant and yield-growth property.
+- `test/FeeDomainEvidence.t.sol` — whole-domain fee fuzzing and first-invalid-boundary regression.
+
+These tests are intentionally red against the current implementation. They should turn green only after the described defects are repaired.
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'git status --short && git diff -- src test/UsdtYieldVault.t.sol test/mocks && forge fmt --check && rg -n "calldata=0x1498" FINDINGS.md' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
 succeeded in 12ms:
173:[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
181:[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..ea280f4ebc0d1a36d51fcf7c9ca5d96ce40b0b92
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,199 @@
+# USDT Yield Vault — deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet.** The pinned-fork test shows that a deposit using the specified real USDT and Aave Pool reverts. Even after that integration defect is repaired, the vault does not account for Aave yield, withdrawal fees cause its accounting to diverge from its Aave custody, and the owner can configure a fee that bricks deposits.
+
+The pre-existing 39 tests remain untouched. All evidence tests are new files under `test/`; nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit reverts with real mainnet USDT
+
+### What I found
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard `IERC20` interface. Mainnet USDT executes `approve` but returns no ABI-encoded boolean. Solidity's generated `IERC20.approve` call then rejects the empty return data and reverts. The transaction rolls back before `aavePool.supply`, so this vault cannot accept its intended underlying at all.
+
+The test uses the exact addresses in the deployment brief and pins mainnet block `25,969,409`. It transfers genuine USDT from an account funded at that block, uses `SafeERC20` only for the depositor's approval, then calls the unmodified vault. The trace ends immediately after the vault's raw USDT `approve`; there is no Aave `supply` call.
+
+### Reproduction and terminal output
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv
+No files changed, compilation skipped
+2026-09-13T15:31:11.748176Z  WARN evm::traces::external: etherscan config not found
+2026-09-13T15:31:11.935369Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"
+
+Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+2026-09-13T15:31:14.607662Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+Traces:
+  [956355] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
+    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
+    │   └─ ← [Return] <env var value>
+    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
+    │   └─ ← [Return] 0
+    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
+    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
+    │   └─ ← [Return] 3596 bytes of code
+    ├─ [0] VM::addr(<pk>) [staticcall]
+    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
+    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
+    │   └─ ← [Return]
+    ├─ [0] VM::prank(0x28C6c06298d514Db089934071355E5743bf21d60)
+    │   └─ ← [Return]
+    ├─ [41601] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transfer(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], 1000000000 [1e9])
+    │   ├─ emit Transfer(from: 0x28C6c06298d514Db089934071355E5743bf21d60, to: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
+    │   └─ ← [Return]
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   └─ ← [Stop]
+    ├─ [58074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [28830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
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
+  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.86s (2.86s CPU time)
+
+Ran 1 test suite in 2.86s (2.86s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove`, or establish a safe maximum allowance during construction/deployment. Keep a pinned mainnet-fork regression that completes deposit and withdrawal against real USDT and Aave. Do not consider a mock-only regression sufficient.
+
+## 2. High — Aave yield is invisible to shares and withdrawal fees become stranded custody
+
+### What I found
+
+All share conversions use the manually maintained `totalAssetsStored`, never the vault's aUSDT balance. Therefore aUSDT interest growth does not increase depositor claims: after custody grows from 1,000 to 1,100 USDT, the sole depositor is still credited with only 1,000 USDT.
+
+The withdrawal path introduces another form of the same accounting split. It subtracts `grossAssets` from `totalAssetsStored`, but asks Aave to withdraw only `netAssets`. The fee remains as aUSDT while disappearing from tracked assets. Despite the source comment saying withdrawal fees accrue to remaining shareholders, those tokens are not included in any later share conversion. If all shares are withdrawn, the fee remains stranded in a vault with zero claims and no recovery path.
+
+### Yield-growth reproduction and terminal output
+
+```text
+$ forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test test_AaveBalanceGrowthMustIncreaseDepositorClaim -vv
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.13s
+Compiler run successful!
+2026-09-13T15:32:07.211413Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.66ms (744.79µs CPU time)
+
+Ran 1 test suite in 7.59ms (1.66ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Stateful fee-drift reproduction and terminal output
+
+The handler owns funded, approved state and bounds inputs to executable values. The minimized counterexample is one deposit followed by one withdrawal. Calls/reverts statistics show four real handler calls and zero reverts; this is not a vacuous invariant.
+
+```text
+$ FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-final forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test invariant_TrackedAssetsEqualAaveCustody -vv
+No files changed, compilation skipped
+2026-09-13T15:33:56.915383Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 1     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 2     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 417.32ms (416.57ms CPU time)
+
+Ran 1 test suite in 418.17ms (417.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Use actual custody as the asset-accounting source of truth (normally the current aUSDT balance, plus any idle USDT if that can exist) for conversions, with careful rounding and virtual-share/asset protection against donation attacks. On withdrawal, burn shares against gross assets but withdraw/send only the net amount so the retained fee remains part of the assets backing remaining shares. Define and test explicit behavior for the final redeemer so no assets can become ownerless. Add a handler invariant asserting equality between accounted assets and custody after arbitrary valid multi-user sequences, and fork tests that advance time/blocks to verify real aUSDT yield is reflected.
+
+## 3. High — unrestricted deposit fee can brick all deposits
+
+### What I found
+
+`setDepositFee` accepts every `uint256`. At `10,001` bps—the first value above 100%—a minimum deposit computes a fee larger than the deposit and `amount - fee` panics. Larger values can also overflow `amount * depositFeeBps`. The owner can therefore accidentally or deliberately disable deposits. The fuzz test searches the full invalid domain with `bound`; the boundary regression separately demonstrates the resulting deposit failure.
+
+### Reproduction and terminal output
+
+```text
+$ forge test --match-path test/FeeDomainEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:28.168840Z  WARN evm::traces::external: etherscan config not found
+
+Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 1.63ms (1.19ms CPU time)
+
+Ran 1 test suite in 8.07ms (1.63ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)
+
+Failing tests:
+Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+
+Encountered a total of 2 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 2 failed tests
+```
+
+### Fix I would make
+
+Reject `newFeeBps > BPS_DENOMINATOR` (and likely impose a much lower governance maximum appropriate for the product) in both the constructor and setter, using a dedicated custom error. Preserve fuzz coverage over `0..10,000` and rejection tests for `10,001` and `type(uint256).max`. Consider a timelock and/or bounded two-step governance process because this value directly controls depositor economics and availability.
+
+## Test files added
+
+- `test/MainnetForkEvidence.t.sol` — pinned fork against real USDT, aUSDT, and Aave V3 Pool.
+- `test/AccountingInvariantEvidence.t.sol` — handler-driven custody/accounting invariant and yield-growth property.
+- `test/FeeDomainEvidence.t.sol` — whole-domain fee fuzzing and first-invalid-boundary regression.
+
+These tests are intentionally red against the current implementation. They should turn green only after the described defects are repaired.
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/FINDINGS.md
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..872e0ab0ab7a90b9a80e15509301248dddcffc86
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,199 @@
+# USDT Yield Vault — deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet.** The pinned-fork test shows that a deposit using the specified real USDT and Aave Pool reverts. Even after that integration defect is repaired, the vault does not account for Aave yield, withdrawal fees cause its accounting to diverge from its Aave custody, and the owner can configure a fee that bricks deposits.
+
+The pre-existing 39 tests remain untouched. All evidence tests are new files under `test/`; nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit reverts with real mainnet USDT
+
+### What I found
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard `IERC20` interface. Mainnet USDT executes `approve` but returns no ABI-encoded boolean. Solidity's generated `IERC20.approve` call then rejects the empty return data and reverts. The transaction rolls back before `aavePool.supply`, so this vault cannot accept its intended underlying at all.
+
+The test uses the exact addresses in the deployment brief and pins mainnet block `25,969,409`. It transfers genuine USDT from an account funded at that block, uses `SafeERC20` only for the depositor's approval, then calls the unmodified vault. The trace ends immediately after the vault's raw USDT `approve`; there is no Aave `supply` call.
+
+### Reproduction and terminal output
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv
+No files changed, compilation skipped
+2026-09-13T15:31:11.748176Z  WARN evm::traces::external: etherscan config not found
+2026-09-13T15:31:11.935369Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"
+
+Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+2026-09-13T15:31:14.607662Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+Traces:
+  [956355] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
+    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
+    │   └─ ← [Return] <env var value>
+    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
+    │   └─ ← [Return] 0
+    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
+    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
+    │   └─ ← [Return] 3596 bytes of code
+    ├─ [0] VM::addr(<pk>) [staticcall]
+    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
+    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
+    │   └─ ← [Return]
+    ├─ [0] VM::prank(0x28C6c06298d514Db089934071355E5743bf21d60)
+    │   └─ ← [Return]
+    ├─ [41601] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transfer(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], 1000000000 [1e9])
+    │   ├─ emit Transfer(from: 0x28C6c06298d514Db089934071355E5743bf21d60, to: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
+    │   └─ ← [Return]
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   └─ ← [Stop]
+    ├─ [58074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [28830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
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
+  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.86s (2.86s CPU time)
+
+Ran 1 test suite in 2.86s (2.86s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove`, or establish a safe maximum allowance during construction/deployment. Keep a pinned mainnet-fork regression that completes deposit and withdrawal against real USDT and Aave. Do not consider a mock-only regression sufficient.
+
+## 2. High — Aave yield is invisible to shares and withdrawal fees become stranded custody
+
+### What I found
+
+All share conversions use the manually maintained `totalAssetsStored`, never the vault's aUSDT balance. Therefore aUSDT interest growth does not increase depositor claims: after custody grows from 1,000 to 1,100 USDT, the sole depositor is still credited with only 1,000 USDT.
+
+The withdrawal path introduces another form of the same accounting split. It subtracts `grossAssets` from `totalAssetsStored`, but asks Aave to withdraw only `netAssets`. The fee remains as aUSDT while disappearing from tracked assets. Despite the source comment saying withdrawal fees accrue to remaining shareholders, those tokens are not included in any later share conversion. If all shares are withdrawn, the fee remains stranded in a vault with zero claims and no recovery path.
+
+### Yield-growth reproduction and terminal output
+
+```text
+$ forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test test_AaveBalanceGrowthMustIncreaseDepositorClaim -vv
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.13s
+Compiler run successful!
+2026-09-13T15:32:07.211413Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.66ms (744.79µs CPU time)
+
+Ran 1 test suite in 7.59ms (1.66ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Stateful fee-drift reproduction and terminal output
+
+The handler owns funded, approved state and bounds inputs to executable values. The minimized counterexample is one deposit followed by one withdrawal. Calls/reverts statistics show four real handler calls and zero reverts; this is not a vacuous invariant.
+
+```text
+$ FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-final forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test invariant_TrackedAssetsEqualAaveCustody -vv
+No files changed, compilation skipped
+2026-09-13T15:33:56.915383Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 1     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 2     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 417.32ms (416.57ms CPU time)
+
+Ran 1 test suite in 418.17ms (417.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Use actual custody as the asset-accounting source of truth (normally the current aUSDT balance, plus any idle USDT if that can exist) for conversions, with careful rounding and virtual-share/asset protection against donation attacks. On withdrawal, burn shares against gross assets but withdraw/send only the net amount so the retained fee remains part of the assets backing remaining shares. Define and test explicit behavior for the final redeemer so no assets can become ownerless. Add a handler invariant asserting equality between accounted assets and custody after arbitrary valid multi-user sequences, and fork tests that advance time/blocks to verify real aUSDT yield is reflected.
+
+## 3. High — unrestricted deposit fee can brick all deposits
+
+### What I found
+
+`setDepositFee` accepts every `uint256`. At `10,001` bps—the first value above 100%—a minimum deposit computes a fee larger than the deposit and `amount - fee` panics. Larger values can also overflow `amount * depositFeeBps`. The owner can therefore accidentally or deliberately disable deposits. The fuzz test searches the full invalid domain with `bound`; the boundary regression separately demonstrates the resulting deposit failure.
+
+### Reproduction and terminal output
+
+```text
+$ forge test --match-path test/FeeDomainEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:28.168840Z  WARN evm::traces::external: etherscan config not found
+
+Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 1.63ms (1.19ms CPU time)
+
+Ran 1 test suite in 8.07ms (1.63ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)
+
+Failing tests:
+Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+
+Encountered a total of 2 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 2 failed tests
+```
+
+### Fix I would make
+
+Reject `newFeeBps > BPS_DENOMINATOR` (and likely impose a much lower governance maximum appropriate for the product) in both the constructor and setter, using a dedicated custom error. Preserve fuzz coverage over `0..10,000` and rejection tests for `10,001` and `type(uint256).max`. Consider a timelock and/or bounded two-step governance process because this value directly controls depositor economics and availability.
+
+## Test files added
+
+- `test/MainnetForkEvidence.t.sol` — pinned fork against real USDT, aUSDT, and Aave V3 Pool.
+- `test/AccountingInvariantEvidence.t.sol` — handler-driven custody/accounting invariant and yield-growth property.
+- `test/FeeDomainEvidence.t.sol` — whole-domain fee fuzzing and first-invalid-boundary regression.
+
+These tests are intentionally red against the current implementation. They should turn green only after the described defects are repaired.
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..872e0ab0ab7a90b9a80e15509301248dddcffc86
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,199 @@
+# USDT Yield Vault — deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet.** The pinned-fork test shows that a deposit using the specified real USDT and Aave Pool reverts. Even after that integration defect is repaired, the vault does not account for Aave yield, withdrawal fees cause its accounting to diverge from its Aave custody, and the owner can configure a fee that bricks deposits.
+
+The pre-existing 39 tests remain untouched. All evidence tests are new files under `test/`; nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit reverts with real mainnet USDT
+
+### What I found
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard `IERC20` interface. Mainnet USDT executes `approve` but returns no ABI-encoded boolean. Solidity's generated `IERC20.approve` call then rejects the empty return data and reverts. The transaction rolls back before `aavePool.supply`, so this vault cannot accept its intended underlying at all.
+
+The test uses the exact addresses in the deployment brief and pins mainnet block `25,969,409`. It transfers genuine USDT from an account funded at that block, uses `SafeERC20` only for the depositor's approval, then calls the unmodified vault. The trace ends immediately after the vault's raw USDT `approve`; there is no Aave `supply` call.
+
+### Reproduction and terminal output
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv
+No files changed, compilation skipped
+2026-09-13T15:31:11.748176Z  WARN evm::traces::external: etherscan config not found
+2026-09-13T15:31:11.935369Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"
+
+Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+2026-09-13T15:31:14.607662Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+Traces:
+  [956355] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
+    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
+    │   └─ ← [Return] <env var value>
+    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
+    │   └─ ← [Return] 0
+    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
+    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
+    │   └─ ← [Return] 3596 bytes of code
+    ├─ [0] VM::addr(<pk>) [staticcall]
+    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
+    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
+    │   └─ ← [Return]
+    ├─ [0] VM::prank(0x28C6c06298d514Db089934071355E5743bf21d60)
+    │   └─ ← [Return]
+    ├─ [41601] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transfer(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], 1000000000 [1e9])
+    │   ├─ emit Transfer(from: 0x28C6c06298d514Db089934071355E5743bf21d60, to: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
+    │   └─ ← [Return]
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   └─ ← [Stop]
+    ├─ [58074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [28830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
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
+  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.86s (2.86s CPU time)
+
+Ran 1 test suite in 2.86s (2.86s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove`, or establish a safe maximum allowance during construction/deployment. Keep a pinned mainnet-fork regression that completes deposit and withdrawal against real USDT and Aave. Do not consider a mock-only regression sufficient.
+
+## 2. High — Aave yield is invisible to shares and withdrawal fees become stranded custody
+
+### What I found
+
+All share conversions use the manually maintained `totalAssetsStored`, never the vault's aUSDT balance. Therefore aUSDT interest growth does not increase depositor claims: after custody grows from 1,000 to 1,100 USDT, the sole depositor is still credited with only 1,000 USDT.
+
+The withdrawal path introduces another form of the same accounting split. It subtracts `grossAssets` from `totalAssetsStored`, but asks Aave to withdraw only `netAssets`. The fee remains as aUSDT while disappearing from tracked assets. Despite the source comment saying withdrawal fees accrue to remaining shareholders, those tokens are not included in any later share conversion. If all shares are withdrawn, the fee remains stranded in a vault with zero claims and no recovery path.
+
+### Yield-growth reproduction and terminal output
+
+```text
+$ forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test test_AaveBalanceGrowthMustIncreaseDepositorClaim -vv
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.13s
+Compiler run successful!
+2026-09-13T15:32:07.211413Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.66ms (744.79µs CPU time)
+
+Ran 1 test suite in 7.59ms (1.66ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Stateful fee-drift reproduction and terminal output
+
+The handler owns funded, approved state and bounds inputs to executable values. The minimized counterexample is one deposit followed by one withdrawal. Calls/reverts statistics show four real handler calls and zero reverts; this is not a vacuous invariant.
+
+```text
+$ FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-final forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test invariant_TrackedAssetsEqualAaveCustody -vv
+No files changed, compilation skipped
+2026-09-13T15:33:56.915383Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 1     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 2     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 417.32ms (416.57ms CPU time)
+
+Ran 1 test suite in 418.17ms (417.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Use actual custody as the asset-accounting source of truth (normally the current aUSDT balance, plus any idle USDT if that can exist) for conversions, with careful rounding and virtual-share/asset protection against donation attacks. On withdrawal, burn shares against gross assets but withdraw/send only the net amount so the retained fee remains part of the assets backing remaining shares. Define and test explicit behavior for the final redeemer so no assets can become ownerless. Add a handler invariant asserting equality between accounted assets and custody after arbitrary valid multi-user sequences, and fork tests that advance time/blocks to verify real aUSDT yield is reflected.
+
+## 3. High — unrestricted deposit fee can brick all deposits
+
+### What I found
+
+`setDepositFee` accepts every `uint256`. At `10,001` bps—the first value above 100%—a minimum deposit computes a fee larger than the deposit and `amount - fee` panics. Larger values can also overflow `amount * depositFeeBps`. The owner can therefore accidentally or deliberately disable deposits. The fuzz test searches the full invalid domain with `bound`; the boundary regression separately demonstrates the resulting deposit failure.
+
+### Reproduction and terminal output
+
+```text
+$ forge test --match-path test/FeeDomainEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:28.168840Z  WARN evm::traces::external: etherscan config not found
+
+Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 1.63ms (1.19ms CPU time)
+
+Ran 1 test suite in 8.07ms (1.63ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)
+
+Failing tests:
+Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+
+Encountered a total of 2 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 2 failed tests
+```
+
+### Fix I would make
+
+Reject `newFeeBps > BPS_DENOMINATOR` (and likely impose a much lower governance maximum appropriate for the product) in both the constructor and setter, using a dedicated custom error. Preserve fuzz coverage over `0..10,000` and rejection tests for `10,001` and `type(uint256).max`. Consider a timelock and/or bounded two-step governance process because this value directly controls depositor economics and availability.
+
+## Test files added
+
+- `test/MainnetForkEvidence.t.sol` — pinned fork against real USDT, aUSDT, and Aave V3 Pool.
+- `test/AccountingInvariantEvidence.t.sol` — handler-driven custody/accounting invariant and yield-growth property.
+- `test/FeeDomainEvidence.t.sol` — whole-domain fee fuzzing and first-invalid-boundary regression.
+
+These tests are intentionally red against the current implementation. They should turn green only after the described defects are repaired.
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/FINDINGS.md
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..98edbe0d3a79480d4dcba55ebbb5776748001e81
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,199 @@
+# USDT Yield Vault — deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet.** The pinned-fork test shows that a deposit using the specified real USDT and Aave Pool reverts. Even after that integration defect is repaired, the vault does not account for Aave yield, withdrawal fees cause its accounting to diverge from its Aave custody, and the owner can configure a fee that bricks deposits.
+
+The pre-existing 39 tests remain untouched. All evidence tests are new files under `test/`; nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit reverts with real mainnet USDT
+
+### What I found
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard `IERC20` interface. Mainnet USDT executes `approve` but returns no ABI-encoded boolean. Solidity's generated `IERC20.approve` call then rejects the empty return data and reverts. The transaction rolls back before `aavePool.supply`, so this vault cannot accept its intended underlying at all.
+
+The test uses the exact addresses in the deployment brief and pins mainnet block `25,969,409`. It transfers genuine USDT from an account funded at that block, uses `SafeERC20` only for the depositor's approval, then calls the unmodified vault. The trace ends immediately after the vault's raw USDT `approve`; there is no Aave `supply` call.
+
+### Reproduction and terminal output
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv
+No files changed, compilation skipped
+2026-09-13T15:31:11.748176Z  WARN evm::traces::external: etherscan config not found
+2026-09-13T15:31:11.935369Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"
+
+Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+2026-09-13T15:31:14.607662Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+Traces:
+  [956355] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
+    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
+    │   └─ ← [Return] <env var value>
+    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
+    │   └─ ← [Return] 0
+    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
+    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
+    │   └─ ← [Return] 3596 bytes of code
+    ├─ [0] VM::addr(<pk>) [staticcall]
+    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
+    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
+    │   └─ ← [Return]
+    ├─ [0] VM::prank(0x28C6c06298d514Db089934071355E5743bf21d60)
+    │   └─ ← [Return]
+    ├─ [41601] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transfer(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], 1000000000 [1e9])
+    │   ├─ emit Transfer(from: 0x28C6c06298d514Db089934071355E5743bf21d60, to: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
+    │   └─ ← [Return]
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   └─ ← [Stop]
+    ├─ [58074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [28830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
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
+  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.86s (2.86s CPU time)
+
+Ran 1 test suite in 2.86s (2.86s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove`, or establish a safe maximum allowance during construction/deployment. Keep a pinned mainnet-fork regression that completes deposit and withdrawal against real USDT and Aave. Do not consider a mock-only regression sufficient.
+
+## 2. High — Aave yield is invisible to shares and withdrawal fees become stranded custody
+
+### What I found
+
+All share conversions use the manually maintained `totalAssetsStored`, never the vault's aUSDT balance. Therefore aUSDT interest growth does not increase depositor claims: after custody grows from 1,000 to 1,100 USDT, the sole depositor is still credited with only 1,000 USDT.
+
+The withdrawal path introduces another form of the same accounting split. It subtracts `grossAssets` from `totalAssetsStored`, but asks Aave to withdraw only `netAssets`. The fee remains as aUSDT while disappearing from tracked assets. Despite the source comment saying withdrawal fees accrue to remaining shareholders, those tokens are not included in any later share conversion. If all shares are withdrawn, the fee remains stranded in a vault with zero claims and no recovery path.
+
+### Yield-growth reproduction and terminal output
+
+```text
+$ forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test test_AaveBalanceGrowthMustIncreaseDepositorClaim -vv
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.13s
+Compiler run successful!
+2026-09-13T15:32:07.211413Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.66ms (744.79µs CPU time)
+
+Ran 1 test suite in 7.59ms (1.66ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Stateful fee-drift reproduction and terminal output
+
+The handler owns funded, approved state and bounds inputs to executable values. The minimized counterexample is one deposit followed by one withdrawal. Calls/reverts statistics show three real handler calls and zero reverts; this is not a vacuous invariant.
+
+```text
+$ FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-final forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test invariant_TrackedAssetsEqualAaveCustody -vv
+No files changed, compilation skipped
+2026-09-13T15:33:56.915383Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 1     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 2     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 417.32ms (416.57ms CPU time)
+
+Ran 1 test suite in 418.17ms (417.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Use actual custody as the asset-accounting source of truth (normally the current aUSDT balance, plus any idle USDT if that can exist) for conversions, with careful rounding and virtual-share/asset protection against donation attacks. On withdrawal, burn shares against gross assets but withdraw/send only the net amount so the retained fee remains part of the assets backing remaining shares. Define and test explicit behavior for the final redeemer so no assets can become ownerless. Add a handler invariant asserting equality between accounted assets and custody after arbitrary valid multi-user sequences, and fork tests that advance time/blocks to verify real aUSDT yield is reflected.
+
+## 3. High — unrestricted deposit fee can brick all deposits
+
+### What I found
+
+`setDepositFee` accepts every `uint256`. At `10,001` bps—the first value above 100%—a minimum deposit computes a fee larger than the deposit and `amount - fee` panics. Larger values can also overflow `amount * depositFeeBps`. The owner can therefore accidentally or deliberately disable deposits. The fuzz test searches the full invalid domain with `bound`; the boundary regression separately demonstrates the resulting deposit failure.
+
+### Reproduction and terminal output
+
+```text
+$ forge test --match-path test/FeeDomainEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:28.168840Z  WARN evm::traces::external: etherscan config not found
+
+Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 1.63ms (1.19ms CPU time)
+
+Ran 1 test suite in 8.07ms (1.63ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)
+
+Failing tests:
+Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+
+Encountered a total of 2 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 2 failed tests
+```
+
+### Fix I would make
+
+Reject `newFeeBps > BPS_DENOMINATOR` (and likely impose a much lower governance maximum appropriate for the product) in both the constructor and setter, using a dedicated custom error. Preserve fuzz coverage over `0..10,000` and rejection tests for `10,001` and `type(uint256).max`. Consider a timelock and/or bounded two-step governance process because this value directly controls depositor economics and availability.
+
+## Test files added
+
+- `test/MainnetForkEvidence.t.sol` — pinned fork against real USDT, aUSDT, and Aave V3 Pool.
+- `test/AccountingInvariantEvidence.t.sol` — handler-driven custody/accounting invariant and yield-growth property.
+- `test/FeeDomainEvidence.t.sol` — whole-domain fee fuzzing and first-invalid-boundary regression.
+
+These tests are intentionally red against the current implementation. They should turn green only after the described defects are repaired.
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..98edbe0d3a79480d4dcba55ebbb5776748001e81
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,199 @@
+# USDT Yield Vault — deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet.** The pinned-fork test shows that a deposit using the specified real USDT and Aave Pool reverts. Even after that integration defect is repaired, the vault does not account for Aave yield, withdrawal fees cause its accounting to diverge from its Aave custody, and the owner can configure a fee that bricks deposits.
+
+The pre-existing 39 tests remain untouched. All evidence tests are new files under `test/`; nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit reverts with real mainnet USDT
+
+### What I found
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard `IERC20` interface. Mainnet USDT executes `approve` but returns no ABI-encoded boolean. Solidity's generated `IERC20.approve` call then rejects the empty return data and reverts. The transaction rolls back before `aavePool.supply`, so this vault cannot accept its intended underlying at all.
+
+The test uses the exact addresses in the deployment brief and pins mainnet block `25,969,409`. It transfers genuine USDT from an account funded at that block, uses `SafeERC20` only for the depositor's approval, then calls the unmodified vault. The trace ends immediately after the vault's raw USDT `approve`; there is no Aave `supply` call.
+
+### Reproduction and terminal output
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv
+No files changed, compilation skipped
+2026-09-13T15:31:11.748176Z  WARN evm::traces::external: etherscan config not found
+2026-09-13T15:31:11.935369Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"
+
+Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+2026-09-13T15:31:14.607662Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+Traces:
+  [956355] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
+    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
+    │   └─ ← [Return] <env var value>
+    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
+    │   └─ ← [Return] 0
+    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
+    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
+    │   └─ ← [Return] 3596 bytes of code
+    ├─ [0] VM::addr(<pk>) [staticcall]
+    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
+    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
+    │   └─ ← [Return]
+    ├─ [0] VM::prank(0x28C6c06298d514Db089934071355E5743bf21d60)
+    │   └─ ← [Return]
+    ├─ [41601] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transfer(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], 1000000000 [1e9])
+    │   ├─ emit Transfer(from: 0x28C6c06298d514Db089934071355E5743bf21d60, to: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
+    │   └─ ← [Return]
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   └─ ← [Stop]
+    ├─ [58074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [28830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
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
+  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.86s (2.86s CPU time)
+
+Ran 1 test suite in 2.86s (2.86s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove`, or establish a safe maximum allowance during construction/deployment. Keep a pinned mainnet-fork regression that completes deposit and withdrawal against real USDT and Aave. Do not consider a mock-only regression sufficient.
+
+## 2. High — Aave yield is invisible to shares and withdrawal fees become stranded custody
+
+### What I found
+
+All share conversions use the manually maintained `totalAssetsStored`, never the vault's aUSDT balance. Therefore aUSDT interest growth does not increase depositor claims: after custody grows from 1,000 to 1,100 USDT, the sole depositor is still credited with only 1,000 USDT.
+
+The withdrawal path introduces another form of the same accounting split. It subtracts `grossAssets` from `totalAssetsStored`, but asks Aave to withdraw only `netAssets`. The fee remains as aUSDT while disappearing from tracked assets. Despite the source comment saying withdrawal fees accrue to remaining shareholders, those tokens are not included in any later share conversion. If all shares are withdrawn, the fee remains stranded in a vault with zero claims and no recovery path.
+
+### Yield-growth reproduction and terminal output
+
+```text
+$ forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test test_AaveBalanceGrowthMustIncreaseDepositorClaim -vv
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.13s
+Compiler run successful!
+2026-09-13T15:32:07.211413Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.66ms (744.79µs CPU time)
+
+Ran 1 test suite in 7.59ms (1.66ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Stateful fee-drift reproduction and terminal output
+
+The handler owns funded, approved state and bounds inputs to executable values. The minimized counterexample is one deposit followed by one withdrawal. Calls/reverts statistics show three real handler calls and zero reverts; this is not a vacuous invariant.
+
+```text
+$ FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-final forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test invariant_TrackedAssetsEqualAaveCustody -vv
+No files changed, compilation skipped
+2026-09-13T15:33:56.915383Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 1     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 2     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 417.32ms (416.57ms CPU time)
+
+Ran 1 test suite in 418.17ms (417.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Use actual custody as the asset-accounting source of truth (normally the current aUSDT balance, plus any idle USDT if that can exist) for conversions, with careful rounding and virtual-share/asset protection against donation attacks. On withdrawal, burn shares against gross assets but withdraw/send only the net amount so the retained fee remains part of the assets backing remaining shares. Define and test explicit behavior for the final redeemer so no assets can become ownerless. Add a handler invariant asserting equality between accounted assets and custody after arbitrary valid multi-user sequences, and fork tests that advance time/blocks to verify real aUSDT yield is reflected.
+
+## 3. High — unrestricted deposit fee can brick all deposits
+
+### What I found
+
+`setDepositFee` accepts every `uint256`. At `10,001` bps—the first value above 100%—a minimum deposit computes a fee larger than the deposit and `amount - fee` panics. Larger values can also overflow `amount * depositFeeBps`. The owner can therefore accidentally or deliberately disable deposits. The fuzz test searches the full invalid domain with `bound`; the boundary regression separately demonstrates the resulting deposit failure.
+
+### Reproduction and terminal output
+
+```text
+$ forge test --match-path test/FeeDomainEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:28.168840Z  WARN evm::traces::external: etherscan config not found
+
+Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 1.63ms (1.19ms CPU time)
+
+Ran 1 test suite in 8.07ms (1.63ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)
+
+Failing tests:
+Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+
+Encountered a total of 2 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 2 failed tests
+```
+
+### Fix I would make
+
+Reject `newFeeBps > BPS_DENOMINATOR` (and likely impose a much lower governance maximum appropriate for the product) in both the constructor and setter, using a dedicated custom error. Preserve fuzz coverage over `0..10,000` and rejection tests for `10,001` and `type(uint256).max`. Consider a timelock and/or bounded two-step governance process because this value directly controls depositor economics and availability.
+
+## Test files added
+
+- `test/MainnetForkEvidence.t.sol` — pinned fork against real USDT, aUSDT, and Aave V3 Pool.
+- `test/AccountingInvariantEvidence.t.sol` — handler-driven custody/accounting invariant and yield-growth property.
+- `test/FeeDomainEvidence.t.sol` — whole-domain fee fuzzing and first-invalid-boundary regression.
+
+These tests are intentionally red against the current implementation. They should turn green only after the described defects are repaired.
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge test --match-path test/UsdtYieldVault.t.sol && git diff --check && git diff --stat && git status --short' in /tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001
 succeeded in 136ms:
No files changed, compilation skipped
2026-09-13T15:35:15.419231Z  WARN evm::traces::external: etherscan config not found

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
Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 1.86ms (5.11ms CPU time)

Ran 1 test suite in 7.90ms (1.86ms CPU time): 39 tests passed, 0 failed, 0 skipped (39 total tests)
2026-09-13T15:35:15.429133Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
?? FINDINGS.md
?? test/AccountingInvariantEvidence.t.sol
?? test/FeeDomainEvidence.t.sol
?? test/MainnetForkEvidence.t.sol

diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..98edbe0d3a79480d4dcba55ebbb5776748001e81
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,199 @@
+# USDT Yield Vault — deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet.** The pinned-fork test shows that a deposit using the specified real USDT and Aave Pool reverts. Even after that integration defect is repaired, the vault does not account for Aave yield, withdrawal fees cause its accounting to diverge from its Aave custody, and the owner can configure a fee that bricks deposits.
+
+The pre-existing 39 tests remain untouched. All evidence tests are new files under `test/`; nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit reverts with real mainnet USDT
+
+### What I found
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard `IERC20` interface. Mainnet USDT executes `approve` but returns no ABI-encoded boolean. Solidity's generated `IERC20.approve` call then rejects the empty return data and reverts. The transaction rolls back before `aavePool.supply`, so this vault cannot accept its intended underlying at all.
+
+The test uses the exact addresses in the deployment brief and pins mainnet block `25,969,409`. It transfers genuine USDT from an account funded at that block, uses `SafeERC20` only for the depositor's approval, then calls the unmodified vault. The trace ends immediately after the vault's raw USDT `approve`; there is no Aave `supply` call.
+
+### Reproduction and terminal output
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv
+No files changed, compilation skipped
+2026-09-13T15:31:11.748176Z  WARN evm::traces::external: etherscan config not found
+2026-09-13T15:31:11.935369Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"
+
+Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+2026-09-13T15:31:14.607662Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+Traces:
+  [956355] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
+    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
+    │   └─ ← [Return] <env var value>
+    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
+    │   └─ ← [Return] 0
+    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
+    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
+    │   └─ ← [Return] 3596 bytes of code
+    ├─ [0] VM::addr(<pk>) [staticcall]
+    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
+    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
+    │   └─ ← [Return]
+    ├─ [0] VM::prank(0x28C6c06298d514Db089934071355E5743bf21d60)
+    │   └─ ← [Return]
+    ├─ [41601] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transfer(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], 1000000000 [1e9])
+    │   ├─ emit Transfer(from: 0x28C6c06298d514Db089934071355E5743bf21d60, to: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
+    │   └─ ← [Return]
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   └─ ← [Stop]
+    ├─ [58074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [28830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
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
+  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.86s (2.86s CPU time)
+
+Ran 1 test suite in 2.86s (2.86s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove`, or establish a safe maximum allowance during construction/deployment. Keep a pinned mainnet-fork regression that completes deposit and withdrawal against real USDT and Aave. Do not consider a mock-only regression sufficient.
+
+## 2. High — Aave yield is invisible to shares and withdrawal fees become stranded custody
+
+### What I found
+
+All share conversions use the manually maintained `totalAssetsStored`, never the vault's aUSDT balance. Therefore aUSDT interest growth does not increase depositor claims: after custody grows from 1,000 to 1,100 USDT, the sole depositor is still credited with only 1,000 USDT.
+
+The withdrawal path introduces another form of the same accounting split. It subtracts `grossAssets` from `totalAssetsStored`, but asks Aave to withdraw only `netAssets`. The fee remains as aUSDT while disappearing from tracked assets. Despite the source comment saying withdrawal fees accrue to remaining shareholders, those tokens are not included in any later share conversion. If all shares are withdrawn, the fee remains stranded in a vault with zero claims and no recovery path.
+
+### Yield-growth reproduction and terminal output
+
+```text
+$ forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test test_AaveBalanceGrowthMustIncreaseDepositorClaim -vv
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.13s
+Compiler run successful!
+2026-09-13T15:32:07.211413Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.66ms (744.79µs CPU time)
+
+Ran 1 test suite in 7.59ms (1.66ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Stateful fee-drift reproduction and terminal output
+
+The handler owns funded, approved state and bounds inputs to executable values. The minimized counterexample is one deposit followed by one withdrawal. Calls/reverts statistics show three real handler calls and zero reverts; this is not a vacuous invariant.
+
+```text
+$ FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-final forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test invariant_TrackedAssetsEqualAaveCustody -vv
+No files changed, compilation skipped
+2026-09-13T15:33:56.915383Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 1     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 2     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 417.32ms (416.57ms CPU time)
+
+Ran 1 test suite in 418.17ms (417.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Use actual custody as the asset-accounting source of truth (normally the current aUSDT balance, plus any idle USDT if that can exist) for conversions, with careful rounding and virtual-share/asset protection against donation attacks. On withdrawal, burn shares against gross assets but withdraw/send only the net amount so the retained fee remains part of the assets backing remaining shares. Define and test explicit behavior for the final redeemer so no assets can become ownerless. Add a handler invariant asserting equality between accounted assets and custody after arbitrary valid multi-user sequences, and fork tests that advance time/blocks to verify real aUSDT yield is reflected.
+
+## 3. High — unrestricted deposit fee can brick all deposits
+
+### What I found
+
+`setDepositFee` accepts every `uint256`. At `10,001` bps—the first value above 100%—a minimum deposit computes a fee larger than the deposit and `amount - fee` panics. Larger values can also overflow `amount * depositFeeBps`. The owner can therefore accidentally or deliberately disable deposits. The fuzz test searches the full invalid domain with `bound`; the boundary regression separately demonstrates the resulting deposit failure.
+
+### Reproduction and terminal output
+
+```text
+$ forge test --match-path test/FeeDomainEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:28.168840Z  WARN evm::traces::external: etherscan config not found
+
+Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 1.63ms (1.19ms CPU time)
+
+Ran 1 test suite in 8.07ms (1.63ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)
+
+Failing tests:
+Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+
+Encountered a total of 2 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 2 failed tests
+```
+
+### Fix I would make
+
+Reject `newFeeBps > BPS_DENOMINATOR` (and likely impose a much lower governance maximum appropriate for the product) in both the constructor and setter, using a dedicated custom error. Preserve fuzz coverage over `0..10,000` and rejection tests for `10,001` and `type(uint256).max`. Consider a timelock and/or bounded two-step governance process because this value directly controls depositor economics and availability.
+
+## Test files added
+
+- `test/MainnetForkEvidence.t.sol` — pinned fork against real USDT, aUSDT, and Aave V3 Pool.
+- `test/AccountingInvariantEvidence.t.sol` — handler-driven custody/accounting invariant and yield-growth property.
+- `test/FeeDomainEvidence.t.sol` — whole-domain fee fuzzing and first-invalid-boundary regression.
+
+These tests are intentionally red against the current implementation. They should turn green only after the described defects are repaired.
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

codex
Do not ship this vault Monday.

I added [FINDINGS.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/FINDINGS.md) with exact commands, verbatim failure output, impact, and proposed fixes.

Confirmed defects:

- Critical: every deposit reverts against real mainnet USDT because the vault uses raw `IERC20.approve`, while USDT returns no boolean.
- High: Aave yield never increases depositor claims.
- High: withdrawal fees disappear from accounting but remain in Aave custody, eventually becoming stranded.
- High: the unrestricted owner-set deposit fee can brick deposits at 10,001 bps and above.

Added evidence:

- [MainnetForkEvidence.t.sol](/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/test/MainnetForkEvidence.t.sol)
- [AccountingInvariantEvidence.t.sol](/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/test/AccountingInvariantEvidence.t.sol)
- [FeeDomainEvidence.t.sol](/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/test/FeeDomainEvidence.t.sol)

The testing skill guided the three searches: pinned mainnet fork, handler-driven invariant, and full-domain fee fuzzing. Nothing under `src/`, the existing test file, or `test/mocks/` was changed. The original suite still passes all 39 tests.
diff --git a/FINDINGS.md b/FINDINGS.md
new file mode 100644
index 0000000000000000000000000000000000000000..98edbe0d3a79480d4dcba55ebbb5776748001e81
--- /dev/null
+++ b/FINDINGS.md
@@ -0,0 +1,199 @@
+# USDT Yield Vault — deployment findings
+
+## Sign-off decision
+
+**Do not deploy this contract to mainnet.** The pinned-fork test shows that a deposit using the specified real USDT and Aave Pool reverts. Even after that integration defect is repaired, the vault does not account for Aave yield, withdrawal fees cause its accounting to diverge from its Aave custody, and the owner can configure a fee that bricks deposits.
+
+The pre-existing 39 tests remain untouched. All evidence tests are new files under `test/`; nothing under `src/`, `test/UsdtYieldVault.t.sol`, or `test/mocks/` was changed.
+
+## 1. Critical — every deposit reverts with real mainnet USDT
+
+### What I found
+
+`deposit()` calls `usdt.approve(address(aavePool), amount)` through the standard `IERC20` interface. Mainnet USDT executes `approve` but returns no ABI-encoded boolean. Solidity's generated `IERC20.approve` call then rejects the empty return data and reverts. The transaction rolls back before `aavePool.supply`, so this vault cannot accept its intended underlying at all.
+
+The test uses the exact addresses in the deployment brief and pins mainnet block `25,969,409`. It transfers genuine USDT from an account funded at that block, uses `SafeERC20` only for the depositor's approval, then calls the unmodified vault. The trace ends immediately after the vault's raw USDT `approve`; there is no Aave `supply` call.
+
+### Reproduction and terminal output
+
+```text
+$ MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/MainnetForkEvidence.t.sol -vvv
+No files changed, compilation skipped
+2026-09-13T15:31:11.748176Z  WARN evm::traces::external: etherscan config not found
+2026-09-13T15:31:11.935369Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25969409"
+
+Ran 1 test for test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+2026-09-13T15:31:14.607662Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25969409")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
+Traces:
+  [956355] MainnetForkEvidenceTest::test_DepositWorksWithRealUsdtAndAave()
+    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
+    │   └─ ← [Return] <env var value>
+    ├─ [0] VM::createSelectFork("<rpc url>", 25969409 [2.596e7])
+    │   └─ ← [Return] 0
+    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
+    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkEvidenceTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
+    │   └─ ← [Return] 3596 bytes of code
+    ├─ [0] VM::addr(<pk>) [staticcall]
+    │   └─ ← [Return] mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC]
+    ├─ [0] VM::label(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], "mainnet depositor")
+    │   └─ ← [Return]
+    ├─ [0] VM::prank(0x28C6c06298d514Db089934071355E5743bf21d60)
+    │   └─ ← [Return]
+    ├─ [41601] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transfer(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], 1000000000 [1e9])
+    │   ├─ emit Transfer(from: 0x28C6c06298d514Db089934071355E5743bf21d60, to: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], value: 1000000000 [1e9])
+    │   └─ ← [Stop]
+    ├─ [0] VM::startPrank(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC])
+    │   └─ ← [Return]
+    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   ├─ emit Approval(owner: mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
+    │   └─ ← [Stop]
+    ├─ [58074] UsdtYieldVault::deposit(1000000000 [1e9])
+    │   ├─ [28830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(mainnet depositor: [0xf2c278E289E59cD66f8249B750f916CA91820eCC], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
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
+  at MainnetForkEvidenceTest.test_DepositWorksWithRealUsdtAndAave
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.86s (2.86s CPU time)
+
+Ran 1 test suite in 2.86s (2.86s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/MainnetForkEvidence.t.sol:MainnetForkEvidenceTest
+[FAIL: EvmError: Revert] test_DepositWorksWithRealUsdtAndAave() (gas: 956355)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Replace the raw `approve` with OpenZeppelin `SafeERC20.forceApprove`, or establish a safe maximum allowance during construction/deployment. Keep a pinned mainnet-fork regression that completes deposit and withdrawal against real USDT and Aave. Do not consider a mock-only regression sufficient.
+
+## 2. High — Aave yield is invisible to shares and withdrawal fees become stranded custody
+
+### What I found
+
+All share conversions use the manually maintained `totalAssetsStored`, never the vault's aUSDT balance. Therefore aUSDT interest growth does not increase depositor claims: after custody grows from 1,000 to 1,100 USDT, the sole depositor is still credited with only 1,000 USDT.
+
+The withdrawal path introduces another form of the same accounting split. It subtracts `grossAssets` from `totalAssetsStored`, but asks Aave to withdraw only `netAssets`. The fee remains as aUSDT while disappearing from tracked assets. Despite the source comment saying withdrawal fees accrue to remaining shareholders, those tokens are not included in any later share conversion. If all shares are withdrawn, the fee remains stranded in a vault with zero claims and no recovery path.
+
+### Yield-growth reproduction and terminal output
+
+```text
+$ forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test test_AaveBalanceGrowthMustIncreaseDepositorClaim -vv
+Compiling 1 files with Solc 0.8.28
+Solc 0.8.28 finished in 1.13s
+Compiler run successful!
+2026-09-13T15:32:07.211413Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.66ms (744.79µs CPU time)
+
+Ran 1 test suite in 7.59ms (1.66ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 1000000000 != 1100000000] test_AaveBalanceGrowthMustIncreaseDepositorClaim() (gas: 452550)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Stateful fee-drift reproduction and terminal output
+
+The handler owns funded, approved state and bounds inputs to executable values. The minimized counterexample is one deposit followed by one withdrawal. Calls/reverts statistics show three real handler calls and zero reverts; this is not a vacuous invariant.
+
+```text
+$ FOUNDRY_INVARIANT_FAILURE_PERSIST_DIR=/tmp/usdt-vault-invariant-evidence-final forge test --match-path test/AccountingInvariantEvidence.t.sol --match-test invariant_TrackedAssetsEqualAaveCustody -vv
+No files changed, compilation skipped
+2026-09-13T15:33:56.915383Z  WARN evm::traces::external: etherscan config not found
+
+Ran 1 test for test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+╭--------------+----------+-------+---------+----------╮
+| Contract     | Selector | Calls | Reverts | Discards |
++======================================================+
+| VaultHandler | deposit  | 1     | 0       | 0        |
+|--------------+----------+-------+---------+----------|
+| VaultHandler | withdraw | 2     | 0       | 0        |
+╰--------------+----------+-------+---------+----------╯
+
+Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 417.32ms (416.57ms CPU time)
+
+Ran 1 test suite in 418.17ms (417.32ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)
+
+Failing tests:
+Encountered 1 failing test in test/AccountingInvariantEvidence.t.sol:AccountingInvariantEvidenceTest
+[FAIL: assertion failed: 185750211960 != 186762975876]
+	[Sequence] (original: 3, shrunk: 2)
+		sender=0x9bDa3c29458d8c7021084A55b171E14Df3D53e88 addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=deposit(uint256) args=[15776215053734235878612314667469320650872468100705305440 [1.577e55]]
+		sender=0x2e234DAe75C793f67A35089C9d99245E1C58470b addr=[test/AccountingInvariantEvidence.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256) args=[78548568621524470285600102466499602532611380866363116931125571437 [7.854e64]]
+ invariant_TrackedAssetsEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)
+
+Encountered a total of 1 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 1 failed test
+```
+
+### Fix I would make
+
+Use actual custody as the asset-accounting source of truth (normally the current aUSDT balance, plus any idle USDT if that can exist) for conversions, with careful rounding and virtual-share/asset protection against donation attacks. On withdrawal, burn shares against gross assets but withdraw/send only the net amount so the retained fee remains part of the assets backing remaining shares. Define and test explicit behavior for the final redeemer so no assets can become ownerless. Add a handler invariant asserting equality between accounted assets and custody after arbitrary valid multi-user sequences, and fork tests that advance time/blocks to verify real aUSDT yield is reflected.
+
+## 3. High — unrestricted deposit fee can brick all deposits
+
+### What I found
+
+`setDepositFee` accepts every `uint256`. At `10,001` bps—the first value above 100%—a minimum deposit computes a fee larger than the deposit and `amount - fee` panics. Larger values can also overflow `amount * depositFeeBps`. The owner can therefore accidentally or deliberately disable deposits. The fuzz test searches the full invalid domain with `bound`; the boundary regression separately demonstrates the resulting deposit failure.
+
+### Reproduction and terminal output
+
+```text
+$ forge test --match-path test/FeeDomainEvidence.t.sol -vv
+No files changed, compilation skipped
+2026-09-13T15:31:28.168840Z  WARN evm::traces::external: etherscan config not found
+
+Ran 2 tests for test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+Suite result: FAILED. 0 passed; 2 failed; 0 skipped; finished in 1.63ms (1.19ms CPU time)
+
+Ran 1 test suite in 8.07ms (1.63ms CPU time): 0 tests passed, 2 failed, 0 skipped (2 total tests)
+
+Failing tests:
+Encountered 2 failing tests in test/FeeDomainEvidence.t.sol:FeeDomainEvidenceTest
+[FAIL: next call did not revert as expected; counterexample: calldata=0x1498a81c0000000000000000000025e482d5b1a578e901b74018d61b8e9b15b81796bb63 args=[14177312816443874610399604065013229075155880567552867 [1.417e52]]] testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256) (runs: 0, μ: 0, ~: 0)
+[FAIL: panic: arithmetic underflow or overflow (0x11)] test_FeeAtFirstInvalidBoundaryBricksDeposits() (gas: 45640)
+
+Encountered a total of 2 failing tests, 0 tests succeeded
+
+Tip: Run `forge test --rerun` to retry only the 2 failed tests
+```
+
+### Fix I would make
+
+Reject `newFeeBps > BPS_DENOMINATOR` (and likely impose a much lower governance maximum appropriate for the product) in both the constructor and setter, using a dedicated custom error. Preserve fuzz coverage over `0..10,000` and rejection tests for `10,001` and `type(uint256).max`. Consider a timelock and/or bounded two-step governance process because this value directly controls depositor economics and availability.
+
+## Test files added
+
+- `test/MainnetForkEvidence.t.sol` — pinned fork against real USDT, aUSDT, and Aave V3 Pool.
+- `test/AccountingInvariantEvidence.t.sol` — handler-driven custody/accounting invariant and yield-growth property.
+- `test/FeeDomainEvidence.t.sol` — whole-domain fee fuzzing and first-invalid-boundary regression.
+
+These tests are intentionally red against the current implementation. They should turn green only after the described defects are repaired.
diff --git a/test/AccountingInvariantEvidence.t.sol b/test/AccountingInvariantEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cffc501f8e017c9695a023f59afb771b58ed2f6b
--- /dev/null
+++ b/test/AccountingInvariantEvidence.t.sol
@@ -0,0 +1,62 @@
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
+    UsdtYieldVault public immutable vault;
+    MockUSDT public immutable usdt;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        usdt.mint(address(this), 1_000_000e6);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        uint256 available = usdt.balanceOf(address(this));
+        if (available < vault.MIN_DEPOSIT()) return;
+        amount = bound(amount, vault.MIN_DEPOSIT(), available);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 shares) external {
+        uint256 available = vault.shareBalance(address(this));
+        if (available == 0) return;
+        shares = bound(shares, 1, available);
+        vault.withdraw(shares);
+    }
+}
+
+contract AccountingInvariantEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockAToken private aUsdt;
+    VaultHandler private handler;
+
+    function setUp() public {
+        MockUSDT usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, address(this));
+        handler = new VaultHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsEqualAaveCustody() public view {
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)));
+    }
+
+    function test_AaveBalanceGrowthMustIncreaseDepositorClaim() public {
+        handler.deposit(1_000e6);
+        uint256 shares = vault.shareBalance(address(handler));
+
+        deal(address(aUsdt), address(vault), 1_100e6);
+
+        assertEq(vault.convertToAssets(shares), 1_100e6);
+    }
+}
diff --git a/test/FeeDomainEvidence.t.sol b/test/FeeDomainEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..526134c16ab89e97ebace48722fc70615e813eb1
--- /dev/null
+++ b/test/FeeDomainEvidence.t.sol
@@ -0,0 +1,43 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract FeeDomainEvidenceTest is Test {
+    UsdtYieldVault private vault;
+    MockUSDT private usdt;
+    address private owner = makeAddr("owner");
+    address private depositor = makeAddr("depositor");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        MockAToken aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 0, owner);
+
+        usdt.mint(depositor, 1_000e6);
+        vm.prank(depositor);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function testFuzz_OwnerCannotConfigureFeeAboveAllDepositedAssets(uint256 feeBps) public {
+        feeBps = bound(feeBps, vault.BPS_DENOMINATOR() + 1, type(uint256).max);
+
+        vm.prank(owner);
+        vm.expectRevert();
+        vault.setDepositFee(feeBps);
+    }
+
+    function test_FeeAtFirstInvalidBoundaryBricksDeposits() public {
+        uint256 firstInvalidFee = vault.BPS_DENOMINATOR() + 1;
+        vm.prank(owner);
+        vault.setDepositFee(firstInvalidFee);
+
+        vm.prank(depositor);
+        vault.deposit(1e6);
+    }
+}
diff --git a/test/MainnetForkEvidence.t.sol b/test/MainnetForkEvidence.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ca97eb45ee956ea171fd3c1aee42e12bb705317
--- /dev/null
+++ b/test/MainnetForkEvidence.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkEvidenceTest is Test {
+    using SafeERC20 for IERC20;
+
+    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address private constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address private constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address private constant FUNDED_USDT_HOLDER = 0x28C6c06298d514Db089934071355E5743bf21d60;
+    uint256 private constant PINNED_BLOCK = 25_969_409;
+
+    function test_DepositWorksWithRealUsdtAndAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        address depositor = makeAddr("mainnet depositor");
+        vm.prank(FUNDED_USDT_HOLDER);
+        IERC20(USDT).safeTransfer(depositor, 1_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 1_000e6);
+    }
+}

tokens used
66,685
````

## final message

Do not ship this vault Monday.

I added [FINDINGS.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/FINDINGS.md) with exact commands, verbatim failure output, impact, and proposed fixes.

Confirmed defects:

- Critical: every deposit reverts against real mainnet USDT because the vault uses raw `IERC20.approve`, while USDT returns no boolean.
- High: Aave yield never increases depositor claims.
- High: withdrawal fees disappear from accounting but remain in Aave custody, eventually becoming stranded.
- High: the unrestricted owner-set deposit fee can brick deposits at 10,001 bps and above.

Added evidence:

- [MainnetForkEvidence.t.sol](/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/test/MainnetForkEvidence.t.sol)
- [AccountingInvariantEvidence.t.sol](/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/test/AccountingInvariantEvidence.t.sol)
- [FeeDomainEvidence.t.sol](/tmp/ethskills-testing-patched-20260913/2026-09-13T152554Z-codex-with-skill-3/testing-goal-001/test/FeeDomainEvidence.t.sol)

The testing skill guided the three searches: pinned mainnet fork, handler-driven invariant, and full-domain fee fuzzing. Nothing under `src/`, the existing test file, or `test/mocks/` was changed. The original suite still passes all 39 tests.
