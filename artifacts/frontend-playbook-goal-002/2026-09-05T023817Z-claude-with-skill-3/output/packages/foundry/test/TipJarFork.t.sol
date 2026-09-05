// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../contracts/TipJar.sol";

/**
 * Runs the jar against the real USDC contract on a Base fork, so the token's
 * actual (proxied, 6 decimal) implementation is exercised — not a mock.
 *
 * Needs network access to the Base RPC in foundry.toml. Skip it with:
 *   forge test --no-match-contract TipJarForkTest
 */
contract TipJarForkTest is Test {
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    TipJar tipJar;
    IERC20 usdc = IERC20(BASE_USDC);

    address owner = makeAddr("owner");
    address tipper = makeAddr("tipper");

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("base"));
        tipJar = new TipJar(owner, BASE_USDC);
        deal(BASE_USDC, tipper, 100e6);
    }

    function testTipRealUsdcOnBaseFork() public {
        assertEq(usdc.balanceOf(tipper), 100e6, "fork funding failed");

        vm.startPrank(tipper);
        usdc.approve(address(tipJar), 25e6);
        tipJar.tip(25e6, "gm from a Base fork");
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(tipJar)), 25e6);
        assertEq(tipJar.totalTipped(), 25e6);
        assertEq(tipJar.recentTips(1)[0].message, "gm from a Base fork");

        vm.prank(owner);
        tipJar.withdraw();
        assertEq(usdc.balanceOf(owner), 25e6);
    }
}
