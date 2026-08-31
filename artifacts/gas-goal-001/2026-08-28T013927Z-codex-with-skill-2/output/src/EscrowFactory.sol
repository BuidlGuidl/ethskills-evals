// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {FreelanceEscrow} from "./FreelanceEscrow.sol";

/// @title EscrowFactory
/// @notice Permissionless factory that creates an auditable escrow contract per job.
contract EscrowFactory {
    /// @dev USDC uses six decimals; these limits represent $2,000 and $50,000.
    uint256 public constant MIN_AMOUNT = 2_000e6;
    uint256 public constant MAX_AMOUNT = 50_000e6;

    IERC20 public immutable usdc;

    error InvalidAmount();

    event EscrowCreated(
        address indexed escrow,
        address indexed client,
        address indexed freelancer,
        address token,
        uint256 amount,
        bytes32 jobReference
    );

    constructor(IERC20 usdc_) {
        if (address(usdc_) == address(0)) revert FreelanceEscrow.InvalidAddress();
        usdc = usdc_;
    }

    function createEscrow(
        address freelancer,
        address arbitrator,
        uint256 amount,
        uint256 fundingDeadline,
        bytes32 jobReference
    ) external returns (FreelanceEscrow escrow) {
        if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) revert InvalidAmount();
        escrow = new FreelanceEscrow(
            usdc, msg.sender, freelancer, arbitrator, amount, fundingDeadline, jobReference
        );
        emit EscrowCreated(
            address(escrow), msg.sender, freelancer, address(usdc), amount, jobReference
        );
    }
}
