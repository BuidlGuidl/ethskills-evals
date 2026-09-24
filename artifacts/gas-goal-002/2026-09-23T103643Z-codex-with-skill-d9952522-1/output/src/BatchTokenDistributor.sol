// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Distributes ERC-20 balances held by this contract to many recipients.
/// @dev Intended for high-volume relayers that custody the tokens being sent.
contract BatchTokenDistributor {
    error LengthMismatch();
    error NotOwner();
    error NotOperator();
    error TokenTransferFailed(address token, address recipient, uint256 amount);
    error ZeroAddress();

    event OperatorSet(address indexed operator, bool allowed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TokensDistributed(address indexed operator, address indexed token, uint256 recipients, uint256 totalAmount);
    event TokensRecovered(address indexed token, address indexed recipient, uint256 amount);

    address public owner;
    mapping(address => bool) public operators;

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        operators[initialOwner] = true;
        emit OwnershipTransferred(address(0), initialOwner);
        emit OperatorSet(initialOwner, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOperator() {
        if (!operators[msg.sender]) revert NotOperator();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        operators[newOwner] = true;
        emit OwnershipTransferred(previousOwner, newOwner);
        emit OperatorSet(newOwner, true);
    }

    function setOperator(address operator, bool allowed) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function distribute(address token, address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyOperator
        returns (uint256 totalAmount)
    {
        if (token == address(0)) revert ZeroAddress();
        if (recipients.length != amounts.length) revert LengthMismatch();

        for (uint256 i = 0; i < recipients.length; ++i) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];
            if (recipient == address(0)) revert ZeroAddress();
            totalAmount += amount;
            _safeTransfer(token, recipient, amount);
        }

        emit TokensDistributed(msg.sender, token, recipients.length, totalAmount);
    }

    function recoverToken(address token, address recipient, uint256 amount) external onlyOwner {
        if (token == address(0) || recipient == address(0)) revert ZeroAddress();
        _safeTransfer(token, recipient, amount);
        emit TokensRecovered(token, recipient, amount);
    }

    function _safeTransfer(address token, address recipient, uint256 amount) internal {
        (bool success, bytes memory returnData) =
            token.call(abi.encodeWithSelector(bytes4(0xa9059cbb), recipient, amount));
        if (!success || (returnData.length != 0 && !abi.decode(returnData, (bool)))) {
            revert TokenTransferFailed(token, recipient, amount);
        }
    }
}
