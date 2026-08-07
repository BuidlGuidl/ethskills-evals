//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TipJar
 * @author BuidlGuidl
 * @notice A public tip jar that accepts USDC tips (with an optional message) and
 *         keeps an onchain feed of every tip. The jar owner can withdraw the
 *         accumulated USDC at any time.
 *
 * @dev USDC is an ERC-20, so tipping is a two-step flow for the tipper:
 *      1. `approve(tipJar, amount)` on the USDC token
 *      2. `tip(amount, message)` on this contract, which pulls the USDC via
 *         `transferFrom`.
 */
contract TipJar {
    using SafeERC20 for IERC20;

    /// @notice The USDC token this jar accepts (Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).
    IERC20 public immutable usdc;

    /// @notice The address allowed to withdraw the collected tips.
    address public immutable owner;

    /// @notice Longest allowed tip message, in bytes.
    uint256 public constant MAX_MESSAGE_LENGTH = 280;

    struct Tip {
        address from;
        uint256 amount; // in USDC's smallest unit (6 decimals)
        string message;
        uint256 timestamp;
    }

    /// @notice Every tip ever sent, oldest first.
    Tip[] private tips;

    /// @notice Gross amount of USDC ever tipped (does not decrease on withdraw).
    uint256 public totalTipped;

    /// @notice Total amount tipped per address.
    mapping(address => uint256) public tippedBy;

    event NewTip(address indexed from, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);

    error ZeroAmount();
    error MessageTooLong();
    error NotOwner();
    error NothingToWithdraw();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /**
     * @param _usdc  Address of the USDC token contract to accept.
     * @param _owner Address allowed to withdraw collected tips.
     */
    constructor(IERC20 _usdc, address _owner) {
        usdc = _usdc;
        owner = _owner;
    }

    /**
     * @notice Send a USDC tip with an optional message.
     * @dev Requires the caller to have `approve`d this contract for at least `amount`.
     * @param amount  Amount of USDC (6 decimals) to tip.
     * @param message Optional message to attach to the tip (max 280 bytes).
     */
    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert ZeroAmount();
        if (bytes(message).length > MAX_MESSAGE_LENGTH) revert MessageTooLong();

        // Pull the USDC from the tipper. SafeERC20 reverts on failure.
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        tips.push(Tip({ from: msg.sender, amount: amount, message: message, timestamp: block.timestamp }));
        totalTipped += amount;
        tippedBy[msg.sender] += amount;

        emit NewTip(msg.sender, amount, message, block.timestamp);
    }

    /**
     * @notice Withdraw the entire USDC balance of the jar to the owner.
     */
    function withdraw() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert NothingToWithdraw();
        usdc.safeTransfer(owner, balance);
        emit Withdrawn(owner, balance);
    }

    /// @notice Current USDC balance held by the jar.
    function jarBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice Number of tips in the feed.
    function tipCount() external view returns (uint256) {
        return tips.length;
    }

    /// @notice Return the whole tip feed, oldest first.
    function getTips() external view returns (Tip[] memory) {
        return tips;
    }

    /**
     * @notice Return the `count` most recent tips, newest first.
     * @dev Handy for a UI that only wants to show a recent slice of the feed.
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
