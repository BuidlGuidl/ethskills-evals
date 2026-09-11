// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { TipJar } from "../contracts/TipJar.sol";
import { MockUSDC, FeeOnTransferUSDC } from "./mocks/MockUSDC.sol";

contract TipJarTest is Test {
    MockUSDC usdc;
    TipJar jar;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant ONE_USDC = 1e6;

    event NewTip(uint256 indexed index, address indexed from, uint256 amount, string message);
    event Withdrawn(address indexed to, uint256 amount);

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(IERC20(address(usdc)), owner);

        usdc.mint(alice, 1000 * ONE_USDC);
        usdc.mint(bob, 1000 * ONE_USDC);

        vm.prank(alice);
        usdc.approve(address(jar), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(jar), type(uint256).max);
    }

    function _tip(address from, uint256 amount, string memory message) internal returns (uint256) {
        vm.prank(from);
        return jar.tip(amount, message);
    }

    function test_Deployment() public view {
        assertEq(address(jar.token()), address(usdc));
        assertEq(jar.owner(), owner);
        assertEq(jar.tipCount(), 0);
        assertEq(jar.totalTipped(), 0);
        assertEq(jar.balance(), 0);
    }

    function test_ConstructorRejectsZeroToken() public {
        vm.expectRevert("TipJar: token is the zero address");
        new TipJar(IERC20(address(0)), owner);
    }

    function test_TipMovesTokensAndRecordsFeedEntry() public {
        vm.warp(1_735_689_600); // 2025-01-01, so the stored timestamp is a realistic value

        vm.expectEmit(true, true, false, true, address(jar));
        emit NewTip(0, alice, 5 * ONE_USDC, "coffee money");

        uint256 index = _tip(alice, 5 * ONE_USDC, "coffee money");

        assertEq(index, 0);
        assertEq(usdc.balanceOf(address(jar)), 5 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 995 * ONE_USDC);
        assertEq(jar.balance(), 5 * ONE_USDC);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.totalTippedBy(alice), 5 * ONE_USDC);
        assertEq(jar.tipCount(), 1);

        TipJar.Tip memory t = jar.getTip(0);
        assertEq(t.from, alice);
        assertEq(t.amount, uint128(5 * ONE_USDC));
        assertEq(t.timestamp, uint64(block.timestamp));
        assertEq(t.message, "coffee money");
    }

    function test_TipAccumulatesPerSender() public {
        _tip(alice, 5 * ONE_USDC, "one");
        _tip(bob, 2 * ONE_USDC, "two");
        _tip(alice, 3 * ONE_USDC, "three");

        assertEq(jar.tipCount(), 3);
        assertEq(jar.totalTipped(), 10 * ONE_USDC);
        assertEq(jar.totalTippedBy(alice), 8 * ONE_USDC);
        assertEq(jar.totalTippedBy(bob), 2 * ONE_USDC);
        assertEq(jar.balance(), 10 * ONE_USDC);
    }

    function test_TipAcceptsEmptyMessage() public {
        _tip(alice, ONE_USDC, "");
        assertEq(jar.getTip(0).message, "");
    }

    function test_TipAcceptsMessageAtMaxLength() public {
        string memory message = _stringOfLength(jar.MAX_MESSAGE_LENGTH());
        _tip(alice, ONE_USDC, message);
        assertEq(bytes(jar.getTip(0).message).length, jar.MAX_MESSAGE_LENGTH());
    }

    function test_RevertWhen_MessageTooLong() public {
        string memory message = _stringOfLength(jar.MAX_MESSAGE_LENGTH() + 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TipJar.MessageTooLong.selector, jar.MAX_MESSAGE_LENGTH() + 1));
        jar.tip(ONE_USDC, message);
    }

    function test_RevertWhen_TipIsZero() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nothing");
    }

    function test_RevertWhen_AllowanceMissing() public {
        address carol = makeAddr("carol");
        usdc.mint(carol, ONE_USDC);

        vm.prank(carol);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(jar), 0, ONE_USDC)
        );
        jar.tip(ONE_USDC, "no approval");

        assertEq(jar.tipCount(), 0);
    }

    function test_RevertWhen_BalanceTooLow() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, alice, 1000 * ONE_USDC, 1001 * ONE_USDC
            )
        );
        jar.tip(1001 * ONE_USDC, "too much");
    }

    function test_FeedIsNewestFirstAndPaginates() public {
        _tip(alice, ONE_USDC, "first");
        _tip(bob, 2 * ONE_USDC, "second");
        _tip(alice, 3 * ONE_USDC, "third");

        TipJar.Tip[] memory page = jar.getLatestTips(0, 10);
        assertEq(page.length, 3);
        assertEq(page[0].message, "third");
        assertEq(page[1].message, "second");
        assertEq(page[2].message, "first");

        page = jar.getLatestTips(0, 2);
        assertEq(page.length, 2);
        assertEq(page[0].message, "third");
        assertEq(page[1].message, "second");

        page = jar.getLatestTips(2, 2);
        assertEq(page.length, 1);
        assertEq(page[0].message, "first");
    }

    function test_FeedReturnsEmptyPageOutOfRange() public {
        assertEq(jar.getLatestTips(0, 10).length, 0);

        _tip(alice, ONE_USDC, "only");
        assertEq(jar.getLatestTips(1, 10).length, 0);
        assertEq(jar.getLatestTips(0, 0).length, 0);
    }

    function test_RevertWhen_TipIndexOutOfBounds() public {
        vm.expectRevert();
        jar.getTip(0);
    }

    function test_OwnerWithdrawsPartialAmount() public {
        _tip(alice, 10 * ONE_USDC, "thanks");

        vm.expectEmit(true, false, false, true, address(jar));
        emit Withdrawn(owner, 4 * ONE_USDC);

        vm.prank(owner);
        jar.withdraw(4 * ONE_USDC);

        assertEq(usdc.balanceOf(owner), 4 * ONE_USDC);
        assertEq(jar.balance(), 6 * ONE_USDC);
        // The feed is a permanent record; withdrawing does not rewrite history.
        assertEq(jar.totalTipped(), 10 * ONE_USDC);
        assertEq(jar.tipCount(), 1);
    }

    function test_OwnerWithdrawsAll() public {
        _tip(alice, 10 * ONE_USDC, "thanks");

        vm.prank(owner);
        jar.withdrawAll();

        assertEq(usdc.balanceOf(owner), 10 * ONE_USDC);
        assertEq(jar.balance(), 0);
    }

    function test_RevertWhen_NonOwnerWithdraws() public {
        _tip(alice, 10 * ONE_USDC, "thanks");

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        jar.withdraw(ONE_USDC);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        jar.withdrawAll();
    }

    function test_RevertWhen_WithdrawExceedsBalance() public {
        _tip(alice, 10 * ONE_USDC, "thanks");

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(TipJar.AmountExceedsBalance.selector, 11 * ONE_USDC, 10 * ONE_USDC));
        jar.withdraw(11 * ONE_USDC);
    }

    function test_RevertWhen_WithdrawZeroOrEmpty() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdrawAll();

        vm.prank(owner);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.withdraw(0);
    }

    function test_FeeOnTransferTokenRecordsWhatArrived() public {
        FeeOnTransferUSDC feeToken = new FeeOnTransferUSDC();
        TipJar feeJar = new TipJar(IERC20(address(feeToken)), owner);

        feeToken.mint(alice, 100 * ONE_USDC);
        vm.startPrank(alice);
        feeToken.approve(address(feeJar), type(uint256).max);
        feeJar.tip(100 * ONE_USDC, "taxed");
        vm.stopPrank();

        uint256 arrived = 99 * ONE_USDC;
        assertEq(feeToken.balanceOf(address(feeJar)), arrived);
        assertEq(feeJar.getTip(0).amount, uint128(arrived));
        assertEq(feeJar.totalTipped(), arrived);
        assertEq(feeJar.totalTippedBy(alice), arrived);
    }

    function testFuzz_TipRecordsAmountAndKeepsAccountingConsistent(uint96 amount, string calldata message) public {
        amount = uint96(bound(amount, 1, 1000 * ONE_USDC));
        vm.assume(bytes(message).length <= jar.MAX_MESSAGE_LENGTH());

        _tip(alice, amount, message);

        TipJar.Tip memory t = jar.getTip(0);
        assertEq(t.amount, uint128(amount));
        assertEq(t.from, alice);
        assertEq(t.message, message);
        assertEq(jar.totalTipped(), amount);
        assertEq(jar.balance(), amount);
        assertEq(usdc.balanceOf(alice), 1000 * ONE_USDC - amount);
    }

    function testFuzz_FeedPaginationCoversEveryTipExactlyOnce(uint8 tipCount, uint8 pageSize) public {
        uint256 total = bound(tipCount, 1, 25);
        uint256 limit = bound(pageSize, 1, 10);

        for (uint256 i = 0; i < total; ++i) {
            _tip(alice, ONE_USDC, vm.toString(i));
        }

        uint256 seen;
        for (uint256 offset = 0; offset < total; offset += limit) {
            TipJar.Tip[] memory page = jar.getLatestTips(offset, limit);
            for (uint256 i = 0; i < page.length; ++i) {
                // Newest first: the tip at global position `offset + i` from the end.
                assertEq(page[i].message, vm.toString(total - 1 - (offset + i)));
                seen++;
            }
        }
        assertEq(seen, total);
    }

    function _stringOfLength(uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(length);
        for (uint256 i = 0; i < length; ++i) {
            buffer[i] = "a";
        }
        return string(buffer);
    }
}
