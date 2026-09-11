// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TipJar
 * @notice Collects USDC tips with an optional public message and keeps them in an
 *         onchain feed that anyone can read. The owner withdraws the balance.
 * @dev The tip token is fixed at construction time. On Base that is the canonical
 *      USDC at 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (6 decimals).
 *
 *      Tipping is a two-step flow, as it is for any ERC-20: the tipper first
 *      approves this contract for the amount, then calls `tip`.
 */
contract TipJar is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Longest message a tip may carry, in bytes.
    uint256 public constant MAX_MESSAGE_LENGTH = 280;

    /// @notice The token tips are denominated in (USDC on Base).
    IERC20 public immutable token;

    struct Tip {
        address sender;
        uint128 amount; // USDC has 6 decimals; uint128 covers any realistic supply
        uint64 timestamp;
        string message;
    }

    /// @notice Every tip ever received, in the order they arrived.
    Tip[] private _tips;

    /// @notice Running total of all tips received, in token units.
    uint256 public totalTipped;

    /// @notice Lifetime amount tipped per address, in token units.
    mapping(address => uint256) public tippedBy;

    event TipReceived(uint256 indexed index, address indexed sender, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);

    error AmountMustBePositive();
    error MessageTooLong(uint256 length, uint256 maxLength);
    error NothingToWithdraw();
    error AmountTooLarge();
    error InvalidRecipient();

    /**
     * @param initialOwner Address that receives withdrawals and owns the jar.
     * @param tipToken ERC-20 accepted as tips (Base USDC).
     */
    constructor(address initialOwner, address tipToken) Ownable(initialOwner) {
        if (tipToken == address(0)) revert InvalidRecipient();
        token = IERC20(tipToken);
    }

    /**
     * @notice Send a tip. The caller must have approved this contract for `amount` first.
     * @param amount Amount of the tip token to send (USDC: 1_000_000 == 1 USDC).
     * @param message Optional public message shown in the feed. May be empty.
     * @return index Position of the new tip in the feed.
     */
    function tip(uint256 amount, string calldata message) external nonReentrant returns (uint256 index) {
        if (amount == 0) revert AmountMustBePositive();
        if (bytes(message).length > MAX_MESSAGE_LENGTH) {
            revert MessageTooLong(bytes(message).length, MAX_MESSAGE_LENGTH);
        }

        // Record what actually landed, so a fee-on-transfer or rebasing token can
        // never make the feed disagree with the contract's real balance.
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert AmountMustBePositive();
        // Bounds the uint128 packing below. USDC's entire supply is orders of
        // magnitude under this, so it only ever trips on an absurd token.
        if (received > type(uint128).max) revert AmountTooLarge();

        index = _tips.length;
        _tips.push(
            Tip({
                sender: msg.sender,
                // forge-lint: disable-next-line(unsafe-typecast)
                amount: uint128(received), // bounded above
                timestamp: uint64(block.timestamp),
                message: message
            })
        );

        totalTipped += received;
        tippedBy[msg.sender] += received;

        emit TipReceived(index, msg.sender, received, message, block.timestamp);
    }

    /// @notice Number of tips in the feed.
    function tipCount() external view returns (uint256) {
        return _tips.length;
    }

    /// @notice Read a single tip by its feed index.
    function getTip(uint256 index) external view returns (Tip memory) {
        return _tips[index];
    }

    /**
     * @notice Read the most recent tips, newest first.
     * @param limit Maximum number to return; the feed is shorter than this early on.
     * @return page Up to `limit` tips, ordered newest to oldest.
     */
    function getRecentTips(uint256 limit) external view returns (Tip[] memory page) {
        uint256 total = _tips.length;
        uint256 n = limit > total ? total : limit;
        page = new Tip[](n);
        for (uint256 i = 0; i < n; ++i) {
            page[i] = _tips[total - 1 - i];
        }
    }

    /**
     * @notice Read a slice of the feed, newest first, for paging through long feeds.
     * @param offset How many of the newest tips to skip.
     * @param limit Maximum number to return.
     */
    function getTips(uint256 offset, uint256 limit) external view returns (Tip[] memory page) {
        uint256 total = _tips.length;
        if (offset >= total) return new Tip[](0);
        uint256 remaining = total - offset;
        uint256 n = limit > remaining ? remaining : limit;
        page = new Tip[](n);
        for (uint256 i = 0; i < n; ++i) {
            page[i] = _tips[total - 1 - offset - i];
        }
    }

    /// @notice Tip token balance currently held by the jar and available to withdraw.
    function balance() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice Withdraw the full balance to the owner.
    function withdraw() external {
        withdrawTo(owner());
    }

    /**
     * @notice Withdraw the full balance to an arbitrary address.
     * @param to Recipient of the withdrawal.
     */
    function withdrawTo(address to) public onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidRecipient();
        uint256 amount = balance();
        if (amount == 0) revert NothingToWithdraw();

        emit Withdrawn(to, amount);
        token.safeTransfer(to, amount);
    }
}
