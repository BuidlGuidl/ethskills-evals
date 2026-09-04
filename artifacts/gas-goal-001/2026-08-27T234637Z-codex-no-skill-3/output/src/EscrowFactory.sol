// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {FreelanceEscrow} from "./FreelanceEscrow.sol";

/// @title EscrowFactory
/// @notice Creates and funds isolated escrow contracts from a client's approved balance.
contract EscrowFactory {
    error FundingFailed();
    error IncorrectFundingReceived();

    event EscrowCreated(
        bytes32 indexed jobId,
        address indexed escrow,
        address indexed client,
        address freelancer,
        address arbitrator,
        address token,
        uint256 amount
    );

    mapping(bytes32 jobId => address escrow) public escrowForJob;

    function createEscrow(IERC20 token, address freelancer, address arbitrator, uint256 amount, bytes32 jobId)
        external
        returns (FreelanceEscrow escrow)
    {
        if (escrowForJob[jobId] != address(0)) revert FundingFailed();

        escrow = new FreelanceEscrow(token, msg.sender, freelancer, arbitrator, amount, jobId);
        uint256 balanceBefore = token.balanceOf(address(escrow));
        if (!token.transferFrom(msg.sender, address(escrow), amount)) revert FundingFailed();
        if (token.balanceOf(address(escrow)) - balanceBefore != amount) revert IncorrectFundingReceived();

        escrowForJob[jobId] = address(escrow);
        emit EscrowCreated(jobId, address(escrow), msg.sender, freelancer, arbitrator, address(token), amount);
    }
}
