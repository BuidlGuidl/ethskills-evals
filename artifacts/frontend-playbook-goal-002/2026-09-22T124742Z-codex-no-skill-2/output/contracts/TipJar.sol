// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract TipJar {
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    uint256 public constant MAX_MESSAGE_LENGTH = 280;

    address public immutable owner;
    address public beneficiary;
    uint256 public totalTips;
    uint256 public totalAmount;

    struct Tip {
        address sender;
        uint256 amount;
        string message;
        uint256 timestamp;
    }

    Tip[] private tips;

    event Tipped(
        uint256 indexed tipId,
        address indexed sender,
        uint256 amount,
        string message,
        uint256 timestamp
    );
    event BeneficiaryUpdated(address indexed previousBeneficiary, address indexed newBeneficiary);

    error AmountMustBePositive();
    error MessageTooLong();
    error OnlyOwner();
    error InvalidBeneficiary();
    error TransferFailed();

    constructor(address initialBeneficiary) {
        if (initialBeneficiary == address(0)) revert InvalidBeneficiary();
        owner = msg.sender;
        beneficiary = initialBeneficiary;
    }

    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert AmountMustBePositive();
        if (bytes(message).length > MAX_MESSAGE_LENGTH) revert MessageTooLong();

        bool transferred = IERC20(USDC).transferFrom(msg.sender, beneficiary, amount);
        if (!transferred) revert TransferFailed();

        uint256 tipId = tips.length;
        uint256 timestamp = block.timestamp;
        tips.push(Tip({
            sender: msg.sender,
            amount: amount,
            message: message,
            timestamp: timestamp
        }));

        totalTips += 1;
        totalAmount += amount;

        emit Tipped(tipId, msg.sender, amount, message, timestamp);
    }

    function updateBeneficiary(address newBeneficiary) external {
        if (msg.sender != owner) revert OnlyOwner();
        if (newBeneficiary == address(0)) revert InvalidBeneficiary();

        address previousBeneficiary = beneficiary;
        beneficiary = newBeneficiary;
        emit BeneficiaryUpdated(previousBeneficiary, newBeneficiary);
    }

    function tipCount() external view returns (uint256) {
        return tips.length;
    }

    function getTip(uint256 tipId) external view returns (Tip memory) {
        return tips[tipId];
    }

    function getRecentTips(uint256 limit) external view returns (Tip[] memory recentTips) {
        uint256 count = tips.length;
        uint256 size = limit < count ? limit : count;
        recentTips = new Tip[](size);

        for (uint256 i = 0; i < size; i++) {
            recentTips[i] = tips[count - 1 - i];
        }
    }
}
