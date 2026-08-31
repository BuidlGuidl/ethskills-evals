// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BatchPayer} from "../src/BatchPayer.sol";
import {MockERC20} from "../src/MockERC20.sol";

interface Vm {
    function prank(address) external;
}

contract BatchPayerTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OWNER = address(0xA11CE);
    address private constant RECIPIENT_A = address(0xB0B);
    address private constant RECIPIENT_B = address(0xCA01);
    address private constant RECIPIENT_C = address(0xD0D);

    BatchPayer private payer;
    MockERC20 private token;

    function setUp() public {
        payer = new BatchPayer(OWNER);
        token = new MockERC20(address(payer), 1_000_000);
    }

    function testPaysBatch() public {
        address[] memory recipients = new address[](3);
        recipients[0] = RECIPIENT_A;
        recipients[1] = RECIPIENT_B;
        recipients[2] = RECIPIENT_C;
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 11;
        amounts[1] = 22;
        amounts[2] = 33;

        vm.prank(OWNER);
        payer.pay(address(token), recipients, amounts);

        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
    }

    function testRejectsNonOwner() public {
        address[] memory recipients = new address[](1);
        recipients[0] = RECIPIENT_A;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        (bool ok,) = address(payer).call(
            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
        );
        require(!ok, "non-owner paid");
    }

    // This is deliberately separate from the batch test so `forge test
    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
    function testDirectTransfersBaseline() public {
        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
        vm.prank(OWNER);
        directToken.transfer(RECIPIENT_A, 11);
        vm.prank(OWNER);
        directToken.transfer(RECIPIENT_B, 22);
        vm.prank(OWNER);
        directToken.transfer(RECIPIENT_C, 33);
    }

    function testPaysHundredRecipients() public {
        address[] memory recipients = new address[](100);
        uint256[] memory amounts = new uint256[](100);
        for (uint256 i; i < 100; ++i) {
            recipients[i] = address(uint160(i + 0x1000));
            amounts[i] = 1;
        }
        vm.prank(OWNER);
        payer.pay(address(token), recipients, amounts);
        require(token.balanceOf(recipients[99]) == 1, "last recipient not paid");
    }
}
