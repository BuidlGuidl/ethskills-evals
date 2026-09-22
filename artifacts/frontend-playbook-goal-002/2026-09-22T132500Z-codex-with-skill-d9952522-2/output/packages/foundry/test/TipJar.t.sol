// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../contracts/TipJar.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function prank(address msgSender) external;
    function expectRevert(bytes4 revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData, address emitter) external;
}

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
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract TipJarTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockUSDC public usdc;
    TipJar public tipJar;

    address public owner;
    address public tipper;

    function setUp() public {
        owner = vm.addr(1);
        tipper = vm.addr(2);
        usdc = new MockUSDC();
        tipJar = new TipJar(owner, address(usdc));
        usdc.mint(tipper, 100e6);
    }

    function testAcceptsUsdcTip() public {
        vm.startPrank(tipper);
        usdc.approve(address(tipJar), 25e6);

        vm.expectEmit(true, true, false, true, address(tipJar));
        emit TipJar.TipSent(0, tipper, "Ada", "For public goods", 25e6, block.timestamp);

        tipJar.tip("Ada", "For public goods", 25e6);
        vm.stopPrank();

        require(usdc.balanceOf(address(tipJar)) == 25e6, "bad jar balance");
        require(tipJar.tipCount() == 1, "bad tip count");
        require(tipJar.totalTips() == 25e6, "bad total");

        (address from, string memory name, string memory message, uint256 amount, uint256 timestamp) = tipJar.tips(0);
        require(from == tipper, "bad tipper");
        require(keccak256(bytes(name)) == keccak256("Ada"), "bad name");
        require(keccak256(bytes(message)) == keccak256("For public goods"), "bad message");
        require(amount == 25e6, "bad amount");
        require(timestamp == block.timestamp, "bad timestamp");
    }

    function testRejectsZeroAmount() public {
        vm.prank(tipper);
        vm.expectRevert(TipJar.InvalidAmount.selector);
        tipJar.tip("Ada", "gm", 0);
    }

    function testOnlyOwnerCanWithdraw() public {
        vm.startPrank(tipper);
        usdc.approve(address(tipJar), 10e6);
        tipJar.tip("Ada", "gm", 10e6);
        vm.stopPrank();

        vm.prank(tipper);
        vm.expectRevert(TipJar.NotOwner.selector);
        tipJar.withdraw(tipper, 1e6);

        vm.prank(owner);
        tipJar.withdraw(owner, 4e6);

        require(usdc.balanceOf(owner) == 4e6, "bad owner balance");
        require(usdc.balanceOf(address(tipJar)) == 6e6, "bad jar remainder");
    }
}
