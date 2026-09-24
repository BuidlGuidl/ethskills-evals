// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract PaymentBatcher {
    error NotOwner();
    error LengthMismatch();
    error EmptyBatch();
    error ZeroAddress();
    error ZeroAmount();
    error TransferFailed();

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Distributed(address indexed token, uint256 count, uint256 totalAmount);
    event PulledAndDistributed(address indexed token, address indexed from, uint256 count, uint256 totalAmount);

    address public owner;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
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

    function distribute(
        IERC20 token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner returns (uint256 totalAmount) {
        uint256 count = _validateBatch(address(token), recipients, amounts);

        for (uint256 i; i < count;) {
            uint256 amount = amounts[i];
            totalAmount += amount;
            _safeTransfer(token, recipients[i], amount);
            unchecked {
                ++i;
            }
        }

        emit Distributed(address(token), count, totalAmount);
    }

    function pullAndDistribute(
        IERC20 token,
        address from,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner returns (uint256 totalAmount) {
        if (from == address(0)) revert ZeroAddress();
        uint256 count = _validateBatch(address(token), recipients, amounts);

        for (uint256 i; i < count;) {
            uint256 amount = amounts[i];
            totalAmount += amount;
            _safeTransferFrom(token, from, recipients[i], amount);
            unchecked {
                ++i;
            }
        }

        emit PulledAndDistributed(address(token), from, count, totalAmount);
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
    }

    function _safeTransfer(IERC20 token, address to, uint256 amount) private {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        (bool success, bytes memory data) =
            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) private {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        (bool success, bytes memory data) =
            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }
}
