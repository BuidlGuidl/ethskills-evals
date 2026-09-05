//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * A tip jar that accepts USDC tips with an optional public message.
 *
 * Tips are pulled with `transferFrom`, so a tipper must `approve` this contract
 * on the USDC token first. Every tip is stored onchain so the frontend can
 * render a feed without an indexer, and is also emitted as an event.
 *
 * @author BuidlGuidl
 */
contract TipJar {
    using SafeERC20 for IERC20;

    /// @notice Longest message a tipper can attach, in bytes.
    uint256 public constant MAX_MESSAGE_LENGTH = 200;

    struct Tip {
        address from;
        uint128 amount; // USDC has 6 decimals, uint128 is plenty and packs with `timestamp`
        uint64 timestamp;
        string message;
    }

    /// @notice The USDC token this jar accepts.
    IERC20 public immutable usdc;
    /// @notice The only address allowed to withdraw collected tips.
    address public immutable owner;

    /// @notice Every tip ever received, oldest first.
    Tip[] public tips;
    /// @notice Total USDC ever tipped (ignores withdrawals).
    uint256 public totalTipped;
    /// @notice Total USDC ever tipped per address.
    mapping(address => uint256) public tippedBy;

    event NewTip(address indexed from, uint256 amount, string message, uint256 timestamp);
    event Withdrawal(address indexed to, uint256 amount);

    error NotTheOwner();
    error ZeroAmount();
    error MessageTooLong();
    error NothingToWithdraw();

    modifier isOwner() {
        if (msg.sender != owner) revert NotTheOwner();
        _;
    }

    constructor(address _owner, address _usdc) {
        owner = _owner;
        usdc = IERC20(_usdc);
    }

    /**
     * Send a tip. Requires an ERC20 allowance on the USDC token for this contract.
     *
     * @param amount USDC amount in base units (6 decimals, so 1 USDC == 1000000)
     * @param message optional public message shown in the tip feed
     */
    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert ZeroAmount();
        if (bytes(message).length > MAX_MESSAGE_LENGTH) revert MessageTooLong();

        // Pull the funds first, so the feed only ever records tips that were paid.
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        tips.push(
            Tip({ from: msg.sender, amount: uint128(amount), timestamp: uint64(block.timestamp), message: message })
        );
        totalTipped += amount;
        tippedBy[msg.sender] += amount;

        emit NewTip(msg.sender, amount, message, block.timestamp);
    }

    /// @notice USDC currently sitting in the jar, i.e. tipped but not yet withdrawn.
    function balance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice Number of tips received so far.
    function tipCount() external view returns (uint256) {
        return tips.length;
    }

    /**
     * The most recent tips, newest first. Cheap enough for a frontend feed.
     *
     * @param limit maximum number of tips to return
     */
    function recentTips(uint256 limit) external view returns (Tip[] memory) {
        uint256 count = tips.length < limit ? tips.length : limit;
        Tip[] memory result = new Tip[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = tips[tips.length - 1 - i];
        }
        return result;
    }

    /// @notice Send the whole jar to the owner.
    function withdraw() external isOwner {
        uint256 amount = usdc.balanceOf(address(this));
        if (amount == 0) revert NothingToWithdraw();
        usdc.safeTransfer(owner, amount);
        emit Withdrawal(owner, amount);
    }
}
