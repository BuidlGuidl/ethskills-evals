// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";

contract MockToken is IERC20 {
    mapping(address => uint256) public balanceOf;
    bool public fail;

    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
    function setFail(bool value) external { fail = value; }
    function transfer(address to, uint256 amount) external returns (bool) {
        if (fail || balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract BatchDistributorTest {
    BatchDistributor private distributor;
    MockToken private token;

    function setUp() public {
        distributor = new BatchDistributor(address(this));
        token = new MockToken();
        token.mint(address(distributor), 1000);
    }

    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
        address[] memory recipients = new address[](2);
        recipients[0] = address(0xA11CE);
        recipients[1] = address(0xB0B);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10;
        amounts[1] = 20;

        distributor.distribute(token, recipients, amounts);

        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
    }

    function testRejectsMismatchedInput() public {
        address[] memory recipients = new address[](1);
        recipients[0] = address(0xA11CE);
        uint256[] memory amounts = new uint256[](0);
        (bool ok,) = address(distributor).call(
            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
        );
        require(!ok, "mismatched input accepted");
    }

    function test_RevertWhen_TokenTransferFails() public {
        address[] memory recipients = new address[](2);
        recipients[0] = address(0xA11CE);
        recipients[1] = address(0xB0B);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10;
        amounts[1] = 20;
        token.setFail(true);

        (bool ok,) = address(distributor).call(
            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
        );
        require(!ok, "failed transfer accepted");
        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
    }
}
