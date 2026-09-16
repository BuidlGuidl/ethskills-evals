# Executor transcript — 2026-09-15T003202Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 1
**workspace**: /tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001

## session

````text
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "/tmp" (codex_home: AbsolutePathBuf("/tmp/ethskills-eval-harness-codex"))
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0a27a-8878-7513-9b04-3245cb94f902
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
I’m using the `testing` skill because this is explicitly a Foundry test sufficiency and deployment-readiness review. I’ll first inspect its full guidance and the repository, then add only new test files and capture reproducible failing command output verbatim.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md && printf '\\n---FILES---\\n' && rg --files -g '"'!*cache*'"' -g '"'!out/**'"' && printf '\\n---STATUS---\\n' && git status --short" in /tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001
 succeeded in 32ms:
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

First decide which values at a boundary are semantically usable; do not assume the exact limit is valid merely because only values beyond it violate a numeric inequality. Exercise the nearest valid value, the exact limit, and the first value beyond it where representable. Preserve separate evidence when the exact limit and the value beyond it fail through different paths.

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

One post-operation mismatch proves divergence, not accumulation. When claiming cumulative drift, show the gap after at least two operations capable of creating that drift — for example, two fee-bearing withdrawals, not setup followed by one withdrawal — or provide a stateful-invariant counterexample whose call sequence demonstrates the growth.

Point `targetContract` at a handler, never at the contract under test. Called directly, the fuzzer supplies random senders that hold no tokens and granted no approvals, so nearly every call reverts. Reverts are discarded rather than failing the run, and the invariant is then asserted against a contract that never left its initial state — green because nothing happened.

The handler owns setup: funded and approved actors, inputs bounded to valid ranges, multiple actors where the property is about interaction between them.

Read the calls/reverts statistics in the run output every time. A revert rate near 100% means the run proved nothing; set `fail_on_revert = true` to surface it while building the handler.

## Before deploy

- [ ] No test asserts the implementation back to itself.
- [ ] Every owner-settable number feeding value math is fuzzed across its domain; each boundary's nearest valid value, exact limit, and first value beyond it are classified and exercised separately where representable.
- [ ] Every external integration and quirky token is exercised on a pinned fork against the real deployment, on an endpoint confirmed to serve that block.
- [ ] Stateful contracts have a handler-driven invariant tying accounting to custody, with a revert rate low enough that the sequences reached real states.
- [ ] Access control, zero, and max-value cases revert as intended.
- [ ] `slither .` run, with no high or medium finding left unaddressed.

---FILES---
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

---STATUS---

exec
/bin/bash -lc "sed -n '1,260p' src/UsdtYieldVault.sol && printf '\\n--- IAAVE ---\\n' && cat src/interfaces/IAavePool.sol && printf '\\n--- TEST ---\\n' && sed -n '1,360p' test/UsdtYieldVault.t.sol && printf '\\n--- MOCKS ---\\n' && cat test/mocks/MockUSDT.sol test/mocks/MockAavePool.sol && printf '\\n--- CONFIG ---\\n' && cat foundry.toml README.md TASK.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001
 succeeded in 11ms:
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

--- IAAVE ---
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

--- TEST ---
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

--- MOCKS ---
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

--- CONFIG ---
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
The baseline suite mostly checks that assignments and getters mirror the implementation. The first risk map already points to three missing searches: the owner-controlled fee needs domain fuzzing, vault accounting needs a stateful custody invariant, and USDT/Aave behavior needs a pinned mainnet fork. I’m checking available RPC support now and will keep every new artifact isolated under `test/`.
exec
/bin/bash -lc "env | cut -d= -f1 | rg 'RPC|ALCHEMY|INFURA|ETH' || true
forge test" in /tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001
 succeeded in 112ms:
No files changed, compilation skipped
2026-09-15T00:32:45.856154Z  WARN evm::traces::external: etherscan config not found

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
Suite result: ok. 39 passed; 0 failed; 0 skipped; finished in 1.82ms (6.21ms CPU time)

Ran 1 test suite in 11.38ms (1.82ms CPU time): 39 tests passed, 0 failed, 0 skipped (39 total tests)
2026-09-15T00:32:45.871107Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)

exec
/bin/bash -lc "curl -sS --max-time 20 https://eth.llamarpc.com -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBlockByNumber\",\"params\":[\"0x1312D00\",false]}' | head -c 500" in /tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001
 succeeded in 1049ms:
error code: 525

exec
/bin/bash -lc "curl -sS --max-time 20 https://ethereum-rpc.publicnode.com -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBlockByNumber\",\"params\":[\"0x1312D00\",false]}' | head -c 500" in /tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001
 succeeded in 502ms:
{"jsonrpc":"2.0","id":1,"result":{"hash":"0xd24fd73f794058a3807db926d8898c6481e902b7edb91ce0d479d6760f276183","parentHash":"0xb390d63aac03bbef75de888d16bd56b91c9291c2a7e38d36ac24731351522bd1","sha3Uncles":"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347","miner":"0x95222290dd7278aa3ddd389cc1e1d165cc4bafe5","stateRoot":"0x68421c2c599dc31396a09772a073fb421c4bd25ef1462914ef13e5dfa2d31c23","transactionsRoot":"0xf0280ae7fd02f2b9684be8d740830710cd62e4869c891c3a0ead32ea757e70a3","reccurl: (23) Failure writing output to destination

apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001/test/DeploymentRisk.t.sol
/tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001/test/MainnetFork.t.sol
diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c7afc8d5e1cb3946cb29f7933df81c0b85b38
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,128 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..018c517671d71d95057ade0fd0eb3bfba554561b
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtAaveYieldMustBeReflectedInTotalAssets() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(10_000e6);
+        vm.stopPrank();
+
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 realAaveBalance = IERC20(A_USDT).balanceOf(address(vault));
+        emit log_named_uint("vault totalAssets", vault.totalAssets());
+        emit log_named_uint("real aUSDT balance after one year", realAaveBalance);
+        assertEq(vault.totalAssets(), realAaveBalance, "Aave yield is absent from vault accounting");
+    }
+}

diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c7afc8d5e1cb3946cb29f7933df81c0b85b38
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,128 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..018c517671d71d95057ade0fd0eb3bfba554561b
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtAaveYieldMustBeReflectedInTotalAssets() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(10_000e6);
+        vm.stopPrank();
+
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 realAaveBalance = IERC20(A_USDT).balanceOf(address(vault));
+        emit log_named_uint("vault totalAssets", vault.totalAssets());
+        emit log_named_uint("real aUSDT balance after one year", realAaveBalance);
+        assertEq(vault.totalAssets(), realAaveBalance, "Aave yield is absent from vault accounting");
+    }
+}

exec
/bin/bash -lc 'forge fmt test/DeploymentRisk.t.sol test/MainnetFork.t.sol
forge test --match-contract DeploymentRiskTest -vv
forge test --match-contract DeploymentInvariantTest -vv' in /tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001
 exited 1 in 2695ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 1.22s
Compiler run successful!
2026-09-15T00:34:07.133336Z  WARN evm::traces::external: etherscan config not found

Ran 3 tests for test/DeploymentRisk.t.sol:DeploymentRiskTest
[FAIL: panic: arithmetic underflow or overflow (0x11); counterexample: calldata=0xcaed8f7d0000000000000000000000000000000000000000000000000000000000002711 args=[10001 [1e4]]] testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256) (runs: 21, μ: 194938, ~: 195472)
[FAIL: invalid fee was accepted: 10001 > 10000] test_FeeAboveDenominatorMustBeRejectedBySetter() (gas: 21237)
[FAIL: custody diverged from accounting: 1003000000 != 1000000001] test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() (gas: 371303)
Logs:
  unaccounted aUSDT after first withdrawal: 1500750
  unaccounted aUSDT after second withdrawal: 2999999

Suite result: FAILED. 0 passed; 3 failed; 0 skipped; finished in 3.19ms (2.84ms CPU time)

Ran 1 test suite in 15.00ms (3.19ms CPU time): 0 tests passed, 3 failed, 0 skipped (3 total tests)

Failing tests:
Encountered 3 failing tests in test/DeploymentRisk.t.sol:DeploymentRiskTest
[FAIL: panic: arithmetic underflow or overflow (0x11); counterexample: calldata=0xcaed8f7d0000000000000000000000000000000000000000000000000000000000002711 args=[10001 [1e4]]] testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256) (runs: 21, μ: 194938, ~: 195472)
[FAIL: invalid fee was accepted: 10001 > 10000] test_FeeAboveDenominatorMustBeRejectedBySetter() (gas: 21237)
[FAIL: custody diverged from accounting: 1003000000 != 1000000001] test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() (gas: 371303)

Encountered a total of 3 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 3 failed tests
No files changed, compilation skipped
2026-09-15T00:34:07.827131Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/DeploymentRisk.t.sol:DeploymentInvariantTest
[FAIL: custody/accounting drift: 1988122938 != 1988087200]
	[Sequence] (original: 6, shrunk: 1)
		sender=0x0000000000000000000000000000000000000f65 addr=[test/DeploymentRisk.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256,uint256) args=[2, 6011838496379905254369105911038918361456997153088628723752049162833359048 [6.011e72]]
 invariant_TrackedAssetsMustEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)

╭--------------+----------+-------+---------+----------╮
| Contract     | Selector | Calls | Reverts | Discards |
+======================================================+
| VaultHandler | withdraw | 6     | 0       | 0        |
╰--------------+----------+-------+---------+----------╯

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 4.34ms (3.15ms CPU time)

Ran 1 test suite in 7.87ms (4.34ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/DeploymentRisk.t.sol:DeploymentInvariantTest
[FAIL: custody/accounting drift: 1988122938 != 1988087200]
	[Sequence] (original: 6, shrunk: 1)
		sender=0x0000000000000000000000000000000000000f65 addr=[test/DeploymentRisk.t.sol:VaultHandler]0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9 calldata=withdraw(uint256,uint256) args=[2, 6011838496379905254369105911038918361456997153088628723752049162833359048 [6.011e72]]
 invariant_TrackedAssetsMustEqualAaveCustody() (runs: 0, calls: 0, reverts: 0)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c7afc8d5e1cb3946cb29f7933df81c0b85b38
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,128 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..018c517671d71d95057ade0fd0eb3bfba554561b
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtAaveYieldMustBeReflectedInTotalAssets() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(10_000e6);
+        vm.stopPrank();
+
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 realAaveBalance = IERC20(A_USDT).balanceOf(address(vault));
+        emit log_named_uint("vault totalAssets", vault.totalAssets());
+        emit log_named_uint("real aUSDT balance after one year", realAaveBalance);
+        assertEq(vault.totalAssets(), realAaveBalance, "Aave yield is absent from vault accounting");
+    }
+}

codex
The new searches have now produced concrete failures: the fee setter accepts a value that makes deposits panic, and each withdrawal creates an increasing gap between Aave custody and reported assets. The handler invariant reached six real calls with zero reverts before Foundry shrank the counterexample to one call, so this is not a vacuous invariant. I’m now exercising the deployed USDT and Aave contracts at pinned block 20,000,000.
exec
/bin/bash -lc 'MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-contract MainnetForkTest -vv' in /tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001
2026-09-15T00:34:30.210968Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 2238ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 929.16ms
Compiler run successful!
2026-09-15T00:34:29.542945Z  WARN evm::traces::external: etherscan config not found
2026-09-15T00:34:30.034888Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/20000000"
2026-09-15T00:34:30.193007Z ERROR sharedbackend: Failed to send/recv `basic` err=failed to get account for 0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode"},"id":4} address=0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f

Ran 1 test for test/MainnetFork.t.sol:MainnetForkTest
[FAIL: EVM error; database error: failed to get account for 0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode"},"id":4}] test_RealUsdtAaveYieldMustBeReflectedInTotalAssets() (gas: 0)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 649.28ms (648.86ms CPU time)
2026-09-15T00:34:30.193191Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/20000000")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)

Ran 1 test suite in 650.40ms (649.28ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/MainnetFork.t.sol:MainnetForkTest
[FAIL: EVM error; database error: failed to get account for 0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode"},"id":4}] test_RealUsdtAaveYieldMustBeReflectedInTotalAssets() (gas: 0)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c7afc8d5e1cb3946cb29f7933df81c0b85b38
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,128 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..018c517671d71d95057ade0fd0eb3bfba554561b
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtAaveYieldMustBeReflectedInTotalAssets() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(10_000e6);
+        vm.stopPrank();
+
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 realAaveBalance = IERC20(A_USDT).balanceOf(address(vault));
+        emit log_named_uint("vault totalAssets", vault.totalAssets());
+        emit log_named_uint("real aUSDT balance after one year", realAaveBalance);
+        assertEq(vault.totalAssets(), realAaveBalance, "Aave yield is absent from vault accounting");
+    }
+}

exec
/bin/bash -lc 'for rpc_url in https://ethereum.gateway.tenderly.co https://eth.drpc.org https://rpc.ankr.com/eth; do echo "$rpc_url"; curl -sS --max-time 15 "$rpc_url" -H '"'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBalance\",\"params\":[\"0xdAC17F958D2ee523a2206206994597C13D831ec7\",\"0x1312D00\"]}' | head -c 240; echo; done" in /tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001
 succeeded in 1581ms:

https://eth.drpc.org
{"id":1,"jsonrpc":"2.0","result":"0x1"}
https://rpc.ankr.com/eth
{"jsonrpc": "2.0", "error": {"code": -32000, "message": "Unauthorized: You must authenticate your request with an API key. Create an account on https://www.ankr.com/rpc/ and generate your personal API key for free."}, "id": null}

diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c7afc8d5e1cb3946cb29f7933df81c0b85b38
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,128 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..018c517671d71d95057ade0fd0eb3bfba554561b
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtAaveYieldMustBeReflectedInTotalAssets() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(10_000e6);
+        vm.stopPrank();
+
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 realAaveBalance = IERC20(A_USDT).balanceOf(address(vault));
+        emit log_named_uint("vault totalAssets", vault.totalAssets());
+        emit log_named_uint("real aUSDT balance after one year", realAaveBalance);
+        assertEq(vault.totalAssets(), realAaveBalance, "Aave yield is absent from vault accounting");
+    }
+}

exec
/bin/bash -lc 'MAINNET_RPC_URL=https://eth.drpc.org forge test --match-contract MainnetForkTest -vv' in /tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001
2026-09-15T00:34:48.248752Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 2717ms:
No files changed, compilation skipped
2026-09-15T00:34:45.647919Z  WARN evm::traces::external: etherscan config not found
2026-09-15T00:34:45.885513Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/20000000"

Ran 1 test for test/MainnetFork.t.sol:MainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtAaveYieldMustBeReflectedInTotalAssets() (gas: 1056420)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.57s (2.57s CPU time)
2026-09-15T00:34:48.221832Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/20000000")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)

Ran 1 test suite in 2.57s (2.57s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/MainnetFork.t.sol:MainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtAaveYieldMustBeReflectedInTotalAssets() (gas: 1056420)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c7afc8d5e1cb3946cb29f7933df81c0b85b38
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,128 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..018c517671d71d95057ade0fd0eb3bfba554561b
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtAaveYieldMustBeReflectedInTotalAssets() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(10_000e6);
+        vm.stopPrank();
+
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 realAaveBalance = IERC20(A_USDT).balanceOf(address(vault));
+        emit log_named_uint("vault totalAssets", vault.totalAssets());
+        emit log_named_uint("real aUSDT balance after one year", realAaveBalance);
+        assertEq(vault.totalAssets(), realAaveBalance, "Aave yield is absent from vault accounting");
+    }
+}

exec
/bin/bash -lc 'MAINNET_RPC_URL=https://eth.drpc.org forge test --match-contract MainnetForkTest -vvvv' in /tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001
2026-09-15T00:34:59.305143Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 2681ms:
No files changed, compilation skipped
2026-09-15T00:34:56.748157Z  WARN evm::traces::external: etherscan config not found
2026-09-15T00:34:56.959964Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/20000000"

Ran 1 test for test/MainnetFork.t.sol:MainnetForkTest
2026-09-15T00:34:59.283292Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/20000000")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
[FAIL: EvmError: Revert] test_RealUsdtAaveYieldMustBeReflectedInTotalAssets() (gas: 1056420)
Traces:
  [1056420] MainnetForkTest::test_RealUsdtAaveYieldMustBeReflectedInTotalAssets()
    ├─ [0] VM::envString("MAINNET_RPC_URL") [staticcall]
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::createSelectFork("<rpc url>", 20000000 [2e7])
    │   └─ ← [Return] 0
    ├─ [0] VM::addr(<pk>) [staticcall]
    │   └─ ← [Return] fork depositor: [0xEF93115201C97D491D058e301c7416551f2B538B]
    ├─ [0] VM::label(fork depositor: [0xEF93115201C97D491D058e301c7416551f2B538B], "fork depositor")
    │   └─ ← [Return]
    ├─ [768792] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: MainnetForkTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
    │   └─ ← [Return] 3596 bytes of code
    ├─ [5031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(fork depositor: [0xEF93115201C97D491D058e301c7416551f2B538B]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::record()
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(fork depositor: [0xEF93115201C97D491D058e301c7416551f2B538B]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::accesses(0xdAC17F958D2ee523a2206206994597C13D831ec7) [staticcall]
    │   └─ ← [Return] [0x000000000000000000000000000000000000000000000000000000000000000a, 0x6a9b5d22df103ede2471682d6856c13d700afd22d492c2b9b369198a437a8a5b], []
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x6a9b5d22df103ede2471682d6856c13d700afd22d492c2b9b369198a437a8a5b) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ emit WARNING_UninitedSlot(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, slot: 48219666047406649029098202973472200199022678836056247551401382252161527351899 [4.821e76])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x6a9b5d22df103ede2471682d6856c13d700afd22d492c2b9b369198a437a8a5b) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(fork depositor: [0xEF93115201C97D491D058e301c7416551f2B538B]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x6a9b5d22df103ede2471682d6856c13d700afd22d492c2b9b369198a437a8a5b, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(fork depositor: [0xEF93115201C97D491D058e301c7416551f2B538B]) [staticcall]
    │   └─ ← [Return] 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77]
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x6a9b5d22df103ede2471682d6856c13d700afd22d492c2b9b369198a437a8a5b, 0x0000000000000000000000000000000000000000000000000000000000000000)
    │   └─ ← [Return]
    ├─ emit SlotFound(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, fsig: 0x70a08231, keysHash: 0x72695e144df1d2ad7ad0119c6128d0827330bba776ed27184ea6787b60a165fe, slot: 48219666047406649029098202973472200199022678836056247551401382252161527351899 [4.821e76])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x6a9b5d22df103ede2471682d6856c13d700afd22d492c2b9b369198a437a8a5b) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x6a9b5d22df103ede2471682d6856c13d700afd22d492c2b9b369198a437a8a5b, 0x00000000000000000000000000000000000000000000000000000002540be400)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(fork depositor: [0xEF93115201C97D491D058e301c7416551f2B538B]) [staticcall]
    │   └─ ← [Return] 10000000000 [1e10]
    ├─ [0] VM::startPrank(fork depositor: [0xEF93115201C97D491D058e301c7416551f2B538B])
    │   └─ ← [Return]
    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   ├─ emit Approval(owner: fork depositor: [0xEF93115201C97D491D058e301c7416551f2B538B], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   └─ ← [Stop]
    └─ ← [Revert] EvmError: Revert

Backtrace:
  at MainnetForkTest.test_RealUsdtAaveYieldMustBeReflectedInTotalAssets

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 2.53s (2.53s CPU time)

Ran 1 test suite in 2.54s (2.53s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/MainnetFork.t.sol:MainnetForkTest
[FAIL: EvmError: Revert] test_RealUsdtAaveYieldMustBeReflectedInTotalAssets() (gas: 1056420)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c7afc8d5e1cb3946cb29f7933df81c0b85b38
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,128 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..018c517671d71d95057ade0fd0eb3bfba554561b
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtAaveYieldMustBeReflectedInTotalAssets() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+        vault.deposit(10_000e6);
+        vm.stopPrank();
+
+        vm.warp(block.timestamp + 365 days);
+
+        uint256 realAaveBalance = IERC20(A_USDT).balanceOf(address(vault));
+        emit log_named_uint("vault totalAssets", vault.totalAssets());
+        emit log_named_uint("real aUSDT balance after one year", realAaveBalance);
+        assertEq(vault.totalAssets(), realAaveBalance, "Aave yield is absent from vault accounting");
+    }
+}

apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001/test/MainnetFork.t.sol
diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c7afc8d5e1cb3946cb29f7933df81c0b85b38
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,128 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..6d4d8ec4316cfdb1c3e8e0c217518d9382389802
--- /dev/null
+++ b/test/MainnetFork.t.sol
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
+contract MainnetForkTest is Test {
+    using SafeERC20 for IERC20;
+
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtDepositMustSupplyIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(10_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 10_000e6, "deposit did not reach Aave");
+    }
+}

diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c7afc8d5e1cb3946cb29f7933df81c0b85b38
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,128 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..6d4d8ec4316cfdb1c3e8e0c217518d9382389802
--- /dev/null
+++ b/test/MainnetFork.t.sol
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
+contract MainnetForkTest is Test {
+    using SafeERC20 for IERC20;
+
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtDepositMustSupplyIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        vault.deposit(10_000e6);
+        vm.stopPrank();
+
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 10_000e6, "deposit did not reach Aave");
+    }
+}

apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001/test/MainnetFork.t.sol
diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c7afc8d5e1cb3946cb29f7933df81c0b85b38
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,128 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a8e0c70f811da69c6d6425da08887f39a3a4ee8
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    using SafeERC20 for IERC20;
+
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtDepositMustSupplyIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        (bool success,) = address(vault).call(abi.encodeCall(vault.deposit, (10_000e6)));
+        vm.stopPrank();
+
+        assertTrue(success, "deposit with real USDT reverted");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 10_000e6, "deposit did not reach Aave");
+    }
+}

diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c7afc8d5e1cb3946cb29f7933df81c0b85b38
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,128 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a8e0c70f811da69c6d6425da08887f39a3a4ee8
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    using SafeERC20 for IERC20;
+
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtDepositMustSupplyIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        (bool success,) = address(vault).call(abi.encodeCall(vault.deposit, (10_000e6)));
+        vm.stopPrank();
+
+        assertTrue(success, "deposit with real USDT reverted");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 10_000e6, "deposit did not reach Aave");
+    }
+}

exec
/bin/bash -lc 'forge fmt test/MainnetFork.t.sol
MAINNET_RPC_URL=https://eth.drpc.org forge test --match-contract MainnetForkTest -vv' in /tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001
2026-09-15T00:35:48.734979Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 7706ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 1.39s
Compiler run successful!
2026-09-15T00:35:43.647101Z  WARN evm::traces::external: etherscan config not found
2026-09-15T00:35:44.779226Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/20000000"

Ran 1 test for test/MainnetFork.t.sol:MainnetForkTest
[FAIL: deposit with real USDT reverted] test_RealUsdtDepositMustSupplyIntoAave() (gas: 1122143)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 5.07s (5.07s CPU time)
2026-09-15T00:35:48.719523Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/20000000")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)

Ran 1 test suite in 5.07s (5.07s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/MainnetFork.t.sol:MainnetForkTest
[FAIL: deposit with real USDT reverted] test_RealUsdtDepositMustSupplyIntoAave() (gas: 1122143)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c7afc8d5e1cb3946cb29f7933df81c0b85b38
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,128 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1a8e0c70f811da69c6d6425da08887f39a3a4ee8
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,33 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    using SafeERC20 for IERC20;
+
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtDepositMustSupplyIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        (bool success,) = address(vault).call(abi.encodeCall(vault.deposit, (10_000e6)));
+        vm.stopPrank();
+
+        assertTrue(success, "deposit with real USDT reverted");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 10_000e6, "deposit did not reach Aave");
+    }
+}

apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001/test/MainnetFork.t.sol
diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c7afc8d5e1cb3946cb29f7933df81c0b85b38
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,128 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2e2513b9fa6d25d19ecbf74f341452ffe5f71308
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    using SafeERC20 for IERC20;
+
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtApproveMustReturnIERC20Bool() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        (bool success, bytes memory returnData) = USDT.call(abi.encodeCall(IERC20.approve, (AAVE_POOL, 1)));
+        assertTrue(success, "USDT approve itself reverted");
+        emit log_named_uint("real USDT approve return-data bytes", returnData.length);
+        assertEq(returnData.length, 32, "IERC20 typed call requires a bool but real USDT returns no data");
+    }
+
+    function test_RealUsdtDepositMustSupplyIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        (bool success,) = address(vault).call(abi.encodeCall(vault.deposit, (10_000e6)));
+        vm.stopPrank();
+
+        assertTrue(success, "deposit with real USDT reverted");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 10_000e6, "deposit did not reach Aave");
+    }
+}

diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9f1c7afc8d5e1cb3946cb29f7933df81c0b85b38
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,128 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2e2513b9fa6d25d19ecbf74f341452ffe5f71308
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    using SafeERC20 for IERC20;
+
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtApproveMustReturnIERC20Bool() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        (bool success, bytes memory returnData) = USDT.call(abi.encodeCall(IERC20.approve, (AAVE_POOL, 1)));
+        assertTrue(success, "USDT approve itself reverted");
+        emit log_named_uint("real USDT approve return-data bytes", returnData.length);
+        assertEq(returnData.length, 32, "IERC20 typed call requires a bool but real USDT returns no data");
+    }
+
+    function test_RealUsdtDepositMustSupplyIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        (bool success,) = address(vault).call(abi.encodeCall(vault.deposit, (10_000e6)));
+        vm.stopPrank();
+
+        assertTrue(success, "deposit with real USDT reverted");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 10_000e6, "deposit did not reach Aave");
+    }
+}

apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-15T003202Z-codex-with-skill-2/testing-goal-001/test/DeploymentRisk.t.sol
diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e292232ac9d556e74995d77a48cf224a45c764bd
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,140 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+
+    function test_AccruedAaveBalanceMustIncreaseReportedAssets() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 100e6);
+
+        emit log_named_uint("vault totalAssets after simulated Aave accrual", vault.totalAssets());
+        emit log_named_uint("aUSDT custody after simulated Aave accrual", aUsdt.balanceOf(address(vault)));
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is absent from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2e2513b9fa6d25d19ecbf74f341452ffe5f71308
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    using SafeERC20 for IERC20;
+
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtApproveMustReturnIERC20Bool() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        (bool success, bytes memory returnData) = USDT.call(abi.encodeCall(IERC20.approve, (AAVE_POOL, 1)));
+        assertTrue(success, "USDT approve itself reverted");
+        emit log_named_uint("real USDT approve return-data bytes", returnData.length);
+        assertEq(returnData.length, 32, "IERC20 typed call requires a bool but real USDT returns no data");
+    }
+
+    function test_RealUsdtDepositMustSupplyIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        (bool success,) = address(vault).call(abi.encodeCall(vault.deposit, (10_000e6)));
+        vm.stopPrank();
+
+        assertTrue(success, "deposit with real USDT reverted");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 10_000e6, "deposit did not reach Aave");
+    }
+}

diff --git a/test/DeploymentRisk.t.sol b/test/DeploymentRisk.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e292232ac9d556e74995d77a48cf224a45c764bd
--- /dev/null
+++ b/test/DeploymentRisk.t.sol
@@ -0,0 +1,140 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+import {MockUSDT} from "./mocks/MockUSDT.sol";
+import {MockAavePool, MockAToken} from "./mocks/MockAavePool.sol";
+
+contract DeploymentRiskTest is Test {
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
+    function testFuzz_AcceptedFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+        assertGt(shares, 0, "an accepted fee must not brick deposits");
+    }
+
+    function test_FeeAboveDenominatorMustBeRejectedBySetter() public {
+        vm.prank(owner);
+        vault.setDepositFee(10_001);
+        assertLe(vault.depositFeeBps(), vault.BPS_DENOMINATOR(), "invalid fee was accepted");
+    }
+
+    function test_TwoWithdrawalsMustNotAccumulateUnaccountedAUsdt() public {
+        vm.prank(alice);
+        uint256 aliceShares = vault.deposit(1_000e6);
+        vm.prank(bob);
+        uint256 bobShares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        uint256 gapAfterFirst = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+        uint256 gapAfterSecond = aUsdt.balanceOf(address(vault)) - vault.totalAssets();
+
+        emit log_named_uint("unaccounted aUSDT after first withdrawal", gapAfterFirst);
+        emit log_named_uint("unaccounted aUSDT after second withdrawal", gapAfterSecond);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody diverged from accounting");
+    }
+
+    function test_AccruedAaveBalanceMustIncreaseReportedAssets() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+
+        vm.prank(address(pool));
+        aUsdt.mint(address(vault), 100e6);
+
+        emit log_named_uint("vault totalAssets after simulated Aave accrual", vault.totalAssets());
+        emit log_named_uint("aUSDT custody after simulated Aave accrual", aUsdt.balanceOf(address(vault)));
+        assertEq(vault.totalAssets(), aUsdt.balanceOf(address(vault)), "Aave yield is absent from accounting");
+    }
+}
+
+contract VaultHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable alice;
+    address internal immutable bob;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt, address _alice, address _bob) {
+        vault = _vault;
+        usdt = _usdt;
+        alice = _alice;
+        bob = _bob;
+    }
+
+    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
+        address actor = actorSeed % 2 == 0 ? alice : bob;
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        uint256 shares = bound(shareSeed, 1, balance);
+        vm.prank(actor);
+        vault.withdraw(shares);
+    }
+}
+
+contract DeploymentInvariantTest is Test {
+    MockUSDT internal usdt;
+    MockAavePool internal pool;
+    MockAToken internal aUsdt;
+    UsdtYieldVault internal vault;
+    VaultHandler internal handler;
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
+        vm.startPrank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+        vm.startPrank(bob);
+        usdt.approve(address(vault), type(uint256).max);
+        vault.deposit(1_000e6);
+        vm.stopPrank();
+
+        handler = new VaultHandler(vault, usdt, alice, bob);
+        targetContract(address(handler));
+    }
+
+    function invariant_TrackedAssetsMustEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "custody/accounting drift");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2e2513b9fa6d25d19ecbf74f341452ffe5f71308
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,42 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    using SafeERC20 for IERC20;
+
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    uint256 internal constant PINNED_BLOCK = 20_000_000;
+
+    function test_RealUsdtApproveMustReturnIERC20Bool() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        (bool success, bytes memory returnData) = USDT.call(abi.encodeCall(IERC20.approve, (AAVE_POOL, 1)));
+        assertTrue(success, "USDT approve itself reverted");
+        emit log_named_uint("real USDT approve return-data bytes", returnData.length);
+        assertEq(returnData.length, 32, "IERC20 typed call requires a bool but real USDT returns no data");
+    }
+
+    function test_RealUsdtDepositMustSupplyIntoAave() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+
+        address depositor = makeAddr("fork depositor");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 0, address(this));
+        deal(USDT, depositor, 10_000e6);
+
+        vm.startPrank(depositor);
+        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
+        (bool success,) = address(vault).call(abi.encodeCall(vault.deposit, (10_000e6)));
+        vm.stopPrank();
+
+        assertTrue(success, "deposit with real USDT reverted");
+        assertEq(IERC20(A_USDT).balanceOf(address(vault)), 10_000e6, "deposit did not reach Aave");
+    }
+}

ERROR: This content was flagged for possible cybersecurity risk. If this seems wrong, try rephrasing your request. To get authorized for security work, join the Trusted Access for Cyber program: https://chatgpt.com/cyber
ERROR: This content was flagged for possible cybersecurity risk. If this seems wrong, try rephrasing your request. To get authorized for security work, join the Trusted Access for Cyber program: https://chatgpt.com/cyber
tokens used
34,162
````
