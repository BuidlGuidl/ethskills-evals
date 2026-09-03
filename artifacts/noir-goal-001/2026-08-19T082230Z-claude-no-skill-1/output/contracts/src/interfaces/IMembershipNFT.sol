// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice The part of the DAO's existing membership NFT that this system reads.
///         Ownership is only ever used to gate *joining* and *proposing*, never
///         to gate voting: a ballot is checked against the membership tree, so
///         it carries no link to a token or a wallet.
interface IMembershipNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
}
