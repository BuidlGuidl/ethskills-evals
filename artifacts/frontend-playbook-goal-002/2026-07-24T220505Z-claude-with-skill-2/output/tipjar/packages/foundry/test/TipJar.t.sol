// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/TipJar.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal 6-decimal ERC20 standing in for USDC in unit tests.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract TipJarTest is Test {
    TipJar public jar;
    MockUSDC public usdc;

    address owner = address(0xABCD);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    uint256 constant ONE_USDC = 1_000_000; // 6 decimals

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(address(usdc), owner);
        usdc.mint(alice, 100 * ONE_USDC);
        usdc.mint(bob, 100 * ONE_USDC);
    }

    function _tip(address who, uint256 amount, string memory msg_) internal {
        vm.startPrank(who);
        usdc.approve(address(jar), amount);
        jar.tip(amount, msg_);
        vm.stopPrank();
    }

    function testDeployment() public view {
        assertEq(address(jar.token()), address(usdc));
        assertEq(jar.owner(), owner);
        assertEq(jar.totalTipped(), 0);
        assertEq(jar.tipCount(), 0);
    }

    function testTipRecordsFeedAndTransfers() public {
        _tip(alice, 5 * ONE_USDC, "gm");

        assertEq(jar.tipCount(), 1);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 5 * ONE_USDC);
        assertEq(jar.jarBalance(), 5 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 95 * ONE_USDC);

        (address from, uint256 amount, string memory message,) = jar.tips(0);
        assertEq(from, alice);
        assertEq(amount, 5 * ONE_USDC);
        assertEq(message, "gm");
    }

    function testMultipleTipsAndRecentOrder() public {
        _tip(alice, 1 * ONE_USDC, "first");
        _tip(bob, 2 * ONE_USDC, "second");
        _tip(alice, 3 * ONE_USDC, "third");

        assertEq(jar.tipCount(), 3);
        assertEq(jar.totalTipped(), 6 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 4 * ONE_USDC);

        TipJar.Tip[] memory recent = jar.getRecentTips(2);
        assertEq(recent.length, 2);
        assertEq(recent[0].message, "third"); // newest first
        assertEq(recent[1].message, "second");

        TipJar.Tip[] memory all = jar.getAllTips();
        assertEq(all.length, 3);
        assertEq(all[0].message, "first");
    }

    function testGetRecentTipsClampsToLength() public {
        _tip(alice, 1 * ONE_USDC, "only");
        TipJar.Tip[] memory recent = jar.getRecentTips(50);
        assertEq(recent.length, 1);
    }

    function testTipZeroReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(jar), ONE_USDC);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nope");
        vm.stopPrank();
    }

    function testTipWithoutApprovalReverts() public {
        vm.prank(alice);
        vm.expectRevert(); // SafeERC20 reverts on insufficient allowance
        jar.tip(ONE_USDC, "no approve");
    }

    function testMessageTooLongReverts() public {
        string memory long = new string(281);
        vm.startPrank(alice);
        usdc.approve(address(jar), ONE_USDC);
        vm.expectRevert(TipJar.MessageTooLong.selector);
        jar.tip(ONE_USDC, long);
        vm.stopPrank();
    }

    function testWithdrawByOwner() public {
        _tip(alice, 10 * ONE_USDC, "thanks");

        uint256 before = usdc.balanceOf(owner);
        vm.prank(owner);
        jar.withdraw();

        assertEq(usdc.balanceOf(owner), before + 10 * ONE_USDC);
        assertEq(jar.jarBalance(), 0);
    }

    function testWithdrawByNonOwnerReverts() public {
        _tip(alice, 10 * ONE_USDC, "thanks");
        vm.prank(alice);
        vm.expectRevert(); // Ownable: caller is not the owner
        jar.withdraw();
    }

    function testWithdrawEmptyReverts() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.withdraw();
    }

    function testFuzzTip(uint256 amount, uint96 mintExtra) public {
        amount = bound(amount, 1, 1_000_000 * ONE_USDC);
        usdc.mint(alice, amount + mintExtra);
        uint256 balBefore = usdc.balanceOf(alice);

        vm.startPrank(alice);
        usdc.approve(address(jar), amount);
        jar.tip(amount, "fuzz");
        vm.stopPrank();

        assertEq(jar.totalTipped(), amount);
        assertEq(jar.jarBalance(), amount);
        assertEq(usdc.balanceOf(alice), balBefore - amount);
    }
}
