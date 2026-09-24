// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
}

contract BatchERC20Payout {
    uint256 public constant MAX_BATCH_SIZE = 500;

    address public owner;
    bool private locked;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event BatchTransfer(address indexed token, uint256 recipients, uint256 totalAmount);

    error NotOwner();
    error ReentrantCall();
    error InvalidOwner();
    error InvalidBatch();
    error InvalidRecipient(uint256 index);
    error InvalidAmount(uint256 index);
    error TokenTransferFailed(uint256 index);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert InvalidOwner();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert ReentrantCall();
        locked = true;
        _;
        locked = false;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidOwner();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function batchTransfer(
        IERC20 token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external nonReentrant onlyOwner returns (uint256 totalAmount) {
        uint256 length = recipients.length;
        if (address(token) == address(0) || length == 0 || length != amounts.length || length > MAX_BATCH_SIZE) {
            revert InvalidBatch();
        }

        for (uint256 i = 0; i < length;) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];

            if (recipient == address(0)) revert InvalidRecipient(i);
            if (amount == 0) revert InvalidAmount(i);

            totalAmount += amount;
            _safeTransfer(token, recipient, amount, i);

            unchecked {
                ++i;
            }
        }

        emit BatchTransfer(address(token), length, totalAmount);
    }

    function recoverToken(IERC20 token, address to, uint256 amount) external nonReentrant onlyOwner {
        if (to == address(0)) revert InvalidRecipient(0);
        _safeTransfer(token, to, amount, 0);
    }

    function _safeTransfer(IERC20 token, address to, uint256 amount, uint256 index) private {
        (bool ok, bytes memory data) = address(token).call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );

        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TokenTransferFailed(index);
        }
    }
}
