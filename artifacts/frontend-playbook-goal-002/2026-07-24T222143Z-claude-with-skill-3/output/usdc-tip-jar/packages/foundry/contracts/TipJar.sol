//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TipJar
 * @notice Accepts USDC tips and keeps an on-chain, queryable feed of them.
 *         Tippers must approve the jar to spend their USDC first, then call `tip`.
 *         The owner can withdraw the accumulated balance at any time.
 * @dev USDC is passed in at deploy time so the same contract works on a Base
 *      mainnet fork (real USDC) or any other network with an ERC20 token.
 */
contract TipJar is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Tip {
        address tipper;
        uint256 amount; // in USDC's smallest unit (6 decimals)
        string message;
        uint256 timestamp;
    }

    /// @notice The USDC token this jar accepts.
    IERC20 public immutable usdc;

    /// @notice Longest tip message allowed, in bytes.
    uint256 public constant MAX_MESSAGE_LENGTH = 280;

    /// @notice Every tip ever sent, in the order received.
    Tip[] public tips;

    /// @notice Running total of USDC tipped (never decreases, even after withdrawals).
    uint256 public totalTipped;

    /// @notice Total USDC tipped per address.
    mapping(address => uint256) public tippedBy;

    event NewTip(
        address indexed tipper, uint256 amount, string message, uint256 timestamp, uint256 indexed index
    );
    event Withdrawn(address indexed to, uint256 amount);

    error ZeroAmount();
    error MessageTooLong();
    error NothingToWithdraw();

    constructor(address _usdc, address _owner) Ownable(_owner) {
        require(_usdc != address(0), "USDC address required");
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Send a USDC tip with an optional message.
     * @dev Caller must have approved this contract for at least `amount` USDC.
     * @param amount USDC amount in the token's smallest unit (6 decimals).
     * @param message Optional public note attached to the tip (max 280 bytes).
     */
    function tip(uint256 amount, string calldata message) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (bytes(message).length > MAX_MESSAGE_LENGTH) revert MessageTooLong();

        // Pull the USDC first so recorded state always matches what was received.
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        uint256 index = tips.length;
        tips.push(Tip({tipper: msg.sender, amount: amount, message: message, timestamp: block.timestamp}));
        totalTipped += amount;
        tippedBy[msg.sender] += amount;

        emit NewTip(msg.sender, amount, message, block.timestamp, index);
    }

    /// @notice Owner withdraws the full USDC balance held by the jar.
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert NothingToWithdraw();
        usdc.safeTransfer(owner(), balance);
        emit Withdrawn(owner(), balance);
    }

    /// @notice Number of tips recorded.
    function tipCount() external view returns (uint256) {
        return tips.length;
    }

    /// @notice All tips, oldest first.
    function getTips() external view returns (Tip[] memory) {
        return tips;
    }

    /**
     * @notice The most recent tips, newest first.
     * @param count Max number to return; clamped to the number of tips.
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
}
