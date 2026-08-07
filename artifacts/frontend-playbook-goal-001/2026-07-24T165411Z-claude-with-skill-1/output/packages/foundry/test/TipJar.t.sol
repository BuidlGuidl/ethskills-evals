// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

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

    address internal owner = address(0xABCD);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(IERC20(address(usdc)), owner);
        usdc.mint(alice, 1_000e6);
        usdc.mint(bob, 1_000e6);
    }

    function _tip(address who, uint256 amount, string memory message) internal {
        vm.startPrank(who);
        usdc.approve(address(jar), amount);
        jar.tip(amount, message);
        vm.stopPrank();
    }

    function test_TipRecordsAndTransfers() public {
        _tip(alice, 10e6, "gm");

        assertEq(usdc.balanceOf(address(jar)), 10e6);
        assertEq(jar.tipsCount(), 1);
        assertEq(jar.totalTipped(), 10e6);
        assertEq(jar.totalTippedBy(alice), 10e6);

        (address from, uint256 amount,, string memory message) = jar.tips(0);
        assertEq(from, alice);
        assertEq(amount, 10e6);
        assertEq(message, "gm");
    }

    function test_RevertOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nope");
    }

    function test_MultipleTipsAndRecentOrdering() public {
        _tip(alice, 5e6, "one");
        _tip(bob, 7e6, "two");
        _tip(alice, 3e6, "three");

        assertEq(jar.totalTipped(), 15e6);
        assertEq(jar.totalTippedBy(alice), 8e6);

        TipJar.Tip[] memory recent = jar.getRecentTips(2);
        assertEq(recent.length, 2);
        assertEq(recent[0].message, "three");
        assertEq(recent[1].message, "two");
    }

    function test_GetRecentTipsClampsToLength() public {
        _tip(alice, 1e6, "only");
        TipJar.Tip[] memory recent = jar.getRecentTips(100);
        assertEq(recent.length, 1);
        assertEq(recent[0].message, "only");
    }

    function test_WithdrawOnlyOwner() public {
        _tip(alice, 10e6, "gm");

        vm.prank(alice);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.withdraw();

        vm.prank(owner);
        jar.withdraw();
        assertEq(usdc.balanceOf(owner), 10e6);
        assertEq(usdc.balanceOf(address(jar)), 0);
    }

    function test_WithdrawNothingReverts() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw();
    }

    function testFuzz_TipAccounting(uint256 amount) public {
        amount = bound(amount, 1, 1_000e6);
        _tip(alice, amount, "fuzz");
        assertEq(jar.totalTipped(), amount);
        assertEq(usdc.balanceOf(address(jar)), amount);
        assertEq(jar.totalTippedBy(alice), amount);
    }
}
