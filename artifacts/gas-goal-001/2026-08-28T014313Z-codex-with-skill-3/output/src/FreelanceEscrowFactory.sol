// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";
import {FreelanceEscrow} from "./FreelanceEscrow.sol";

/// @notice Deploys USDC-denominated freelance escrows with the product's $2k–$50k bounds.
contract FreelanceEscrowFactory {
    error InvalidAddress();
    error AmountOutOfBounds();

    IERC20 public immutable paymentToken;
    address public immutable arbitrator;
    uint256 public immutable minAmount;
    uint256 public immutable maxAmount;

    event EscrowCreated(
        address indexed escrow, address indexed client, address indexed freelancer, uint256 amount, bytes32 jobReference
    );

    constructor(IERC20 paymentToken_, address arbitrator_, uint256 minAmount_, uint256 maxAmount_) {
        if (address(paymentToken_) == address(0) || arbitrator_ == address(0)) revert InvalidAddress();
        if (minAmount_ == 0 || minAmount_ > maxAmount_) revert AmountOutOfBounds();
        paymentToken = paymentToken_;
        arbitrator = arbitrator_;
        minAmount = minAmount_;
        maxAmount = maxAmount_;
    }

    function createEscrow(address freelancer, uint256 amount, bytes32 jobReference)
        external
        returns (FreelanceEscrow escrow)
    {
        if (amount < minAmount || amount > maxAmount) revert AmountOutOfBounds();
        escrow = new FreelanceEscrow(paymentToken, msg.sender, freelancer, arbitrator, amount, jobReference);
        emit EscrowCreated(address(escrow), msg.sender, freelancer, amount, jobReference);
    }
}
