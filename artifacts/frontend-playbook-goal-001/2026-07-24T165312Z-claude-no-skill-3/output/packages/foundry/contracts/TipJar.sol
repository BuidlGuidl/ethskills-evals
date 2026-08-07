//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @notice A tip jar denominated in a single ERC20 (USDC on Base).
 * @dev Tippers must `approve` the jar for the tip amount first, then call `tip`.
 *      The jar pulls the tokens with `transferFrom`, records the tip in an
 *      on-chain feed, and lets the owner withdraw the collected balance.
 * @author BuidlGuidl
 */
contract TipJar {
    using SafeERC20 for IERC20;

    struct TipEntry {
        address from;
        uint256 amount;
        string message;
        uint256 timestamp;
    }

    /// @notice The ERC20 accepted as tips (Base USDC).
    IERC20 public immutable token;

    /// @notice The account allowed to withdraw collected tips.
    address public immutable owner;

    /// @notice Every tip ever received, oldest first.
    TipEntry[] public tips;

    /// @notice Running total tipped per address (in token base units).
    mapping(address => uint256) public totalTippedBy;

    /// @notice Lifetime total of all tips received (in token base units).
    uint256 public totalTipped;

    event Tipped(address indexed from, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);

    error NotOwner();
    error ZeroAmount();
    error NothingToWithdraw();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IERC20 _token, address _owner) {
        token = _token;
        owner = _owner;
    }

    /**
     * @notice Send a tip. Caller must have approved this contract for `amount` first.
     * @param amount Tip amount in token base units (USDC has 6 decimals, so 1 USDC = 1_000_000).
     * @param message A short public message shown in the tip feed.
     */
    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert ZeroAmount();

        // Pull the tokens first so we only record tips that actually settled.
        token.safeTransferFrom(msg.sender, address(this), amount);

        tips.push(TipEntry({ from: msg.sender, amount: amount, message: message, timestamp: block.timestamp }));
        totalTippedBy[msg.sender] += amount;
        totalTipped += amount;

        emit Tipped(msg.sender, amount, message, block.timestamp);
    }

    /// @notice Number of tips in the feed.
    function tipCount() external view returns (uint256) {
        return tips.length;
    }

    /// @notice Return the most recent `count` tips, newest first (clamped to what exists).
    function recentTips(uint256 count) external view returns (TipEntry[] memory) {
        uint256 len = tips.length;
        if (count > len) count = len;

        TipEntry[] memory out = new TipEntry[](count);
        for (uint256 i = 0; i < count; i++) {
            out[i] = tips[len - 1 - i];
        }
        return out;
    }

    /// @notice Current jar balance available to withdraw.
    function balance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice Withdraw the entire collected balance to the owner.
    function withdraw() external onlyOwner {
        uint256 amount = token.balanceOf(address(this));
        if (amount == 0) revert NothingToWithdraw();

        token.safeTransfer(owner, amount);
        emit Withdrawn(owner, amount);
    }
}
