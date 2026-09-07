// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

/**
 * @notice Integration test against the real USDC deployed on Base.
 * @dev Unit tests use a mock, which proves the jar's own logic but says nothing about the
 *      token it will actually meet in production: real USDC is a proxy whose `transfer`
 *      returns a bool and whose implementation can blocklist. This suite runs the same flow
 *      against the real thing, funded by impersonating an existing holder.
 *
 *      Off by default because it needs network access. Run with:
 *          FORK_TESTS=true yarn test
 *          FORK_TESTS=true BASE_RPC_URL=https://... yarn test   # your own RPC
 */
contract TipJarForkTest is Test {
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    /// @dev Aave's aBasUSDC reserve — an existing Base USDC holder with tens of millions on hand.
    address internal constant USDC_WHALE = 0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB;

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

        vm.createSelectFork(vm.envOr("BASE_RPC_URL", string("https://mainnet.base.org")));
        jar = new TipJar(usdc, owner);

        vm.prank(USDC_WHALE);
        usdc.transfer(tipper, 1000 * ONE_USDC);
    }

    function test_Fork_UsesRealBaseUsdc() public view {
        assertEq(address(jar.token()), BASE_USDC);
        assertEq(jar.tokenDecimals(), 6, "Base USDC has 6 decimals");
        assertGe(usdc.balanceOf(tipper), 1000 * ONE_USDC);
    }

    function test_Fork_TipAndWithdrawRoundTrip() public {
        vm.startPrank(tipper);
        usdc.approve(address(jar), 250 * ONE_USDC);
        jar.tip(250 * ONE_USDC, "tipped with real USDC");
        vm.stopPrank();

        assertEq(jar.jarBalance(), 250 * ONE_USDC);
        assertEq(jar.totalTipped(), 250 * ONE_USDC);

        TipJar.Tip[] memory feed = jar.getTips(0, 10);
        assertEq(feed.length, 1);
        assertEq(feed[0].sender, tipper);
        assertEq(feed[0].message, "tipped with real USDC");

        uint256 ownerBefore = usdc.balanceOf(owner);
        vm.prank(owner);
        jar.withdrawAll();

        assertEq(usdc.balanceOf(owner) - ownerBefore, 250 * ONE_USDC);
        assertEq(jar.jarBalance(), 0);
    }

    function test_Fork_RevertsWhenApprovalIsTooSmall() public {
        vm.startPrank(tipper);
        usdc.approve(address(jar), 10 * ONE_USDC);
        vm.expectRevert(); // real USDC reverts with a string, not a custom error
        jar.tip(11 * ONE_USDC, "over the allowance");
        vm.stopPrank();
    }
}
