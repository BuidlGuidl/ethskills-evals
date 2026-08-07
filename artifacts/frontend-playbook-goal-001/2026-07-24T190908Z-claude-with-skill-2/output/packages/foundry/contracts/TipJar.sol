//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @notice A USDC tip jar. Anyone can send a USDC tip with a short message; the
 *         owner can withdraw the collected balance. Every tip is emitted as an
 *         event so the frontend can render a live feed.
 * @dev Tips are pulled with `transferFrom`, so the tipper must `approve` this
 *      contract for at least `amount` first. USDC is a fixed 6-decimal token.
 */
contract TipJar {
    using SafeERC20 for IERC20;

    /// @notice The token accepted as tips (USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).
    IERC20 public immutable usdc;

    /// @notice Address allowed to withdraw collected tips.
    address public immutable owner;

    /// @notice Number of tips received.
    uint256 public tipCount;

    /// @notice Cumulative amount tipped, in USDC's smallest unit (6 decimals).
    uint256 public totalTipped;

    /// @notice Emitted on every tip. Indexed by tipper so the feed can filter by sender.
    event NewTip(address indexed from, uint256 amount, string message, uint256 timestamp);

    /// @notice Emitted when the owner withdraws the collected balance.
    event Withdraw(address indexed to, uint256 amount);

    error ZeroAmount();
    error NotOwner();
    error NothingToWithdraw();

    constructor(address _usdc, address _owner) {
        require(_usdc != address(0) && _owner != address(0), "zero address");
        usdc = IERC20(_usdc);
        owner = _owner;
    }

    /**
     * @notice Send a USDC tip with an optional message.
     * @param amount USDC amount in the token's smallest unit (6 decimals; 1 USDC = 1_000_000).
     * @param message Short public message shown in the feed.
     */
    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert ZeroAmount();

        // Interactions: pull the tip. SafeERC20 reverts if the transfer fails,
        // so state below only updates on a confirmed transfer.
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Effects: counters are stats only, so post-transfer ordering is safe here.
        tipCount += 1;
        totalTipped += amount;

        emit NewTip(msg.sender, amount, message, block.timestamp);
    }

    /// @notice Withdraw the full collected USDC balance to the owner.
    function withdraw() external {
        if (msg.sender != owner) revert NotOwner();

        uint256 collected = usdc.balanceOf(address(this));
        if (collected == 0) revert NothingToWithdraw();

        usdc.safeTransfer(owner, collected);
        emit Withdraw(owner, collected);
    }

    /// @notice Current USDC balance held by the jar, awaiting withdrawal.
    function balance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
