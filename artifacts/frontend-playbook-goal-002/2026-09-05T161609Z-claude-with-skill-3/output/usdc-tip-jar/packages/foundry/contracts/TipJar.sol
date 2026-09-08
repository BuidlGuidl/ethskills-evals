//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/**
 * @title TipJar
 * @notice Collects USDC tips with an optional short message and keeps an onchain feed of them.
 *         The owner can withdraw the collected balance at any time.
 * @dev The tip token is fixed at construction time. On Base that is the canonical USDC at
 *      0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (6 decimals).
 */
contract TipJar is Ownable {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    /// @notice Longest message a tipper may attach, in bytes.
    uint256 public constant MAX_MESSAGE_LENGTH = 140;

    struct Tip {
        address from;
        uint128 amount;
        uint64 timestamp;
        string message;
    }

    /// @notice The token tips are denominated in (USDC on Base).
    IERC20 public immutable token;

    /// @notice Every tip ever received, oldest first.
    Tip[] private _tips;

    /// @notice Sum of every tip received, in token units.
    uint256 public totalTipped;

    /// @notice Sum of the tips received from a given address, in token units.
    mapping(address => uint256) public totalTippedBy;

    event NewTip(uint256 indexed index, address indexed from, uint256 amount, string message);
    event Withdrawn(address indexed to, uint256 amount);

    error ZeroAmount();
    error MessageTooLong(uint256 length);
    error NothingToWithdraw();
    error AmountExceedsBalance(uint256 requested, uint256 available);

    /**
     * @param _token Address of the ERC20 used for tips (USDC).
     * @param _owner Address allowed to withdraw the collected tips.
     */
    constructor(IERC20 _token, address _owner) Ownable(_owner) {
        require(address(_token) != address(0), "TipJar: token is the zero address");
        token = _token;
    }

    /**
     * @notice Send a tip. The caller must have approved this contract for `amount` first.
     * @param amount Amount of tokens to tip, in the token's own units (USDC has 6 decimals).
     * @param message Optional note shown in the feed, up to MAX_MESSAGE_LENGTH bytes.
     * @return index Position of the new tip in the feed.
     */
    function tip(uint256 amount, string calldata message) external returns (uint256 index) {
        if (amount == 0) revert ZeroAmount();
        if (bytes(message).length > MAX_MESSAGE_LENGTH) revert MessageTooLong(bytes(message).length);

        // Record what actually landed rather than what was asked for, so the feed stays
        // truthful even against a token that takes a cut on transfer.
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        index = _tips.length;
        _tips.push(
            Tip({
                from: msg.sender, amount: received.toUint128(), timestamp: uint64(block.timestamp), message: message
            })
        );

        totalTipped += received;
        totalTippedBy[msg.sender] += received;

        emit NewTip(index, msg.sender, received, message);
    }

    /// @notice Number of tips in the feed.
    function tipCount() external view returns (uint256) {
        return _tips.length;
    }

    /// @notice A single tip by its feed index (oldest first).
    function getTip(uint256 index) external view returns (Tip memory) {
        return _tips[index];
    }

    /**
     * @notice A page of the feed, newest first — the order the UI renders.
     * @param offset How many of the most recent tips to skip.
     * @param limit Maximum number of tips to return.
     * @return page The requested tips, newest first. Shorter than `limit` at the end of the feed.
     */
    function getLatestTips(uint256 offset, uint256 limit) external view returns (Tip[] memory page) {
        uint256 total = _tips.length;
        if (offset >= total || limit == 0) return new Tip[](0);

        uint256 remaining = total - offset;
        uint256 size = remaining < limit ? remaining : limit;

        page = new Tip[](size);
        for (uint256 i = 0; i < size; ++i) {
            // total - 1 - offset is the newest tip not skipped; walk backwards from there.
            page[i] = _tips[total - 1 - offset - i];
        }
    }

    /// @notice Tokens held by the jar and not yet withdrawn.
    function balance() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @notice Withdraw collected tips to the owner.
     * @param amount Amount to withdraw, in token units.
     */
    function withdraw(uint256 amount) public onlyOwner {
        if (amount == 0) revert ZeroAmount();
        uint256 available = balance();
        if (amount > available) revert AmountExceedsBalance(amount, available);

        address to = owner();
        token.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice Withdraw the jar's entire balance to the owner.
    function withdrawAll() external onlyOwner {
        uint256 available = balance();
        if (available == 0) revert NothingToWithdraw();
        withdraw(available);
    }
}
