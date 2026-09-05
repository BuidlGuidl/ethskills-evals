//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

/// @dev Stands in for USDC: 6 decimals, plain ERC20 behaviour.
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
    MockUSDC internal usdc;
    TipJar internal jar;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant ONE_USDC = 1e6;

    event NewTip(uint256 indexed index, address indexed sender, uint256 amount, string message, uint256 timestamp);
    event Withdrawal(address indexed to, uint256 amount);

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(address(usdc), owner);

        usdc.mint(alice, 100 * ONE_USDC);
        usdc.mint(bob, 100 * ONE_USDC);
    }

    function _tip(address from, uint256 amount, string memory message) internal {
        vm.startPrank(from);
        usdc.approve(address(jar), amount);
        jar.tip(amount, message);
        vm.stopPrank();
    }

    function test_Deployment() public view {
        assertEq(address(jar.token()), address(usdc));
        assertEq(jar.owner(), owner);
        assertEq(jar.tipCount(), 0);
        assertEq(jar.totalTipped(), 0);
        assertEq(jar.balance(), 0);
    }

    function test_TipMovesUsdcIntoTheJar() public {
        _tip(alice, 5 * ONE_USDC, "coffee on me");

        assertEq(jar.balance(), 5 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 95 * ONE_USDC);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 5 * ONE_USDC);
    }

    function test_TipIsStoredInTheFeed() public {
        vm.warp(1_800_000_000);
        _tip(alice, 5 * ONE_USDC, "coffee on me");

        TipJar.Tip memory stored = jar.getTip(0);
        assertEq(stored.sender, alice);
        assertEq(stored.amount, 5 * ONE_USDC);
        assertEq(stored.message, "coffee on me");
        assertEq(stored.timestamp, 1_800_000_000);
    }

    function test_TipEmitsNewTip() public {
        vm.warp(1_800_000_000);
        vm.prank(alice);
        usdc.approve(address(jar), ONE_USDC);

        vm.expectEmit(true, true, false, true, address(jar));
        emit NewTip(0, alice, ONE_USDC, "gm", 1_800_000_000);

        vm.prank(alice);
        jar.tip(ONE_USDC, "gm");
    }

    function test_TipAcceptsAnEmptyMessage() public {
        _tip(alice, ONE_USDC, "");
        assertEq(jar.getTip(0).message, "");
    }

    function test_LatestTipsAreNewestFirst() public {
        _tip(alice, ONE_USDC, "first");
        _tip(bob, 2 * ONE_USDC, "second");
        _tip(alice, 3 * ONE_USDC, "third");

        TipJar.Tip[] memory latest = jar.getLatestTips(2);
        assertEq(latest.length, 2);
        assertEq(latest[0].message, "third");
        assertEq(latest[1].message, "second");
    }

    function test_LatestTipsClampsToFeedLength() public {
        _tip(alice, ONE_USDC, "only one");

        TipJar.Tip[] memory latest = jar.getLatestTips(50);
        assertEq(latest.length, 1);
        assertEq(latest[0].message, "only one");
    }

    function test_LatestTipsOnEmptyFeed() public view {
        assertEq(jar.getLatestTips(10).length, 0);
    }

    function test_TotalsAccumulateAcrossTippers() public {
        _tip(alice, ONE_USDC, "a");
        _tip(bob, 2 * ONE_USDC, "b");
        _tip(alice, 4 * ONE_USDC, "c");

        assertEq(jar.totalTipped(), 7 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 5 * ONE_USDC);
        assertEq(jar.tippedBy(bob), 2 * ONE_USDC);
        assertEq(jar.tipCount(), 3);
    }

    function test_RevertWhen_AmountIsZero() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.AmountIsZero.selector);
        jar.tip(0, "nothing");
    }

    function test_RevertWhen_MessageIsTooLong() public {
        string memory tooLong = new string(141);

        vm.prank(alice);
        usdc.approve(address(jar), ONE_USDC);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TipJar.MessageTooLong.selector, 141, 140));
        jar.tip(ONE_USDC, tooLong);
    }

    function test_MessageAtTheLimitIsAccepted() public {
        string memory atLimit = new string(140);
        _tip(alice, ONE_USDC, atLimit);
        assertEq(bytes(jar.getTip(0).message).length, 140);
    }

    function test_RevertWhen_AllowanceIsMissing() public {
        vm.prank(alice);
        vm.expectRevert();
        jar.tip(ONE_USDC, "no approval");
    }

    function test_OwnerWithdrawsPart() public {
        _tip(alice, 10 * ONE_USDC, "thanks");

        vm.expectEmit(true, false, false, true, address(jar));
        emit Withdrawal(owner, 4 * ONE_USDC);

        vm.prank(owner);
        jar.withdraw(4 * ONE_USDC);

        assertEq(usdc.balanceOf(owner), 4 * ONE_USDC);
        assertEq(jar.balance(), 6 * ONE_USDC);
        // Withdrawing does not rewrite the tip history.
        assertEq(jar.totalTipped(), 10 * ONE_USDC);
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
        vm.expectRevert(abi.encodeWithSelector(TipJar.NotTheOwner.selector, alice));
        jar.withdraw(ONE_USDC);
    }

    function test_RevertWhen_WithdrawingMoreThanTheBalance() public {
        _tip(alice, ONE_USDC, "thanks");

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(TipJar.AmountExceedsBalance.selector, 2 * ONE_USDC, ONE_USDC));
        jar.withdraw(2 * ONE_USDC);
    }

    function test_RevertWhen_WithdrawingFromAnEmptyJar() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.AmountIsZero.selector);
        jar.withdrawAll();
    }

    function test_TransferOwnership() public {
        vm.prank(owner);
        jar.transferOwnership(bob);
        assertEq(jar.owner(), bob);

        _tip(alice, ONE_USDC, "for bob");
        vm.prank(bob);
        jar.withdrawAll();
        assertEq(usdc.balanceOf(bob), 100 * ONE_USDC + ONE_USDC);
    }

    function test_RevertWhen_NonOwnerTransfersOwnership() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TipJar.NotTheOwner.selector, alice));
        jar.transferOwnership(alice);
    }

    function test_RevertWhen_ConstructedWithZeroAddress() public {
        vm.expectRevert(TipJar.ZeroAddress.selector);
        new TipJar(address(0), owner);

        vm.expectRevert(TipJar.ZeroAddress.selector);
        new TipJar(address(usdc), address(0));
    }

    function testFuzz_TipRecordsAnyAmount(uint96 amount, address sender) public {
        vm.assume(amount > 0);
        vm.assume(sender != address(0) && sender != address(jar));

        usdc.mint(sender, amount);
        _tip(sender, amount, "fuzz");

        assertEq(jar.balance(), amount);
        assertEq(jar.tippedBy(sender), amount);
        assertEq(jar.getTip(0).amount, amount);
    }
}
