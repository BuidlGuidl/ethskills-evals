// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Transfer {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract PackedERC20BatchDistributor {
    error NotOwner();
    error NotExecutor();
    error InvalidPackedLength();
    error TransferFailed(address token, address to, uint256 amount);

    event OwnerTransferred(address indexed oldOwner, address indexed newOwner);
    event ExecutorSet(address indexed executor, bool allowed);
    event Distributed(address indexed token, address indexed executor, uint256 count, uint256 totalAmount);

    address public owner;
    mapping(address => bool) public executors;

    constructor(address initialOwner) {
        owner = initialOwner == address(0) ? msg.sender : initialOwner;
        emit OwnerTransferred(address(0), owner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyExecutor() {
        if (msg.sender != owner && !executors[msg.sender]) revert NotExecutor();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert NotOwner();
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setExecutor(address executor, bool allowed) external onlyOwner {
        executors[executor] = allowed;
        emit ExecutorSet(executor, allowed);
    }

    function distributePacked(address token, bytes calldata packedPayments) external onlyExecutor {
        if (packedPayments.length % 32 != 0) revert InvalidPackedLength();

        uint256 count = packedPayments.length / 32;
        uint256 totalAmount;

        for (uint256 i; i < count; ) {
            uint256 offset = i * 32;
            address to;
            uint96 amount;

            assembly {
                let word := calldataload(add(packedPayments.offset, offset))
                to := shr(96, word)
                amount := and(word, 0xffffffffffffffffffffffff)
            }

            totalAmount += amount;
            _safeTransfer(token, to, amount);

            unchecked {
                ++i;
            }
        }

        emit Distributed(token, msg.sender, count, totalAmount);
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        _safeTransfer(token, to, amount);
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeCall(IERC20Transfer.transfer, (to, amount))
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed(token, to, amount);
        }
    }
}
