// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TipJar} from "../src/TipJar.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract TipJarTest is Test {
    MockUSDC internal usdc;
    TipJar internal jar;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant ONE_USDC = 1e6;

    event TipReceived(
        uint256 indexed id, address indexed from, uint256 amount, string name, string message, uint256 timestamp
    );
    event Withdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(IERC20(address(usdc)), owner);

        usdc.mint(alice, 1_000 * ONE_USDC);
        usdc.mint(bob, 1_000 * ONE_USDC);

        vm.prank(alice);
        usdc.approve(address(jar), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(jar), type(uint256).max);
    }

    function test_constructor_setsTokenAndOwner() public view {
        assertEq(address(jar.token()), address(usdc));
        assertEq(jar.owner(), owner);
        assertEq(jar.tipCount(), 0);
        assertEq(jar.totalTipped(), 0);
    }

    function test_constructor_rejectsZeroAddresses() public {
        vm.expectRevert(TipJar.ZeroAddress.selector);
        new TipJar(IERC20(address(0)), owner);

        vm.expectRevert(TipJar.ZeroAddress.selector);
        new TipJar(IERC20(address(usdc)), address(0));
    }

    function test_tip_movesFundsAndRecordsFeedEntry() public {
        vm.expectEmit(true, true, false, true, address(jar));
        emit TipReceived(0, alice, 5 * ONE_USDC, "alice", "keep shipping", block.timestamp);

        vm.prank(alice);
        uint256 id = jar.tip(5 * ONE_USDC, "alice", "keep shipping");

        assertEq(id, 0);
        assertEq(usdc.balanceOf(address(jar)), 5 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 995 * ONE_USDC);
        assertEq(jar.balance(), 5 * ONE_USDC);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.totalTippedBy(alice), 5 * ONE_USDC);
        assertEq(jar.tipCount(), 1);

        TipJar.Tip memory t = jar.getTip(0);
        assertEq(t.from, alice);
        assertEq(t.amount, 5 * ONE_USDC);
        assertEq(t.timestamp, uint64(block.timestamp));
        assertEq(t.name, "alice");
        assertEq(t.message, "keep shipping");
    }

    function test_tip_accumulatesPerTipper() public {
        vm.startPrank(alice);
        jar.tip(2 * ONE_USDC, "alice", "one");
        jar.tip(3 * ONE_USDC, "alice", "two");
        vm.stopPrank();

        assertEq(jar.totalTippedBy(alice), 5 * ONE_USDC);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.tipCount(), 2);
    }

    function test_tip_allowsEmptyNameAndMessage() public {
        vm.prank(alice);
        jar.tip(ONE_USDC, "", "");

        TipJar.Tip memory t = jar.getTip(0);
        assertEq(t.name, "");
        assertEq(t.message, "");
    }

    function test_tip_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "alice", "nothing");
    }

    function test_tip_revertsOnOversizedName() public {
        string memory name = _repeat("a", jar.MAX_NAME_BYTES() + 1);
        vm.prank(alice);
        vm.expectRevert(TipJar.NameTooLong.selector);
        jar.tip(ONE_USDC, name, "");
    }

    function test_tip_revertsOnOversizedMessage() public {
        string memory message = _repeat("b", jar.MAX_MESSAGE_BYTES() + 1);
        vm.prank(alice);
        vm.expectRevert(TipJar.MessageTooLong.selector);
        jar.tip(ONE_USDC, "", message);
    }

    function test_tip_acceptsMaximumLengthStrings() public {
        string memory name = _repeat("a", jar.MAX_NAME_BYTES());
        string memory message = _repeat("b", jar.MAX_MESSAGE_BYTES());

        vm.prank(alice);
        jar.tip(ONE_USDC, name, message);

        assertEq(jar.tipCount(), 1);
        assertEq(bytes(jar.getTip(0).message).length, jar.MAX_MESSAGE_BYTES());
    }

    function test_tip_revertsWithoutApproval() public {
        address carol = makeAddr("carol");
        usdc.mint(carol, ONE_USDC);

        vm.prank(carol);
        vm.expectRevert();
        jar.tip(ONE_USDC, "carol", "no approval");
    }

    function test_tip_revertsWithInsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert();
        jar.tip(10_000 * ONE_USDC, "alice", "too much");
    }

    function test_getTips_returnsNewestFirst() public {
        vm.prank(alice);
        jar.tip(ONE_USDC, "alice", "first");
        vm.prank(bob);
        jar.tip(2 * ONE_USDC, "bob", "second");
        vm.prank(alice);
        jar.tip(3 * ONE_USDC, "alice", "third");

        TipJar.Tip[] memory page = jar.getTips(0, 10);
        assertEq(page.length, 3);
        assertEq(page[0].message, "third");
        assertEq(page[1].message, "second");
        assertEq(page[2].message, "first");
    }

    function test_getTips_paginates() public {
        for (uint256 i = 0; i < 5; ++i) {
            vm.prank(alice);
            jar.tip(ONE_USDC, "alice", vm.toString(i));
        }

        TipJar.Tip[] memory first = jar.getTips(0, 2);
        assertEq(first.length, 2);
        assertEq(first[0].message, "4");
        assertEq(first[1].message, "3");

        TipJar.Tip[] memory second = jar.getTips(2, 2);
        assertEq(second.length, 2);
        assertEq(second[0].message, "2");
        assertEq(second[1].message, "1");

        // Last page is short rather than out of bounds.
        TipJar.Tip[] memory third = jar.getTips(4, 2);
        assertEq(third.length, 1);
        assertEq(third[0].message, "0");
    }

    function test_getTips_returnsEmptyOutsideRange() public {
        assertEq(jar.getTips(0, 10).length, 0);

        vm.prank(alice);
        jar.tip(ONE_USDC, "alice", "only");

        assertEq(jar.getTips(1, 10).length, 0);
        assertEq(jar.getTips(0, 0).length, 0);
    }

    function test_withdraw_sendsFullBalanceWhenAmountIsZero() public {
        vm.prank(alice);
        jar.tip(7 * ONE_USDC, "alice", "thanks");

        address payee = makeAddr("payee");
        vm.expectEmit(true, false, false, true, address(jar));
        emit Withdrawn(payee, 7 * ONE_USDC);

        vm.prank(owner);
        jar.withdraw(payee, 0);

        assertEq(usdc.balanceOf(payee), 7 * ONE_USDC);
        assertEq(jar.balance(), 0);
        // History survives the withdrawal.
        assertEq(jar.totalTipped(), 7 * ONE_USDC);
        assertEq(jar.tipCount(), 1);
    }

    function test_withdraw_sendsPartialAmount() public {
        vm.prank(alice);
        jar.tip(10 * ONE_USDC, "alice", "thanks");

        vm.prank(owner);
        jar.withdraw(owner, 4 * ONE_USDC);

        assertEq(usdc.balanceOf(owner), 4 * ONE_USDC);
        assertEq(jar.balance(), 6 * ONE_USDC);
    }

    function test_withdraw_onlyOwner() public {
        vm.prank(alice);
        jar.tip(ONE_USDC, "alice", "hi");

        vm.prank(alice);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.withdraw(alice, 0);
    }

    function test_withdraw_revertsWhenEmptyOrOverdrawn() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw(owner, 0);

        vm.prank(alice);
        jar.tip(ONE_USDC, "alice", "hi");

        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw(owner, 2 * ONE_USDC);
    }

    function test_withdraw_revertsOnZeroRecipient() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.ZeroAddress.selector);
        jar.withdraw(address(0), 0);
    }

    function test_transferOwnership() public {
        vm.expectEmit(true, true, false, false, address(jar));
        emit OwnershipTransferred(owner, alice);

        vm.prank(owner);
        jar.transferOwnership(alice);
        assertEq(jar.owner(), alice);

        vm.prank(owner);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.transferOwnership(bob);
    }

    function test_transferOwnership_rejectsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.ZeroAddress.selector);
        jar.transferOwnership(address(0));
    }

    function testFuzz_tip(uint96 amount, address tipper) public {
        vm.assume(tipper != address(0) && tipper != address(jar));
        amount = uint96(bound(amount, 1, type(uint96).max));

        usdc.mint(tipper, amount);
        vm.startPrank(tipper);
        usdc.approve(address(jar), amount);
        jar.tip(amount, "fuzz", "fuzz");
        vm.stopPrank();

        assertEq(jar.totalTipped(), amount);
        assertEq(jar.totalTippedBy(tipper), amount);
        assertEq(usdc.balanceOf(address(jar)), amount);
        assertEq(jar.getTip(0).amount, amount);
    }

    function _repeat(string memory char, uint256 times) internal pure returns (string memory out) {
        for (uint256 i = 0; i < times; ++i) {
            out = string.concat(out, char);
        }
    }
}
