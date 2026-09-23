// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Like {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract BatchTokenRelayer {
    uint256 public constant MAX_BATCH_SIZE = 500;

    address public owner;
    mapping(address => bool) public operators;

    error EmptyBatch();
    error LengthMismatch();
    error TransferFailed(uint256 index);
    error Unauthorized();
    error ZeroAddress();
    error TooManyRecipients();

    event BatchTransfer(address indexed operator, address indexed token, uint256 count, uint256 total);
    event BatchTransferFrom(
        address indexed operator,
        address indexed token,
        address indexed from,
        uint256 count,
        uint256 total
    );
    event OperatorSet(address indexed operator, bool enabled);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != owner && !operators[msg.sender]) revert Unauthorized();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setOperator(address operator, bool enabled) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        operators[operator] = enabled;
        emit OperatorSet(operator, enabled);
    }

    function batchTransfer(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOperator returns (uint256 total) {
        uint256 count = _validateBatch(token, recipients, amounts);

        for (uint256 i = 0; i < count; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            total += amounts[i];
            _callToken(token, abi.encodeCall(IERC20Like.transfer, (recipients[i], amounts[i])), i);
        }

        emit BatchTransfer(msg.sender, token, count, total);
    }

    function batchTransferFrom(
        address token,
        address from,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOperator returns (uint256 total) {
        if (from == address(0)) revert ZeroAddress();
        uint256 count = _validateBatch(token, recipients, amounts);

        for (uint256 i = 0; i < count; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            total += amounts[i];
            _callToken(token, abi.encodeCall(IERC20Like.transferFrom, (from, recipients[i], amounts[i])), i);
        }

        emit BatchTransferFrom(msg.sender, token, from, count, total);
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        _callToken(token, abi.encodeCall(IERC20Like.transfer, (to, amount)), 0);
    }

    function _validateBatch(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) private pure returns (uint256 count) {
        if (token == address(0)) revert ZeroAddress();
        count = recipients.length;
        if (count == 0) revert EmptyBatch();
        if (count != amounts.length) revert LengthMismatch();
        if (count > MAX_BATCH_SIZE) revert TooManyRecipients();
    }

    function _callToken(address token, bytes memory data, uint256 index) private {
        (bool ok, bytes memory result) = token.call(data);
        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
            revert TransferFailed(index);
        }
    }
}
