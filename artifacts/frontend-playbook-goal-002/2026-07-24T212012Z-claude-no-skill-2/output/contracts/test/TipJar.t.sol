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

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(address(usdc));
        usdc.mint(alice, 1_000 * 10 ** 6);
        usdc.mint(bob, 1_000 * 10 ** 6);
    }

    function _tipAs(address who, uint256 amount, string memory message) internal {
        vm.startPrank(who);
        usdc.approve(address(jar), amount);
        jar.tip(amount, message);
        vm.stopPrank();
    }

    function test_TipRecordsAndTransfers() public {
        _tipAs(alice, 10 * 10 ** 6, "hello");

        assertEq(usdc.balanceOf(address(jar)), 10 * 10 ** 6);
        assertEq(jar.totalTipped(), 10 * 10 ** 6);
        assertEq(jar.tipCount(), 1);

        TipJar.Tip[] memory all = jar.getAllTips();
        assertEq(all.length, 1);
        assertEq(all[0].from, alice);
        assertEq(all[0].amount, 10 * 10 ** 6);
        assertEq(all[0].message, "hello");
    }

    function test_TipRequiresApproval() public {
        vm.prank(alice);
        vm.expectRevert(); // insufficient allowance
        jar.tip(10 * 10 ** 6, "no approve");
    }

    function test_ZeroAmountReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(jar), 10 * 10 ** 6);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nope");
        vm.stopPrank();
    }

    function test_RecentTipsAreNewestFirst() public {
        _tipAs(alice, 1 * 10 ** 6, "first");
        _tipAs(bob, 2 * 10 ** 6, "second");
        _tipAs(alice, 3 * 10 ** 6, "third");

        TipJar.Tip[] memory recent = jar.getRecentTips(2);
        assertEq(recent.length, 2);
        assertEq(recent[0].message, "third");
        assertEq(recent[1].message, "second");
    }

    function test_RecentTipsClampsToCount() public {
        _tipAs(alice, 1 * 10 ** 6, "only");
        TipJar.Tip[] memory recent = jar.getRecentTips(50);
        assertEq(recent.length, 1);
    }

    function test_OnlyOwnerWithdraws() public {
        _tipAs(alice, 100 * 10 ** 6, "for you");

        vm.prank(bob);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.withdraw();

        uint256 before = usdc.balanceOf(owner);
        jar.withdraw();
        assertEq(usdc.balanceOf(owner), before + 100 * 10 ** 6);
        assertEq(usdc.balanceOf(address(jar)), 0);
    }

    function test_WithdrawNothingReverts() public {
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw();
    }

    function test_TransferOwnership() public {
        jar.transferOwnership(alice);
        assertEq(jar.owner(), alice);

        _tipAs(bob, 5 * 10 ** 6, "hi");
        vm.prank(alice);
        jar.withdraw();
        assertEq(usdc.balanceOf(alice), 1_000 * 10 ** 6 + 5 * 10 ** 6);
    }
}
