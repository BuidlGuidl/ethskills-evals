// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { TipJar } from "../contracts/TipJar.sol";

/// @dev Minimal 6-decimal token standing in for Base USDC.
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
    MockUSDC usdc;
    TipJar jar;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant ONE_USDC = 1e6;

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(address(usdc), owner);
        usdc.mint(alice, 100 * ONE_USDC);
        usdc.mint(bob, 100 * ONE_USDC);
    }

    function _tip(address who, uint256 amount, string memory message) internal {
        vm.startPrank(who);
        usdc.approve(address(jar), amount);
        jar.tip(amount, message);
        vm.stopPrank();
    }

    function test_TipMovesUsdcAndRecordsFeed() public {
        _tip(alice, 5 * ONE_USDC, "gm");

        assertEq(usdc.balanceOf(address(jar)), 5 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 95 * ONE_USDC);
        assertEq(jar.tipCount(), 1);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 5 * ONE_USDC);

        (address from, uint256 amount, uint256 timestamp, string memory message) = jar.tips(0);
        assertEq(from, alice);
        assertEq(amount, 5 * ONE_USDC);
        assertEq(timestamp, block.timestamp);
        assertEq(message, "gm");
    }

    function test_TipEmitsEvent() public {
        vm.startPrank(alice);
        usdc.approve(address(jar), ONE_USDC);
        vm.expectEmit(true, true, false, true);
        emit TipJar.NewTip(0, alice, ONE_USDC, "hi", block.timestamp);
        jar.tip(ONE_USDC, "hi");
        vm.stopPrank();
    }

    function test_TipRevertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nope");
    }

    function test_TipRevertsWithoutApproval() public {
        vm.prank(alice);
        vm.expectRevert();
        jar.tip(ONE_USDC, "no approval");
    }

    function test_GetTipsReturnsNewestFirst() public {
        _tip(alice, ONE_USDC, "first");
        _tip(bob, 2 * ONE_USDC, "second");
        _tip(alice, 3 * ONE_USDC, "third");

        TipJar.Tip[] memory page = jar.getTips(0, 2);
        assertEq(page.length, 2);
        assertEq(page[0].message, "third");
        assertEq(page[1].message, "second");

        TipJar.Tip[] memory next = jar.getTips(2, 2);
        assertEq(next.length, 1);
        assertEq(next[0].message, "first");

        assertEq(jar.getTips(5, 2).length, 0);
    }

    function test_OnlyOwnerWithdraws() public {
        _tip(alice, 10 * ONE_USDC, "thanks");

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        jar.withdraw();

        vm.prank(owner);
        jar.withdraw();
        assertEq(usdc.balanceOf(owner), 10 * ONE_USDC);
        assertEq(usdc.balanceOf(address(jar)), 0);
    }

    function test_WithdrawRevertsWhenEmpty() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.EmptyBalance.selector);
        jar.withdraw();
    }
}
