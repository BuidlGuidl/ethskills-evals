// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Test } from "forge-std/Test.sol";
import { TipJar } from "../contracts/TipJar.sol";
import { MockUSDC } from "../contracts/test/MockUSDC.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract TipJarTest is Test {
    TipJar internal jar;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant ONE_USDC = 1e6;

    event TipReceived(uint256 indexed index, address indexed sender, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(owner, address(usdc));

        usdc.mint(alice, 1000 * ONE_USDC);
        usdc.mint(bob, 1000 * ONE_USDC);
    }

    function _tip(address from, uint256 amount, string memory message) internal returns (uint256) {
        vm.startPrank(from);
        usdc.approve(address(jar), amount);
        uint256 index = jar.tip(amount, message);
        vm.stopPrank();
        return index;
    }

    function test_Constructor_SetsOwnerAndToken() public view {
        assertEq(jar.owner(), owner);
        assertEq(address(jar.token()), address(usdc));
        assertEq(jar.tipCount(), 0);
        assertEq(jar.totalTipped(), 0);
    }

    function test_Constructor_RevertsOnZeroToken() public {
        vm.expectRevert(TipJar.InvalidRecipient.selector);
        new TipJar(owner, address(0));
    }

    function test_Tip_MovesTokensAndRecordsFeedEntry() public {
        _tip(alice, 5 * ONE_USDC, "coffee on me");

        assertEq(usdc.balanceOf(address(jar)), 5 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 995 * ONE_USDC);
        assertEq(jar.balance(), 5 * ONE_USDC);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 5 * ONE_USDC);
        assertEq(jar.tipCount(), 1);

        TipJar.Tip memory t = jar.getTip(0);
        assertEq(t.sender, alice);
        assertEq(t.amount, 5 * ONE_USDC);
        assertEq(t.message, "coffee on me");
        assertEq(t.timestamp, block.timestamp);
    }

    function test_Tip_EmitsEvent() public {
        vm.startPrank(alice);
        usdc.approve(address(jar), 2 * ONE_USDC);
        vm.expectEmit(true, true, false, true, address(jar));
        emit TipReceived(0, alice, 2 * ONE_USDC, "hi", block.timestamp);
        jar.tip(2 * ONE_USDC, "hi");
        vm.stopPrank();
    }

    function test_Tip_AllowsEmptyMessage() public {
        _tip(alice, ONE_USDC, "");
        assertEq(jar.getTip(0).message, "");
    }

    function test_Tip_AccumulatesPerSender() public {
        _tip(alice, ONE_USDC, "one");
        _tip(alice, 2 * ONE_USDC, "two");
        _tip(bob, 4 * ONE_USDC, "three");

        assertEq(jar.tippedBy(alice), 3 * ONE_USDC);
        assertEq(jar.tippedBy(bob), 4 * ONE_USDC);
        assertEq(jar.totalTipped(), 7 * ONE_USDC);
        assertEq(jar.tipCount(), 3);
    }

    function test_Tip_RevertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.AmountMustBePositive.selector);
        jar.tip(0, "nothing");
    }

    function test_Tip_RevertsOnOverlongMessage() public {
        string memory long = new string(281);
        vm.startPrank(alice);
        usdc.approve(address(jar), ONE_USDC);
        vm.expectRevert(abi.encodeWithSelector(TipJar.MessageTooLong.selector, 281, 280));
        jar.tip(ONE_USDC, long);
        vm.stopPrank();
    }

    function test_Tip_AcceptsMessageAtMaxLength() public {
        string memory atMax = new string(280);
        vm.startPrank(alice);
        usdc.approve(address(jar), ONE_USDC);
        jar.tip(ONE_USDC, atMax);
        vm.stopPrank();
        assertEq(bytes(jar.getTip(0).message).length, 280);
    }

    function test_Tip_RevertsWithoutApproval() public {
        vm.prank(alice);
        vm.expectRevert();
        jar.tip(ONE_USDC, "no approval");
    }

    function test_Tip_RevertsWhenBalanceTooLow() public {
        vm.startPrank(alice);
        usdc.approve(address(jar), 5000 * ONE_USDC);
        vm.expectRevert();
        jar.tip(5000 * ONE_USDC, "too much");
        vm.stopPrank();
    }

    function test_GetRecentTips_ReturnsNewestFirst() public {
        _tip(alice, ONE_USDC, "first");
        _tip(bob, 2 * ONE_USDC, "second");
        _tip(alice, 3 * ONE_USDC, "third");

        TipJar.Tip[] memory page = jar.getRecentTips(10);
        assertEq(page.length, 3);
        assertEq(page[0].message, "third");
        assertEq(page[1].message, "second");
        assertEq(page[2].message, "first");
    }

    function test_GetRecentTips_RespectsLimit() public {
        _tip(alice, ONE_USDC, "first");
        _tip(bob, ONE_USDC, "second");
        _tip(alice, ONE_USDC, "third");

        TipJar.Tip[] memory page = jar.getRecentTips(2);
        assertEq(page.length, 2);
        assertEq(page[0].message, "third");
        assertEq(page[1].message, "second");
    }

    function test_GetRecentTips_EmptyFeed() public view {
        assertEq(jar.getRecentTips(10).length, 0);
    }

    function test_GetTips_PagesNewestFirst() public {
        for (uint256 i = 0; i < 5; ++i) {
            _tip(alice, ONE_USDC, vm.toString(i));
        }

        TipJar.Tip[] memory first = jar.getTips(0, 2);
        assertEq(first.length, 2);
        assertEq(first[0].message, "4");
        assertEq(first[1].message, "3");

        TipJar.Tip[] memory second = jar.getTips(2, 2);
        assertEq(second.length, 2);
        assertEq(second[0].message, "2");
        assertEq(second[1].message, "1");

        // Final page is short rather than reverting.
        TipJar.Tip[] memory last = jar.getTips(4, 2);
        assertEq(last.length, 1);
        assertEq(last[0].message, "0");

        // Past the end is empty.
        assertEq(jar.getTips(5, 2).length, 0);
        assertEq(jar.getTips(99, 2).length, 0);
    }

    function test_GetTip_RevertsOutOfBounds() public {
        vm.expectRevert();
        jar.getTip(0);
    }

    function test_Withdraw_SendsFullBalanceToOwner() public {
        _tip(alice, 5 * ONE_USDC, "a");
        _tip(bob, 3 * ONE_USDC, "b");

        vm.expectEmit(true, false, false, true, address(jar));
        emit Withdrawn(owner, 8 * ONE_USDC);
        vm.prank(owner);
        jar.withdraw();

        assertEq(usdc.balanceOf(owner), 8 * ONE_USDC);
        assertEq(jar.balance(), 0);
        // The feed survives withdrawal.
        assertEq(jar.tipCount(), 2);
        assertEq(jar.totalTipped(), 8 * ONE_USDC);
    }

    function test_WithdrawTo_SendsToChosenAddress() public {
        _tip(alice, 5 * ONE_USDC, "a");

        vm.prank(owner);
        jar.withdrawTo(bob);

        assertEq(usdc.balanceOf(bob), 1000 * ONE_USDC + 5 * ONE_USDC);
        assertEq(jar.balance(), 0);
    }

    function test_Withdraw_RevertsForNonOwner() public {
        _tip(alice, ONE_USDC, "a");

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        jar.withdraw();
    }

    function test_WithdrawTo_RevertsForNonOwner() public {
        _tip(alice, ONE_USDC, "a");

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        jar.withdrawTo(bob);
    }

    function test_Withdraw_RevertsWhenEmpty() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw();
    }

    function test_WithdrawTo_RevertsOnZeroAddress() public {
        _tip(alice, ONE_USDC, "a");
        vm.prank(owner);
        vm.expectRevert(TipJar.InvalidRecipient.selector);
        jar.withdrawTo(address(0));
    }

    function test_Withdraw_CanRunAgainAfterMoreTips() public {
        _tip(alice, ONE_USDC, "a");
        vm.prank(owner);
        jar.withdraw();

        _tip(bob, 2 * ONE_USDC, "b");
        vm.prank(owner);
        jar.withdraw();

        assertEq(usdc.balanceOf(owner), 3 * ONE_USDC);
        assertEq(jar.totalTipped(), 3 * ONE_USDC);
    }

    function testFuzz_Tip_RecordsAnyPositiveAmount(uint128 amount, string calldata message) public {
        vm.assume(amount > 0);
        vm.assume(bytes(message).length <= 280);

        usdc.mint(alice, amount);
        uint256 before = usdc.balanceOf(alice);

        vm.startPrank(alice);
        usdc.approve(address(jar), amount);
        uint256 index = jar.tip(amount, message);
        vm.stopPrank();

        assertEq(index, 0);
        assertEq(jar.balance(), amount);
        assertEq(jar.totalTipped(), amount);
        assertEq(usdc.balanceOf(alice), before - amount);

        TipJar.Tip memory t = jar.getTip(index);
        assertEq(t.amount, amount);
        assertEq(t.sender, alice);
        assertEq(t.message, message);
    }

    function testFuzz_Withdraw_AlwaysDrainsBalance(uint96 a, uint96 b) public {
        vm.assume(a > 0 && b > 0);
        usdc.mint(alice, a);
        usdc.mint(bob, b);

        _tip(alice, a, "a");
        _tip(bob, b, "b");

        vm.prank(owner);
        jar.withdraw();

        assertEq(jar.balance(), 0);
        assertEq(usdc.balanceOf(owner), uint256(a) + uint256(b));
    }
}
