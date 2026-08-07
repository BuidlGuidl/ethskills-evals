// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TipJar} from "../src/TipJar.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract TipJarTest is Test {
    MockUSDC internal usdc;
    TipJar internal jar;

    address internal owner = address(0xABCD);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(address(usdc), owner);

        usdc.mint(alice, 1_000e6);
        usdc.mint(bob, 1_000e6);
    }

    function _tip(address who, uint256 amount, string memory msg_) internal {
        vm.startPrank(who);
        usdc.approve(address(jar), amount);
        jar.tip(amount, msg_);
        vm.stopPrank();
    }

    function test_TipRecordsFeedAndTransfersUsdc() public {
        _tip(alice, 10e6, "gm");

        assertEq(jar.tipCount(), 1);
        assertEq(jar.balance(), 10e6);
        assertEq(jar.totalTipped(), 10e6);
        assertEq(usdc.balanceOf(alice), 990e6);

        TipJar.Tip memory t = jar.getTip(0);
        assertEq(t.from, alice);
        assertEq(t.amount, 10e6);
        assertEq(t.message, "gm");
        assertEq(t.timestamp, block.timestamp);
    }

    function test_GetRecentTipsNewestFirst() public {
        _tip(alice, 1e6, "first");
        _tip(bob, 2e6, "second");
        _tip(alice, 3e6, "third");

        TipJar.Tip[] memory recent = jar.getRecentTips(2);
        assertEq(recent.length, 2);
        assertEq(recent[0].message, "third");
        assertEq(recent[1].message, "second");

        // Requesting more than exist returns all of them.
        TipJar.Tip[] memory all = jar.getRecentTips(50);
        assertEq(all.length, 3);
    }

    function test_RevertOnZeroAmount() public {
        vm.startPrank(alice);
        usdc.approve(address(jar), 1e6);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nope");
        vm.stopPrank();
    }

    function test_RevertOnMessageTooLong() public {
        string memory long = new string(281);
        vm.startPrank(alice);
        usdc.approve(address(jar), 1e6);
        vm.expectRevert(TipJar.MessageTooLong.selector);
        jar.tip(1e6, long);
        vm.stopPrank();
    }

    function test_RevertWhenNotApproved() public {
        vm.prank(alice);
        vm.expectRevert(); // SafeERC20 / allowance failure
        jar.tip(1e6, "no approval");
    }

    function test_OwnerCanWithdraw() public {
        _tip(alice, 10e6, "gm");
        _tip(bob, 5e6, "ty");

        uint256 before = usdc.balanceOf(owner);
        vm.prank(owner);
        jar.withdraw();

        assertEq(usdc.balanceOf(owner), before + 15e6);
        assertEq(jar.balance(), 0);
        // Feed history is preserved after withdrawal.
        assertEq(jar.tipCount(), 2);
        assertEq(jar.totalTipped(), 15e6);
    }

    function test_NonOwnerCannotWithdraw() public {
        _tip(alice, 10e6, "gm");
        vm.prank(alice);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.withdraw();
    }

    function test_WithdrawRevertsWhenEmpty() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw();
    }

    function test_TransferOwnership() public {
        vm.prank(owner);
        jar.transferOwnership(alice);
        assertEq(jar.owner(), alice);
    }

    function testFuzz_Tip(uint256 amount) public {
        amount = bound(amount, 1, 1_000e6);
        _tip(alice, amount, "fuzz");
        assertEq(jar.balance(), amount);
        assertEq(jar.getTip(0).amount, amount);
    }
}
