// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title TipJar
/// @notice Collects ERC-20 tips (USDC on Base) together with a public message,
///         and keeps them on chain so a front end can render a tip feed.
/// @dev The token is fixed at construction time. On Base that is USDC at
///      0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (6 decimals).
contract TipJar {
    using SafeERC20 for IERC20;

    struct Tip {
        address from; // tipper
        uint128 amount; // token units actually received (6 decimals for USDC)
        uint64 timestamp; // block timestamp of the tip
        string name; // display name chosen by the tipper (may be empty)
        string message; // public message (may be empty)
    }

    /// @notice Longest accepted display name, in bytes.
    uint256 public constant MAX_NAME_BYTES = 32;
    /// @notice Longest accepted message, in bytes.
    uint256 public constant MAX_MESSAGE_BYTES = 280;

    /// @notice Token tips are denominated in (USDC on Base).
    IERC20 public immutable token;

    /// @notice Account allowed to withdraw collected tips.
    address public owner;

    /// @notice Every tip ever received, oldest first.
    Tip[] private _tips;

    /// @notice Lifetime total received, in token units.
    uint256 public totalTipped;

    /// @notice Lifetime total per tipper, in token units.
    mapping(address tipper => uint256 total) public totalTippedBy;

    event TipReceived(
        uint256 indexed id, address indexed from, uint256 amount, string name, string message, uint256 timestamp
    );
    event Withdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error ZeroAddress();
    error ZeroAmount();
    error NotOwner();
    error NameTooLong();
    error MessageTooLong();
    error NothingToWithdraw();
    error AmountTooLarge();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @param token_ ERC-20 tips are collected in.
    /// @param owner_ Account allowed to withdraw.
    constructor(IERC20 token_, address owner_) {
        if (address(token_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        token = token_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    /// @notice Send a tip. The caller must have approved this contract for at
    ///         least `amount` of `token` first.
    /// @param amount Token units to tip (USDC has 6 decimals, so 1 USDC = 1_000_000).
    /// @param name Display name to show in the feed. May be empty.
    /// @param message Public message to show in the feed. May be empty.
    /// @return id Index of the new tip in the feed.
    function tip(uint256 amount, string calldata name, string calldata message) external returns (uint256 id) {
        if (amount == 0) revert ZeroAmount();
        if (bytes(name).length > MAX_NAME_BYTES) revert NameTooLong();
        if (bytes(message).length > MAX_MESSAGE_BYTES) revert MessageTooLong();

        // Measure the delta rather than trusting `amount`, so a token with a
        // transfer fee can never record more than the jar actually received.
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();
        if (received > type(uint128).max) revert AmountTooLarge();

        id = _tips.length;
        _tips.push(
            Tip({
                from: msg.sender,
                // Bounded by the check above.
                // forge-lint: disable-next-line(unsafe-typecast)
                amount: uint128(received),
                timestamp: uint64(block.timestamp),
                name: name,
                message: message
            })
        );

        totalTipped += received;
        totalTippedBy[msg.sender] += received;

        emit TipReceived(id, msg.sender, received, name, message, block.timestamp);
    }

    /// @notice Number of tips received so far.
    function tipCount() external view returns (uint256) {
        return _tips.length;
    }

    /// @notice Read a single tip by index.
    function getTip(uint256 id) external view returns (Tip memory) {
        return _tips[id];
    }

    /// @notice Read a page of the feed, newest first.
    /// @param offset How many of the newest tips to skip.
    /// @param limit Maximum number of tips to return.
    function getTips(uint256 offset, uint256 limit) external view returns (Tip[] memory page) {
        uint256 total = _tips.length;
        if (offset >= total || limit == 0) return new Tip[](0);

        uint256 remaining = total - offset;
        uint256 size = remaining < limit ? remaining : limit;
        page = new Tip[](size);
        // _tips is oldest-first; walk backwards so the page is newest-first.
        uint256 cursor = total - offset;
        for (uint256 i = 0; i < size; ++i) {
            page[i] = _tips[cursor - 1 - i];
        }
    }

    /// @notice Tips currently held by the jar and available to withdraw.
    function balance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice Withdraw collected tips to `to`.
    /// @param to Recipient of the tokens.
    /// @param amount Token units to withdraw, or 0 for the full balance.
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 available = token.balanceOf(address(this));
        if (amount == 0) amount = available;
        if (amount == 0 || amount > available) revert NothingToWithdraw();

        token.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice Hand the jar over to a new owner.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }
}
