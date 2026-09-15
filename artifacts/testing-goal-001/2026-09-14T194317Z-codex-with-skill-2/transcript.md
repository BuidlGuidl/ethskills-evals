# Executor transcript — 2026-09-14T194317Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 1
**workspace**: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T194317Z-codex-with-skill-2/testing-goal-001

## session

````text
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "/tmp" (codex_home: AbsolutePathBuf("/tmp/ethskills-eval-harness-codex"))
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T194317Z-codex-with-skill-2/testing-goal-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0a172-30d2-7c23-85d4-6ead06aea035
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
I’m using the Foundry testing skill because the sign-off depends on adversarial tests and reproducible failure evidence, not headline coverage. I’ll first inspect its instructions and the vault/test setup, then add only new files under `test/` and record exact terminal output.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/testing/SKILL.md && find . -maxdepth 3 -type f -not -path './.git/*' -print | sort && git status --short" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T194317Z-codex-with-skill-2/testing-goal-001
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
./.gitignore
./README.md
./TASK.md
./cache/solidity-files-cache.json
./foundry.toml
./lib/forge-std/.gitattributes
./lib/forge-std/.gitignore
./lib/forge-std/CONTRIBUTING.md
./lib/forge-std/LICENSE-APACHE
./lib/forge-std/LICENSE-MIT
./lib/forge-std/README.md
./lib/forge-std/RELEASE_CHECKLIST.md
./lib/forge-std/foundry.toml
./lib/forge-std/package.json
./lib/openzeppelin-contracts/.codecov.yml
./lib/openzeppelin-contracts/.editorconfig
./lib/openzeppelin-contracts/.gitattributes
./lib/openzeppelin-contracts/.gitignore
./lib/openzeppelin-contracts/.gitmodules
./lib/openzeppelin-contracts/.mocharc.js
./lib/openzeppelin-contracts/.prettierrc
./lib/openzeppelin-contracts/.solcover.js
./lib/openzeppelin-contracts/CHANGELOG.md
./lib/openzeppelin-contracts/CODE_OF_CONDUCT.md
./lib/openzeppelin-contracts/CONTRIBUTING.md
./lib/openzeppelin-contracts/FUNDING.json
./lib/openzeppelin-contracts/GUIDELINES.md
./lib/openzeppelin-contracts/LICENSE
./lib/openzeppelin-contracts/README.md
./lib/openzeppelin-contracts/RELEASING.md
./lib/openzeppelin-contracts/SECURITY.md
./lib/openzeppelin-contracts/eslint.config.mjs
./lib/openzeppelin-contracts/foundry.toml
./lib/openzeppelin-contracts/fv-requirements.txt
./lib/openzeppelin-contracts/hardhat.config.js
./lib/openzeppelin-contracts/logo.svg
./lib/openzeppelin-contracts/netlify.toml
./lib/openzeppelin-contracts/package-lock.json
./lib/openzeppelin-contracts/package.json
./lib/openzeppelin-contracts/remappings.txt
./lib/openzeppelin-contracts/renovate.json
./lib/openzeppelin-contracts/slither.config.json
./lib/openzeppelin-contracts/solhint.config.js
./out/Base.sol/CommonBase.json
./out/Base.sol/ScriptBase.json
./out/Base.sol/TestBase.json
./out/Context.sol/Context.json
./out/ERC20.sol/ERC20.json
./out/IAavePool.sol/IAavePool.json
./out/IERC1363.sol/IERC1363.json
./out/IERC165.sol/IERC165.json
./out/IERC20.sol/IERC20.json
./out/IERC20Metadata.sol/IERC20Metadata.json
./out/IMulticall3.sol/IMulticall3.json
./out/Math.sol/Math.json
./out/MockAavePool.sol/MockAToken.json
./out/MockAavePool.sol/MockAavePool.json
./out/MockUSDT.sol/MockUSDT.json
./out/Ownable.sol/Ownable.json
./out/Panic.sol/Panic.json
./out/Pausable.sol/Pausable.json
./out/ReentrancyGuard.sol/ReentrancyGuard.json
./out/SafeCast.sol/SafeCast.json
./out/SafeERC20.sol/SafeERC20.json
./out/StdAssertions.sol/StdAssertions.json
./out/StdChains.sol/StdChains.json
./out/StdCheats.sol/StdCheats.json
./out/StdCheats.sol/StdCheatsSafe.json
./out/StdConstants.sol/StdConstants.json
./out/StdError.sol/stdError.json
./out/StdInvariant.sol/StdInvariant.json
./out/StdJson.sol/stdJson.json
./out/StdMath.sol/stdMath.json
./out/StdStorage.sol/stdStorage.json
./out/StdStorage.sol/stdStorageSafe.json
./out/StdStyle.sol/StdStyle.json
./out/StdToml.sol/stdToml.json
./out/StdUtils.sol/StdUtils.json
./out/StorageSlot.sol/StorageSlot.json
./out/Test.sol/Test.json
./out/UsdtYieldVault.sol/UsdtYieldVault.json
./out/UsdtYieldVault.t.sol/UsdtYieldVaultTest.json
./out/Vm.sol/Vm.json
./out/Vm.sol/VmSafe.json
./out/build-info/7418f0dbff7bc3d4.json
./out/console.sol/console.json
./out/draft-IERC6093.sol/IERC1155Errors.json
./out/draft-IERC6093.sol/IERC20Errors.json
./out/draft-IERC6093.sol/IERC721Errors.json
./out/safeconsole.sol/safeconsole.json
./package.json
./remappings.txt
./src/UsdtYieldVault.sol
./src/interfaces/IAavePool.sol
./test/UsdtYieldVault.t.sol
./test/mocks/MockAavePool.sol
./test/mocks/MockUSDT.sol

