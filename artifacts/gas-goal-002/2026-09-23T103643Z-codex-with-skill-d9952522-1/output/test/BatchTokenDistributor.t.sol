// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BatchTokenDistributor} from "../src/BatchTokenDistributor.sol";

contract BatchTokenDistributorTest {
    function testDistributesTokensAndReturnsTotal() external {
        MockToken token = new MockToken();
        BatchTokenDistributor distributor = new BatchTokenDistributor(address(this));

        address[] memory recipients = new address[](3);
        recipients[0] = address(0xBEEF1);
        recipients[1] = address(0xBEEF2);
        recipients[2] = address(0xBEEF3);

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100;
        amounts[1] = 200;
        amounts[2] = 300;

        token.mint(address(distributor), 600);
        uint256 total = distributor.distribute(address(token), recipients, amounts);

        require(total == 600, "wrong total");
        require(token.balanceOf(recipients[0]) == 100, "recipient 0 balance");
        require(token.balanceOf(recipients[1]) == 200, "recipient 1 balance");
        require(token.balanceOf(recipients[2]) == 300, "recipient 2 balance");
        require(token.balanceOf(address(distributor)) == 0, "distributor balance");
    }

    function testGasDistribute100Recipients() external {
        MockToken token = new MockToken();
        BatchTokenDistributor distributor = new BatchTokenDistributor(address(this));

        address[] memory recipients = new address[](100);
        uint256[] memory amounts = new uint256[](100);

        for (uint256 i = 0; i < recipients.length; ++i) {
            recipients[i] = address(uint160(0x1000 + i));
            amounts[i] = 1;
        }

        token.mint(address(distributor), 100);
        uint256 total = distributor.distribute(address(token), recipients, amounts);

        require(total == 100, "wrong total");
        require(token.balanceOf(recipients[0]) == 1, "first recipient");
        require(token.balanceOf(recipients[99]) == 1, "last recipient");
    }

    function testOwnerCanSetOperator() external {
        MockToken token = new MockToken();
        BatchTokenDistributor distributor = new BatchTokenDistributor(address(this));
        Operator operator = new Operator(distributor);

        address[] memory recipients = new address[](1);
        recipients[0] = address(0xBEEF1);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 123;

        token.mint(address(distributor), 123);
        distributor.setOperator(address(operator), true);
        operator.distribute(address(token), recipients, amounts);

        require(token.balanceOf(recipients[0]) == 123, "operator transfer failed");
    }

    function testRejectsNonOperator() external {
        MockToken token = new MockToken();
        BatchTokenDistributor distributor = new BatchTokenDistributor(address(this));
        Operator operator = new Operator(distributor);

        address[] memory recipients = new address[](1);
        recipients[0] = address(0xBEEF1);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 123;

        token.mint(address(distributor), 123);
        (bool ok,) = address(operator).call(abi.encodeCall(Operator.distribute, (address(token), recipients, amounts)));
        require(!ok, "non-operator should fail");
    }

    function testRejectsLengthMismatch() external {
        MockToken token = new MockToken();
        BatchTokenDistributor distributor = new BatchTokenDistributor(address(this));

        address[] memory recipients = new address[](1);
        recipients[0] = address(0xBEEF1);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 123;
        amounts[1] = 456;

        (bool ok,) = address(distributor)
            .call(abi.encodeCall(BatchTokenDistributor.distribute, (address(token), recipients, amounts)));
        require(!ok, "length mismatch should fail");
    }

    function testRecoversTokens() external {
        MockToken token = new MockToken();
        BatchTokenDistributor distributor = new BatchTokenDistributor(address(this));

        token.mint(address(distributor), 999);
        distributor.recoverToken(address(token), address(0xCAFE), 999);

        require(token.balanceOf(address(0xCAFE)) == 999, "recovery failed");
    }
}

contract Operator {
    BatchTokenDistributor private immutable distributor;

    constructor(BatchTokenDistributor distributor_) {
        distributor = distributor_;
    }

    function distribute(address token, address[] calldata recipients, uint256[] calldata amounts)
        external
        returns (uint256)
    {
        return distributor.distribute(token, recipients, amounts);
    }
}

contract MockToken {
    mapping(address => uint256) public balanceOf;

    function mint(address recipient, uint256 amount) external {
        balanceOf[recipient] += amount;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }
}
