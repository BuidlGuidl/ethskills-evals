// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20Transfer {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract BatchRelayer {
    address public owner;

    error NotOwner();
    error ArrayMismatch();
    error TransferFailed(uint256 index);

    event BatchTransferred(address indexed token, uint256 count);
    event MultiBatchTransferred(uint256 count);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        uint256 n = recipients.length;
        if (n == 0 || n != amounts.length) revert ArrayMismatch();
        for (uint256 i = 0; i < n; ++i) {
            _safeTransfer(token, recipients[i], amounts[i], i);
        }
        emit BatchTransferred(token, n);
    }

    function batchTransferMulti(
        address[] calldata tokens,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        uint256 n = tokens.length;
        if (n == 0 || n != recipients.length || n != amounts.length) revert ArrayMismatch();
        for (uint256 i = 0; i < n; ++i) {
            _safeTransfer(tokens[i], recipients[i], amounts[i], i);
        }
        emit MultiBatchTransferred(n);
    }

    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        _safeTransfer(token, to, amount, 0);
    }

    function transferOwnership(address next) external onlyOwner {
        address prev = owner;
        owner = next;
        emit OwnershipTransferred(prev, next);
    }

    function _safeTransfer(address token, address to, uint256 amount, uint256 index) private {
        (bool ok, bytes memory ret) = token.call(abi.encodeWithSelector(IERC20Transfer.transfer.selector, to, amount));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed(index);
    }
}