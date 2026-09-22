// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TipJar {
    address public immutable usdc;
    address public immutable owner;
    uint256 public totalTips;

    event Tip(address indexed tipper, uint256 amount, string message, uint256 timestamp);
    event Withdrawal(address indexed to, uint256 amount);

    error AmountZero();
    error InvalidAddress();
    error MessageTooLong();
    error OnlyOwner();
    error TransferFailed();

    constructor(address usdc_, address owner_) {
        if (usdc_ == address(0) || owner_ == address(0)) revert InvalidAddress();

        usdc = usdc_;
        owner = owner_;
    }

    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert AmountZero();
        if (bytes(message).length > 280) revert MessageTooLong();

        bool ok = IERC20(usdc).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        totalTips += amount;
        emit Tip(msg.sender, amount, message, block.timestamp);
    }

    function withdraw(address to, uint256 amount) external {
        if (msg.sender != owner) revert OnlyOwner();
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert AmountZero();

        bool ok = IERC20(usdc).transfer(to, amount);
        if (!ok) revert TransferFailed();

        emit Withdrawal(to, amount);
    }

    function balance() external view returns (uint256) {
        return IERC20(usdc).balanceOf(address(this));
    }
}
