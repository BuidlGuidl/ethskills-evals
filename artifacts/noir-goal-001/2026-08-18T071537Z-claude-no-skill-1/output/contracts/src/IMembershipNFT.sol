// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The slice of ERC-721 this system needs from the DAO's existing
///         membership NFT. Any standard ERC-721 satisfies it.
interface IMembershipNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
}
