// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AeroUsdcWethVault} from "../src/AeroUsdcWethVault.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {BaseAddresses as B} from "../script/BaseAddresses.sol";

interface IVoter {
    function gauges(address pool) external view returns (address);
    function isAlive(address gauge) external view returns (bool);
}

interface IPoolFactory {
    function getPool(address a, address b, bool stable) external view returns (address);
}

/// @notice Runs against real Base contracts. Skipped unless BASE_RPC_URL is set.
contract AeroUsdcWethVaultForkTest is Test {
    AeroUsdcWethVault vault;
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
        vault = new AeroUsdcWethVault(new Deploy().addresses(owner, keeper), 1_000_000e6);
    }

    function test_fork_addressesAreConsistent() public view {
        assertEq(IPoolFactory(B.AERO_POOL_FACTORY).getPool(B.USDC, B.WETH, false), B.VAMM_WETH_USDC);
        assertEq(IVoter(B.AERO_VOTER).gauges(B.VAMM_WETH_USDC), B.VAMM_WETH_USDC_GAUGE);
        assertTrue(IVoter(B.AERO_VOTER).isAlive(B.VAMM_WETH_USDC_GAUGE));
        assertEq(keccak256(bytes(vault.ethUsdFeed().description())), keccak256("ETH / USD"));
    }

    function test_fork_depositHarvestRedeem() public {
        deal(B.USDC, alice, 50_000e6);
        vm.startPrank(alice);
        IERC20(B.USDC).approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(50_000e6, alice);
        vm.stopPrank();

        vm.prank(keeper);
        vault.harvest(0); // nothing to claim yet; invests idle USDC
        assertGt(vault.lpBalance(), 0);
        assertApproxEqRel(vault.totalAssets(), 50_000e6, 0.01e18);

        skip(15 minutes); // stay inside the oracle heartbeat
        assertGt(vault.pendingRewards(), 0);
        vm.prank(keeper);
        vault.harvest(0);
        assertGt(vault.currentLockedProfit(), 0);

        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, alice);
        assertApproxEqRel(out, 50_000e6, 0.01e18);
    }
}
