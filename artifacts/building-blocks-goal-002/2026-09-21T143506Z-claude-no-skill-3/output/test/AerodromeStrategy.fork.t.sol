// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {YieldVault} from "../src/YieldVault.sol";
import {AerodromeStrategy} from "../src/AerodromeStrategy.sol";
import {IAerodromeRouter, IAerodromeGauge} from "../src/interfaces/IAerodrome.sol";
import {IAggregatorV3} from "../src/interfaces/IChainlink.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {BaseAddresses as B} from "../script/BaseAddresses.sol";

/// Integration tests against real Aerodrome + Chainlink on a Base mainnet fork.
/// Uses BASE_RPC_URL if set, else the public Base RPC. Block is pinned so results are reproducible and cached.
contract AerodromeStrategyForkTest is Test {
    uint256 constant FORK_BLOCK = 51_600_000;

    IERC20 usdc = IERC20(B.USDC);
    IERC20 weth = IERC20(B.WETH);
    YieldVault vault;
    AerodromeStrategy strategy;

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_RPC_URL", string("https://mainnet.base.org")), FORK_BLOCK);

        vault = new YieldVault(usdc, owner, 10_000_000e6);
        strategy = new AerodromeStrategy(new Deploy().config(address(vault)), owner, keeper);
        vm.prank(owner);
        vault.setStrategy(strategy);

        _fund(alice, 100_000e6);
        _fund(bob, 100_000e6);
    }

    // ---------------------------------------------------------------- tests

    function test_DepositThenHarvestInvestsIntoGauge() public {
        _deposit(alice, 20_000e6);
        assertEq(usdc.balanceOf(address(strategy)), 20_000e6, "idle in strategy");

        vm.prank(keeper);
        strategy.harvest();

        assertGt(strategy.stakedLp(), 0, "lp staked");
        assertLt(usdc.balanceOf(address(strategy)), 50e6, "little idle usdc");
        // Swap fee (0.3% on half) + price impact + pool/oracle gap are the only valuation drift.
        assertApproxEqRel(vault.totalAssets(), 20_000e6, 0.01e18);
    }

    function test_LargeDepositInvestedOverSeveralHarvests() public {
        _deposit(alice, 60_000e6);
        vm.startPrank(keeper);
        strategy.harvest();
        vm.stopPrank();
        assertApproxEqAbs(usdc.balanceOf(address(strategy)), 35_000e6, 100e6, "only 25k deployed");

        // Between harvests arbitrageurs undo our price impact (~12.5k USDC of WETH bought each time).
        for (uint256 i; i < 2; i++) {
            _manipulatePool(4.6 ether);
            vm.prank(keeper);
            strategy.harvest();
        }
        assertLt(usdc.balanceOf(address(strategy)), 50e6, "all deployed");
        assertApproxEqRel(vault.totalAssets(), 60_000e6, 0.01e18);
    }

    function test_HarvestCompoundsAeroAndUnlocksLinearly() public {
        _deposit(alice, 25_000e6);
        vm.prank(keeper);
        strategy.harvest();

        _skip(1 days);
        assertGt(IAerodromeGauge(B.WETH_USDC_GAUGE).earned(address(strategy)), 0, "aero accrued");
        uint256 lpBefore = strategy.stakedLp();
        uint256 assetsBefore = vault.totalAssets();

        vm.prank(keeper);
        uint256 profit = strategy.harvest();

        assertGt(profit, 0, "profit");
        assertGt(strategy.stakedLp(), lpBefore, "compounded into lp");
        // Profit is locked right after harvest, so share price doesn't jump.
        assertApproxEqRel(vault.totalAssets(), assetsBefore, 0.001e18);
        assertApproxEqRel(strategy.lockedProfit(), profit, 0.001e18);

        _skip(3 hours);
        assertApproxEqRel(strategy.lockedProfit(), profit / 2, 0.01e18);
        _skip(3 hours);
        assertEq(strategy.lockedProfit(), 0);
    }

    function test_RedeemUnwindsLiquidity() public {
        _deposit(alice, 12_500e6);
        _deposit(bob, 12_500e6);
        vm.prank(keeper);
        strategy.harvest();

        uint256 bobValueBefore = vault.convertToAssets(vault.balanceOf(bob));
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 got = vault.redeem(shares, alice, alice);

        assertGt(got, 12_375e6, "alice gets >99%");
        assertEq(usdc.balanceOf(alice), 100_000e6 - 12_500e6 + got);
        // Alice's exit cost is not socialised onto Bob.
        assertGe(vault.convertToAssets(vault.balanceOf(bob)), bobValueBefore * 9999 / 10000);
    }

    function test_FullExit() public {
        _deposit(alice, 25_000e6);
        vm.prank(keeper);
        strategy.harvest();

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 got = vault.redeem(shares, alice, alice);
        assertGt(got, 24_750e6);
        assertEq(vault.totalSupply(), 0);
    }

    function test_ValuationIgnoresPoolManipulation() public {
        _deposit(alice, 25_000e6);
        vm.prank(keeper);
        strategy.harvest();
        uint256 before = vault.totalAssets();

        _manipulatePool(300 ether);

        // Fair-LP pricing: skewing reserves barely moves reported assets (k only grows by the attacker's fee).
        assertApproxEqRel(vault.totalAssets(), before, 0.005e18);
    }

    function test_RevertWhen_HarvestIntoManipulatedPool() public {
        _deposit(alice, 25_000e6);
        _manipulatePool(300 ether);
        vm.prank(keeper);
        vm.expectPartialRevert(AerodromeStrategy.PoolPriceDeviation.selector);
        strategy.harvest();
    }

    function test_RevertWhen_WithdrawSwapSandwiched() public {
        _deposit(alice, 25_000e6);
        vm.prank(keeper);
        strategy.harvest();

        // Pool WETH price dumped ~30%: selling the WETH leg would breach the oracle-based minOut.
        _manipulatePool(300 ether);
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert();
        vault.redeem(shares, alice, alice);
    }

    function test_RevertWhen_NotKeeper() public {
        vm.prank(alice);
        vm.expectRevert(AerodromeStrategy.NotKeeper.selector);
        strategy.harvest();
    }

    function test_RevertWhen_NotVault() public {
        vm.prank(alice);
        vm.expectRevert(AerodromeStrategy.NotVault.selector);
        strategy.withdraw(1);
    }

    function test_RevertWhen_OracleStale() public {
        _deposit(alice, 1_000e6);
        vm.warp(block.timestamp + 2 hours); // ETH/USD older than ethMaxAge
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(AerodromeStrategy.StaleOrBadPrice.selector, B.CL_ETH_USD));
        strategy.harvest();
    }

    function test_RevertWhen_SequencerDown() public {
        _deposit(alice, 1_000e6);
        vm.mockCall(
            B.CL_SEQUENCER_UPTIME,
            abi.encodeWithSelector(IAggregatorV3.latestRoundData.selector),
            abi.encode(uint80(1), int256(1), block.timestamp - 1 days, block.timestamp, uint80(1))
        );
        vm.prank(keeper);
        vm.expectRevert(AerodromeStrategy.SequencerDown.selector);
        strategy.harvest();
    }

    function test_EmergencyExit() public {
        _deposit(alice, 25_000e6);
        vm.prank(keeper);
        strategy.harvest();

        vm.prank(owner);
        strategy.emergencyExit();
        assertEq(strategy.stakedLp(), 0);
        assertEq(weth.balanceOf(address(strategy)), 0);
        assertGt(usdc.balanceOf(address(strategy)), 24_750e6);

        // Harvest no longer reinvests.
        vm.prank(keeper);
        strategy.harvest();
        assertEq(strategy.stakedLp(), 0);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        assertGt(vault.redeem(shares, alice, alice), 24_750e6);
    }

    // ---------------------------------------------------------------- helpers

    function _fund(address who, uint256 amount) internal {
        deal(address(usdc), who, amount);
        vm.prank(who);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _deposit(address who, uint256 amount) internal {
        vm.prank(who);
        vault.deposit(amount, who);
    }

    /// Dump WETH into the pool to push its WETH price down.
    function _manipulatePool(uint256 wethIn) internal {
        address attacker = makeAddr("attacker");
        deal(address(weth), attacker, wethIn);
        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route(B.WETH, B.USDC, false, B.AERO_FACTORY);
        vm.startPrank(attacker);
        weth.approve(B.AERO_ROUTER, wethIn);
        IAerodromeRouter(B.AERO_ROUTER).swapExactTokensForTokens(wethIn, 0, routes, attacker, block.timestamp);
        vm.stopPrank();
    }

    /// Warp and keep Chainlink feeds fresh (same answer, new timestamp).
    function _skip(uint256 dt) internal {
        vm.warp(block.timestamp + dt);
        vm.roll(block.number + dt / 2);
        vm.clearMockedCalls();
        _refresh(B.CL_ETH_USD);
        _refresh(B.CL_USDC_USD);
        _refresh(B.CL_AERO_USD);
    }

    function _refresh(address feed) internal {
        (uint80 id, int256 answer,,,) = IAggregatorV3(feed).latestRoundData();
        vm.mockCall(
            feed,
            abi.encodeWithSelector(IAggregatorV3.latestRoundData.selector),
            abi.encode(id, answer, block.timestamp, block.timestamp, id)
        );
    }
}
