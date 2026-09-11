//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * A tip jar that collects USDC tips together with a short public message.
 *
 * Tips are pulled with `transferFrom`, so a tipper has to `approve` the jar for
 * the amount first. Every tip is stored onchain so the frontend can render the
 * feed from contract state instead of depending on log queries, and is also
 * emitted as an event for indexers.
 *
 * The collected USDC sits in the contract until the owner withdraws it.
 */
contract TipJar {
    using SafeERC20 for IERC20;

    struct Tip {
        address sender;
        uint256 amount;
        uint256 timestamp;
        string message;
    }

    /// @notice Longest message a tip is allowed to carry, in bytes.
    uint256 public constant MAX_MESSAGE_LENGTH = 140;

    /// @notice The token tips are denominated in (USDC, 6 decimals).
    IERC20 public immutable token;

    /// @notice Account allowed to withdraw the jar and hand over ownership.
    address public owner;

    /// @notice Sum of every tip ever received, ignoring withdrawals.
    uint256 public totalTipped;

    /// @notice Sum of every tip received per sender, ignoring withdrawals.
    mapping(address => uint256) public tippedBy;

    Tip[] private tips;

    event NewTip(uint256 indexed index, address indexed sender, uint256 amount, string message, uint256 timestamp);
    event Withdrawal(address indexed to, uint256 amount);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);

    error AmountIsZero();
    error MessageTooLong(uint256 length, uint256 maxLength);
    error NotTheOwner(address caller);
    error ZeroAddress();
    error AmountExceedsBalance(uint256 amount, uint256 available);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotTheOwner(msg.sender);
        _;
    }

    constructor(address _token, address _owner) {
        if (_token == address(0) || _owner == address(0)) revert ZeroAddress();
        token = IERC20(_token);
        owner = _owner;
        emit OwnerChanged(address(0), _owner);
    }

    /**
     * @notice Send a tip. The caller must have approved this contract for `amount` first.
     * @param amount Tip size in the token's smallest unit (6 decimals for USDC).
     * @param message Public note shown in the feed. May be empty, up to MAX_MESSAGE_LENGTH bytes.
     */
    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert AmountIsZero();
        if (bytes(message).length > MAX_MESSAGE_LENGTH) {
            revert MessageTooLong(bytes(message).length, MAX_MESSAGE_LENGTH);
        }

        token.safeTransferFrom(msg.sender, address(this), amount);

        tips.push(Tip({ sender: msg.sender, amount: amount, timestamp: block.timestamp, message: message }));
        totalTipped += amount;
        tippedBy[msg.sender] += amount;

        emit NewTip(tips.length - 1, msg.sender, amount, message, block.timestamp);
    }

    /// @notice Move `amount` out of the jar to the owner.
    function withdraw(uint256 amount) public onlyOwner {
        uint256 available = balance();
        if (amount == 0) revert AmountIsZero();
        if (amount > available) revert AmountExceedsBalance(amount, available);

        token.safeTransfer(owner, amount);
        emit Withdrawal(owner, amount);
    }

    /// @notice Empty the jar into the owner's wallet.
    function withdrawAll() external {
        withdraw(balance());
    }

    /// @notice Hand the jar over to a new owner.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Tokens currently held by the jar and available to withdraw.
    function balance() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice Number of tips received so far.
    function tipCount() external view returns (uint256) {
        return tips.length;
    }

    /// @notice A single tip by its index in the feed, oldest first.
    function getTip(uint256 index) external view returns (Tip memory) {
        return tips[index];
    }

    /**
     * @notice The most recent tips, newest first.
     * @param limit Maximum number of tips to return; the whole feed is returned when it is shorter.
     */
    function getLatestTips(uint256 limit) external view returns (Tip[] memory latest) {
        uint256 total = tips.length;
        uint256 count = limit > total ? total : limit;

        latest = new Tip[](count);
        for (uint256 i = 0; i < count; i++) {
            latest[i] = tips[total - 1 - i];
        }
    }
}
