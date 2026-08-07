//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * A tip jar that accepts USDC tips with an optional public message and keeps an on-chain feed.
 * The USDC token address is fixed at deploy time: Base USDC in production, and the exact same
 * address on a `yarn fork --network base` fork, so local demos hit the real USDC contract.
 * @author BuidlGuidl
 */
contract TipJar {
    using SafeERC20 for IERC20;

    struct Tip {
        address from;
        uint256 amount;
        uint256 timestamp;
        string message;
    }

    IERC20 public immutable usdc;
    address public immutable owner;

    Tip[] public tips;
    mapping(address => uint256) public totalTippedBy;
    uint256 public totalTipped;

    event NewTip(address indexed from, uint256 amount, string message, uint256 timestamp);
    event Withdraw(address indexed to, uint256 amount);

    error ZeroAmount();
    error NotOwner();
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
     * Send a USDC tip with an optional message. The caller must first `approve` this contract
     * for at least `amount` on the USDC token.
     * @param amount USDC amount in base units (6 decimals, so 1 USDC == 1_000_000)
     * @param message optional public message shown in the feed
     */
    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert ZeroAmount();

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        tips.push(Tip({ from: msg.sender, amount: amount, timestamp: block.timestamp, message: message }));
        totalTippedBy[msg.sender] += amount;
        totalTipped += amount;

        emit NewTip(msg.sender, amount, message, block.timestamp);
    }

    /**
     * Owner withdraws the full USDC balance currently held by the jar.
     */
    function withdraw() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert NothingToWithdraw();
        usdc.safeTransfer(owner, balance);
        emit Withdraw(owner, balance);
    }

    function tipsCount() external view returns (uint256) {
        return tips.length;
    }

    /**
     * Returns up to the most recent `count` tips, newest first — a bounded read for the UI feed.
     */
    function getRecentTips(uint256 count) external view returns (Tip[] memory) {
        uint256 len = tips.length;
        if (count > len) count = len;
        Tip[] memory recent = new Tip[](count);
        for (uint256 i = 0; i < count; i++) {
            recent[i] = tips[len - 1 - i];
        }
        return recent;
    }
}
