// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/PaymentBatcher.sol";

contract MockERC20 {
    mapping(address => uint256) public balanceOf;

    bool public returnFalse;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function setReturnFalse(bool value) external {
        returnFalse = value;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (returnFalse) return false;
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract OtherCaller {
    function callBatch(PaymentBatcher batcher, address token, PaymentBatcher.Payment[] calldata payments)
        external
        returns (bool ok)
    {
        (ok,) = address(batcher).call(abi.encodeCall(PaymentBatcher.batchTransfer, (token, payments)));
    }
}

contract PaymentBatcherTest {
    function testBatchTransferSendsAllPayments() external {
        MockERC20 token = new MockERC20();
        PaymentBatcher batcher = new PaymentBatcher(address(this));
        token.mint(address(batcher), 100);

        PaymentBatcher.Payment[] memory payments = new PaymentBatcher.Payment[](2);
        payments[0] = PaymentBatcher.Payment(address(0xB0B), 40);
        payments[1] = PaymentBatcher.Payment(address(0xCAFE), 25);

        uint256 total = batcher.batchTransfer(address(token), payments);

        require(total == 65, "wrong total");
        require(token.balanceOf(address(0xB0B)) == 40, "first recipient");
        require(token.balanceOf(address(0xCAFE)) == 25, "second recipient");
        require(token.balanceOf(address(batcher)) == 35, "remaining balance");
    }

    function testOnlyOwnerCanBatchTransfer() external {
        MockERC20 token = new MockERC20();
        PaymentBatcher batcher = new PaymentBatcher(address(this));
        OtherCaller other = new OtherCaller();

        PaymentBatcher.Payment[] memory payments = new PaymentBatcher.Payment[](1);
        payments[0] = PaymentBatcher.Payment(address(0xB0B), 1);

        bool ok = other.callBatch(batcher, address(token), payments);
        require(!ok, "non-owner call succeeded");
    }

    function testRejectsZeroRecipient() external {
        MockERC20 token = new MockERC20();
        PaymentBatcher batcher = new PaymentBatcher(address(this));

        PaymentBatcher.Payment[] memory payments = new PaymentBatcher.Payment[](1);
        payments[0] = PaymentBatcher.Payment(address(0), 1);

        (bool ok,) = address(batcher).call(abi.encodeCall(PaymentBatcher.batchTransfer, (address(token), payments)));
        require(!ok, "zero recipient accepted");
    }

    function testRejectsFalseReturningToken() external {
        MockERC20 token = new MockERC20();
        PaymentBatcher batcher = new PaymentBatcher(address(this));
        token.mint(address(batcher), 100);
        token.setReturnFalse(true);

        PaymentBatcher.Payment[] memory payments = new PaymentBatcher.Payment[](1);
        payments[0] = PaymentBatcher.Payment(address(0xB0B), 1);

        (bool ok,) = address(batcher).call(abi.encodeCall(PaymentBatcher.batchTransfer, (address(token), payments)));
        require(!ok, "false transfer accepted");
    }
}
