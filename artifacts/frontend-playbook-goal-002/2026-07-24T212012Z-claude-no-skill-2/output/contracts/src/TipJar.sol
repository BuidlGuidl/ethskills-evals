// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC20 interface used by the tip jar.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title TipJar
/// @notice Accepts USDC tips and keeps an onchain feed of them. The owner can
///         withdraw the collected balance. Designed for Base USDC
///         (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) but the token is passed
///         in at deploy time so it can run against a mock token locally.
contract TipJar {
    /// @notice The USDC token this jar accepts.
    IERC20 public immutable usdc;

    /// @notice Address allowed to withdraw collected tips.
    address public owner;

    struct Tip {
        address from;
        uint256 amount; // in USDC's smallest unit (6 decimals)
        string message;
        uint256 timestamp;
    }

    /// @notice Every tip ever sent, oldest first.
    Tip[] private _tips;

    /// @notice Running total of all tips received.
    uint256 public totalTipped;

    event NewTip(
        address indexed from,
        uint256 amount,
        string message,
        uint256 timestamp,
        uint256 index
    );
    event Withdraw(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error ZeroAmount();
    error NotOwner();
    error TransferFailed();
    error ZeroAddress();
    error NothingToWithdraw();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _usdc) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Send a USDC tip. The caller must `approve` this contract for
    ///         `amount` on the USDC token first.
    /// @param amount USDC amount in smallest units (6 decimals).
    /// @param message A short public message attached to the tip.
    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert ZeroAmount();
        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        uint256 index = _tips.length;
        _tips.push(Tip({from: msg.sender, amount: amount, message: message, timestamp: block.timestamp}));
        totalTipped += amount;

        emit NewTip(msg.sender, amount, message, block.timestamp, index);
    }

    /// @notice Number of tips recorded.
    function tipCount() external view returns (uint256) {
        return _tips.length;
    }

    /// @notice Return every tip, oldest first.
    function getAllTips() external view returns (Tip[] memory) {
        return _tips;
    }

    /// @notice Return the most recent `count` tips, newest first.
    /// @dev Convenience reader for the feed so the UI does not have to fetch the
    ///      whole history.
    function getRecentTips(uint256 count) external view returns (Tip[] memory) {
        uint256 total = _tips.length;
        if (count > total) count = total;

        Tip[] memory out = new Tip[](count);
        for (uint256 i = 0; i < count; i++) {
            out[i] = _tips[total - 1 - i];
        }
        return out;
    }

    /// @notice Current USDC balance held by the jar.
    function jarBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice Withdraw the entire USDC balance to the owner.
    function withdraw() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert NothingToWithdraw();
        bool ok = usdc.transfer(owner, balance);
        if (!ok) revert TransferFailed();
        emit Withdraw(owner, balance);
    }

    /// @notice Transfer ownership to a new address.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
