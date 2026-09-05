// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TipJar} from "../src/TipJar.sol";

/// @notice Exercises the jar against the real USDC contract on Base.
/// @dev Skipped unless BASE_RPC_URL is set: `BASE_RPC_URL=https://mainnet.base.org forge test`.
contract TipJarForkTest is Test {
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    IERC20 internal usdc = IERC20(BASE_USDC);
    TipJar internal jar;
    address internal owner = makeAddr("owner");
    address internal tipper = makeAddr("tipper");

    bool internal enabled;

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;

        vm.createSelectFork(rpc);
        enabled = true;
        jar = new TipJar(usdc, owner);
        deal(BASE_USDC, tipper, 100e6);
    }

    function test_fork_tipRealUsdc() public {
        if (!enabled) {
            vm.skip(true);
        }

        vm.startPrank(tipper);
        usdc.approve(address(jar), 25e6);
        jar.tip(25e6, "base dev", "gm from a fork");
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(jar)), 25e6);
        assertEq(jar.totalTipped(), 25e6);

        TipJar.Tip[] memory feed = jar.getTips(0, 5);
        assertEq(feed.length, 1);
        assertEq(feed[0].from, tipper);
        assertEq(feed[0].message, "gm from a fork");

        vm.prank(owner);
        jar.withdraw(owner, 0);
        assertEq(usdc.balanceOf(owner), 25e6);
    }
}
