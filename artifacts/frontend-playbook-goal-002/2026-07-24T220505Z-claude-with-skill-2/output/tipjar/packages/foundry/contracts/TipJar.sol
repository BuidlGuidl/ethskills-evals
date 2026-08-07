// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TipJar
 * @notice A public tip jar that accepts tips in a single ERC20 token (USDC on Base).
 *         Every tip is recorded on-chain with an optional message, forming a public
 *         "tip feed" that anyone can read. The owner can withdraw the collected balance.
 * @dev The tip token is fixed at deploy time. Tippers must `approve` this contract to
 *      spend their USDC before calling `tip`.
 */
contract TipJar is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The ERC20 token accepted as tips (USDC on Base, 6 decimals).
    IERC20 public immutable token;

    struct Tip {
        address from; // who sent the tip
        uint256 amount; // amount in token's smallest unit (USDC has 6 decimals)
        string message; // optional message left with the tip
        uint256 timestamp; // block time the tip was recorded
    }

    /// @notice Chronological feed of every tip ever sent.
    Tip[] public tips;

    /// @notice Total amount tipped, in the token's smallest unit.
    uint256 public totalTipped;

    /// @notice Total amount tipped per address, in the token's smallest unit.
    mapping(address => uint256) public tippedBy;

    event NewTip(address indexed from, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);

    error ZeroAmount();
    error MessageTooLong();

    /// @param _token   Address of the ERC20 tip token (Base USDC).
    /// @param _owner   Address that can withdraw collected tips.
    constructor(address _token, address _owner) Ownable(_owner) {
        require(_token != address(0), "token is zero address");
        token = IERC20(_token);
    }

    /**
     * @notice Send a tip. Requires a prior `approve` on the token for at least `amount`.
     * @param amount  Amount of token to tip (USDC uses 6 decimals, e.g. 1 USDC = 1_000_000).
     * @param message Optional message (max 280 chars) shown in the feed.
     */
    function tip(uint256 amount, string calldata message) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (bytes(message).length > 280) revert MessageTooLong();

        // Pull the tip in. SafeERC20 reverts if the transfer fails.
        token.safeTransferFrom(msg.sender, address(this), amount);

        tips.push(Tip({ from: msg.sender, amount: amount, message: message, timestamp: block.timestamp }));
        totalTipped += amount;
        tippedBy[msg.sender] += amount;

        emit NewTip(msg.sender, amount, message, block.timestamp);
    }

    /// @notice Number of tips in the feed.
    function tipCount() external view returns (uint256) {
        return tips.length;
    }

    /// @notice Return the entire tip feed.
    function getAllTips() external view returns (Tip[] memory) {
        return tips;
    }

    /**
     * @notice Return up to `count` most recent tips, newest first.
     * @param count Maximum number of tips to return.
     */
    function getRecentTips(uint256 count) external view returns (Tip[] memory) {
        uint256 total = tips.length;
        if (count > total) count = total;
        Tip[] memory recent = new Tip[](count);
        for (uint256 i = 0; i < count; i++) {
            recent[i] = tips[total - 1 - i];
        }
        return recent;
    }

    /// @notice Current token balance held by the jar (equals un-withdrawn tips).
    function jarBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice Withdraw the full jar balance to the owner.
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();
        token.safeTransfer(owner(), balance);
        emit Withdrawn(owner(), balance);
    }
}
