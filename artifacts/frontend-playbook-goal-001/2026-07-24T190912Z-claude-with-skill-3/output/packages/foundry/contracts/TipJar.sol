//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @notice A USDC tip jar. Anyone can leave a USDC tip with a short message; the owner
 *         can withdraw the collected balance. Designed for Base (USDC has 6 decimals).
 * @dev Uses SafeERC20 so it works with tokens (like USDC) whose transfer* functions
 *      do not return a bool. The token address is injected at construction so the same
 *      contract can point at real Base USDC on a fork/mainnet or a mock in unit tests.
 */
contract TipJar {
    using SafeERC20 for IERC20;

    struct Tip {
        address tipper;
        uint256 amount;
        uint256 timestamp;
        string message;
    }

    IERC20 public immutable usdc;
    address public immutable owner;

    Tip[] private tips;
    uint256 public totalTipped;
    mapping(address => uint256) public tippedBy;

    event NewTip(address indexed tipper, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);

    error NotOwner();
    error ZeroAmount();
    error NothingToWithdraw();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IERC20 _usdc, address _owner) {
        usdc = _usdc;
        owner = _owner;
    }

    /**
     * @notice Leave a USDC tip. Caller must have approved this contract for `amount` first.
     * @param amount USDC amount in base units (6 decimals, e.g. 1 USDC = 1_000_000).
     * @param message Short public message shown in the tip feed.
     */
    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert ZeroAmount();

        // Pull the USDC in first, then record — reverts here roll back the whole tip.
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        tips.push(Tip({ tipper: msg.sender, amount: amount, timestamp: block.timestamp, message: message }));
        totalTipped += amount;
        tippedBy[msg.sender] += amount;

        emit NewTip(msg.sender, amount, message, block.timestamp);
    }

    /// @notice Withdraw the full USDC balance to the owner.
    function withdraw() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert NothingToWithdraw();

        usdc.safeTransfer(owner, balance);
        emit Withdrawn(owner, balance);
    }

    /// @notice Number of tips recorded so far.
    function tipCount() external view returns (uint256) {
        return tips.length;
    }

    /// @notice Every tip, oldest first. The frontend reverses this for a newest-first feed.
    function getTips() external view returns (Tip[] memory) {
        return tips;
    }

    /// @notice The most recent `count` tips, newest first (cheap read for the feed).
    function getRecentTips(uint256 count) external view returns (Tip[] memory recent) {
        uint256 total = tips.length;
        if (count > total) count = total;
        recent = new Tip[](count);
        for (uint256 i = 0; i < count; i++) {
            recent[i] = tips[total - 1 - i];
        }
    }
}
