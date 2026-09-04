// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Transfers one ERC-20 from msg.sender to many recipients in one transaction.
/// @dev The caller must approve this contract first. The call is atomic: a failed token
///      transfer reverts the whole batch, which prevents a partially paid payroll run.
contract BatchERC20Distributor {
    uint256 public constant MAX_RECIPIENTS = 200;

    error EmptyBatch();
    error LengthMismatch();
    error BatchTooLarge(uint256 length);
    error InvalidToken(address token);
    error ZeroRecipient(uint256 index);
    error ZeroAmount(uint256 index);
    error TokenTransferFailed(uint256 index);

    event BatchTransferred(
        address indexed token,
        address indexed sender,
        uint256 recipients,
        uint256 totalAmount
    );

    /// @param token ERC-20 paid by the caller.
    /// @param recipients Payment recipients. No zero address is accepted.
    /// @param amounts Token base-unit amounts, one for each recipient.
    function batchTransferFrom(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        uint256 length = recipients.length;
        if (length == 0) revert EmptyBatch();
        if (length != amounts.length) revert LengthMismatch();
        if (length > MAX_RECIPIENTS) revert BatchTooLarge(length);
        if (token.code.length == 0) revert InvalidToken(token);

        uint256 totalAmount;
        for (uint256 i; i < length;) {
            address recipient = recipients[i];
            if (recipient == address(0)) revert ZeroRecipient(i);
            uint256 amount = amounts[i];
            if (amount == 0) revert ZeroAmount(i);
            totalAmount += amount;

            // Accept both standard ERC-20s (bool return) and established tokens that
            // return no value. Any false return, revert, or malformed return fails.
            (bool success, bytes memory result) = token.call(
                abi.encodeWithSelector(0x23b872dd, msg.sender, recipient, amount)
            );
            if (!success || (result.length != 0 && (result.length != 32 || !abi.decode(result, (bool))))) {
                revert TokenTransferFailed(i);
            }

            unchecked { ++i; }
        }

        emit BatchTransferred(token, msg.sender, length, totalAmount);
    }
}
