// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/USDCTipJar.sol";

contract MockUSDC {
    string public constant name = "USD Coin";
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
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract USDCTipJarTest is Test {
    MockUSDC public usdc;
    USDCTipJar public tipJar;

    address public owner = makeAddr("owner");
    address public tipper = makeAddr("tipper");

    function setUp() public {
        usdc = new MockUSDC();
        tipJar = new USDCTipJar(owner, address(usdc));
        usdc.mint(tipper, 100e6);
    }

    function testTipStoresFeedEntryAndTransfersUSDC() public {
        vm.startPrank(tipper);
        usdc.approve(address(tipJar), 25e6);

        vm.expectEmit(true, true, false, true, address(tipJar));
        emit USDCTipJar.TipReceived(tipper, 0, 25e6, "Ada", "For the jar", block.timestamp);
        tipJar.tip(25e6, "Ada", "For the jar");
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(tipJar)), 25e6);
        assertEq(tipJar.totalAmount(), 25e6);
        assertEq(tipJar.tipCount(), 1);

        USDCTipJar.Tip memory storedTip = tipJar.getTip(0);
        assertEq(storedTip.tipper, tipper);
        assertEq(storedTip.amount, 25e6);
        assertEq(storedTip.name, "Ada");
        assertEq(storedTip.message, "For the jar");
    }

    function testOwnerCanWithdraw() public {
        vm.startPrank(tipper);
        usdc.approve(address(tipJar), 10e6);
        tipJar.tip(10e6, "Grace", "Ship it");
        vm.stopPrank();

        vm.prank(owner);
        tipJar.withdraw(owner, 4e6);

        assertEq(usdc.balanceOf(owner), 4e6);
        assertEq(usdc.balanceOf(address(tipJar)), 6e6);
    }

    function testOnlyOwnerCanWithdraw() public {
        vm.prank(tipper);
        vm.expectRevert(USDCTipJar.NotOwner.selector);
        tipJar.withdraw(tipper, 1);
    }

    function testRejectsZeroTip() public {
        vm.prank(tipper);
        vm.expectRevert(USDCTipJar.AmountIsZero.selector);
        tipJar.tip(0, "", "");
    }
}
