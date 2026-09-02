// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
}

/// @notice Holds one ERC-20 and sends many payments in one Base transaction.
/// @dev Fund this contract before calling distribute.  Deploy one instance per token.
contract BatchTokenDistributor {
    error NotOwner();
    error LengthMismatch();
    error EmptyBatch();
    error ZeroRecipient(uint256 index);
    error TransferFailed(uint256 index);

    IERC20 public immutable token;
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event BatchDistributed(uint256 recipients, uint256 totalAmount);

    constructor(IERC20 token_, address owner_) {
        token = token_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function distribute(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        uint256 length = recipients.length;
        if (length == 0) revert EmptyBatch();
        if (length != amounts.length) revert LengthMismatch();

        uint256 total;
        for (uint256 i; i < length; ++i) {
            if (recipients[i] == address(0)) revert ZeroRecipient(i);
            if (!token.transfer(recipients[i], amounts[i])) revert TransferFailed(i);
            total += amounts[i];
        }
        emit BatchDistributed(length, total);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroRecipient(0);
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
