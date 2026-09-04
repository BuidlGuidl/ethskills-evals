// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The slice of ERC-721 the registry needs from the DAO's existing
///         membership NFT. Point the registry at the real collection in production.
interface IMembershipNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
}
