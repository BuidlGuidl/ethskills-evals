// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Always reverts, to prove a single bad entry cannot take down a batch.
contract RevertingToken {
    error AlwaysReverts();

    function transfer(address, uint256) external pure returns (bool) {
        revert AlwaysReverts();
    }
}
