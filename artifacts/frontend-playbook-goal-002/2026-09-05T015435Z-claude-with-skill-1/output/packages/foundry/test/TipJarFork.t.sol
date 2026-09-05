//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

/**
 * Exercises the jar against the real USDC contract instead of a mock.
 *
 * Needs a Base fork, so it is skipped by default. Run it with the local fork
 * from `yarn fork` up:
 *
 *   FORK_TESTS=true yarn test
 */
contract TipJarForkTest is Test {
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    IERC20 internal usdc = IERC20(BASE_USDC);
    TipJar internal jar;

    address internal owner = makeAddr("owner");
    address internal tipper = makeAddr("tipper");

    uint256 internal constant ONE_USDC = 1e6;

    function setUp() public {
        if (!vm.envOr("FORK_TESTS", false)) {
            vm.skip(true);
            return;
        }

        vm.createSelectFork(vm.envOr("FORK_RPC_URL", string("http://127.0.0.1:8545")));
        jar = new TipJar(BASE_USDC, owner);

        // USDC keeps balances in slot 9 of the implementation's storage layout.
        deal(BASE_USDC, tipper, 100 * ONE_USDC);
    }

    function test_TipWithRealUsdc() public {
        assertGt(BASE_USDC.code.length, 0, "no USDC on this chain - is the fork running?");

        vm.startPrank(tipper);
        usdc.approve(address(jar), 25 * ONE_USDC);
        jar.tip(25 * ONE_USDC, "real usdc");
        vm.stopPrank();

        assertEq(jar.balance(), 25 * ONE_USDC);
        assertEq(usdc.balanceOf(address(jar)), 25 * ONE_USDC);
        assertEq(jar.getTip(0).message, "real usdc");

        vm.prank(owner);
        jar.withdrawAll();
        assertEq(usdc.balanceOf(owner), 25 * ONE_USDC);
    }
}
