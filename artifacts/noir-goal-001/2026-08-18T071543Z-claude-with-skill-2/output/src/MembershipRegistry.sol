// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {InternalLeanIMT, LeanIMTData} from "lean-imt/InternalLeanIMT.sol";

/// @title MembershipRegistry
/// @notice The anonymity set for DAO votes.
///
/// A member proves NFT ownership once, from their public wallet, and inserts a
/// commitment to a secret only they know. From then on they never touch this
/// contract again: voting happens from an unrelated wallet against a Merkle
/// root of every commitment in here.
///
/// What a chain observer learns from `join()`: "wallet X, holder of membership
/// token T, registered commitment C". The commitment is a Poseidon hash of
/// secrets that never leave the member's machine, so C cannot be linked to any
/// later vote.
contract MembershipRegistry {
    using InternalLeanIMT for LeanIMTData;

    /// @notice The DAO's public membership NFT. Holding one is the only
    /// entitlement to join.
    IERC721 public immutable membershipNft;

    /// @dev Lean incremental Merkle tree of member commitments. Hashed with
    /// PoseidonT3, matching `poseidon::poseidon::bn254::hash_2` in the circuit.
    LeanIMTData internal tree;

    /// @notice One commitment per membership NFT, ever.
    ///
    /// Keyed on the token, not the wallet: gating on the wallet would let a
    /// member transfer their NFT to a second address, join again and vote
    /// twice. It also means a member holding several NFTs gets one leaf — and
    /// so one vote — per NFT, which is what NFT-weighted membership means.
    mapping(uint256 => bool) public hasJoined;

    /// @notice Every root this tree has ever had. A proposal snapshots one of
    /// these at creation; proofs are checked against that snapshot, so late
    /// joiners never invalidate an in-flight vote.
    mapping(uint256 => bool) public isKnownRoot;

    /// @dev `leafIndex` is what a client needs to rebuild the tree offchain and
    /// derive its own Merkle path. The contract never hands out witness paths.
    event MemberJoined(uint256 indexed commitment, uint256 leafIndex, uint256 root);

    error NotTokenOwner();
    error AlreadyJoined();

    constructor(IERC721 _membershipNft) {
        membershipNft = _membershipNft;
    }

    /// @notice Add `commitment` to the anonymity set.
    /// @param tokenId A membership NFT the caller owns. Consumed permanently.
    /// @param commitment Poseidon(1, Poseidon(identityNullifier, identitySecret)).
    ///        Computed offchain; this contract learns nothing from it.
    function join(uint256 tokenId, uint256 commitment) external returns (uint256 leafIndex, uint256 newRoot) {
        if (membershipNft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (hasJoined[tokenId]) revert AlreadyJoined();

        hasJoined[tokenId] = true;

        leafIndex = tree.size;
        newRoot = tree._insert(commitment);
        isKnownRoot[newRoot] = true;

        emit MemberJoined(commitment, leafIndex, newRoot);
    }

    /// @notice Current root of the commitment tree.
    function root() external view returns (uint256) {
        return tree._root();
    }

    /// @notice Number of commitments in the tree — the size of the anonymity set.
    function memberCount() external view returns (uint256) {
        return tree.size;
    }

    /// @notice Depth of the tree. Must stay <= the circuit's MAX_DEPTH (16).
    function depth() external view returns (uint256) {
        return tree.depth;
    }
}
