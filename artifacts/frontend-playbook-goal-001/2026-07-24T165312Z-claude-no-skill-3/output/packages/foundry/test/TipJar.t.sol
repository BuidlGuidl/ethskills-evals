// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

/// @dev 6-decimal token that mimics USDC for unit tests (no fork required).
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract TipJarTest is Test {
    MockUSDC usdc;
    TipJar jar;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant ONE_USDC = 1e6;

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(IERC20(address(usdc)), owner);
        usdc.mint(alice, 100 * ONE_USDC);
        usdc.mint(bob, 100 * ONE_USDC);
    }

    function _tip(address who, uint256 amount, string memory message) internal {
        vm.startPrank(who);
        usdc.approve(address(jar), amount);
        jar.tip(amount, message);
        vm.stopPrank();
    }

    function test_TipPullsUsdcAndRecordsFeed() public {
        _tip(alice, 5 * ONE_USDC, "gm");

        assertEq(usdc.balanceOf(address(jar)), 5 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 95 * ONE_USDC);
        assertEq(jar.tipCount(), 1);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.totalTippedBy(alice), 5 * ONE_USDC);

        (address from, uint256 amount, string memory message,) = jar.tips(0);
        assertEq(from, alice);
        assertEq(amount, 5 * ONE_USDC);
        assertEq(message, "gm");
    }

    function test_TipEmitsEvent() public {
        vm.startPrank(alice);
        usdc.approve(address(jar), 2 * ONE_USDC);
        vm.expectEmit(true, false, false, true);
        emit TipJar.Tipped(alice, 2 * ONE_USDC, "thanks", block.timestamp);
        jar.tip(2 * ONE_USDC, "thanks");
        vm.stopPrank();
    }

    function test_RecentTipsNewestFirstAndClamped() public {
        _tip(alice, 1 * ONE_USDC, "one");
        _tip(bob, 2 * ONE_USDC, "two");
        _tip(alice, 3 * ONE_USDC, "three");

        TipJar.TipEntry[] memory recent = jar.recentTips(2);
        assertEq(recent.length, 2);
        assertEq(recent[0].message, "three");
        assertEq(recent[1].message, "two");

        // Asking for more than exists returns everything.
        assertEq(jar.recentTips(50).length, 3);
    }

    function test_TipRevertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nope");
    }

    function test_TipRevertsWithoutApproval() public {
        vm.prank(alice);
        vm.expectRevert();
        jar.tip(ONE_USDC, "no approval");
    }

    function test_OwnerWithdrawsCollectedBalance() public {
        _tip(alice, 5 * ONE_USDC, "a");
        _tip(bob, 3 * ONE_USDC, "b");

        assertEq(jar.balance(), 8 * ONE_USDC);

        vm.prank(owner);
        jar.withdraw();

        assertEq(usdc.balanceOf(owner), 8 * ONE_USDC);
        assertEq(jar.balance(), 0);
    }

    function test_WithdrawRevertsForNonOwner() public {
        _tip(alice, ONE_USDC, "a");
        vm.prank(alice);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.withdraw();
    }

    function test_WithdrawRevertsWhenEmpty() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw();
    }
}
