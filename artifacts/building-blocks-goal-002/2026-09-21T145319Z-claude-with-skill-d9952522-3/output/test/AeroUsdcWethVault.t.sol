// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AeroUsdcWethVault} from "../src/AeroUsdcWethVault.sol";
import {IAeroRouter, IAeroGauge, IChainlinkFeed} from "../src/interfaces/IAerodrome.sol";
import {BaseAddresses as B} from "../script/BaseAddresses.sol";

interface IPoolQuote {
    function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256);
}

interface IGaugeFor {
    function deposit(uint256 amount, address recipient) external;
}

interface IVoter {
    function isAlive(address gauge) external view returns (bool);
}

/// @notice Fork tests against live Base state.
///         RPC: BASE_RPC_URL (default https://mainnet.base.org). Optional FORK_BLOCK to pin.
contract AeroUsdcWethVaultTest is Test {
    AeroUsdcWethVault vault;
    IERC20 usdc = IERC20(B.USDC);
    IERC20 weth = IERC20(B.WETH);
    IERC20 aero = IERC20(B.AERO);
    IAeroRouter router = IAeroRouter(B.AERO_ROUTER);
    IAeroGauge gauge = IAeroGauge(B.WETH_USDC_VAMM_GAUGE);

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string("https://mainnet.base.org"));
        uint256 forkBlock = vm.envOr("FORK_BLOCK", uint256(0));
        if (forkBlock == 0) vm.createSelectFork(rpc);
        else vm.createSelectFork(rpc, forkBlock);

        vault = new AeroUsdcWethVault(
            B.USDC,
            B.WETH,
            B.AERO_ROUTER,
            B.WETH_USDC_VAMM_GAUGE,
            B.CL_ETH_USD,
            B.CL_SEQUENCER_UPTIME,
            keeper,
            treasury,
            owner
        );
        _refreshOracle(); // live feed may lag fork head by a few seconds; pin it to "now"
    }

    // ------------------------------------------------------------------
    // wiring
    // ------------------------------------------------------------------

    function test_wiring() public view {
        assertEq(address(vault.pool()), B.WETH_USDC_VAMM);
        assertEq(address(vault.aero()), B.AERO);
        assertEq(address(vault.factory()), B.AERO_POOL_FACTORY);
        assertTrue(IVoter(B.AERO_VOTER).isAlive(B.WETH_USDC_VAMM_GAUGE));
    }

    function test_constructor_rejectsWrongPool() public {
        // AERO/USDC gauge: pool does not contain WETH
        address aeroUsdcGauge = 0x4F09bAb2f0E15e2A078A227FE1537665F55b8360;
        vm.expectRevert(AeroUsdcWethVault.BadPool.selector);
        new AeroUsdcWethVault(
            B.USDC, B.WETH, B.AERO_ROUTER, aeroUsdcGauge, B.CL_ETH_USD, B.CL_SEQUENCER_UPTIME, keeper, treasury, owner
        );
    }

    // ------------------------------------------------------------------
    // deposit / withdraw
    // ------------------------------------------------------------------

    function test_deposit_stakesLpAndMintsShares() public {
        uint256 shares = _deposit(alice, 10_000e6);

        assertGt(shares, 0);
        assertEq(vault.balanceOf(alice), shares);
        assertGt(gauge.balanceOf(address(vault)), 0);
        assertEq(IERC20(B.WETH_USDC_VAMM).balanceOf(address(vault)), 0, "no idle LP");
        // optimal zap: dust left behind is tiny
        assertLt(usdc.balanceOf(address(vault)), 10e6, "usdc dust < 0.1%");
    }

    function test_roundTrip_lossIsOnlySwapFeesAndImpact() public {
        uint256 amount = 10_000e6;
        uint256 shares = _deposit(alice, amount);

        vm.prank(alice);
        uint256 out = vault.withdraw(shares, 0);

        assertEq(usdc.balanceOf(alice), out);
        assertEq(vault.balanceOf(alice), 0);
        assertGe(out, amount * 995 / 1000, "round trip loss > 0.5%");
    }

    function test_withdraw_revertsBelowMinOut() public {
        uint256 shares = _deposit(alice, 10_000e6);
        vm.prank(alice);
        vm.expectRevert(AeroUsdcWethVault.Slippage.selector);
        vault.withdraw(shares, 10_000e6);
    }

    function test_deposit_revertsBelowMinShares() public {
        deal(B.USDC, alice, 1_000e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        vm.expectRevert(AeroUsdcWethVault.Slippage.selector);
        vault.deposit(1_000e6, type(uint256).max);
        vm.stopPrank();
    }

    function test_twoUsers_proRata() public {
        uint256 sa = _deposit(alice, 10_000e6);
        uint256 sb = _deposit(bob, 30_000e6);
        assertApproxEqRel(sb, sa * 3, 0.01e18);

        vm.prank(alice);
        uint256 outA = vault.withdraw(sa, 0);
        vm.prank(bob);
        uint256 outB = vault.withdraw(sb, 0);
        assertApproxEqRel(outB, outA * 3, 0.01e18);
    }

    // ------------------------------------------------------------------
    // harvest
    // ------------------------------------------------------------------

    function test_harvest_compoundsAeroIntoLp() public {
        // 20k keeps our own zap's price impact under the 1% oracle band (fork has no arbitrageurs)
        uint256 shares = _deposit(alice, 20_000e6);
        uint256 lpBefore = vault.totalLp();
        uint256 lpPerShareBefore = vault.lpForShares(1e18);

        skip(1 days);
        _refreshOracle();

        uint256 pending = vault.pendingAero();
        assertGt(pending, 0, "gauge emits AERO");

        uint256 quote = IPoolQuote(B.AERO_USDC_VAMM).getAmountOut(pending, B.AERO);
        vm.prank(keeper);
        uint256 lpAdded = vault.harvest(quote * 99 / 100, 1);

        assertGt(lpAdded, 0);
        assertEq(vault.totalLp(), lpBefore + lpAdded, "all new LP staked");
        assertGt(vault.lpForShares(1e18), lpPerShareBefore, "share value grew");
        assertEq(aero.balanceOf(address(vault)), 0, "all AERO sold");
        assertApproxEqRel(usdc.balanceOf(treasury), quote / 10, 0.02e18, "10% perf fee");
        assertEq(vault.balanceOf(alice), shares);
    }

    function test_harvest_onlyKeeperOrOwner() public {
        _deposit(alice, 1_000e6);
        vm.prank(alice);
        vm.expectRevert(AeroUsdcWethVault.NotKeeper.selector);
        vault.harvest(0, 0);
    }

    function test_harvest_revertsOnAeroSlippage() public {
        _deposit(alice, 20_000e6);
        skip(1 days);
        _refreshOracle();
        vm.prank(keeper);
        vm.expectRevert(); // router: InsufficientOutputAmount
        vault.harvest(type(uint128).max, 0);
    }

    function test_harvest_noRewardsIsNoop() public {
        vm.prank(keeper);
        assertEq(vault.harvest(0, 0), 0);
    }

    // ------------------------------------------------------------------
    // price / oracle guards
    // ------------------------------------------------------------------

    function test_deposit_revertsWhenPoolManipulated() public {
        // whale dumps 500k USDC into the pool -> spot WETH price moves far above Chainlink
        address whale = makeAddr("whale");
        deal(B.USDC, whale, 500_000e6);
        vm.startPrank(whale);
        usdc.approve(B.AERO_ROUTER, type(uint256).max);
        IAeroRouter.Route[] memory r = new IAeroRouter.Route[](1);
        r[0] = IAeroRouter.Route(B.USDC, B.WETH, false, B.AERO_POOL_FACTORY);
        router.swapExactTokensForTokens(500_000e6, 0, r, whale, block.timestamp);
        vm.stopPrank();

        deal(B.USDC, alice, 1_000e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        vm.expectPartialRevert(AeroUsdcWethVault.PriceDeviation.selector);
        vault.deposit(1_000e6, 0);
        vm.stopPrank();
    }

    function test_deposit_revertsOnStaleOracle() public {
        skip(2 hours); // no refresh
        deal(B.USDC, alice, 1_000e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        vm.expectRevert(AeroUsdcWethVault.StaleOracle.selector);
        vault.deposit(1_000e6, 0);
        vm.stopPrank();
    }

    function test_deposit_revertsWhenSequencerDown() public {
        vm.mockCall(
            B.CL_SEQUENCER_UPTIME,
            abi.encodeWithSelector(IChainlinkFeed.latestRoundData.selector),
            abi.encode(uint80(1), int256(1), block.timestamp - 1 days, block.timestamp, uint80(1))
        );
        deal(B.USDC, alice, 1_000e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        vm.expectRevert(AeroUsdcWethVault.SequencerDown.selector);
        vault.deposit(1_000e6, 0);
        vm.stopPrank();
    }

    function test_withdraw_worksWithStaleOracle() public {
        uint256 shares = _deposit(alice, 1_000e6);
        skip(2 hours); // oracle stale, exits must still work
        vm.prank(alice);
        assertGt(vault.withdraw(shares, 0), 0);
    }

    // ------------------------------------------------------------------
    // admin / emergency
    // ------------------------------------------------------------------

    function test_pause_blocksDepositNotWithdraw() public {
        uint256 shares = _deposit(alice, 1_000e6);
        vm.prank(owner);
        vault.pause();

        deal(B.USDC, bob, 1_000e6);
        vm.startPrank(bob);
        usdc.approve(address(vault), 1_000e6);
        vm.expectRevert();
        vault.deposit(1_000e6, 0);
        vm.stopPrank();

        vm.prank(alice);
        assertGt(vault.withdraw(shares, 0), 0);
    }

    function test_emergencyUnstake_thenWithdraw() public {
        uint256 shares = _deposit(alice, 10_000e6);
        uint256 lp = vault.totalLp();

        vm.prank(owner);
        vault.emergencyUnstake();
        assertEq(gauge.balanceOf(address(vault)), 0);
        assertEq(vault.totalLp(), lp, "LP now idle, still counted");
        assertTrue(vault.paused());

        vm.prank(alice);
        assertGe(vault.withdraw(shares, 0), 9_950e6);
    }

    function test_setters_bounds() public {
        vm.startPrank(owner);
        vm.expectRevert(AeroUsdcWethVault.InvalidParam.selector);
        vault.setPerformanceFee(2_001);
        vm.expectRevert(AeroUsdcWethVault.InvalidParam.selector);
        vault.setOracleParams(501, 1 hours);
        vm.expectRevert(AeroUsdcWethVault.ZeroAddress.selector);
        vault.setKeeper(address(0));
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert();
        vault.setPerformanceFee(0);
    }

    /// First-depositor inflation: attacker donates LP straight into the gauge for the vault.
    /// Virtual shares make the attack unprofitable and the victim keeps ~all value.
    function test_donationAttack_victimNotRobbed() public {
        address attacker = makeAddr("attacker");
        uint256 s = _deposit(attacker, 10e6);
        vm.prank(attacker);
        vault.withdraw(s - 1, 0); // leave 1 share

        // attacker gets ~10k USDC worth of LP and donates it to the vault via gauge.deposit(amt, vault)
        uint256 donation = _mintLp(attacker, 10_000e6);
        vm.startPrank(attacker);
        IERC20(B.WETH_USDC_VAMM).approve(address(gauge), donation);
        IGaugeFor(address(gauge)).deposit(donation, address(vault));
        vm.stopPrank();

        uint256 victimShares = _deposit(alice, 10_000e6);
        assertGt(victimShares, 0);
        vm.prank(alice);
        uint256 out = vault.withdraw(victimShares, 0);
        assertGe(out, 9_900e6, "victim lost value");
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    function _deposit(address user, uint256 amount) internal returns (uint256 shares) {
        deal(B.USDC, user, amount);
        vm.startPrank(user);
        usdc.approve(address(vault), amount);
        shares = vault.deposit(amount, 1);
        vm.stopPrank();
    }

    /// @dev pin Chainlink ETH/USD to the live answer with updatedAt = now (needed after skip()).
    function _refreshOracle() internal {
        (, int256 answer,,,) = IChainlinkFeed(B.CL_ETH_USD).latestRoundData();
        vm.mockCall(
            B.CL_ETH_USD,
            abi.encodeWithSelector(IChainlinkFeed.latestRoundData.selector),
            abi.encode(uint80(1), answer, block.timestamp, block.timestamp, uint80(1))
        );
    }

    function _mintLp(address user, uint256 usdcAmount) internal returns (uint256 lp) {
        deal(B.USDC, user, usdcAmount);
        vm.startPrank(user);
        usdc.approve(B.AERO_ROUTER, type(uint256).max);
        weth.approve(B.AERO_ROUTER, type(uint256).max);
        IAeroRouter.Route[] memory r = new IAeroRouter.Route[](1);
        r[0] = IAeroRouter.Route(B.USDC, B.WETH, false, B.AERO_POOL_FACTORY);
        uint256[] memory out = router.swapExactTokensForTokens(usdcAmount / 2, 0, r, user, block.timestamp);
        (,, lp) = router.addLiquidity(B.USDC, B.WETH, false, usdcAmount / 2, out[1], 0, 0, user, block.timestamp);
        vm.stopPrank();
    }
}
