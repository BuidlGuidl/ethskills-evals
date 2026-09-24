// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract TipJar {
    address public constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    uint256 public constant MAX_MESSAGE_BYTES = 280;

    address public immutable owner;

    event Tip(address indexed tipper, uint256 amount, string message, uint256 timestamp);
    event Withdraw(address indexed recipient, uint256 amount);

    error AmountIsZero();
    error MessageTooLong();
    error NotOwner();
    error TransferFailed();

    constructor(address owner_) {
        owner = owner_;
    }

    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert AmountIsZero();
        if (bytes(message).length > MAX_MESSAGE_BYTES) revert MessageTooLong();

        bool ok = IERC20(BASE_USDC).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        emit Tip(msg.sender, amount, message, block.timestamp);
    }

    function withdraw(address recipient, uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        if (amount == 0) revert AmountIsZero();

        bool ok = IERC20(BASE_USDC).transfer(recipient, amount);
        if (!ok) revert TransferFailed();

        emit Withdraw(recipient, amount);
    }
}
