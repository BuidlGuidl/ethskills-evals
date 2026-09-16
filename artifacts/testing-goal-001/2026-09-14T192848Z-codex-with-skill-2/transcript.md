# Executor transcript — 2026-09-14T192848Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 1
**workspace**: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001

## session

````text
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "/tmp" (codex_home: AbsolutePathBuf("/tmp/ethskills-eval-harness-codex"))
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0a169-5aad-7d80-9543-e5087505f579
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
I’m using the `testing` skill because the sign-off hinges on whether the existing Foundry suite meaningfully covers mainnet behavior, not merely its green count. I’ll preserve `src/`, the existing test file, and all mocks; any added evidence will live in new `test/` files, with terminal commands and outputs copied verbatim into `FINDINGS.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
 succeeded in 7ms:
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

exec
/bin/bash -lc "pwd && rg --files -g '"'!*cache*'"' -g '"'!out/**'"' && git status --short && sed -n '1,260p' src/UsdtYieldVault.sol && sed -n '1,340p' test/UsdtYieldVault.t.sol && sed -n '1,220p' foundry.toml && env | rg 'RPC|ETH|ALCHEMY|INFURA' || true" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
 succeeded in 25ms:
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
package.json
README.md
foundry.toml
TASK.md
remappings.txt
src/interfaces/IAavePool.sol
src/UsdtYieldVault.sol
test/UsdtYieldVault.t.sol
test/mocks/MockUSDT.sol
test/mocks/MockAavePool.sol
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
ARWEAVE_KEY=[REDACTED]

codex
The first material gap is already visible in the test architecture: every integration assertion is against a standards-compliant mock, while production uses legacy USDT and Aave. I’m now checking a pinned Ethereum fork and, separately, stateful accounting properties so each conclusion is backed by a deliberately failing test rather than source inspection alone.
exec
/bin/bash -lc "sed -n '1,260p' test/mocks/MockAavePool.sol && sed -n '1,220p' test/mocks/MockUSDT.sol && sed -n '1,200p' src/interfaces/IAavePool.sol && forge --version && (command -v slither || true) && curl -sS --max-time 20 -X POST -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}' https://eth.llamarpc.com" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
 succeeded in 885ms:
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
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf
/home/damu/.local/bin/slither
error code: 525

exec
/bin/bash -lc "for rpc in https://ethereum-rpc.publicnode.com https://rpc.ankr.com/eth https://eth.drpc.org; do printf '%s ' \""'$rpc"; curl -sS --max-time 15 -X POST -H '"'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}' \""'$rpc"; printf '"'\\n'; done" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
 succeeded in 1375ms:
{"jsonrpc":"2.0","result":"0x18c63d8","id":1}

https://rpc.ankr.com/eth {"jsonrpc": "2.0", "error": {"code": -32000, "message": "Unauthorized: You must authenticate your request with an API key. Create an account on https://www.ankr.com/rpc/ and generate your personal API key for free."}, "id": null}
https://eth.drpc.org {"id":1,"jsonrpc":"2.0","result":"0x18c63d8"}

exec
/bin/bash -lc "cast call 0xdAC17F958D2ee523a2206206994597C13D831ec7 'totalSupply()(uint256)' --rpc-url https://ethereum-rpc.publicnode.com --block 25970000 && cast call 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 'getReserveData(address)((uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address,address,address,address,uint128,uint128,uint128))' 0xdAC17F958D2ee523a2206206994597C13D831ec7 --rpc-url https://ethereum-rpc.publicnode.com --block 25970000" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
 exited 1 in 817ms:
Error: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode"},"id":2}

exec
/bin/bash -lc "cast call 0xdAC17F958D2ee523a2206206994597C13D831ec7 'totalSupply()(uint256)' --rpc-url https://ethereum-rpc.publicnode.com --block 25977700" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
 exited 1 in 858ms:
Error: HTTP error 403 with body: {"jsonrpc":"2.0","error":{"code":-32602,"message":"Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode"},"id":2}

exec
/bin/bash -lc "cast call 0xdAC17F958D2ee523a2206206994597C13D831ec7 'totalSupply()(uint256)' --rpc-url https://eth.drpc.org --block 25970000" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
 succeeded in 979ms:
88305985017331899 [8.83e16]

apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultAdversarial.t.sol
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8b46066d823a9cf36808bc2df5d88ff88f6cb43a
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
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    /// A fee accepted by governance must leave the advertised minimum deposit usable.
+    function testFuzz_OwnerSettableFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(vault.MIN_DEPOSIT());
+        assertGt(shares, 0);
+    }
+
+    /// A vault's recorded assets must equal the Aave claim backing its shares after sequences.
+    function test_AccountingEqualsCustodyAfterTwoFeeBearingWithdrawals() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody drifted from accounting");
+    }
+
+    /// Aave yield belongs to shareholders and therefore must change their redeemable balance.
+    function test_AaveYieldAccruesToShareholders() public {
+        _deposit(alice, 1_000e6);
+        uint256 claimBefore = vault.balanceOfUnderlying(alice);
+
+        deal(address(aUsdt), address(vault), aUsdt.balanceOf(address(vault)) + 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), claimBefore + 100e6, "Aave yield was ignored");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c644df715c816f95902e146b9cb1799505b5e5d0
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 internal constant PINNED_BLOCK = 25_970_000;
+
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+    }
+
+    /// The exact production token and pool must accept a normal vault deposit.
+    function test_DepositRealUsdtIntoAaveV3() public {
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, alice, 1_000e6);
+
+        vm.prank(alice);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), type(uint256).max));
+        assertTrue(approved, "user approval failed");
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(vault.totalAssets(), 1_000e6);
+    }
+}

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8b46066d823a9cf36808bc2df5d88ff88f6cb43a
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
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    /// A fee accepted by governance must leave the advertised minimum deposit usable.
+    function testFuzz_OwnerSettableFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(vault.MIN_DEPOSIT());
+        assertGt(shares, 0);
+    }
+
+    /// A vault's recorded assets must equal the Aave claim backing its shares after sequences.
+    function test_AccountingEqualsCustodyAfterTwoFeeBearingWithdrawals() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody drifted from accounting");
+    }
+
+    /// Aave yield belongs to shareholders and therefore must change their redeemable balance.
+    function test_AaveYieldAccruesToShareholders() public {
+        _deposit(alice, 1_000e6);
+        uint256 claimBefore = vault.balanceOfUnderlying(alice);
+
+        deal(address(aUsdt), address(vault), aUsdt.balanceOf(address(vault)) + 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), claimBefore + 100e6, "Aave yield was ignored");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c644df715c816f95902e146b9cb1799505b5e5d0
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 internal constant PINNED_BLOCK = 25_970_000;
+
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+    }
+
+    /// The exact production token and pool must accept a normal vault deposit.
+    function test_DepositRealUsdtIntoAaveV3() public {
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, alice, 1_000e6);
+
+        vm.prank(alice);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), type(uint256).max));
+        assertTrue(approved, "user approval failed");
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(vault.totalAssets(), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge fmt --check && forge test --match-test testFuzz_OwnerSettableFeeMustLeaveDepositsUsable -vv' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
 exited 1 in 13ms:
Diff in test/UsdtYieldVaultMainnetFork.t.sol:
23  23   |         deal(USDT, alice, 1_000e6);
24  24   |
25  25   |         vm.prank(alice);
26       |-        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), type(uint256).max));
    26   |+        (bool approved,) =
    27   |+            USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), type(uint256).max));
27  28   |         assertTrue(approved, "user approval failed");
28  29   |
29  30   |         vm.prank(alice);

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8b46066d823a9cf36808bc2df5d88ff88f6cb43a
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
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    /// A fee accepted by governance must leave the advertised minimum deposit usable.
+    function testFuzz_OwnerSettableFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(vault.MIN_DEPOSIT());
+        assertGt(shares, 0);
+    }
+
+    /// A vault's recorded assets must equal the Aave claim backing its shares after sequences.
+    function test_AccountingEqualsCustodyAfterTwoFeeBearingWithdrawals() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody drifted from accounting");
+    }
+
+    /// Aave yield belongs to shareholders and therefore must change their redeemable balance.
+    function test_AaveYieldAccruesToShareholders() public {
+        _deposit(alice, 1_000e6);
+        uint256 claimBefore = vault.balanceOfUnderlying(alice);
+
+        deal(address(aUsdt), address(vault), aUsdt.balanceOf(address(vault)) + 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), claimBefore + 100e6, "Aave yield was ignored");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c644df715c816f95902e146b9cb1799505b5e5d0
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 internal constant PINNED_BLOCK = 25_970_000;
+
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+    }
+
+    /// The exact production token and pool must accept a normal vault deposit.
+    function test_DepositRealUsdtIntoAaveV3() public {
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, alice, 1_000e6);
+
+        vm.prank(alice);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), type(uint256).max));
+        assertTrue(approved, "user approval failed");
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(vault.totalAssets(), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge fmt' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
 succeeded in 12ms:
Formatted /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultMainnetFork.t.sol

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8b46066d823a9cf36808bc2df5d88ff88f6cb43a
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
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    /// A fee accepted by governance must leave the advertised minimum deposit usable.
+    function testFuzz_OwnerSettableFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(vault.MIN_DEPOSIT());
+        assertGt(shares, 0);
+    }
+
+    /// A vault's recorded assets must equal the Aave claim backing its shares after sequences.
+    function test_AccountingEqualsCustodyAfterTwoFeeBearingWithdrawals() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody drifted from accounting");
+    }
+
+    /// Aave yield belongs to shareholders and therefore must change their redeemable balance.
+    function test_AaveYieldAccruesToShareholders() public {
+        _deposit(alice, 1_000e6);
+        uint256 claimBefore = vault.balanceOfUnderlying(alice);
+
+        deal(address(aUsdt), address(vault), aUsdt.balanceOf(address(vault)) + 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), claimBefore + 100e6, "Aave yield was ignored");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c644df715c816f95902e146b9cb1799505b5e5d0
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 internal constant PINNED_BLOCK = 25_970_000;
+
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+    }
+
+    /// The exact production token and pool must accept a normal vault deposit.
+    function test_DepositRealUsdtIntoAaveV3() public {
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, alice, 1_000e6);
+
+        vm.prank(alice);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), type(uint256).max));
+        assertTrue(approved, "user approval failed");
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(vault.totalAssets(), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge test --match-test testFuzz_OwnerSettableFeeMustLeaveDepositsUsable -vv' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
 exited 1 in 1793ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 1.09s
Compiler run successful!
2026-09-14T19:36:20.697960Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: ERC20InsufficientAllowance(0xF62849F9A0B5Bf2913b396098F7c7019b51A820a, 0, 1000000 [1e6]); counterexample: calldata=0x8a7e417200000000000000000000000002f7c72f5d45584a9e00227efcac334bb48bee9e args=[16943617067834671392680092247258285316716097182 [1.694e46]]] testFuzz_OwnerSettableFeeMustLeaveDepositsUsable(uint256) (runs: 0, μ: 0, ~: 0)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.69ms (897.14µs CPU time)

Ran 1 test suite in 13.88ms (1.69ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: ERC20InsufficientAllowance(0xF62849F9A0B5Bf2913b396098F7c7019b51A820a, 0, 1000000 [1e6]); counterexample: calldata=0x8a7e417200000000000000000000000002f7c72f5d45584a9e00227efcac334bb48bee9e args=[16943617067834671392680092247258285316716097182 [1.694e46]]] testFuzz_OwnerSettableFeeMustLeaveDepositsUsable(uint256) (runs: 0, μ: 0, ~: 0)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..8b46066d823a9cf36808bc2df5d88ff88f6cb43a
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
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    /// A fee accepted by governance must leave the advertised minimum deposit usable.
+    function testFuzz_OwnerSettableFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(vault.MIN_DEPOSIT());
+        assertGt(shares, 0);
+    }
+
+    /// A vault's recorded assets must equal the Aave claim backing its shares after sequences.
+    function test_AccountingEqualsCustodyAfterTwoFeeBearingWithdrawals() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody drifted from accounting");
+    }
+
+    /// Aave yield belongs to shareholders and therefore must change their redeemable balance.
+    function test_AaveYieldAccruesToShareholders() public {
+        _deposit(alice, 1_000e6);
+        uint256 claimBefore = vault.balanceOfUnderlying(alice);
+
+        deal(address(aUsdt), address(vault), aUsdt.balanceOf(address(vault)) + 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), claimBefore + 100e6, "Aave yield was ignored");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c644df715c816f95902e146b9cb1799505b5e5d0
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 internal constant PINNED_BLOCK = 25_970_000;
+
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+    }
+
+    /// The exact production token and pool must accept a normal vault deposit.
+    function test_DepositRealUsdtIntoAaveV3() public {
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, alice, 1_000e6);
+
+        vm.prank(alice);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), type(uint256).max));
+        assertTrue(approved, "user approval failed");
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(vault.totalAssets(), 1_000e6);
+    }
+}

apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001/test/UsdtYieldVaultAdversarial.t.sol
diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ced72bb48164719b1c37d5282b2e4c191bf6197
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,73 @@
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
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    /// A fee accepted by governance must leave the advertised minimum deposit usable.
+    function testFuzz_OwnerSettableFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        uint256 minimumDeposit = vault.MIN_DEPOSIT();
+        vm.prank(alice);
+        uint256 shares = vault.deposit(minimumDeposit);
+        assertGt(shares, 0);
+    }
+
+    /// A vault's recorded assets must equal the Aave claim backing its shares after sequences.
+    function test_AccountingEqualsCustodyAfterTwoFeeBearingWithdrawals() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody drifted from accounting");
+    }
+
+    /// Aave yield belongs to shareholders and therefore must change their redeemable balance.
+    function test_AaveYieldAccruesToShareholders() public {
+        _deposit(alice, 1_000e6);
+        uint256 claimBefore = vault.balanceOfUnderlying(alice);
+
+        deal(address(aUsdt), address(vault), aUsdt.balanceOf(address(vault)) + 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), claimBefore + 100e6, "Aave yield was ignored");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c644df715c816f95902e146b9cb1799505b5e5d0
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 internal constant PINNED_BLOCK = 25_970_000;
+
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+    }
+
+    /// The exact production token and pool must accept a normal vault deposit.
+    function test_DepositRealUsdtIntoAaveV3() public {
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, alice, 1_000e6);
+
+        vm.prank(alice);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), type(uint256).max));
+        assertTrue(approved, "user approval failed");
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(vault.totalAssets(), 1_000e6);
+    }
+}

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ced72bb48164719b1c37d5282b2e4c191bf6197
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,73 @@
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
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    /// A fee accepted by governance must leave the advertised minimum deposit usable.
+    function testFuzz_OwnerSettableFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        uint256 minimumDeposit = vault.MIN_DEPOSIT();
+        vm.prank(alice);
+        uint256 shares = vault.deposit(minimumDeposit);
+        assertGt(shares, 0);
+    }
+
+    /// A vault's recorded assets must equal the Aave claim backing its shares after sequences.
+    function test_AccountingEqualsCustodyAfterTwoFeeBearingWithdrawals() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody drifted from accounting");
+    }
+
+    /// Aave yield belongs to shareholders and therefore must change their redeemable balance.
+    function test_AaveYieldAccruesToShareholders() public {
+        _deposit(alice, 1_000e6);
+        uint256 claimBefore = vault.balanceOfUnderlying(alice);
+
+        deal(address(aUsdt), address(vault), aUsdt.balanceOf(address(vault)) + 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), claimBefore + 100e6, "Aave yield was ignored");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c644df715c816f95902e146b9cb1799505b5e5d0
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 internal constant PINNED_BLOCK = 25_970_000;
+
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+    }
+
+    /// The exact production token and pool must accept a normal vault deposit.
+    function test_DepositRealUsdtIntoAaveV3() public {
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, alice, 1_000e6);
+
+        vm.prank(alice);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), type(uint256).max));
+        assertTrue(approved, "user approval failed");
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(vault.totalAssets(), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge test --match-test testFuzz_OwnerSettableFeeMustLeaveDepositsUsable -vv' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
 exited 1 in 1786ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 1.07s
Compiler run successful!
2026-09-14T19:36:36.968536Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: NoSharesMinted(); counterexample: calldata=0x8a7e41720000000000000000000000000000000000000000000000000000000000002710 args=[10000 [1e4]]] testFuzz_OwnerSettableFeeMustLeaveDepositsUsable(uint256) (runs: 57, μ: 195698, ~: 196319)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 5.68ms (4.66ms CPU time)

Ran 1 test suite in 11.72ms (5.68ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: NoSharesMinted(); counterexample: calldata=0x8a7e41720000000000000000000000000000000000000000000000000000000000002710 args=[10000 [1e4]]] testFuzz_OwnerSettableFeeMustLeaveDepositsUsable(uint256) (runs: 57, μ: 195698, ~: 196319)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ced72bb48164719b1c37d5282b2e4c191bf6197
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,73 @@
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
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    /// A fee accepted by governance must leave the advertised minimum deposit usable.
+    function testFuzz_OwnerSettableFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        uint256 minimumDeposit = vault.MIN_DEPOSIT();
+        vm.prank(alice);
+        uint256 shares = vault.deposit(minimumDeposit);
+        assertGt(shares, 0);
+    }
+
+    /// A vault's recorded assets must equal the Aave claim backing its shares after sequences.
+    function test_AccountingEqualsCustodyAfterTwoFeeBearingWithdrawals() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody drifted from accounting");
+    }
+
+    /// Aave yield belongs to shareholders and therefore must change their redeemable balance.
+    function test_AaveYieldAccruesToShareholders() public {
+        _deposit(alice, 1_000e6);
+        uint256 claimBefore = vault.balanceOfUnderlying(alice);
+
+        deal(address(aUsdt), address(vault), aUsdt.balanceOf(address(vault)) + 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), claimBefore + 100e6, "Aave yield was ignored");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c644df715c816f95902e146b9cb1799505b5e5d0
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 internal constant PINNED_BLOCK = 25_970_000;
+
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+    }
+
+    /// The exact production token and pool must accept a normal vault deposit.
+    function test_DepositRealUsdtIntoAaveV3() public {
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, alice, 1_000e6);
+
+        vm.prank(alice);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), type(uint256).max));
+        assertTrue(approved, "user approval failed");
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(vault.totalAssets(), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'forge test --match-test test_AccountingEqualsCustodyAfterTwoFeeBearingWithdrawals -vv' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
exec
/bin/bash -lc 'forge test --match-test test_AaveYieldAccruesToShareholders -vv' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
 exited 1 in 679ms:
No files changed, compilation skipped
2026-09-14T19:36:47.579106Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: Aave yield was ignored: 1000000000 != 1100000000] test_AaveYieldAccruesToShareholders() (gas: 450138)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.26ms (454.87µs CPU time)

Ran 1 test suite in 7.59ms (1.26ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: Aave yield was ignored: 1000000000 != 1100000000] test_AaveYieldAccruesToShareholders() (gas: 450138)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

 exited 1 in 698ms:
No files changed, compilation skipped
2026-09-14T19:36:47.592926Z  WARN evm::traces::external: etherscan config not found

Ran 1 test for test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: Aave custody drifted from accounting: 1003000000 != 1000000001] test_AccountingEqualsCustodyAfterTwoFeeBearingWithdrawals() (gas: 363192)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 1.03ms (233.30µs CPU time)

Ran 1 test suite in 7.82ms (1.03ms CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultAdversarial.t.sol:UsdtYieldVaultAdversarialTest
[FAIL: Aave custody drifted from accounting: 1003000000 != 1000000001] test_AccountingEqualsCustodyAfterTwoFeeBearingWithdrawals() (gas: 363192)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ced72bb48164719b1c37d5282b2e4c191bf6197
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,73 @@
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
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    /// A fee accepted by governance must leave the advertised minimum deposit usable.
+    function testFuzz_OwnerSettableFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        uint256 minimumDeposit = vault.MIN_DEPOSIT();
+        vm.prank(alice);
+        uint256 shares = vault.deposit(minimumDeposit);
+        assertGt(shares, 0);
+    }
+
+    /// A vault's recorded assets must equal the Aave claim backing its shares after sequences.
+    function test_AccountingEqualsCustodyAfterTwoFeeBearingWithdrawals() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody drifted from accounting");
+    }
+
+    /// Aave yield belongs to shareholders and therefore must change their redeemable balance.
+    function test_AaveYieldAccruesToShareholders() public {
+        _deposit(alice, 1_000e6);
+        uint256 claimBefore = vault.balanceOfUnderlying(alice);
+
+        deal(address(aUsdt), address(vault), aUsdt.balanceOf(address(vault)) + 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), claimBefore + 100e6, "Aave yield was ignored");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c644df715c816f95902e146b9cb1799505b5e5d0
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 internal constant PINNED_BLOCK = 25_970_000;
+
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+    }
+
+    /// The exact production token and pool must accept a normal vault deposit.
+    function test_DepositRealUsdtIntoAaveV3() public {
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, alice, 1_000e6);
+
+        vm.prank(alice);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), type(uint256).max));
+        assertTrue(approved, "user approval failed");
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(vault.totalAssets(), 1_000e6);
+    }
+}

exec
/bin/bash -lc 'MAINNET_RPC_URL=https://eth.drpc.org forge test --match-contract UsdtYieldVaultMainnetForkTest --match-test test_DepositRealUsdtIntoAaveV3 -vvv' in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192848Z-codex-with-skill-2/testing-goal-001
2026-09-14T19:37:08.391403Z  WARN codex_sandboxing::violation: recorded sandbox violation: resource=filesystem backend=linux_sandbox reason=read_only_file_system path=unknown
 exited 1 in 7508ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 882.55ms
Compiler run successful!
2026-09-14T19:37:02.421700Z  WARN evm::traces::external: etherscan config not found
2026-09-14T19:37:02.640091Z  WARN foundry_fork_db::cache: Failed to read cache file err=Os { code: 2, kind: NotFound, message: "No such file or directory" } path="/home/damu/.foundry/cache/rpc/mainnet/25970000"

Ran 1 test for test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_DepositRealUsdtIntoAaveV3() (gas: 1140866)
2026-09-14T19:37:08.366514Z  WARN flush{path=Some("/home/damu/.foundry/cache/rpc/mainnet/25970000")}: cache: Failed to open json cache for writing e=Read-only file system (os error 30)
Traces:
  [1140866] UsdtYieldVaultMainnetForkTest::test_DepositRealUsdtIntoAaveV3()
    ├─ [788692] → new UsdtYieldVault@0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f
    │   ├─ emit OwnershipTransferred(previousOwner: 0x0000000000000000000000000000000000000000, newOwner: UsdtYieldVaultMainnetForkTest: [0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496])
    │   └─ ← [Return] 3596 bytes of code
    ├─ [5031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(alice: [0x328809Bc894f92807417D2dAD6b7C998c1aFdac6]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::record()
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(alice: [0x328809Bc894f92807417D2dAD6b7C998c1aFdac6]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::accesses(0xdAC17F958D2ee523a2206206994597C13D831ec7) [staticcall]
    │   └─ ← [Return] [0x000000000000000000000000000000000000000000000000000000000000000a, 0xab6d3e55895e3e05e9a2ebf84052cdb55ff087915a8643eed90f4e6e80e70698], []
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xab6d3e55895e3e05e9a2ebf84052cdb55ff087915a8643eed90f4e6e80e70698) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ emit WARNING_UninitedSlot(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, slot: 77538513652134917009484598156056052292627943328711086492832673518089096595096 [7.753e76])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xab6d3e55895e3e05e9a2ebf84052cdb55ff087915a8643eed90f4e6e80e70698) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(alice: [0x328809Bc894f92807417D2dAD6b7C998c1aFdac6]) [staticcall]
    │   └─ ← [Return] 0
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xab6d3e55895e3e05e9a2ebf84052cdb55ff087915a8643eed90f4e6e80e70698, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(alice: [0x328809Bc894f92807417D2dAD6b7C998c1aFdac6]) [staticcall]
    │   └─ ← [Return] 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77]
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xab6d3e55895e3e05e9a2ebf84052cdb55ff087915a8643eed90f4e6e80e70698, 0x0000000000000000000000000000000000000000000000000000000000000000)
    │   └─ ← [Return]
    ├─ emit SlotFound(who: 0xdAC17F958D2ee523a2206206994597C13D831ec7, fsig: 0x70a08231, keysHash: 0xd3751b735d9edcdf3462f9493be94138f68ee6a5bfd2c14f7e1a7b0b58f11cca, slot: 77538513652134917009484598156056052292627943328711086492832673518089096595096 [7.753e76])
    ├─ [0] VM::load(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xab6d3e55895e3e05e9a2ebf84052cdb55ff087915a8643eed90f4e6e80e70698) [staticcall]
    │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000000
    ├─ [0] VM::store(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xab6d3e55895e3e05e9a2ebf84052cdb55ff087915a8643eed90f4e6e80e70698, 0x000000000000000000000000000000000000000000000000000000003b9aca00)
    │   └─ ← [Return]
    ├─ [1031] 0xdAC17F958D2ee523a2206206994597C13D831ec7::balanceOf(alice: [0x328809Bc894f92807417D2dAD6b7C998c1aFdac6]) [staticcall]
    │   └─ ← [Return] 1000000000 [1e9]
    ├─ [0] VM::prank(alice: [0x328809Bc894f92807417D2dAD6b7C998c1aFdac6])
    │   └─ ← [Return]
    ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   ├─ emit Approval(owner: alice: [0x328809Bc894f92807417D2dAD6b7C998c1aFdac6], spender: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 115792089237316195423570985008687907853269984665640564039457584007913129639935 [1.157e77])
    │   └─ ← [Stop]
    ├─ [0] VM::prank(alice: [0x328809Bc894f92807417D2dAD6b7C998c1aFdac6])
    │   └─ ← [Return]
    ├─ [64074] UsdtYieldVault::deposit(1000000000 [1e9])
    │   ├─ [34830] 0xdAC17F958D2ee523a2206206994597C13D831ec7::transferFrom(alice: [0x328809Bc894f92807417D2dAD6b7C998c1aFdac6], UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 1000000000 [1e9])
    │   │   ├─ emit Transfer(from: alice: [0x328809Bc894f92807417D2dAD6b7C998c1aFdac6], to: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   ├─ [24953] 0xdAC17F958D2ee523a2206206994597C13D831ec7::approve(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, 1000000000 [1e9])
    │   │   ├─ emit Approval(owner: UsdtYieldVault: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], spender: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2, value: 1000000000 [1e9])
    │   │   └─ ← [Stop]
    │   └─ ← [Revert] EvmError: Revert
    └─ ← [Revert] EvmError: Revert

Backtrace:
  at UsdtYieldVault.deposit
  at UsdtYieldVaultMainnetForkTest.test_DepositRealUsdtIntoAaveV3

Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 5.94s (5.11s CPU time)

Ran 1 test suite in 5.95s (5.94s CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/UsdtYieldVaultMainnetFork.t.sol:UsdtYieldVaultMainnetForkTest
[FAIL: EvmError: Revert] test_DepositRealUsdtIntoAaveV3() (gas: 1140866)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/test/UsdtYieldVaultAdversarial.t.sol b/test/UsdtYieldVaultAdversarial.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..2ced72bb48164719b1c37d5282b2e4c191bf6197
--- /dev/null
+++ b/test/UsdtYieldVaultAdversarial.t.sol
@@ -0,0 +1,73 @@
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
+    function _deposit(address account, uint256 amount) internal returns (uint256 shares) {
+        vm.prank(account);
+        shares = vault.deposit(amount);
+    }
+
+    /// A fee accepted by governance must leave the advertised minimum deposit usable.
+    function testFuzz_OwnerSettableFeeMustLeaveDepositsUsable(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, 10_001);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        uint256 minimumDeposit = vault.MIN_DEPOSIT();
+        vm.prank(alice);
+        uint256 shares = vault.deposit(minimumDeposit);
+        assertGt(shares, 0);
+    }
+
+    /// A vault's recorded assets must equal the Aave claim backing its shares after sequences.
+    function test_AccountingEqualsCustodyAfterTwoFeeBearingWithdrawals() public {
+        uint256 aliceShares = _deposit(alice, 1_000e6);
+        uint256 bobShares = _deposit(bob, 1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(aliceShares / 2);
+        vm.prank(bob);
+        vault.withdraw(bobShares / 2);
+
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody drifted from accounting");
+    }
+
+    /// Aave yield belongs to shareholders and therefore must change their redeemable balance.
+    function test_AaveYieldAccruesToShareholders() public {
+        _deposit(alice, 1_000e6);
+        uint256 claimBefore = vault.balanceOfUnderlying(alice);
+
+        deal(address(aUsdt), address(vault), aUsdt.balanceOf(address(vault)) + 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), claimBefore + 100e6, "Aave yield was ignored");
+    }
+}
diff --git a/test/UsdtYieldVaultMainnetFork.t.sol b/test/UsdtYieldVaultMainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..c644df715c816f95902e146b9cb1799505b5e5d0
--- /dev/null
+++ b/test/UsdtYieldVaultMainnetFork.t.sol
@@ -0,0 +1,35 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract UsdtYieldVaultMainnetForkTest is Test {
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    uint256 internal constant PINNED_BLOCK = 25_970_000;
+
+    address internal alice = makeAddr("alice");
+
+    function setUp() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+    }
+
+    /// The exact production token and pool must accept a normal vault deposit.
+    function test_DepositRealUsdtIntoAaveV3() public {
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_V3_POOL, 10, address(this));
+        deal(USDT, alice, 1_000e6);
+
+        vm.prank(alice);
+        (bool approved,) = USDT.call(abi.encodeWithSignature("approve(address,uint256)", address(vault), type(uint256).max));
+        assertTrue(approved, "user approval failed");
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        assertGt(shares, 0);
+        assertEq(vault.totalAssets(), 1_000e6);
+    }
+}

ERROR: This content was flagged for possible cybersecurity risk. If this seems wrong, try rephrasing your request. To get authorized for security work, join the Trusted Access for Cyber program: https://chatgpt.com/cyber
ERROR: This content was flagged for possible cybersecurity risk. If this seems wrong, try rephrasing your request. To get authorized for security work, join the Trusted Access for Cyber program: https://chatgpt.com/cyber
tokens used
57,431
````
