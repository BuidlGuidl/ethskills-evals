// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal ERC-20 interface used by BatchDistributor.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
contract BatchDistributor {
    error NotOperator();
    error LengthMismatch();
    error EmptyBatch();
    error BatchTooLarge();
    error ZeroRecipient(uint256 index);
    error TransferFailed(address token, address recipient, uint256 amount);

    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
    uint256 public constant MAX_BATCH_SIZE = 200;

    address public immutable operator;

    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);

    constructor(address operator_) {
        if (operator_ == address(0)) revert ZeroRecipient(0);
        operator = operator_;
    }

    /// @notice Distribute `token` already held by this contract.
    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
        if (msg.sender != operator) revert NotOperator();

        uint256 length = recipients.length;
        if (length == 0) revert EmptyBatch();
        if (length != amounts.length) revert LengthMismatch();
        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();

        uint256 totalAmount;
        for (uint256 i; i < length; ++i) {
            address recipient = recipients[i];
            if (recipient == address(0)) revert ZeroRecipient(i);

            uint256 amount = amounts[i];
            totalAmount += amount;
            if (!token.transfer(recipient, amount)) {
                revert TransferFailed(address(token), recipient, amount);
            }
        }

        emit Distributed(address(token), length, totalAmount);
    }
}
