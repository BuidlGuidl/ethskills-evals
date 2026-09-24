// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract UsdcTipJar {
    struct Tip {
        address sender;
        uint256 amount;
        string message;
        uint256 timestamp;
    }

    address public immutable usdc;
    address public owner;
    Tip[] private tips;

    event TipReceived(
        address indexed sender,
        uint256 amount,
        string message,
        uint256 timestamp,
        uint256 indexed tipId
    );
    event Withdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error InvalidAddress();
    error EmptyTip();
    error MessageTooLong();
    error TransferFailed();
    error NotOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address usdc_, address owner_) {
        if (usdc_ == address(0) || owner_ == address(0)) revert InvalidAddress();
        usdc = usdc_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert EmptyTip();
        if (bytes(message).length > 280) revert MessageTooLong();

        if (!IERC20(usdc).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        uint256 tipId = tips.length;
        Tip memory newTip = Tip({
            sender: msg.sender,
            amount: amount,
            message: message,
            timestamp: block.timestamp
        });

        tips.push(newTip);
        emit TipReceived(msg.sender, amount, message, block.timestamp, tipId);
    }

    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (!IERC20(usdc).transfer(to, amount)) revert TransferFailed();
        emit Withdrawn(to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function tipCount() external view returns (uint256) {
        return tips.length;
    }

    function getTip(uint256 index) external view returns (Tip memory) {
        return tips[index];
    }

    function getTips(uint256 offset, uint256 limit) external view returns (Tip[] memory) {
        uint256 total = tips.length;
        if (offset >= total) return new Tip[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        Tip[] memory page = new Tip[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = tips[i];
        }

        return page;
    }
}
