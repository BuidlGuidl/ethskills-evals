// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Holds payment tokens and distributes them in one transaction.
/// @dev Fund this contract directly. Do not use `transferFrom` for every
/// recipient: the allowance update and extra call remove much of the benefit.
contract BatchPayer {
    error Unauthorized();
    error ReentrantCall();
    error LengthMismatch();
    error EmptyBatch();
    error BatchTooLarge();
    error TokenTransferFailed(uint256 index);

    uint256 public constant MAX_RECIPIENTS = 200;

    address public immutable owner;
    uint256 private locked = 1;

    event BatchPaid(address indexed token, uint256 recipients, uint256 total);

    constructor(address owner_) {
        if (owner_ == address(0)) revert Unauthorized();
        owner = owner_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert ReentrantCall();
        locked = 2;
        _;
        locked = 1;
    }

    /// @notice Pays every recipient from this contract's balance.
    /// @dev Supports ERC-20s that either return true or return no value.
    function pay(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner nonReentrant {
        uint256 length = recipients.length;
        if (length == 0) revert EmptyBatch();
        if (length != amounts.length) revert LengthMismatch();
        if (length > MAX_RECIPIENTS) revert BatchTooLarge();

        uint256 total;
        for (uint256 i; i < length; ++i) {
            total += amounts[i];
            _safeTransfer(token, recipients[i], amounts[i], i);
        }
        emit BatchPaid(token, length, total);
    }

    /// @notice Lets the owner recover a token after a failed or retired campaign.
    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
        _safeTransfer(token, recipient, amount, type(uint256).max);
    }

    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
        (bool ok, bytes memory result) = token.call(
            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
        );
        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
            revert TokenTransferFailed(index);
        }
    }
}
