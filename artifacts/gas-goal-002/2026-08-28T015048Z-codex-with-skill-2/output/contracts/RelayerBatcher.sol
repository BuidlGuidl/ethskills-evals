// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Holds a token float and sends many ERC-20 payments in one Base transaction.
/// @dev Transfers are atomic. Do not use for a payment set that needs partial success.
contract RelayerBatcher {
    error Unauthorized();
    error ZeroAddress();
    error InvalidToken();
    error LengthMismatch();
    error EmptyBatch();
    error BatchTooLarge();
    error ReentrantCall();
    error TokenTransferFailed();

    uint256 public constant MAX_BATCH_SIZE = 500;
    address public owner;
    address public relayer;
    uint256 private locked = 1;

    event RelayerUpdated(address indexed relayer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event BatchPaid(address indexed token, uint256 count);
    event TokenSwept(address indexed token, address indexed to, uint256 amount);

    constructor(address initialOwner, address initialRelayer) {
        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();
        owner = initialOwner;
        relayer = initialRelayer;
    }

    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
    modifier onlyRelayer() { if (msg.sender != relayer) revert Unauthorized(); _; }
    modifier nonReentrant() {
        if (locked != 1) revert ReentrantCall();
        locked = 2;
        _;
        locked = 1;
    }

    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert ZeroAddress();
        relayer = newRelayer;
        emit RelayerUpdated(newRelayer);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
        external onlyRelayer nonReentrant
    {
        uint256 length = recipients.length;
        if (length == 0) revert EmptyBatch();
        if (length != amounts.length) revert LengthMismatch();
        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
        if (token.code.length == 0) revert InvalidToken();
        for (uint256 i; i < length; ++i) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            _safeTransfer(token, recipients[i], amounts[i]);
        }
        emit BatchPaid(token, length);
    }

    /// @notice Recovery path for a token float; protect the owner with a multisig.
    function sweep(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (token.code.length == 0) revert InvalidToken();
        _safeTransfer(token, to, amount);
        emit TokenSwept(token, to, amount);
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool ok, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) revert TokenTransferFailed();
    }
}
