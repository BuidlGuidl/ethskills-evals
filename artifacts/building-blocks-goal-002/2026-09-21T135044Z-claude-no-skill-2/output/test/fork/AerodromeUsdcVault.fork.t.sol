// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AerodromeUsdcVault} from "../../src/AerodromeUsdcVault.sol";
import {BaseAddresses as B} from "../../script/BaseAddresses.sol";

/// @notice Runs against real Base contracts. Skipped unless BASE_RPC_URL is set.
///         Forks latest block unless BASE_FORK_BLOCK is set (pinning needs an archive RPC).
contract AerodromeUsdcVaultForkTest is Test {
    AerodromeUsdcVault vault;
    IERC20 usdc = IERC20(B.USDC);
    address alice = makeAddr("alice");
    address treasury = makeAddr("treasury");

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        uint256 forkBlock = vm.envOr("BASE_FORK_BLOCK", uint256(0));
        if (forkBlock == 0) vm.createSelectFork(rpc);
        else vm.createSelectFork(rpc, forkBlock);
        vault = new AerodromeUsdcVault(B.vaultConfig(address(this), treasury), 1_000_000e6, address(this));
    }

    function test_fork_fullCycle() public {
        (, bool ok) = vault.oraclePrice();
        assertTrue(ok, "oracle healthy at fork block");

        deal(B.USDC, alice, 20_000e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), 20_000e6);
        uint256 shares = vault.deposit(20_000e6, alice);
        vm.stopPrank();

        // deploy into the Aerodrome LP + gauge
        vault.harvest(0, type(uint256).max);
        assertGt(vault.stakedLp(), 0);
        assertLt(usdc.balanceOf(address(vault)), 50e6);
        assertApproxEqRel(vault.totalAssets(), 20_000e6, 0.005e18);

        // accrue AERO emissions, then compound (stay within the ETH feed max age)
        skip(30 minutes);
        assertGt(vault.pendingRewards(), 0);
        uint256 profit = vault.harvest(0, type(uint256).max);
        assertGt(profit, 0);
        assertGt(usdc.balanceOf(treasury), 0);

        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, 19_700e6);
        assertApproxEqRel(out, 20_000e6, 0.01e18);
        assertEq(vault.totalSupply(), 0);
    }
}
