// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract USDCTipJar {
    struct Tip {
        address from;
        uint256 amount;
        string message;
        uint256 timestamp;
    }

    address public immutable usdc;
    address public owner;
    address public recipient;

    Tip[] private tips;

    event TipReceived(
        uint256 indexed tipId,
        address indexed from,
        address indexed recipient,
        uint256 amount,
        string message,
        uint256 timestamp
    );
    event RecipientUpdated(address indexed previousRecipient, address indexed newRecipient);

    error AmountMustBePositive();
    error MessageTooLong();
    error TransferFailed();
    error NotOwner();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address usdc_, address recipient_) {
        if (usdc_ == address(0) || recipient_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
        owner = msg.sender;
        recipient = recipient_;
    }

    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert AmountMustBePositive();
        if (bytes(message).length > 280) revert MessageTooLong();

        bool transferred = IERC20(usdc).transferFrom(msg.sender, recipient, amount);
        if (!transferred) revert TransferFailed();

        uint256 tipId = tips.length;
        tips.push(Tip({from: msg.sender, amount: amount, message: message, timestamp: block.timestamp}));

        emit TipReceived(tipId, msg.sender, recipient, amount, message, block.timestamp);
    }

    function updateRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        address previousRecipient = recipient;
        recipient = newRecipient;
        emit RecipientUpdated(previousRecipient, newRecipient);
    }

    function getTipCount() external view returns (uint256) {
        return tips.length;
    }

    function getTips(uint256 start, uint256 count) external view returns (Tip[] memory) {
        uint256 tipCount = tips.length;
        if (start >= tipCount || count == 0) return new Tip[](0);

        uint256 end = start + count;
        if (end > tipCount) end = tipCount;

        Tip[] memory page = new Tip[](end - start);
        for (uint256 i = start; i < end; i++) {
            page[i - start] = tips[i];
        }

        return page;
    }
}
