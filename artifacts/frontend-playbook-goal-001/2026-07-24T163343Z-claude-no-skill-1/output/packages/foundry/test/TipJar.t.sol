// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { TipJar } from "../contracts/TipJar.sol";

/// @dev Minimal 6-decimal stand-in for USDC used in unit tests.
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

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(IERC20(address(usdc)), owner);
        usdc.mint(alice, 100 * ONE_USDC);
        usdc.mint(bob, 100 * ONE_USDC);
    }

    function _tip(address who, uint256 amount, string memory message) internal {
        vm.startPrank(who);
        usdc.approve(address(jar), amount);
        jar.tip(amount, message);
        vm.stopPrank();
    }

    function testTipMovesUsdcAndRecordsFeed() public {
        _tip(alice, 5 * ONE_USDC, "gm");

        assertEq(usdc.balanceOf(address(jar)), 5 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 95 * ONE_USDC);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.tipCount(), 1);

        (address from, uint256 amount,, string memory message) = jar.tips(0);
        assertEq(from, alice);
        assertEq(amount, 5 * ONE_USDC);
        assertEq(message, "gm");
    }

    function testRecentTipsAreNewestFirst() public {
        _tip(alice, 1 * ONE_USDC, "first");
        _tip(bob, 2 * ONE_USDC, "second");

        TipJar.Tip[] memory recent = jar.recentTips(10);
        assertEq(recent.length, 2);
        assertEq(recent[0].from, bob);
        assertEq(recent[0].message, "second");
        assertEq(recent[1].from, alice);
    }

    function testTipEmitsEvent() public {
        vm.startPrank(alice);
        usdc.approve(address(jar), ONE_USDC);
        vm.expectEmit(true, false, false, true);
        emit TipJar.NewTip(alice, ONE_USDC, "hi", block.timestamp);
        jar.tip(ONE_USDC, "hi");
        vm.stopPrank();
    }

    function testZeroAmountReverts() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nope");
    }

    function testTooLongMessageReverts() public {
        string memory long = new string(281);
        vm.startPrank(alice);
        usdc.approve(address(jar), ONE_USDC);
        vm.expectRevert(TipJar.MessageTooLong.selector);
        jar.tip(ONE_USDC, long);
        vm.stopPrank();
    }

    function testTipWithoutApprovalReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        jar.tip(ONE_USDC, "no approval");
    }

    function testOnlyOwnerWithdraws() public {
        _tip(alice, 10 * ONE_USDC, "thanks");

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        jar.withdraw();

        vm.prank(owner);
        jar.withdraw();
        assertEq(usdc.balanceOf(owner), 10 * ONE_USDC);
        assertEq(usdc.balanceOf(address(jar)), 0);
    }

    function testWithdrawWithEmptyJarReverts() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw();
    }
}
