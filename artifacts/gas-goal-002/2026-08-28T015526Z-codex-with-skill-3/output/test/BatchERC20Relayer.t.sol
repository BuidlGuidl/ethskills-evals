// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BatchERC20Relayer, IERC20} from "../contracts/BatchERC20Relayer.sol";

interface Vm {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    bool public returnsFalse;
    event Transfer(address indexed from, address indexed to, uint256 value);

    function mint(address recipient, uint256 amount) external { balanceOf[recipient] += amount; }
    function setReturnsFalse(bool value) external { returnsFalse = value; }
    function transfer(address recipient, uint256 amount) external returns (bool) {
        if (returnsFalse || balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(msg.sender, recipient, amount);
        return true;
    }
}

contract BatchERC20RelayerTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    BatchERC20Relayer internal relayer;
    MockERC20 internal token;
    address internal constant OWNER = address(0xA11CE);
    address internal constant ALICE = address(0xA11CE1);
    address internal constant BOB = address(0xB0B);

    function assertEq(uint256 actual, uint256 expected) internal pure {
        require(actual == expected, "assertion failed");
    }

    function setUp() public {
        relayer = new BatchERC20Relayer(OWNER);
        token = new MockERC20();
        token.mint(address(relayer), 100);
    }

    function testBatchPaysAllRecipients() public {
        address[] memory recipients = new address[](2);
        recipients[0] = ALICE;
        recipients[1] = BOB;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 40;
        amounts[1] = 60;

        vm.prank(OWNER);
        relayer.batchTransfer(IERC20(address(token)), recipients, amounts);

        assertEq(token.balanceOf(ALICE), 40);
        assertEq(token.balanceOf(BOB), 60);
        assertEq(token.balanceOf(address(relayer)), 0);
    }

    function testOnlyOwnerCanPay() public {
        address[] memory recipients = new address[](1);
        recipients[0] = ALICE;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        vm.expectRevert(BatchERC20Relayer.NotOwner.selector);
        relayer.batchTransfer(IERC20(address(token)), recipients, amounts);
    }

    function testRejectsMismatchedArrays() public {
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](0);
        vm.prank(OWNER);
        vm.expectRevert(BatchERC20Relayer.LengthMismatch.selector);
        relayer.batchTransfer(IERC20(address(token)), recipients, amounts);
    }
}
