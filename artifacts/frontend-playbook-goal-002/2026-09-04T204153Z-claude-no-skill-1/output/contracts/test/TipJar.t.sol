// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TipJar} from "../src/TipJar.sol";
import {MockUSDC, FeeOnTransferToken, FalseReturningToken, NoReturnToken, ReentrantToken} from "./mocks/MockUSDC.sol";

contract TipJarTest is Test {
    MockUSDC internal usdc;
    TipJar internal jar;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant ONE_USDC = 1e6;

    event TipReceived(uint256 indexed index, address indexed sender, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(address(usdc), owner);

        usdc.mint(alice, 1_000 * ONE_USDC);
        usdc.mint(bob, 1_000 * ONE_USDC);

        vm.prank(alice);
        usdc.approve(address(jar), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(jar), type(uint256).max);
    }

    function _tip(address from, uint256 amount, string memory message) internal returns (uint256) {
        vm.prank(from);
        return jar.tip(amount, message);
    }

    /* ---------------------------------------------------------------- setup */

    function test_constructor_setsTokenAndOwner() public view {
        assertEq(address(jar.token()), address(usdc));
        assertEq(jar.owner(), owner);
        assertEq(jar.tipCount(), 0);
        assertEq(jar.totalTipped(), 0);
    }

    function test_constructor_rejectsZeroAddresses() public {
        vm.expectRevert(TipJar.ZeroAddress.selector);
        new TipJar(address(0), owner);

        vm.expectRevert(TipJar.ZeroAddress.selector);
        new TipJar(address(usdc), address(0));
    }

    function test_constructor_rejectsNonContractToken() public {
        vm.expectRevert(TipJar.TokenNotAContract.selector);
        new TipJar(makeAddr("not a token"), owner);
    }

    /* ----------------------------------------------------------------- tips */

    function test_tip_movesFundsAndRecordsEntry() public {
        uint256 index = _tip(alice, 5 * ONE_USDC, "thanks for the stream");

        assertEq(index, 0);
        assertEq(usdc.balanceOf(address(jar)), 5 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 995 * ONE_USDC);
        assertEq(jar.balance(), 5 * ONE_USDC);
        assertEq(jar.tipCount(), 1);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 5 * ONE_USDC);

        TipJar.Tip memory t = jar.getTip(0);
        assertEq(t.sender, alice);
        assertEq(t.amount, 5 * ONE_USDC);
        assertEq(t.timestamp, uint64(block.timestamp));
        assertEq(t.message, "thanks for the stream");
    }

    function test_tip_emitsEvent() public {
        vm.expectEmit(true, true, false, true, address(jar));
        emit TipReceived(0, alice, 2 * ONE_USDC, "hi", block.timestamp);
        _tip(alice, 2 * ONE_USDC, "hi");
    }

    function test_tip_accumulatesPerSender() public {
        _tip(alice, 3 * ONE_USDC, "one");
        _tip(bob, 7 * ONE_USDC, "two");
        _tip(alice, 4 * ONE_USDC, "three");

        assertEq(jar.tipCount(), 3);
        assertEq(jar.totalTipped(), 14 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 7 * ONE_USDC);
        assertEq(jar.tippedBy(bob), 7 * ONE_USDC);
        assertEq(jar.balance(), 14 * ONE_USDC);
    }

    function test_tip_allowsEmptyMessage() public {
        _tip(alice, ONE_USDC, "");
        assertEq(jar.getTip(0).message, "");
    }

    function test_tip_acceptsMessageAtMaxLength() public {
        string memory message = string(new bytes(200));
        _tip(alice, ONE_USDC, message);
        assertEq(bytes(jar.getTip(0).message).length, 200);
    }

    function test_tip_revertsOnOversizedMessage() public {
        string memory message = string(new bytes(201));
        vm.prank(alice);
        vm.expectRevert(TipJar.MessageTooLong.selector);
        jar.tip(ONE_USDC, message);
    }

    function test_tip_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nothing");
    }

    function test_tip_revertsWithoutAllowance() public {
        address carol = makeAddr("carol");
        usdc.mint(carol, ONE_USDC);

        vm.prank(carol);
        vm.expectRevert(TipJar.TransferFailed.selector);
        jar.tip(ONE_USDC, "no approval");
    }

    function test_tip_revertsWithoutBalance() public {
        address carol = makeAddr("carol");
        vm.prank(carol);
        usdc.approve(address(jar), type(uint256).max);

        vm.prank(carol);
        vm.expectRevert(TipJar.TransferFailed.selector);
        jar.tip(ONE_USDC, "broke");
    }

    function test_tip_recordsAmountActuallyReceived() public {
        FeeOnTransferToken feeToken = new FeeOnTransferToken();
        TipJar feeJar = new TipJar(address(feeToken), owner);
        feeToken.mint(alice, 100 * ONE_USDC);

        vm.startPrank(alice);
        feeToken.approve(address(feeJar), type(uint256).max);
        feeJar.tip(100 * ONE_USDC, "fee token");
        vm.stopPrank();

        uint256 expected = 99 * ONE_USDC; // 1% kept by the token
        assertEq(feeJar.getTip(0).amount, expected);
        assertEq(feeJar.totalTipped(), expected);
        assertEq(feeToken.balanceOf(address(feeJar)), expected);
    }

    function test_tip_revertsWhenTokenReturnsFalse() public {
        FalseReturningToken badToken = new FalseReturningToken();
        TipJar badJar = new TipJar(address(badToken), owner);
        badToken.mint(alice, 100 * ONE_USDC);

        vm.startPrank(alice);
        badToken.approve(address(badJar), type(uint256).max);
        vm.expectRevert(TipJar.TransferFailed.selector);
        badJar.tip(ONE_USDC, "silent failure");
        vm.stopPrank();
    }

    function test_tip_acceptsTokenWithNoReturnValue() public {
        NoReturnToken quietToken = new NoReturnToken();
        TipJar quietJar = new TipJar(address(quietToken), owner);
        quietToken.mint(alice, 100 * ONE_USDC);

        vm.startPrank(alice);
        quietToken.approve(address(quietJar), type(uint256).max);
        quietJar.tip(ONE_USDC, "usdt style");
        vm.stopPrank();

        assertEq(quietJar.getTip(0).amount, ONE_USDC);
        assertEq(quietToken.balanceOf(address(quietJar)), ONE_USDC);
    }

    function test_tip_blocksReentrancy() public {
        ReentrantToken evil = new ReentrantToken();
        TipJar evilJar = new TipJar(address(evil), owner);
        evil.setJar(address(evilJar));
        evil.mint(alice, 100 * ONE_USDC);

        vm.startPrank(alice);
        evil.approve(address(evilJar), type(uint256).max);
        evilJar.tip(ONE_USDC, "outer");
        vm.stopPrank();

        assertTrue(evil.reentryAttempted(), "token never reentered");
        assertTrue(evil.reentryReverted(), "reentrant tip was allowed through");
        assertEq(bytes4(evil.reentryError()), TipJar.Reentrancy.selector);

        // Only the outer tip is recorded, and the jar holds exactly that.
        assertEq(evilJar.tipCount(), 1);
        assertEq(evilJar.getTip(0).message, "outer");
        assertEq(evilJar.totalTipped(), ONE_USDC);
        assertEq(evil.balanceOf(address(evilJar)), ONE_USDC);
    }

    /* ----------------------------------------------------------------- feed */

    function test_getTips_returnsChronologicalPage() public {
        _tip(alice, ONE_USDC, "a");
        _tip(bob, 2 * ONE_USDC, "b");
        _tip(alice, 3 * ONE_USDC, "c");

        TipJar.Tip[] memory page = jar.getTips(1, 2);
        assertEq(page.length, 2);
        assertEq(page[0].message, "b");
        assertEq(page[1].message, "c");
    }

    function test_getTips_clampsToAvailable() public {
        _tip(alice, ONE_USDC, "a");
        _tip(bob, ONE_USDC, "b");

        TipJar.Tip[] memory page = jar.getTips(1, 50);
        assertEq(page.length, 1);
        assertEq(page[0].message, "b");
    }

    function test_getTips_returnsEmptyBeyondEnd() public {
        _tip(alice, ONE_USDC, "a");

        assertEq(jar.getTips(1, 10).length, 0);
        assertEq(jar.getTips(99, 10).length, 0);
        assertEq(jar.getTips(0, 0).length, 0);
    }

    function test_getRecentTips_returnsNewestFirst() public {
        _tip(alice, ONE_USDC, "oldest");
        _tip(bob, ONE_USDC, "middle");
        _tip(alice, ONE_USDC, "newest");

        TipJar.Tip[] memory page = jar.getRecentTips(2);
        assertEq(page.length, 2);
        assertEq(page[0].message, "newest");
        assertEq(page[1].message, "middle");

        assertEq(jar.getRecentTips(10).length, 3);
        assertEq(jar.getRecentTips(0).length, 0);
    }

    function test_getRecentTips_emptyFeed() public view {
        assertEq(jar.getRecentTips(10).length, 0);
    }

    function test_getTip_revertsOutOfRange() public {
        vm.expectRevert();
        jar.getTip(0);
    }

    /* ------------------------------------------------------------ withdrawal */

    function test_withdraw_movesRequestedAmount() public {
        _tip(alice, 10 * ONE_USDC, "tip");

        vm.expectEmit(true, false, false, true, address(jar));
        emit Withdrawn(owner, 4 * ONE_USDC);
        vm.prank(owner);
        jar.withdraw(owner, 4 * ONE_USDC);

        assertEq(usdc.balanceOf(owner), 4 * ONE_USDC);
        assertEq(jar.balance(), 6 * ONE_USDC);
        // History is untouched by withdrawals.
        assertEq(jar.totalTipped(), 10 * ONE_USDC);
        assertEq(jar.tipCount(), 1);
    }

    function test_withdrawAll_emptiesJar() public {
        _tip(alice, 10 * ONE_USDC, "tip");
        _tip(bob, 5 * ONE_USDC, "tip");

        address payout = makeAddr("payout");
        vm.prank(owner);
        uint256 amount = jar.withdrawAll(payout);

        assertEq(amount, 15 * ONE_USDC);
        assertEq(usdc.balanceOf(payout), 15 * ONE_USDC);
        assertEq(jar.balance(), 0);
    }

    function test_withdraw_onlyOwner() public {
        _tip(alice, 10 * ONE_USDC, "tip");

        vm.prank(alice);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.withdraw(alice, ONE_USDC);

        vm.prank(alice);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.withdrawAll(alice);
    }

    function test_withdraw_validatesInputs() public {
        _tip(alice, 10 * ONE_USDC, "tip");

        vm.startPrank(owner);
        vm.expectRevert(TipJar.ZeroAddress.selector);
        jar.withdraw(address(0), ONE_USDC);

        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.withdraw(owner, 0);

        vm.expectRevert(TipJar.TransferFailed.selector);
        jar.withdraw(owner, 100 * ONE_USDC); // more than the jar holds
        vm.stopPrank();
    }

    function test_withdrawAll_revertsWhenEmpty() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdrawAll(owner);
    }

    /* ------------------------------------------------------------- ownership */

    function test_transferOwnership() public {
        vm.expectEmit(true, true, false, false, address(jar));
        emit OwnershipTransferred(owner, alice);
        vm.prank(owner);
        jar.transferOwnership(alice);

        assertEq(jar.owner(), alice);

        _tip(bob, ONE_USDC, "tip");
        vm.prank(alice);
        jar.withdrawAll(alice);
        assertEq(jar.balance(), 0);
    }

    function test_transferOwnership_guards() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.transferOwnership(alice);

        vm.prank(owner);
        vm.expectRevert(TipJar.ZeroAddress.selector);
        jar.transferOwnership(address(0));
    }

    /* ------------------------------------------------------------------ fuzz */

    function testFuzz_tip_recordsAnyAmountTheSenderHolds(uint96 amount, string calldata message) public {
        vm.assume(amount > 0);
        vm.assume(bytes(message).length <= jar.MAX_MESSAGE_BYTES());

        usdc.mint(alice, amount);
        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        uint256 index = jar.tip(amount, message);

        assertEq(index, 0);
        assertEq(usdc.balanceOf(alice), balanceBefore - amount);
        assertEq(jar.balance(), amount);
        assertEq(jar.getTip(index).amount, amount);
        assertEq(jar.getTip(index).message, message);
    }

    function testFuzz_getTips_pageStaysInBounds(uint8 tipsToSend, uint256 offset, uint256 limit) public {
        tipsToSend = uint8(bound(tipsToSend, 0, 20));
        offset = bound(offset, 0, 30);
        limit = bound(limit, 0, 30);

        usdc.mint(alice, uint256(tipsToSend) * ONE_USDC);
        for (uint256 i = 0; i < tipsToSend; ++i) {
            _tip(alice, ONE_USDC, "fuzz");
        }

        TipJar.Tip[] memory page = jar.getTips(offset, limit);
        uint256 remaining = offset >= tipsToSend ? 0 : tipsToSend - offset;
        assertEq(page.length, limit < remaining ? limit : remaining);

        TipJar.Tip[] memory recent = jar.getRecentTips(limit);
        assertEq(recent.length, limit < tipsToSend ? limit : tipsToSend);
    }
}
