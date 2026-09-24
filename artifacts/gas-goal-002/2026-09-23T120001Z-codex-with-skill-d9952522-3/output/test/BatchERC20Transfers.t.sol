// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BatchERC20Transfers, IERC20Transfer} from "../contracts/BatchERC20Transfers.sol";

contract MockERC20 is IERC20Transfer {
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
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract BatchERC20TransfersTest {
    BatchERC20Transfers private batch;
    MockERC20 private token;
    address private recipientA = address(0xA11CE);
    address private recipientB = address(0xB0B);

    function testBatchTransfer() external {
        batch = new BatchERC20Transfers(address(this));
        token = new MockERC20();
        token.mint(address(batch), 30);

        BatchERC20Transfers.Payment[] memory payments = new BatchERC20Transfers.Payment[](2);
        payments[0] = BatchERC20Transfers.Payment({to: recipientA, amount: 10});
        payments[1] = BatchERC20Transfers.Payment({to: recipientB, amount: 20});

        uint256 total = batch.batchTransfer(token, payments);

        require(total == 30, "wrong total");
        require(token.balanceOf(recipientA) == 10, "recipient A not paid");
        require(token.balanceOf(recipientB) == 20, "recipient B not paid");
    }

    function testBatchTransferFrom() external {
        batch = new BatchERC20Transfers(address(this));
        token = new MockERC20();
        token.mint(address(this), 30);
        token.approve(address(batch), type(uint256).max);

        BatchERC20Transfers.Payment[] memory payments = new BatchERC20Transfers.Payment[](2);
        payments[0] = BatchERC20Transfers.Payment({to: recipientA, amount: 10});
        payments[1] = BatchERC20Transfers.Payment({to: recipientB, amount: 20});

        uint256 total = batch.batchTransferFrom(token, address(this), payments);

        require(total == 30, "wrong total");
        require(token.balanceOf(recipientA) == 10, "recipient A not paid");
        require(token.balanceOf(recipientB) == 20, "recipient B not paid");
    }
}
