// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AeroUsdcWethVault} from "../../src/AeroUsdcWethVault.sol";
import {Deploy} from "../../script/Deploy.s.sol";
import {BaseAddresses as B} from "../../script/BaseAddresses.sol";

/// @notice Runs against real Aerodrome + Chainlink on a Base fork. Skipped unless BASE_RPC_URL is set:
///   BASE_RPC_URL=https://mainnet.base.org forge test --match-path test/fork/*
contract AeroUsdcWethVaultForkTest is Test {
    AeroUsdcWethVault vault;
    IERC20 usdc = IERC20(B.USDC);
    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        vault = new AeroUsdcWethVault(new Deploy().config(owner, keeper, 1_000_000e6));
    }

    function test_fork_depositHarvestRedeem() public {
        deal(B.USDC, alice, 20_000e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), 20_000e6);
        vault.deposit(20_000e6, alice);
        vm.stopPrank();

        vm.prank(keeper);
        vault.harvest(0, type(uint256).max);
        assertGt(vault.gauge().balanceOf(address(vault)), 0);
        assertApproxEqRel(vault.totalAssets(), 20_000e6, 0.01e18);

        // Let emissions accrue. Feeds are frozen on a fork, so refresh their timestamps by mocking.
        skip(1 days);
        _refreshFeeds();
        assertGt(vault.pendingRewards(), 0);

        vm.prank(keeper);
        (uint256 fromRewards,) = vault.harvest(0, type(uint256).max);
        assertGt(fromRewards, 0);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, alice, 0);
        assertApproxEqRel(out, 20_000e6, 0.01e18);
    }

    function _refreshFeeds() internal {
        address[2] memory feeds = [B.CL_ETH_USD, B.CL_USDC_USD];
        for (uint256 i; i < 2; ++i) {
            (uint80 id, int256 answer, uint256 startedAt,, uint80 answeredIn) =
                AggregatorLike(feeds[i]).latestRoundData();
            vm.mockCall(
                feeds[i],
                abi.encodeWithSelector(AggregatorLike.latestRoundData.selector),
                abi.encode(id, answer, startedAt, block.timestamp, answeredIn)
            );
        }
    }
}

interface AggregatorLike {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}
