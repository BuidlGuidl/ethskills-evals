// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TipJar} from "../src/TipJar.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract TipJarTest is Test {
    MockUSDC usdc;
    TipJar jar;

    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant ONE_USDC = 1e6;

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(address(usdc));

        usdc.mint(alice, 100 * ONE_USDC);
        usdc.mint(bob, 100 * ONE_USDC);
    }

    function _tip(address who, uint256 amount, string memory message) internal {
        vm.startPrank(who);
        usdc.approve(address(jar), amount);
        jar.tip(amount, message);
        vm.stopPrank();
    }

    function test_TipRecordsFeedAndTransfersUSDC() public {
        _tip(alice, 5 * ONE_USDC, "gm");

        assertEq(usdc.balanceOf(address(jar)), 5 * ONE_USDC);
        assertEq(jar.balance(), 5 * ONE_USDC);
        assertEq(jar.tipCount(), 1);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 5 * ONE_USDC);

        TipJar.Tip memory t = jar.getTip(0);
        assertEq(t.tipper, alice);
        assertEq(t.amount, 5 * ONE_USDC);
        assertEq(t.message, "gm");
    }

    function test_RecentTipsNewestFirst() public {
        _tip(alice, 1 * ONE_USDC, "first");
        _tip(bob, 2 * ONE_USDC, "second");
        _tip(alice, 3 * ONE_USDC, "third");

        TipJar.Tip[] memory recent = jar.getRecentTips(2);
        assertEq(recent.length, 2);
        assertEq(recent[0].message, "third");
        assertEq(recent[1].message, "second");
    }

    function test_RecentTipsClampsToTotal() public {
        _tip(alice, 1 * ONE_USDC, "only");
        TipJar.Tip[] memory recent = jar.getRecentTips(50);
        assertEq(recent.length, 1);
    }

    function test_RevertOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nope");
    }

    function test_RevertWithoutApproval() public {
        vm.prank(alice);
        vm.expectRevert();
        jar.tip(ONE_USDC, "no approval");
    }

    function test_OwnerCanWithdraw() public {
        _tip(alice, 10 * ONE_USDC, "thanks");

        uint256 before = usdc.balanceOf(owner);
        jar.withdraw();
        assertEq(usdc.balanceOf(owner), before + 10 * ONE_USDC);
        assertEq(jar.balance(), 0);
    }

    function test_NonOwnerCannotWithdraw() public {
        _tip(alice, 10 * ONE_USDC, "thanks");
        vm.prank(bob);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.withdraw();
    }

    function test_WithdrawRevertsWhenEmpty() public {
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw();
    }

    function test_ConstructorRejectsZeroAddress() public {
        vm.expectRevert(TipJar.ZeroAddress.selector);
        new TipJar(address(0));
    }

    function test_TransferOwnership() public {
        jar.transferOwnership(alice);
        assertEq(jar.owner(), alice);

        _tip(bob, ONE_USDC, "hi");
        vm.prank(alice);
        jar.withdraw();
        assertEq(usdc.balanceOf(alice), 100 * ONE_USDC + ONE_USDC);
    }
}
