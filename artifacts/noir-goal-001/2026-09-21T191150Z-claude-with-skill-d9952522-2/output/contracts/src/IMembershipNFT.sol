// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice The subset of ERC-721 the voting system reads from the DAO's existing membership NFT.
interface IMembershipNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
}
