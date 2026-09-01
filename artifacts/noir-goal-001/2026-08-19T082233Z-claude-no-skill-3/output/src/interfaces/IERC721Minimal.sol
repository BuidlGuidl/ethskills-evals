// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Just the two calls the registry needs from the DAO's existing
///         membership NFT.
interface IERC721Minimal {
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
}
