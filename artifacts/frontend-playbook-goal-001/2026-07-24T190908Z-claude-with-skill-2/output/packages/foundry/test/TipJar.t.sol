// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

/// @dev Minimal 6-decimal token that mimics USDC for unit tests (no fork needed).
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

    event NewTip(address indexed from, uint256 amount, string message, uint256 timestamp);
    event Withdraw(address indexed to, uint256 amount);

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(address(usdc), owner);
        usdc.mint(alice, 1000 * ONE_USDC);
        usdc.mint(bob, 1000 * ONE_USDC);
    }

    function test_Constructor() public view {
        assertEq(address(jar.usdc()), address(usdc));
        assertEq(jar.owner(), owner);
        assertEq(jar.tipCount(), 0);
        assertEq(jar.totalTipped(), 0);
    }

    function test_ConstructorRejectsZeroAddresses() public {
        vm.expectRevert("zero address");
        new TipJar(address(0), owner);
        vm.expectRevert("zero address");
        new TipJar(address(usdc), address(0));
    }

    function test_Tip_MovesUsdcAndUpdatesState() public {
        vm.startPrank(alice);
        usdc.approve(address(jar), 5 * ONE_USDC);

        vm.expectEmit(true, false, false, true);
        emit NewTip(alice, 5 * ONE_USDC, "gm", block.timestamp);
        jar.tip(5 * ONE_USDC, "gm");
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(jar)), 5 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 995 * ONE_USDC);
        assertEq(jar.tipCount(), 1);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.balance(), 5 * ONE_USDC);
    }

    function test_Tip_MultipleTippersAccumulate() public {
        _tip(alice, 3 * ONE_USDC, "one");
        _tip(bob, 7 * ONE_USDC, "two");

        assertEq(jar.tipCount(), 2);
        assertEq(jar.totalTipped(), 10 * ONE_USDC);
        assertEq(jar.balance(), 10 * ONE_USDC);
    }

    function test_Tip_RevertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nope");
    }

    function test_Tip_RevertsWithoutApproval() public {
        vm.prank(alice);
        vm.expectRevert();
        jar.tip(ONE_USDC, "no allowance");
    }

    function test_Tip_RevertsWhenBalanceTooLow() public {
        vm.startPrank(alice);
        usdc.approve(address(jar), type(uint256).max);
        vm.expectRevert();
        jar.tip(2000 * ONE_USDC, "too much");
        vm.stopPrank();
    }

    function test_Withdraw_OnlyOwner() public {
        _tip(alice, 4 * ONE_USDC, "hi");

        vm.prank(alice);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.withdraw();
    }

    function test_Withdraw_RevertsWhenEmpty() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw();
    }

    function test_Withdraw_TransfersFullBalanceToOwner() public {
        _tip(alice, 4 * ONE_USDC, "hi");
        _tip(bob, 6 * ONE_USDC, "yo");

        vm.expectEmit(true, false, false, true);
        emit Withdraw(owner, 10 * ONE_USDC);
        vm.prank(owner);
        jar.withdraw();

        assertEq(usdc.balanceOf(owner), 10 * ONE_USDC);
        assertEq(jar.balance(), 0);
    }

    function testFuzz_Tip(uint256 amount, string calldata message) public {
        amount = bound(amount, 1, 1000 * ONE_USDC);

        vm.startPrank(alice);
        usdc.approve(address(jar), amount);
        jar.tip(amount, message);
        vm.stopPrank();

        assertEq(jar.balance(), amount);
        assertEq(jar.totalTipped(), amount);
        assertEq(jar.tipCount(), 1);
    }

    function _tip(address from, uint256 amount, string memory message) internal {
        vm.startPrank(from);
        usdc.approve(address(jar), amount);
        jar.tip(amount, message);
        vm.stopPrank();
    }
}
