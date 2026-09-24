// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract Erc20BatchRelayer {
    struct Transfer {
        address to;
        uint256 amount;
    }

    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event BatchTransfer(address indexed token, uint256 count, uint256 totalAmount);

    error NotOwner();
    error ZeroAddress();
    error EmptyBatch();
    error TransferFailed(uint256 index);

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

    function batchTransfer(IERC20 token, Transfer[] calldata transfers) external onlyOwner {
        if (address(token) == address(0)) revert ZeroAddress();
        if (transfers.length == 0) revert EmptyBatch();

        uint256 totalAmount;
        for (uint256 i = 0; i < transfers.length; i++) {
            address recipient = transfers[i].to;
            uint256 amount = transfers[i].amount;
            if (recipient == address(0)) revert ZeroAddress();

            totalAmount += amount;
            if (!_safeTransfer(token, recipient, amount)) revert TransferFailed(i);
        }

        emit BatchTransfer(address(token), transfers.length, totalAmount);
    }

    function rescueToken(IERC20 token, address to, uint256 amount) external onlyOwner {
        if (address(token) == address(0) || to == address(0)) revert ZeroAddress();
        if (!_safeTransfer(token, to, amount)) revert TransferFailed(0);
    }

    function _safeTransfer(IERC20 token, address to, uint256 amount) private returns (bool) {
        (bool success, bytes memory returnData) = address(token).call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        return success && (returnData.length == 0 || abi.decode(returnData, (bool)));
    }
}
