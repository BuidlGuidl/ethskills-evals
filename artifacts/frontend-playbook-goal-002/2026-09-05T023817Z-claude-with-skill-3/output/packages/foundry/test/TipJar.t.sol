// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../contracts/TipJar.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

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
    TipJar public tipJar;
    MockUSDC public usdc;

    address owner = address(0xB0B);
    address alice = address(0xA11CE);
    address bob = address(0xB0BB1);

    uint256 constant ONE_USDC = 1e6;

    function setUp() public {
        usdc = new MockUSDC();
        tipJar = new TipJar(owner, address(usdc));
        usdc.mint(alice, 100 * ONE_USDC);
        usdc.mint(bob, 100 * ONE_USDC);
    }

    function _tip(address from, uint256 amount, string memory message) internal {
        vm.startPrank(from);
        usdc.approve(address(tipJar), amount);
        tipJar.tip(amount, message);
        vm.stopPrank();
    }

    function testTipMovesUsdcAndRecordsFeedEntry() public {
        vm.warp(1_700_000_000);
        _tip(alice, 5 * ONE_USDC, "great work");

        assertEq(usdc.balanceOf(address(tipJar)), 5 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 95 * ONE_USDC);
        assertEq(tipJar.balance(), 5 * ONE_USDC);
        assertEq(tipJar.totalTipped(), 5 * ONE_USDC);
        assertEq(tipJar.tippedBy(alice), 5 * ONE_USDC);
        assertEq(tipJar.tipCount(), 1);

        (address from, uint128 amount, uint64 timestamp, string memory message) = tipJar.tips(0);
        assertEq(from, alice);
        assertEq(amount, uint128(5 * ONE_USDC));
        assertEq(timestamp, uint64(1_700_000_000));
        assertEq(message, "great work");
    }

    function testTipEmitsEvent() public {
        vm.warp(1_700_000_000);
        vm.startPrank(alice);
        usdc.approve(address(tipJar), 2 * ONE_USDC);

        vm.expectEmit(true, false, false, true, address(tipJar));
        emit TipJar.NewTip(alice, 2 * ONE_USDC, "hi", 1_700_000_000);
        tipJar.tip(2 * ONE_USDC, "hi");
        vm.stopPrank();
    }

    function testRecentTipsAreNewestFirstAndCapped() public {
        _tip(alice, 1 * ONE_USDC, "first");
        _tip(bob, 2 * ONE_USDC, "second");
        _tip(alice, 3 * ONE_USDC, "third");

        TipJar.Tip[] memory recent = tipJar.recentTips(2);
        assertEq(recent.length, 2);
        assertEq(recent[0].message, "third");
        assertEq(recent[1].message, "second");

        // Asking for more than exist returns everything without reverting.
        assertEq(tipJar.recentTips(50).length, 3);
        assertEq(tipJar.tippedBy(alice), 4 * ONE_USDC);
    }

    function testTipRevertsWithoutAllowance() public {
        vm.prank(alice);
        vm.expectRevert();
        tipJar.tip(ONE_USDC, "no approval");
    }

    function testTipRevertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        tipJar.tip(0, "");
    }

    function testTipRevertsOnLongMessage() public {
        string memory tooLong = new string(201);
        vm.prank(alice);
        vm.expectRevert(TipJar.MessageTooLong.selector);
        tipJar.tip(ONE_USDC, tooLong);
    }

    function testOnlyOwnerWithdraws() public {
        _tip(alice, 7 * ONE_USDC, "for you");

        vm.prank(alice);
        vm.expectRevert(TipJar.NotTheOwner.selector);
        tipJar.withdraw();

        vm.prank(owner);
        tipJar.withdraw();
        assertEq(usdc.balanceOf(owner), 7 * ONE_USDC);
        assertEq(tipJar.balance(), 0);

        // The feed survives the withdrawal.
        assertEq(tipJar.tipCount(), 1);
        assertEq(tipJar.totalTipped(), 7 * ONE_USDC);
    }

    function testWithdrawRevertsWhenEmpty() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        tipJar.withdraw();
    }
}
