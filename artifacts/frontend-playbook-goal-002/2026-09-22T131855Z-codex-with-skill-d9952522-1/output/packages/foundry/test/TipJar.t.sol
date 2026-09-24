// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/TipJar.sol";

contract MockUSDC {
    string public constant name = "Mock USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) {
            return false;
        }

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (balanceOf[from] < amount || allowance[from][msg.sender] < amount) {
            return false;
        }

        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract TipJarTest is Test {
    MockUSDC public usdc;
    TipJar public tipJar;

    address public owner = address(0xA11CE);
    address public tipper = address(0xB0B);

    event TipReceived(uint256 indexed tipId, address indexed tipper, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);

    function setUp() public {
        usdc = new MockUSDC();
        tipJar = new TipJar(owner, address(usdc));
        usdc.mint(tipper, 100e6);
    }

    function testAcceptsUsdcTip() public {
        vm.startPrank(tipper);
        usdc.approve(address(tipJar), 25e6);

        vm.expectEmit(true, true, false, true, address(tipJar));
        emit TipReceived(0, tipper, 25e6, "coffee for the builder", block.timestamp);
        tipJar.tip(25e6, "coffee for the builder");
        vm.stopPrank();

        TipJar.Tip memory storedTip = tipJar.getTip(0);
        assertEq(storedTip.tipper, tipper);
        assertEq(storedTip.amount, 25e6);
        assertEq(storedTip.message, "coffee for the builder");
        assertEq(tipJar.tipCount(), 1);
        assertEq(tipJar.totalTips(), 25e6);
        assertEq(usdc.balanceOf(address(tipJar)), 25e6);
    }

    function testRejectsZeroTip() public {
        vm.prank(tipper);
        vm.expectRevert(TipJar.InvalidAmount.selector);
        tipJar.tip(0, "");
    }

    function testOwnerCanWithdraw() public {
        vm.startPrank(tipper);
        usdc.approve(address(tipJar), 40e6);
        tipJar.tip(40e6, "ship it");
        vm.stopPrank();

        vm.prank(owner);
        vm.expectEmit(true, false, false, true, address(tipJar));
        emit Withdrawn(owner, 40e6);
        tipJar.withdrawAll(owner);

        assertEq(usdc.balanceOf(owner), 40e6);
        assertEq(usdc.balanceOf(address(tipJar)), 0);
    }

    function testOnlyOwnerCanWithdraw() public {
        vm.prank(tipper);
        vm.expectRevert(TipJar.NotOwner.selector);
        tipJar.withdraw(tipper, 1e6);
    }
}
