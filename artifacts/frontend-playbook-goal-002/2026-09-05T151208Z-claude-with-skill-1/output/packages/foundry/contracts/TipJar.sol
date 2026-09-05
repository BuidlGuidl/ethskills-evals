//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TipJar
 * @notice A tip jar that accepts tips in a single ERC-20 token (USDC on Base) with an
 *         optional public message. Every tip is kept onchain so the feed can be rendered
 *         from contract state alone, without relying on an indexer or log retention.
 * @dev The token is fixed at construction time. Tippers must `approve` the jar first;
 *      the jar then pulls the funds with `transferFrom`.
 * @author BuidlGuidl
 */
contract TipJar is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The token tips are denominated in (USDC on Base).
    IERC20 public immutable token;

    /// @notice Decimals of `token`, cached at construction for convenient frontend formatting.
    uint8 public immutable tokenDecimals;

    /// @notice The address allowed to withdraw the collected tips.
    address public owner;

    /// @notice Longest message a tip may carry, in bytes.
    uint256 public constant MAX_MESSAGE_LENGTH = 140;

    struct Tip {
        address sender;
        uint128 amount;
        uint64 timestamp;
        string message;
    }

    /// @notice Every tip ever received, oldest first.
    Tip[] public tips;

    /// @notice Running total of every tip received, in token units.
    uint256 public totalTipped;

    /// @notice Total withdrawn by the owner so far, in token units.
    uint256 public totalWithdrawn;

    /// @notice Lifetime amount tipped per address, in token units.
    mapping(address => uint256) public totalTippedBy;

    event TipReceived(uint256 indexed index, address indexed sender, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);

    error AmountZero();
    error MessageTooLong(uint256 length, uint256 maxLength);
    error NotOwner(address caller);
    error ZeroAddress();
    error NothingToWithdraw();
    error AmountExceedsBalance(uint256 requested, uint256 available);
    error AmountTooLarge(uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    /**
     * @param _token The ERC-20 tips are accepted in (Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).
     * @param _owner The address allowed to withdraw collected tips.
     */
    constructor(IERC20 _token, address _owner) {
        if (address(_token) == address(0) || _owner == address(0)) revert ZeroAddress();
        token = _token;
        tokenDecimals = IERC20Metadata(address(_token)).decimals();
        owner = _owner;
        emit OwnerChanged(address(0), _owner);
    }

    /**
     * @notice Send a tip. The caller must have approved this contract for at least `amount` first.
     * @param amount Amount of `token` to tip, in the token's smallest unit (USDC has 6 decimals).
     * @param message Optional public message, up to `MAX_MESSAGE_LENGTH` bytes.
     * @return index Position of the new tip in the feed.
     */
    function tip(uint256 amount, string calldata message) external nonReentrant returns (uint256 index) {
        if (amount == 0) revert AmountZero();
        if (bytes(message).length > MAX_MESSAGE_LENGTH) {
            revert MessageTooLong(bytes(message).length, MAX_MESSAGE_LENGTH);
        }

        // Record what actually arrived rather than what was asked for, so the feed and the
        // jar balance stay in agreement even for tokens that take a cut on transfer.
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert AmountZero();
        if (received > type(uint128).max) revert AmountTooLarge(received);

        index = tips.length;
        tips.push(
            Tip({
                sender: msg.sender,
                // casting to 'uint128' is safe because `received` is bounded by the check above
                // forge-lint: disable-next-line(unsafe-typecast)
                amount: uint128(received),
                timestamp: uint64(block.timestamp),
                message: message
            })
        );

        totalTipped += received;
        totalTippedBy[msg.sender] += received;

        emit TipReceived(index, msg.sender, received, message, block.timestamp);
    }

    /**
     * @notice Withdraw part of the jar to an arbitrary address.
     * @param to Recipient of the withdrawal.
     * @param amount Amount to withdraw, in the token's smallest unit.
     */
    function withdraw(address to, uint256 amount) public onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert NothingToWithdraw();

        uint256 balance = token.balanceOf(address(this));
        if (amount > balance) revert AmountExceedsBalance(amount, balance);

        totalWithdrawn += amount;
        token.safeTransfer(to, amount);

        emit Withdrawn(to, amount);
    }

    /// @notice Withdraw the entire jar balance to the owner.
    function withdrawAll() external {
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert NothingToWithdraw();
        withdraw(owner, balance);
    }

    /// @notice Hand the jar over to a new owner.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnerChanged(previousOwner, newOwner);
    }

    /// @notice Number of tips received so far.
    function tipCount() external view returns (uint256) {
        return tips.length;
    }

    /// @notice Token currently sitting in the jar, in the token's smallest unit.
    function jarBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @notice Read a page of the feed, newest first.
     * @param offset How many of the newest tips to skip.
     * @param limit Maximum number of tips to return.
     * @return page The requested tips, newest first. Shorter than `limit` at the end of the feed.
     */
    function getTips(uint256 offset, uint256 limit) external view returns (Tip[] memory page) {
        uint256 total = tips.length;
        if (offset >= total || limit == 0) return new Tip[](0);

        uint256 remaining = total - offset;
        uint256 size = remaining < limit ? remaining : limit;

        page = new Tip[](size);
        for (uint256 i = 0; i < size; i++) {
            // `total - 1 - offset` is the newest tip not skipped; walk backwards from there.
            page[i] = tips[total - 1 - offset - i];
        }
    }
}
