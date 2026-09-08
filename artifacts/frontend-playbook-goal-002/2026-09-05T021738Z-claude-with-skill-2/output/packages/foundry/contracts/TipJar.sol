// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TipJar
 * @notice A tip jar that accepts tips denominated in a single ERC20 token (USDC on Base).
 *         Every tip is stored onchain together with its message so the frontend can render a
 *         feed without relying on an indexer, and is also emitted as an event for cheap syncing.
 * @dev Tippers must `approve` the jar for the tip amount before calling `tip`.
 */
contract TipJar {
    using SafeERC20 for IERC20;

    struct Tip {
        address sender;
        uint128 amount; // token units (USDC has 6 decimals)
        uint64 timestamp;
        string message;
    }

    /// @notice Token every tip is paid in (USDC on Base).
    IERC20 public immutable token;

    /// @notice Receives withdrawals; the only account allowed to move funds out.
    address public owner;

    /// @notice Longest message accepted with a tip, in bytes.
    uint256 public constant MAX_MESSAGE_LENGTH = 200;

    Tip[] private _tips;

    /// @notice Lifetime total tipped, in token units.
    uint256 public totalTipped;

    /// @notice Lifetime total tipped per address, in token units.
    mapping(address => uint256) public tippedBy;

    event TipReceived(uint256 indexed index, address indexed sender, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAddress();
    error ZeroAmount();
    error MessageTooLong(uint256 length, uint256 maxLength);
    error NothingToWithdraw();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IERC20 _token, address _owner) {
        if (address(_token) == address(0) || _owner == address(0)) revert ZeroAddress();
        token = _token;
        owner = _owner;
        emit OwnerChanged(address(0), _owner);
    }

    /**
     * @notice Send a tip. Requires an ERC20 allowance of at least `amount` for this contract.
     * @param amount Tip size in token units (1 USDC == 1_000_000).
     * @param message Optional note shown in the feed, up to MAX_MESSAGE_LENGTH bytes.
     */
    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert ZeroAmount();
        uint256 length = bytes(message).length;
        if (length > MAX_MESSAGE_LENGTH) revert MessageTooLong(length, MAX_MESSAGE_LENGTH);

        // Record what actually arrived rather than what was requested.
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        _tips.push(
            Tip({ sender: msg.sender, amount: uint128(received), timestamp: uint64(block.timestamp), message: message })
        );
        totalTipped += received;
        tippedBy[msg.sender] += received;

        emit TipReceived(_tips.length - 1, msg.sender, received, message, block.timestamp);
    }

    /// @notice Move the jar's whole balance to `to`.
    function withdraw(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert NothingToWithdraw();
        token.safeTransfer(to, balance);
        emit Withdrawn(to, balance);
    }

    /// @notice Hand the jar to a new owner.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Number of tips ever received.
    function tipCount() external view returns (uint256) {
        return _tips.length;
    }

    /// @notice Tip at `index`, oldest first.
    function tipAt(uint256 index) external view returns (Tip memory) {
        return _tips[index];
    }

    /**
     * @notice The most recent tips, newest first.
     * @param limit Maximum number of tips to return.
     */
    function latestTips(uint256 limit) external view returns (Tip[] memory page) {
        uint256 total = _tips.length;
        uint256 size = limit < total ? limit : total;
        page = new Tip[](size);
        for (uint256 i = 0; i < size; ++i) {
            page[i] = _tips[total - 1 - i];
        }
    }

    /// @notice Token units currently sitting in the jar.
    function jarBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice Decimals of the tip token, so the UI can format amounts from one source.
    function tokenDecimals() external view returns (uint8) {
        return IERC20Metadata(address(token)).decimals();
    }
}
