// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {AeroUsdcWethVault} from "../src/AeroUsdcWethVault.sol";
import {IAeroRouter, IAeroPool, IAeroGauge} from "../src/interfaces/IAerodrome.sol";
import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";
import {BaseAddresses as B} from "../script/BaseAddresses.sol";

/// Runs against real Base contracts. Skipped unless BASE_RPC_URL is set:
///   BASE_RPC_URL=https://mainnet.base.org forge test --mt testFork -vv
contract AeroUsdcWethVaultForkTest is Test {
    AeroUsdcWethVault vault;
    IERC20 usdc = IERC20(B.USDC);
    address keeper = makeAddr("keeper");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);

        vault = new AeroUsdcWethVault(
            AeroUsdcWethVault.Config({
                usdc: usdc,
                weth: IERC20(B.WETH),
                aero: IERC20(B.AERO),
                router: IAeroRouter(B.AERO_ROUTER),
                pool: IAeroPool(B.VAMM_WETH_USDC),
                gauge: IAeroGauge(B.VAMM_WETH_USDC_GAUGE),
                ethUsdFeed: AggregatorV3Interface(B.ETH_USD_FEED),
                usdcUsdFeed: AggregatorV3Interface(B.USDC_USD_FEED),
                sequencerFeed: AggregatorV3Interface(B.SEQUENCER_UPTIME_FEED),
                ethUsdMaxAge: B.ETH_USD_MAX_AGE,
                usdcUsdMaxAge: B.USDC_USD_MAX_AGE,
                owner: address(this),
                keeper: keeper,
                treasury: treasury,
                depositCap: 1_000_000e6
            })
        );
    }

    function testFork_depositHarvestRedeem() public {
        vm.skip(address(vault) == address(0));

        deal(address(usdc), alice, 10_000e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(10_000e6, alice);
        vm.stopPrank();

        // First harvest deploys idle USDC into the gauge.
        vm.prank(keeper);
        vault.harvest(0);
        assertGt(vault.gauge().balanceOf(address(vault)), 0);
        assertApproxEqRel(vault.totalAssets(), 10_000e6, 0.005e18);

        // Accrue emissions (stay inside the ETH/USD staleness window).
        skip(15 minutes);
        uint256 earned = vault.gauge().earned(address(vault));
        assertGt(earned, 0, "AERO accrued");

        vm.prank(keeper);
        uint256 profit = vault.harvest(1);
        assertGt(profit, 0);
        assertGt(usdc.balanceOf(treasury), 0);

        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, alice);
        assertApproxEqRel(out, 10_000e6, 0.01e18);
    }
}
