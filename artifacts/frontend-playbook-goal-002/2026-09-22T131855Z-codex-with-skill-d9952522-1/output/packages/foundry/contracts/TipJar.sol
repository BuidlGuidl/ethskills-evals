// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TipJar {
    error InvalidAddress();
    error InvalidAmount();
    error MessageTooLong();
    error NotOwner();
    error TransferFailed();

    struct Tip {
        address tipper;
        uint256 amount;
        string message;
        uint256 timestamp;
    }

    IERC20 public immutable usdc;
    address public immutable owner;
    uint256 public totalTips;

    Tip[] private tips;

    event TipReceived(uint256 indexed tipId, address indexed tipper, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);

    constructor(address _owner, address _usdc) {
        if (_owner == address(0) || _usdc == address(0)) {
            revert InvalidAddress();
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

    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (bytes(message).length > 280) {
            revert MessageTooLong();
        }

        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) {
            revert TransferFailed();
        }

        uint256 tipId = tips.length;
        uint256 timestamp = block.timestamp;
        tips.push(Tip({ tipper: msg.sender, amount: amount, message: message, timestamp: timestamp }));
        totalTips += amount;

        emit TipReceived(tipId, msg.sender, amount, message, timestamp);
    }

    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) {
            revert InvalidAddress();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        bool success = usdc.transfer(to, amount);
        if (!success) {
            revert TransferFailed();
        }

        emit Withdrawn(to, amount);
    }

    function withdrawAll(address to) external onlyOwner {
        if (to == address(0)) {
            revert InvalidAddress();
        }

        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) {
            revert InvalidAmount();
        }

        bool success = usdc.transfer(to, balance);
        if (!success) {
            revert TransferFailed();
        }

        emit Withdrawn(to, balance);
    }

    function tipCount() external view returns (uint256) {
        return tips.length;
    }

    function getTip(uint256 tipId) external view returns (Tip memory) {
        return tips[tipId];
    }

    function usdcBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