exec
/bin/bash -lc "sed -n '1,260p' src/UsdtYieldVault.sol && sed -n '1,360p' test/UsdtYieldVault.t.sol && sed -n '1,240p' test/mocks/MockAavePool.sol && cat foundry.toml && cat README.md && env | rg 'RPC|ETH|MAINNET' || true" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T194317Z-codex-with-skill-2/testing-goal-001
 succeeded in 12ms:
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

codex
The existing suite largely checks that fields changed or that calls succeeded. Two accounting risks are already visible enough to turn into properties: custody must equal recorded assets after sequences, and every owner-accepted fee must leave deposit math usable. I’m also checking the actual USDT/Aave path on a pinned mainnet state; if no RPC is available, I’ll document that sign-off blocker rather than silently substituting mocks.
exec
/bin/bash -lc "curl -sS --max-time 15 https://eth.llamarpc.com -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}' && command -v slither || true && forge --version" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T194317Z-codex-with-skill-2/testing-goal-001
 succeeded in 766ms:
error code: 525
/home/damu/.local/bin/slither
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

exec
/bin/bash -lc "for url in https://ethereum-rpc.publicnode.com https://eth-mainnet.public.blastapi.io https://rpc.ankr.com/eth; do printf '%s ' \""'$url"; curl -sS --max-time 12 "$url" -H '"'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}'; printf '\\n'; done" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T194317Z-codex-with-skill-2/testing-goal-001
 succeeded in 1443ms:
{"jsonrpc":"2.0","result":"0x18c6409","id":1}

https://eth-mainnet.public.blastapi.io {"jsonrpc":"2.0","id":1,"result":"0x18c6409"}
https://rpc.ankr.com/eth {"jsonrpc": "2.0", "error": {"code": -32000, "message": "Unauthorized: You must authenticate your request with an API key. Create an account on https://www.ankr.com/rpc/ and generate your personal API key for free."}, "id": null}

apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T194317Z-codex-with-skill-2/testing-goal-001/test/AdversarialVault.t.sol
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T194317Z-codex-with-skill-2/testing-goal-001/test/MainnetFork.t.sol
diff --git a/test/AdversarialVault.t.sol b/test/AdversarialVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ce4eacbafc0da37c783642a432c72b81ff21c0f3
--- /dev/null
+++ b/test/AdversarialVault.t.sol
@@ -0,0 +1,105 @@
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
+contract WithdrawalHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = address(this);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 10_000e6);
+        usdt.mint(actor, amount);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        vault.withdraw(bound(seed, 1, balance));
+    }
+}
+
+contract VaultAccountingInvariantTest is StdInvariant, Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAToken internal aUsdt;
+    WithdrawalHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new WithdrawalHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_recordedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets());
+    }
+}
+
+contract VaultAdversarialTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAToken internal aUsdt;
+    address internal alice = makeAddr("adversarial alice");
+    address internal owner = makeAddr("adversarial owner");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function test_TwoWithdrawalsAccumulateUnaccountedWithdrawalFees() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+        assertEq(aUsdt.balanceOf(address(vault)) - vault.totalAssets(), 1_500_000, "gap after first withdrawal");
+
+        vm.prank(alice);
+        vault.withdraw(shares - shares / 2);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody must equal recorded assets");
+    }
+
+    function testFuzz_OwnerAcceptedFeeMustPermitMinimumDeposit(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, type(uint32).max);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(vault.MIN_DEPOSIT());
+        assertGt(shares, 0, "an accepted fee must leave deposits usable");
+    }
+
+    function test_AccruedAaveBalanceMustIncreaseRedeemableAssets() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+        uint256 beforeYield = vault.balanceOfUnderlying(alice);
+
+        deal(address(aUsdt), address(vault), aUsdt.balanceOf(address(vault)) + 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), beforeYield + 100e6, "Aave yield must be redeemable");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d504b6152454542ba35c1b38a8c859ad41fc256e
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    uint256 internal constant PINNED_BLOCK = 25_977_000;
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+
+    function test_PinnedMainnetRealUsdtCanSupplyAndWithdrawTwice() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+        address alice = makeAddr("fork alice");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, alice, 2_000e6);
+        vm.prank(alice);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+
+        vm.startPrank(alice);
+        uint256 firstShares = vault.deposit(1_000e6);
+        uint256 secondShares = vault.deposit(1_000e6);
+        vault.withdraw(firstShares);
+        vault.withdraw(secondShares);
+        vm.stopPrank();
+
+        assertEq(vault.totalShares(), 0);
+    }
+}

