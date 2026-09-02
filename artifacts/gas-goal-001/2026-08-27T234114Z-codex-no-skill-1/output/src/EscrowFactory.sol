// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";
import {FreelanceEscrow} from "./FreelanceEscrow.sol";

/// @notice Deploys immutable, individually-addressable fixed-price freelance escrows.
contract EscrowFactory {
    IERC20 public immutable usdc;
    address public immutable arbiter;

    event EscrowCreated(
        address indexed escrow,
        address indexed client,
        address indexed freelancer,
        uint256 amount,
        uint256 refundDeadline
    );

    constructor(IERC20 usdc_, address arbiter_) {
        if (address(usdc_) == address(0) || arbiter_ == address(0)) {
            revert FreelanceEscrow.InvalidAddress();
        }
        if (usdc_.decimals() != 6) revert FreelanceEscrow.UnsupportedToken();
        usdc = usdc_;
        arbiter = arbiter_;
    }

    function createEscrow(address freelancer, uint256 amount, uint256 refundDeadline)
        external
        returns (FreelanceEscrow escrow)
    {
        escrow = new FreelanceEscrow(usdc, msg.sender, freelancer, arbiter, amount, refundDeadline);
        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, refundDeadline);
    }
}

