//SPDX-License-Identifier: MIT
pragma solidity >=0.8.20 <0.9.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @notice A tip jar that accepts USDC tips and keeps an on-chain feed of them.
 * @dev The USDC token address is injected at deploy time so the same contract
 *      works against Base mainnet and a local Base fork (same token address).
 *      Tippers must `approve` this contract for `amount` before calling {tip}.
 * @author BuidlGuidl
 */
contract TipJar is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Tip {
        address from;
        uint256 amount;
        uint256 timestamp;
        string message;
    }

    /// @notice The USDC token this jar accepts (6 decimals on Base).
    IERC20 public immutable usdc;

    /// @notice Every tip ever sent, in chronological order.
    Tip[] public tips;

    /// @notice Lifetime total of USDC tipped (in USDC's smallest unit).
    uint256 public totalTipped;

    /// @notice Lifetime total tipped per address.
    mapping(address => uint256) public tippedBy;

    event NewTip(uint256 indexed id, address indexed from, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);

    error ZeroAmount();
    error EmptyBalance();

    constructor(address _usdc, address _owner) Ownable(_owner) {
        require(_usdc != address(0), "USDC address required");
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Send a USDC tip with an optional message.
     * @dev Caller must have `approve`d this contract for at least `amount` first.
     * @param amount USDC amount in its smallest unit (6 decimals).
     * @param message Public message stored alongside the tip.
     */
    function tip(uint256 amount, string calldata message) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        // Pull the USDC in first, then record — measure the actual received
        // amount so fee-on-transfer or non-standard tokens can't desync the feed.
        uint256 balanceBefore = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = usdc.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        uint256 id = tips.length;
        tips.push(Tip({ from: msg.sender, amount: received, timestamp: block.timestamp, message: message }));
        totalTipped += received;
        tippedBy[msg.sender] += received;

        emit NewTip(id, msg.sender, received, message, block.timestamp);
    }

    /// @notice Number of tips in the feed.
    function tipCount() external view returns (uint256) {
        return tips.length;
    }

    /**
     * @notice Return a slice of the tip feed, newest first.
     * @param cursor Number of tips to skip from the newest end.
     * @param limit Max number of tips to return.
     */
    function getTips(uint256 cursor, uint256 limit) external view returns (Tip[] memory page) {
        uint256 total = tips.length;
        if (cursor >= total) return new Tip[](0);

        uint256 remaining = total - cursor;
        uint256 size = remaining < limit ? remaining : limit;
        page = new Tip[](size);
        for (uint256 i = 0; i < size; i++) {
            // Walk backwards from the newest, skipping `cursor` entries.
            page[i] = tips[total - 1 - cursor - i];
        }
    }

    /// @notice Withdraw the entire USDC balance to the owner.
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert EmptyBalance();
        usdc.safeTransfer(owner(), balance);
        emit Withdrawn(owner(), balance);
    }
}