diff --git a/test/AdversarialVault.t.sol b/test/AdversarialVault.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..ce4eacbafc0da37c783642a432c72b81ff21c0f3
--- /dev/null
+++ b/test/AdversarialVault.t.sol
@@ -0,0 +1,105 @@
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
+contract WithdrawalHandler is Test {
+    UsdtYieldVault internal immutable vault;
+    MockUSDT internal immutable usdt;
+    address internal immutable actor;
+
+    constructor(UsdtYieldVault _vault, MockUSDT _usdt) {
+        vault = _vault;
+        usdt = _usdt;
+        actor = address(this);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function deposit(uint256 amount) external {
+        amount = bound(amount, vault.MIN_DEPOSIT(), 10_000e6);
+        usdt.mint(actor, amount);
+        vault.deposit(amount);
+    }
+
+    function withdraw(uint256 seed) external {
+        uint256 balance = vault.shareBalance(actor);
+        if (balance == 0) return;
+        vault.withdraw(bound(seed, 1, balance));
+    }
+}
+
+contract VaultAccountingInvariantTest is StdInvariant, Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAToken internal aUsdt;
+    WithdrawalHandler internal handler;
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, address(this));
+        handler = new WithdrawalHandler(vault, usdt);
+        targetContract(address(handler));
+    }
+
+    function invariant_recordedAssetsEqualAaveCustody() public view {
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets());
+    }
+}
+
+contract VaultAdversarialTest is Test {
+    UsdtYieldVault internal vault;
+    MockUSDT internal usdt;
+    MockAToken internal aUsdt;
+    address internal alice = makeAddr("adversarial alice");
+    address internal owner = makeAddr("adversarial owner");
+
+    function setUp() public {
+        usdt = new MockUSDT();
+        MockAavePool pool = new MockAavePool(address(usdt));
+        aUsdt = pool.aToken();
+        vault = new UsdtYieldVault(address(usdt), address(aUsdt), address(pool), 10, owner);
+        usdt.mint(alice, 100_000e6);
+        vm.prank(alice);
+        usdt.approve(address(vault), type(uint256).max);
+    }
+
+    function test_TwoWithdrawalsAccumulateUnaccountedWithdrawalFees() public {
+        vm.prank(alice);
+        uint256 shares = vault.deposit(1_000e6);
+
+        vm.prank(alice);
+        vault.withdraw(shares / 2);
+        assertEq(aUsdt.balanceOf(address(vault)) - vault.totalAssets(), 1_500_000, "gap after first withdrawal");
+
+        vm.prank(alice);
+        vault.withdraw(shares - shares / 2);
+        assertEq(aUsdt.balanceOf(address(vault)), vault.totalAssets(), "Aave custody must equal recorded assets");
+    }
+
+    function testFuzz_OwnerAcceptedFeeMustPermitMinimumDeposit(uint256 feeBps) public {
+        feeBps = bound(feeBps, 0, type(uint32).max);
+        vm.prank(owner);
+        vault.setDepositFee(feeBps);
+
+        vm.prank(alice);
+        uint256 shares = vault.deposit(vault.MIN_DEPOSIT());
+        assertGt(shares, 0, "an accepted fee must leave deposits usable");
+    }
+
+    function test_AccruedAaveBalanceMustIncreaseRedeemableAssets() public {
+        vm.prank(alice);
+        vault.deposit(1_000e6);
+        uint256 beforeYield = vault.balanceOfUnderlying(alice);
+
+        deal(address(aUsdt), address(vault), aUsdt.balanceOf(address(vault)) + 100e6);
+
+        assertEq(vault.balanceOfUnderlying(alice), beforeYield + 100e6, "Aave yield must be redeemable");
+    }
+}
diff --git a/test/MainnetFork.t.sol b/test/MainnetFork.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..d504b6152454542ba35c1b38a8c859ad41fc256e
--- /dev/null
+++ b/test/MainnetFork.t.sol
@@ -0,0 +1,32 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.28;
+
+import {Test} from "forge-std/Test.sol";
+import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
+
+import {UsdtYieldVault} from "../src/UsdtYieldVault.sol";
+
+contract MainnetForkTest is Test {
+    uint256 internal constant PINNED_BLOCK = 25_977_000;
+    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
+    address internal constant A_USDT = 0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a;
+    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
+
+    function test_PinnedMainnetRealUsdtCanSupplyAndWithdrawTwice() public {
+        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
+        address alice = makeAddr("fork alice");
+        UsdtYieldVault vault = new UsdtYieldVault(USDT, A_USDT, AAVE_POOL, 10, address(this));
+        deal(USDT, alice, 2_000e6);
+        vm.prank(alice);
+        IERC20(USDT).approve(address(vault), type(uint256).max);
+
+        vm.startPrank(alice);
+        uint256 firstShares = vault.deposit(1_000e6);
+        uint256 secondShares = vault.deposit(1_000e6);
+        vault.withdraw(firstShares);
+        vault.withdraw(secondShares);
+        vm.stopPrank();
+
+        assertEq(vault.totalShares(), 0);
+    }
+}

ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 9:12 PM.
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 9:12 PM.
tokens used
14,330
````
