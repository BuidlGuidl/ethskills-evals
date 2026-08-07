// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

/// @dev 6-decimal stand-in for USDC used in unit tests.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") { }

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

    event NewTip(address indexed tipper, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(IERC20(address(usdc)), owner);
        usdc.mint(alice, 1000 * ONE_USDC);
        usdc.mint(bob, 1000 * ONE_USDC);
    }

    function _tip(address from, uint256 amount, string memory message) internal {
        vm.startPrank(from);
        usdc.approve(address(jar), amount);
        jar.tip(amount, message);
        vm.stopPrank();
    }

    function test_TipMovesUsdcAndRecordsFeed() public {
        vm.startPrank(alice);
        usdc.approve(address(jar), 5 * ONE_USDC);
        vm.expectEmit(true, false, false, true);
        emit NewTip(alice, 5 * ONE_USDC, "gm", block.timestamp);
        jar.tip(5 * ONE_USDC, "gm");
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(jar)), 5 * ONE_USDC);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 5 * ONE_USDC);
        assertEq(jar.tipCount(), 1);

        TipJar.Tip[] memory tips = jar.getTips();
        assertEq(tips.length, 1);
        assertEq(tips[0].tipper, alice);
        assertEq(tips[0].amount, 5 * ONE_USDC);
        assertEq(tips[0].message, "gm");
    }

    function test_RecentTipsAreNewestFirst() public {
        _tip(alice, 1 * ONE_USDC, "first");
        _tip(bob, 2 * ONE_USDC, "second");
        _tip(alice, 3 * ONE_USDC, "third");

        TipJar.Tip[] memory recent = jar.getRecentTips(2);
        assertEq(recent.length, 2);
        assertEq(recent[0].message, "third");
        assertEq(recent[1].message, "second");

        // Asking for more than exist just returns everything.
        assertEq(jar.getRecentTips(100).length, 3);
    }

    function test_TipRevertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nope");
    }

    function test_TipRevertsWithoutApproval() public {
        vm.prank(alice);
        vm.expectRevert();
        jar.tip(ONE_USDC, "no allowance");
    }

    function test_OwnerCanWithdraw() public {
        _tip(alice, 10 * ONE_USDC, "thanks");

        vm.expectEmit(true, false, false, true);
        emit Withdrawn(owner, 10 * ONE_USDC);
        vm.prank(owner);
        jar.withdraw();

        assertEq(usdc.balanceOf(owner), 10 * ONE_USDC);
        assertEq(usdc.balanceOf(address(jar)), 0);
    }

    function test_WithdrawRevertsForNonOwner() public {
        _tip(alice, ONE_USDC, "hi");
        vm.prank(alice);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.withdraw();
    }

    function test_WithdrawRevertsWhenEmpty() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw();
    }

    function testFuzz_TipAccounting(uint96 a, uint96 b) public {
        vm.assume(a > 0 && b > 0);
        usdc.mint(alice, a);
        usdc.mint(bob, b);

        _tip(alice, a, "a");
        _tip(bob, b, "b");

        assertEq(jar.totalTipped(), uint256(a) + b);
        assertEq(usdc.balanceOf(address(jar)), uint256(a) + b);
        assertEq(jar.tipCount(), 2);
    }
}
