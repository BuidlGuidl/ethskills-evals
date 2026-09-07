// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { TipJar } from "../contracts/TipJar.sol";
import { MockUSDC, FeeOnTransferUSDC, ReentrantUSDC } from "./mocks/MockUSDC.sol";

contract TipJarTest is Test {
    TipJar internal jar;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant ONE_USDC = 1e6;

    event TipReceived(uint256 indexed index, address indexed sender, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);

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

    /*//////////////////////////////////////////////////////////////
                              DEPLOYMENT
    //////////////////////////////////////////////////////////////*/

    function test_Deployment_StoresConfiguration() public view {
        assertEq(address(jar.token()), address(usdc));
        assertEq(jar.tokenDecimals(), 6);
        assertEq(jar.owner(), owner);
        assertEq(jar.tipCount(), 0);
        assertEq(jar.totalTipped(), 0);
        assertEq(jar.jarBalance(), 0);
    }

    function test_Deployment_RevertsOnZeroToken() public {
        vm.expectRevert(TipJar.ZeroAddress.selector);
        new TipJar(IERC20(address(0)), owner);
    }

    function test_Deployment_RevertsOnZeroOwner() public {
        vm.expectRevert(TipJar.ZeroAddress.selector);
        new TipJar(IERC20(address(usdc)), address(0));
    }

    /*//////////////////////////////////////////////////////////////
                                TIPPING
    //////////////////////////////////////////////////////////////*/

    function test_Tip_MovesFundsAndRecordsTip() public {
        uint256 index = _tip(alice, 25 * ONE_USDC, "coffee money");

        assertEq(index, 0);
        assertEq(usdc.balanceOf(address(jar)), 25 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 975 * ONE_USDC);
        assertEq(jar.totalTipped(), 25 * ONE_USDC);
        assertEq(jar.totalTippedBy(alice), 25 * ONE_USDC);
        assertEq(jar.tipCount(), 1);

        (address sender, uint128 amount, uint64 timestamp, string memory message) = jar.tips(0);
        assertEq(sender, alice);
        assertEq(amount, uint128(25 * ONE_USDC));
        assertEq(timestamp, uint64(block.timestamp));
        assertEq(message, "coffee money");
    }

    function test_Tip_EmitsEvent() public {
        vm.expectEmit(true, true, true, true, address(jar));
        emit TipReceived(0, alice, 5 * ONE_USDC, "gm", block.timestamp);
        _tip(alice, 5 * ONE_USDC, "gm");
    }

    function test_Tip_AcceptsEmptyMessage() public {
        _tip(alice, ONE_USDC, "");
        (,,, string memory message) = jar.tips(0);
        assertEq(message, "");
    }

    function test_Tip_AcceptsMessageAtMaxLength() public {
        string memory maxMessage = _repeat("a", jar.MAX_MESSAGE_LENGTH());
        _tip(alice, ONE_USDC, maxMessage);
        (,,, string memory stored) = jar.tips(0);
        assertEq(bytes(stored).length, jar.MAX_MESSAGE_LENGTH());
    }

    function test_Tip_AccumulatesAcrossTippers() public {
        _tip(alice, 10 * ONE_USDC, "one");
        _tip(bob, 30 * ONE_USDC, "two");
        _tip(alice, 2 * ONE_USDC, "three");

        assertEq(jar.tipCount(), 3);
        assertEq(jar.totalTipped(), 42 * ONE_USDC);
        assertEq(jar.totalTippedBy(alice), 12 * ONE_USDC);
        assertEq(jar.totalTippedBy(bob), 30 * ONE_USDC);
        assertEq(jar.jarBalance(), 42 * ONE_USDC);
    }

    function test_Tip_RevertsOnZeroAmount() public {
        vm.expectRevert(TipJar.AmountZero.selector);
        _tip(alice, 0, "nothing");
    }

    function test_Tip_RevertsOnOverlongMessage() public {
        uint256 max = jar.MAX_MESSAGE_LENGTH();
        string memory tooLong = _repeat("a", max + 1);
        vm.expectRevert(abi.encodeWithSelector(TipJar.MessageTooLong.selector, max + 1, max));
        _tip(alice, ONE_USDC, tooLong);
    }

    function test_Tip_RevertsWithoutAllowance() public {
        address carol = makeAddr("carol");
        usdc.mint(carol, 10 * ONE_USDC);

        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(jar), 0, ONE_USDC)
        );
        _tip(carol, ONE_USDC, "no approval");
    }

    function test_Tip_RevertsWithoutBalance() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, alice, 1000 * ONE_USDC, 1001 * ONE_USDC
            )
        );
        jar.tip(1001 * ONE_USDC, "broke");
    }

    function test_Tip_RecordsAmountActuallyReceived() public {
        FeeOnTransferUSDC feeToken = new FeeOnTransferUSDC();
        TipJar feeJar = new TipJar(IERC20(address(feeToken)), owner);
        feeToken.mint(alice, 1000 * ONE_USDC);

        vm.startPrank(alice);
        feeToken.approve(address(feeJar), type(uint256).max);
        feeJar.tip(100 * ONE_USDC, "fee token");
        vm.stopPrank();

        uint256 expected = 99 * ONE_USDC; // 1% skimmed in transit
        (, uint128 amount,,) = feeJar.tips(0);
        assertEq(amount, uint128(expected));
        assertEq(feeJar.totalTipped(), expected);
        assertEq(feeJar.jarBalance(), expected);
    }

    function test_Tip_RevertsOnReentry() public {
        ReentrantUSDC evil = new ReentrantUSDC();
        TipJar evilJar = new TipJar(IERC20(address(evil)), owner);
        evil.setJar(address(evilJar));
        evil.mint(alice, 1000 * ONE_USDC);

        vm.startPrank(alice);
        evil.approve(address(evilJar), type(uint256).max);
        vm.expectRevert(bytes4(keccak256("ReentrancyGuardReentrantCall()")));
        evilJar.tip(ONE_USDC, "attack");
        vm.stopPrank();

        assertEq(evilJar.tipCount(), 0);
    }

    function testFuzz_Tip(uint256 amount, string calldata message) public {
        amount = bound(amount, 1, 1000 * ONE_USDC);
        vm.assume(bytes(message).length <= jar.MAX_MESSAGE_LENGTH());

        _tip(alice, amount, message);

        assertEq(jar.totalTipped(), amount);
        assertEq(jar.jarBalance(), amount);
        (address sender, uint128 stored,,) = jar.tips(0);
        assertEq(sender, alice);
        assertEq(stored, uint128(amount));
    }

    /*//////////////////////////////////////////////////////////////
                                 FEED
    //////////////////////////////////////////////////////////////*/

    function test_GetTips_ReturnsNewestFirst() public {
        _tip(alice, ONE_USDC, "first");
        _tip(bob, 2 * ONE_USDC, "second");
        _tip(alice, 3 * ONE_USDC, "third");

        TipJar.Tip[] memory page = jar.getTips(0, 10);
        assertEq(page.length, 3);
        assertEq(page[0].message, "third");
        assertEq(page[1].message, "second");
        assertEq(page[2].message, "first");
    }

    function test_GetTips_Paginates() public {
        for (uint256 i = 0; i < 5; i++) {
            _tip(alice, ONE_USDC, vm.toString(i));
        }

        TipJar.Tip[] memory firstPage = jar.getTips(0, 2);
        assertEq(firstPage.length, 2);
        assertEq(firstPage[0].message, "4");
        assertEq(firstPage[1].message, "3");

        TipJar.Tip[] memory lastPage = jar.getTips(4, 2);
        assertEq(lastPage.length, 1, "page is truncated at the end of the feed");
        assertEq(lastPage[0].message, "0");
    }

    function test_GetTips_ReturnsEmptyForOutOfRange() public {
        assertEq(jar.getTips(0, 10).length, 0);
        _tip(alice, ONE_USDC, "only");
        assertEq(jar.getTips(1, 10).length, 0);
        assertEq(jar.getTips(0, 0).length, 0);
    }

    /*//////////////////////////////////////////////////////////////
                              WITHDRAWALS
    //////////////////////////////////////////////////////////////*/

    function test_Withdraw_TransfersToRecipient() public {
        _tip(alice, 100 * ONE_USDC, "tip");

        vm.expectEmit(true, true, true, true, address(jar));
        emit Withdrawn(bob, 40 * ONE_USDC);
        vm.prank(owner);
        jar.withdraw(bob, 40 * ONE_USDC);

        assertEq(usdc.balanceOf(bob), 1040 * ONE_USDC); // untouched 1000 plus the 40 withdrawn to him
        assertEq(jar.jarBalance(), 60 * ONE_USDC);
        assertEq(jar.totalWithdrawn(), 40 * ONE_USDC);
        assertEq(jar.totalTipped(), 100 * ONE_USDC, "withdrawing does not rewrite tip history");
    }

    function test_WithdrawAll_EmptiesJarToOwner() public {
        _tip(alice, 100 * ONE_USDC, "tip");
        _tip(bob, 50 * ONE_USDC, "tip");

        vm.prank(owner);
        jar.withdrawAll();

        assertEq(usdc.balanceOf(owner), 150 * ONE_USDC);
        assertEq(jar.jarBalance(), 0);
        assertEq(jar.totalWithdrawn(), 150 * ONE_USDC);
    }

    function test_Withdraw_RevertsForNonOwner() public {
        _tip(alice, 100 * ONE_USDC, "tip");

        vm.expectRevert(abi.encodeWithSelector(TipJar.NotOwner.selector, alice));
        vm.prank(alice);
        jar.withdraw(alice, ONE_USDC);

        vm.expectRevert(abi.encodeWithSelector(TipJar.NotOwner.selector, alice));
        vm.prank(alice);
        jar.withdrawAll();
    }

    function test_Withdraw_RevertsOnZeroRecipientOrAmount() public {
        _tip(alice, 100 * ONE_USDC, "tip");

        vm.startPrank(owner);
        vm.expectRevert(TipJar.ZeroAddress.selector);
        jar.withdraw(address(0), ONE_USDC);

        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw(owner, 0);
        vm.stopPrank();
    }

    function test_Withdraw_RevertsAboveBalance() public {
        _tip(alice, 10 * ONE_USDC, "tip");

        vm.expectRevert(abi.encodeWithSelector(TipJar.AmountExceedsBalance.selector, 11 * ONE_USDC, 10 * ONE_USDC));
        vm.prank(owner);
        jar.withdraw(owner, 11 * ONE_USDC);
    }

    function test_WithdrawAll_RevertsOnEmptyJar() public {
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        vm.prank(owner);
        jar.withdrawAll();
    }

    /*//////////////////////////////////////////////////////////////
                               OWNERSHIP
    //////////////////////////////////////////////////////////////*/

    function test_TransferOwnership_MovesWithdrawRights() public {
        _tip(alice, 10 * ONE_USDC, "tip");

        vm.expectEmit(true, true, true, true, address(jar));
        emit OwnerChanged(owner, bob);
        vm.prank(owner);
        jar.transferOwnership(bob);
        assertEq(jar.owner(), bob);

        vm.expectRevert(abi.encodeWithSelector(TipJar.NotOwner.selector, owner));
        vm.prank(owner);
        jar.withdrawAll();

        vm.prank(bob);
        jar.withdrawAll();
        assertEq(jar.jarBalance(), 0);
    }

    function test_TransferOwnership_RevertsForNonOwnerOrZero() public {
        vm.expectRevert(abi.encodeWithSelector(TipJar.NotOwner.selector, alice));
        vm.prank(alice);
        jar.transferOwnership(alice);

        vm.expectRevert(TipJar.ZeroAddress.selector);
        vm.prank(owner);
        jar.transferOwnership(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                                HELPERS
    //////////////////////////////////////////////////////////////*/

    function _repeat(string memory char, uint256 times) internal pure returns (string memory out) {
        bytes memory buffer = new bytes(times);
        bytes1 c = bytes(char)[0];
        for (uint256 i = 0; i < times; i++) {
            buffer[i] = c;
        }
        out = string(buffer);
    }
}
