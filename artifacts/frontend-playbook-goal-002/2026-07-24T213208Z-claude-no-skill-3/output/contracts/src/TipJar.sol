// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title TipJar
/// @notice A USDC tip jar. Anyone can send a USDC tip with a short message.
///         Tips accumulate in the contract; the owner can withdraw them.
/// @dev USDC uses 6 decimals. Tippers must `approve` this contract to spend
///      their USDC before calling `tip`.
contract TipJar {
    using SafeERC20 for IERC20;

    struct Tip {
        address from; // who sent the tip
        uint256 amount; // amount in USDC's smallest unit (6 decimals)
        string message; // short public message
        uint256 timestamp; // block time the tip was recorded
    }

    /// @notice The USDC token this jar accepts.
    IERC20 public immutable usdc;

    /// @notice The address allowed to withdraw collected tips.
    address public owner;

    /// @notice Maximum length of a tip message, in bytes.
    uint256 public constant MAX_MESSAGE_LENGTH = 280;

    /// @notice All tips ever recorded, oldest first.
    Tip[] private _tips;

    /// @notice Running total of USDC tipped (across all withdrawals).
    uint256 public totalTipped;

    event NewTip(address indexed from, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error ZeroAmount();
    error MessageTooLong();
    error NotOwner();
    error NothingToWithdraw();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @param _usdc Address of the USDC token contract.
    /// @param _owner Address that may withdraw collected tips.
    constructor(address _usdc, address _owner) {
        if (_usdc == address(0) || _owner == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
    }

    /// @notice Send a USDC tip with a message.
    /// @dev Caller must have approved this contract for at least `amount` USDC.
    /// @param amount Amount of USDC (6 decimals) to tip.
    /// @param message A short public message (<= MAX_MESSAGE_LENGTH bytes).
    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert ZeroAmount();
        if (bytes(message).length > MAX_MESSAGE_LENGTH) revert MessageTooLong();

        // Pull the USDC from the tipper into this contract.
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        _tips.push(Tip({from: msg.sender, amount: amount, message: message, timestamp: block.timestamp}));
        totalTipped += amount;

        emit NewTip(msg.sender, amount, message, block.timestamp);
    }

    /// @notice Number of tips recorded.
    function tipCount() external view returns (uint256) {
        return _tips.length;
    }

    /// @notice Read a single tip by index.
    function getTip(uint256 index) external view returns (Tip memory) {
        return _tips[index];
    }

    /// @notice Read all tips (oldest first). Convenient for a local UI.
    function getTips() external view returns (Tip[] memory) {
        return _tips;
    }

    /// @notice Read the most recent `count` tips, newest first.
    /// @param count Maximum number of tips to return.
    function getRecentTips(uint256 count) external view returns (Tip[] memory) {
        uint256 len = _tips.length;
        if (count > len) count = len;
        Tip[] memory out = new Tip[](count);
        for (uint256 i = 0; i < count; i++) {
            out[i] = _tips[len - 1 - i];
        }
        return out;
    }

    /// @notice Current USDC balance held by the jar (tips not yet withdrawn).
    function balance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice Withdraw the entire USDC balance to the owner.
    function withdraw() external onlyOwner {
        uint256 bal = usdc.balanceOf(address(this));
        if (bal == 0) revert NothingToWithdraw();
        usdc.safeTransfer(owner, bal);
        emit Withdrawn(owner, bal);
    }

    /// @notice Transfer ownership (withdrawal rights) to a new address.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address prev = owner;
        owner = newOwner;
        emit OwnershipTransferred(prev, newOwner);
    }
}
