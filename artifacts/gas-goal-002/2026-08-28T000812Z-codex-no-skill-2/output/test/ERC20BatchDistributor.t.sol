// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20BatchDistributor} from "../src/ERC20BatchDistributor.sol";

interface Vm {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockERC20 {
    mapping(address => uint256) public balanceOf;

    function mint(address account, uint256 amount) external {
        balanceOf[account] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        unchecked {
            balanceOf[msg.sender] -= amount;
            balanceOf[to] += amount;
        }
        return true;
    }
}

contract ERC20BatchDistributorTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    ERC20BatchDistributor private distributor;
    MockERC20 private token;
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant ATTACKER = address(0xBAD);

    function setUp() public {
        distributor = new ERC20BatchDistributor();
        token = new MockERC20();
        token.mint(address(distributor), 1_000 ether);
    }

    function testBatchTransfersPackedPayments() public {
        bytes memory payments = abi.encodePacked(ALICE, uint256(123 ether), BOB, uint256(7 ether));
        distributor.batchTransfer(address(token), payments);

        require(token.balanceOf(ALICE) == 123 ether, "alice was not paid");
        require(token.balanceOf(BOB) == 7 ether, "bob was not paid");
        require(token.balanceOf(address(distributor)) == 870 ether, "wrong remaining balance");
    }

    function testRejectsUnalignedPaymentData() public {
        vm.expectRevert(ERC20BatchDistributor.InvalidPaymentData.selector);
        distributor.batchTransfer(address(token), hex"00");
    }

    function testOnlyRelayerCanSpendCustodiedFunds() public {
        bytes memory payments = abi.encodePacked(ALICE, uint256(1 ether));
        vm.prank(ATTACKER);
        vm.expectRevert(ERC20BatchDistributor.Unauthorized.selector);
        distributor.batchTransfer(address(token), payments);
    }

    function testOwnerCanRecoverFunds() public {
        distributor.withdraw(address(token), ALICE, 10 ether);
        require(token.balanceOf(ALICE) == 10 ether, "withdraw failed");
    }
}
