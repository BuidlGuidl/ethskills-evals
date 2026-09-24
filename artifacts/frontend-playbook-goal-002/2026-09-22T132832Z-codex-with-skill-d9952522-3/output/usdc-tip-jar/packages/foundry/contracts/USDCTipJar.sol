// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract USDCTipJar {
    error AmountIsZero();
    error EmptyRecipient();
    error MessageTooLong();
    error NameTooLong();
    error NotOwner();
    error TokenTransferFailed();

    struct Tip {
        address tipper;
        uint256 amount;
        string name;
        string message;
        uint256 timestamp;
    }

    IERC20 public immutable usdc;
    address public immutable owner;
    uint256 public totalAmount;

    Tip[] private tips;

    event TipReceived(
        address indexed tipper, uint256 indexed tipId, uint256 amount, string name, string message, uint256 timestamp
    );
    event Withdrawn(address indexed to, uint256 amount);

    constructor(address _owner, address _usdc) {
        if (_owner == address(0) || _usdc == address(0)) {
            revert EmptyRecipient();
        }

        owner = _owner;
        usdc = IERC20(_usdc);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        _;
    }

    function tip(uint256 amount, string calldata name, string calldata message) external {
        if (amount == 0) {
            revert AmountIsZero();
        }
        if (bytes(name).length > 64) {
            revert NameTooLong();
        }
        if (bytes(message).length > 280) {
            revert MessageTooLong();
        }

        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) {
            revert TokenTransferFailed();
        }

        tips.push(Tip({ tipper: msg.sender, amount: amount, name: name, message: message, timestamp: block.timestamp }));
        totalAmount += amount;

        emit TipReceived(msg.sender, tips.length - 1, amount, name, message, block.timestamp);
    }

    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) {
            revert EmptyRecipient();
        }

        bool success = usdc.transfer(to, amount);
        if (!success) {
            revert TokenTransferFailed();
        }

        emit Withdrawn(to, amount);
    }

    function tipCount() external view returns (uint256) {
        return tips.length;
    }

    function getTip(uint256 tipId) external view returns (Tip memory) {
        return tips[tipId];
    }

    function getTips() external view returns (Tip[] memory) {
        return tips;
    }
}
