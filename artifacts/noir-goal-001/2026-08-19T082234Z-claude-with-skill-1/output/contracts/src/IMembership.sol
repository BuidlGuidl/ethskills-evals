// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The only thing this system needs from the DAO's membership NFT.
interface IMembership {
    function balanceOf(address owner) external view returns (uint256);
}
