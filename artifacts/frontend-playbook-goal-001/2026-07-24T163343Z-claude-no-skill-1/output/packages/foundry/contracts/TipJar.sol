//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @notice A USDC tip jar. Anyone can leave a USDC tip with an optional message;
 *         the owner can withdraw the collected tips.
 * @dev The jar only ever holds and moves the ERC20 token passed at deployment
 *      (USDC on Base). Tippers must `approve` this contract for `amount` before
 *      calling `tip`, since the jar pulls funds with `transferFrom`.
 */
contract TipJar is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The ERC20 token accepted as tips (USDC).
    IERC20 public immutable token;

    /// @notice Longest tip message we store, to bound gas and calldata.
    uint256 public constant MAX_MESSAGE_LENGTH = 280;

    struct Tip {
        address from;
        uint256 amount;
        uint256 timestamp;
        string message;
    }

    /// @notice Every tip ever left, oldest first.
    Tip[] public tips;

    /// @notice Running total of all tipped amounts (token base units).
    uint256 public totalTipped;

    event NewTip(address indexed from, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);

    error ZeroAmount();
    error MessageTooLong();
    error NothingToWithdraw();

    /**
     * @param _token The tip token (USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).
     * @param _owner The address allowed to withdraw collected tips.
     */
    constructor(IERC20 _token, address _owner) Ownable(_owner) {
        token = _token;
    }

    /**
     * @notice Leave a USDC tip with an optional message.
     * @dev Requires a prior `token.approve(address(this), amount)` from the sender.
     * @param amount Tip amount in token base units (USDC has 6 decimals).
     * @param message Optional message shown in the tip feed.
     */
    function tip(uint256 amount, string calldata message) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (bytes(message).length > MAX_MESSAGE_LENGTH) revert MessageTooLong();

        // Pull the tip in before recording it (checks-effects-interactions).
        token.safeTransferFrom(msg.sender, address(this), amount);

        totalTipped += amount;
        tips.push(Tip({ from: msg.sender, amount: amount, timestamp: block.timestamp, message: message }));

        emit NewTip(msg.sender, amount, message, block.timestamp);
    }

    /// @notice Withdraw the full jar balance to the owner.
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert NothingToWithdraw();

        token.safeTransfer(owner(), balance);
        emit Withdrawn(owner(), balance);
    }

    /// @notice Number of tips in the feed.
    function tipCount() external view returns (uint256) {
        return tips.length;
    }

    /**
     * @notice Return the most recent tips, newest first.
     * @param count Maximum number of tips to return.
     */
    function recentTips(uint256 count) external view returns (Tip[] memory) {
        uint256 len = tips.length;
        if (count > len) count = len;

        Tip[] memory result = new Tip[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = tips[len - 1 - i];
        }
        return result;
    }
}
