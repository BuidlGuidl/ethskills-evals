// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {TipJar, IERC20} from "../src/TipJar.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract TipJarTest is Test {
    TipJar internal jar;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant ONE_USDC = 1e6;

    event Tipped(uint256 indexed id, address indexed sender, uint256 amount, string message, uint64 timestamp);
    event Withdrawal(address indexed to, uint256 amount);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(IERC20(address(usdc)), owner);

        for (uint256 i = 0; i < 2; ++i) {
            address account = i == 0 ? alice : bob;
            usdc.mint(account, 1_000 * ONE_USDC);
            vm.prank(account);
            usdc.approve(address(jar), type(uint256).max);
        }
    }

    function test_constructor_setsTokenAndOwner() public view {
        assertEq(address(jar.token()), address(usdc));
        assertEq(jar.owner(), owner);
        assertEq(jar.pendingOwner(), address(0));
        assertEq(jar.tipCount(), 0);
        assertEq(jar.totalTipped(), 0);
    }

    function test_constructor_revertsOnZeroToken() public {
        vm.expectRevert(TipJar.ZeroAddress.selector);
        new TipJar(IERC20(address(0)), owner);
    }

    function test_constructor_revertsOnZeroOwner() public {
        vm.expectRevert(TipJar.ZeroAddress.selector);
        new TipJar(IERC20(address(usdc)), address(0));
    }

    function test_tip_movesTokensAndRecordsTip() public {
        vm.warp(1_700_000_000);

        vm.expectEmit(true, true, true, true, address(jar));
        emit Tipped(0, alice, 5 * ONE_USDC, "coffee money", uint64(1_700_000_000));

        vm.prank(alice);
        uint256 id = jar.tip(5 * ONE_USDC, "coffee money");

        assertEq(id, 0);
        assertEq(usdc.balanceOf(address(jar)), 5 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 995 * ONE_USDC);
        assertEq(jar.balance(), 5 * ONE_USDC);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 5 * ONE_USDC);
        assertEq(jar.tipCount(), 1);

        TipJar.Tip memory recorded = jar.getTip(0);
        assertEq(recorded.sender, alice);
        assertEq(recorded.amount, 5 * ONE_USDC);
        assertEq(recorded.timestamp, uint64(1_700_000_000));
        assertEq(recorded.message, "coffee money");
    }

    function test_tip_acceptsEmptyMessage() public {
        vm.prank(alice);
        jar.tip(ONE_USDC, "");
        assertEq(jar.getTip(0).message, "");
    }

    function test_tip_acceptsMessageAtMaxLength() public {
        string memory message = _repeat("a", jar.MAX_MESSAGE_BYTES());
        vm.prank(alice);
        jar.tip(ONE_USDC, message);
        assertEq(bytes(jar.getTip(0).message).length, jar.MAX_MESSAGE_BYTES());
    }

    function test_tip_revertsOnMessageOverMaxLength() public {
        uint256 max = jar.MAX_MESSAGE_BYTES();
        string memory message = _repeat("a", max + 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TipJar.MessageTooLong.selector, max + 1, max));
        jar.tip(ONE_USDC, message);
    }

    function test_tip_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nothing");
    }

    function test_tip_revertsAboveMaxTip() public {
        uint256 tooBig = jar.MAX_TIP() + 1;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TipJar.TipTooLarge.selector, tooBig, jar.MAX_TIP()));
        jar.tip(tooBig, "whale");
    }

    function test_tip_bubblesUpTokenRevertWhenAllowanceMissing() public {
        address carol = makeAddr("carol");
        usdc.mint(carol, ONE_USDC);

        vm.prank(carol);
        vm.expectRevert(
            abi.encodeWithSelector(MockUSDC.InsufficientAllowance.selector, carol, address(jar), ONE_USDC, 0)
        );
        jar.tip(ONE_USDC, "no approval");
    }

    function test_tip_bubblesUpTokenRevertWhenBalanceTooLow() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MockUSDC.InsufficientBalance.selector, alice, 2_000 * ONE_USDC, 1_000 * ONE_USDC)
        );
        jar.tip(2_000 * ONE_USDC, "broke");
    }

    function test_tip_accumulatesAcrossSenders() public {
        vm.prank(alice);
        jar.tip(3 * ONE_USDC, "one");
        vm.prank(bob);
        jar.tip(7 * ONE_USDC, "two");
        vm.prank(alice);
        jar.tip(ONE_USDC, "three");

        assertEq(jar.tipCount(), 3);
        assertEq(jar.totalTipped(), 11 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 4 * ONE_USDC);
        assertEq(jar.tippedBy(bob), 7 * ONE_USDC);
        assertEq(jar.balance(), 11 * ONE_USDC);
    }

    function test_getTips_returnsPageOldestFirst() public {
        _seedTips(5);

        TipJar.Tip[] memory page = jar.getTips(1, 3);
        assertEq(page.length, 3);
        assertEq(page[0].message, "tip-1");
        assertEq(page[1].message, "tip-2");
        assertEq(page[2].message, "tip-3");
    }

    function test_getTips_clampsToAvailable() public {
        _seedTips(3);
        assertEq(jar.getTips(2, 50).length, 1);
    }

    function test_getTips_returnsEmptyForOffsetPastEndOrZeroLimit() public {
        _seedTips(2);
        assertEq(jar.getTips(2, 10).length, 0);
        assertEq(jar.getTips(99, 10).length, 0);
        assertEq(jar.getTips(0, 0).length, 0);
        assertEq(jar.getTips(0, 10).length, 2);
    }

    function test_latestTips_returnsNewestFirst() public {
        _seedTips(4);

        TipJar.Tip[] memory feed = jar.latestTips(2);
        assertEq(feed.length, 2);
        assertEq(feed[0].message, "tip-3");
        assertEq(feed[1].message, "tip-2");
    }

    function test_latestTips_clampsToTipCount() public {
        _seedTips(2);
        assertEq(jar.latestTips(100).length, 2);
        assertEq(jar.latestTips(0).length, 0);
    }

    function test_latestTips_onEmptyJar() public view {
        assertEq(jar.latestTips(10).length, 0);
    }

    function test_getTip_revertsOnUnknownId() public {
        vm.expectRevert();
        jar.getTip(0);
    }

    function test_withdraw_movesTokensToRecipient() public {
        vm.prank(alice);
        jar.tip(10 * ONE_USDC, "thanks");

        vm.expectEmit(true, true, true, true, address(jar));
        emit Withdrawal(bob, 4 * ONE_USDC);

        vm.prank(owner);
        jar.withdraw(bob, 4 * ONE_USDC);

        assertEq(usdc.balanceOf(bob), 1_004 * ONE_USDC);
        assertEq(jar.balance(), 6 * ONE_USDC);
        // The feed is a permanent record; withdrawing must not rewrite history.
        assertEq(jar.totalTipped(), 10 * ONE_USDC);
        assertEq(jar.tipCount(), 1);
    }

    function test_withdraw_revertsForNonOwner() public {
        vm.prank(alice);
        jar.tip(ONE_USDC, "hi");

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TipJar.NotOwner.selector, alice));
        jar.withdraw(alice, ONE_USDC);
    }

    function test_withdraw_revertsAboveBalance() public {
        vm.prank(alice);
        jar.tip(ONE_USDC, "hi");

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(TipJar.InsufficientBalance.selector, 2 * ONE_USDC, ONE_USDC));
        jar.withdraw(owner, 2 * ONE_USDC);
    }

    function test_withdraw_revertsOnZeroAddressOrAmount() public {
        vm.prank(alice);
        jar.tip(ONE_USDC, "hi");

        vm.prank(owner);
        vm.expectRevert(TipJar.ZeroAddress.selector);
        jar.withdraw(address(0), ONE_USDC);

        vm.prank(owner);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.withdraw(owner, 0);
    }

    function test_withdrawAll_emptiesTheJar() public {
        vm.prank(alice);
        jar.tip(12 * ONE_USDC, "all yours");

        vm.prank(owner);
        uint256 amount = jar.withdrawAll(owner);

        assertEq(amount, 12 * ONE_USDC);
        assertEq(jar.balance(), 0);
        assertEq(usdc.balanceOf(owner), 12 * ONE_USDC);
    }

    function test_withdrawAll_revertsForNonOwner() public {
        vm.prank(alice);
        jar.tip(ONE_USDC, "hi");

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(TipJar.NotOwner.selector, bob));
        jar.withdrawAll(bob);
    }

    function test_withdrawAll_revertsWhenJarIsEmpty() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.withdrawAll(owner);
    }

    function test_transferOwnership_isTwoStep() public {
        vm.expectEmit(true, true, true, true, address(jar));
        emit OwnershipTransferStarted(owner, alice);
        vm.prank(owner);
        jar.transferOwnership(alice);

        // Ownership does not move until it is accepted.
        assertEq(jar.owner(), owner);
        assertEq(jar.pendingOwner(), alice);

        vm.expectEmit(true, true, true, true, address(jar));
        emit OwnershipTransferred(owner, alice);
        vm.prank(alice);
        jar.acceptOwnership();

        assertEq(jar.owner(), alice);
        assertEq(jar.pendingOwner(), address(0));
    }

    function test_transferOwnership_revertsForNonOwnerOrZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TipJar.NotOwner.selector, alice));
        jar.transferOwnership(alice);

        vm.prank(owner);
        vm.expectRevert(TipJar.ZeroAddress.selector);
        jar.transferOwnership(address(0));
    }

    function test_acceptOwnership_revertsForNonPendingOwner() public {
        vm.prank(owner);
        jar.transferOwnership(alice);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(TipJar.NotPendingOwner.selector, bob));
        jar.acceptOwnership();
    }

    function test_oldOwnerLosesWithdrawRightsAfterHandover() public {
        vm.prank(alice);
        jar.tip(ONE_USDC, "hi");

        vm.prank(owner);
        jar.transferOwnership(bob);
        vm.prank(bob);
        jar.acceptOwnership();

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(TipJar.NotOwner.selector, owner));
        jar.withdraw(owner, ONE_USDC);

        vm.prank(bob);
        jar.withdraw(bob, ONE_USDC);
        assertEq(jar.balance(), 0);
    }

    function test_rejectsPlainEth() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(jar).call{value: 1 ether}("");
        assertFalse(ok, "tip jar must not accept ETH");
    }

    function test_tip_recordsAmountActuallyReceivedFromFeeOnTransferToken() public {
        // 10% fee on every transfer: the feed must show the 9 that landed, not the 10 requested.
        FeeOnTransferToken feeToken = new FeeOnTransferToken();
        TipJar feeJar = new TipJar(IERC20(address(feeToken)), owner);

        feeToken.mint(alice, 100 * ONE_USDC);
        vm.startPrank(alice);
        feeToken.approve(address(feeJar), type(uint256).max);
        feeJar.tip(10 * ONE_USDC, "fee token");
        vm.stopPrank();

        assertEq(feeJar.getTip(0).amount, 9 * ONE_USDC);
        assertEq(feeJar.totalTipped(), 9 * ONE_USDC);
        assertEq(feeJar.balance(), 9 * ONE_USDC);
    }

    function test_tip_revertsWhenNothingIsReceived() public {
        // A token that swallows the whole transfer must not create a phantom feed entry.
        FeeOnTransferToken feeToken = new FeeOnTransferToken();
        feeToken.setFeeBps(10_000);
        TipJar feeJar = new TipJar(IERC20(address(feeToken)), owner);

        feeToken.mint(alice, 100 * ONE_USDC);
        vm.startPrank(alice);
        feeToken.approve(address(feeJar), type(uint256).max);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        feeJar.tip(10 * ONE_USDC, "vanishes");
        vm.stopPrank();
    }

    function test_tip_revertsWhenTokenReturnsFalse() public {
        SilentlyFailingToken badToken = new SilentlyFailingToken();
        TipJar badJar = new TipJar(IERC20(address(badToken)), owner);

        vm.prank(alice);
        vm.expectRevert(TipJar.TransferFailed.selector);
        badJar.tip(ONE_USDC, "should fail");
    }

    function test_tip_worksWithTokenThatReturnsNoData() public {
        NoReturnDataToken quietToken = new NoReturnDataToken();
        TipJar quietJar = new TipJar(IERC20(address(quietToken)), owner);

        quietToken.mint(alice, 10 * ONE_USDC);
        vm.prank(alice);
        quietJar.tip(2 * ONE_USDC, "quiet token");

        assertEq(quietJar.balance(), 2 * ONE_USDC);
        assertEq(quietJar.getTip(0).amount, 2 * ONE_USDC);
    }

    function test_tip_blocksReentrancy() public {
        ReentrantToken evilToken = new ReentrantToken();
        TipJar evilJar = new TipJar(IERC20(address(evilToken)), owner);
        evilToken.setJar(evilJar);
        evilToken.mint(address(this), 10 * ONE_USDC);

        vm.expectRevert(TipJar.Reentrancy.selector);
        evilJar.tip(ONE_USDC, "reenter");
    }

    function testFuzz_tip_recordsAnyValidAmount(uint96 amount, string calldata message) public {
        amount = uint96(bound(uint256(amount), 1, type(uint96).max));
        vm.assume(bytes(message).length <= jar.MAX_MESSAGE_BYTES());

        usdc.mint(alice, amount);
        vm.prank(alice);
        jar.tip(amount, message);

        TipJar.Tip memory recorded = jar.getTip(0);
        assertEq(recorded.amount, amount);
        assertEq(recorded.sender, alice);
        assertEq(recorded.message, message);
        assertEq(jar.totalTipped(), amount);
        assertEq(jar.balance(), amount);
    }

    function testFuzz_getTips_pageStaysWithinBounds(uint8 tipCount, uint256 offset, uint256 limit) public {
        tipCount = uint8(bound(tipCount, 0, 20));
        offset = bound(offset, 0, 30);
        limit = bound(limit, 0, 30);
        _seedTips(tipCount);

        TipJar.Tip[] memory page = jar.getTips(offset, limit);

        uint256 available = offset >= tipCount ? 0 : tipCount - offset;
        uint256 expected = limit < available ? limit : available;
        assertEq(page.length, expected);
        for (uint256 i = 0; i < page.length; ++i) {
            assertEq(page[i].message, string.concat("tip-", vm.toString(offset + i)));
        }
    }

    function testFuzz_latestTips_mirrorsGetTips(uint8 tipCount, uint8 limit) public {
        tipCount = uint8(bound(tipCount, 0, 20));
        _seedTips(tipCount);

        TipJar.Tip[] memory feed = jar.latestTips(limit);
        uint256 expected = limit < tipCount ? limit : tipCount;
        assertEq(feed.length, expected);
        for (uint256 i = 0; i < feed.length; ++i) {
            assertEq(feed[i].message, string.concat("tip-", vm.toString(tipCount - 1 - i)));
        }
    }

    function _seedTips(uint256 count) private {
        for (uint256 i = 0; i < count; ++i) {
            usdc.mint(alice, ONE_USDC);
            vm.prank(alice);
            jar.tip(ONE_USDC, string.concat("tip-", vm.toString(i)));
        }
    }

    function _repeat(string memory unit, uint256 times) private pure returns (string memory out) {
        for (uint256 i = 0; i < times; ++i) {
            out = string.concat(out, unit);
        }
    }
}

/// @dev Takes a configurable cut of every transfer.
contract FeeOnTransferToken {
    uint256 public feeBps = 1_000;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function setFeeBps(uint256 feeBps_) external {
        feeBps = feeBps_;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;

        uint256 fee = (amount * feeBps) / 10_000;
        balanceOf[from] -= amount;
        balanceOf[to] += amount - fee;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @dev Returns `false` instead of reverting, the classic non-compliant ERC-20.
contract SilentlyFailingToken {
    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
}

/// @dev Returns no data at all on transfer, like USDT on mainnet.
contract NoReturnDataToken {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transferFrom(address from, address to, uint256 amount) external {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
    }
}

/// @dev Calls back into the jar during `transferFrom`.
contract ReentrantToken {
    mapping(address => uint256) public balanceOf;
    TipJar public jar;

    function setJar(TipJar jar_) external {
        jar = jar_;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transferFrom(address, address, uint256) external returns (bool) {
        jar.tip(1, "reentered");
        return true;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return true;
    }
}
