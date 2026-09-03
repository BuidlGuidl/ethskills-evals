// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FieldHash} from "./FieldHash.sol";

interface IMembershipNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
}

/// @title MemberRegistry
/// @notice The public list of voting keys, and the incremental Merkle tree over it.
///
/// Each member generates a secret offchain, publishes `commitment = H(secret)`, and
/// proves membership against this tree when voting. Registration is deliberately
/// attributable: it is sent from the member's own NFT-holding wallet and the
/// commitment is public. That is fine and unavoidable, because membership itself is
/// public. What stays hidden is the link from a commitment to a *ballot*, which
/// needs `secret` to compute and which nobody but the member has.
///
/// @dev The tree is maintained onchain rather than posted by an admin on purpose.
/// A root the DAO could choose freely is a privacy hole, not just an integrity one:
/// an operator who could pack a proposal's tree with commitments they control could
/// subtract their own known ballots from the tally and narrow down - or fully
/// determine - what the remaining real members voted. Here the root is a pure
/// function of what NFT holders themselves registered.
contract MemberRegistry {
    /// @dev Must equal TREE_DEPTH in circuits/vote/src/main.nr and js/core/tree.js.
    uint256 public constant TREE_DEPTH = 10;
    uint256 public constant MAX_MEMBERS = 1 << TREE_DEPTH;

    IMembershipNFT public immutable membershipNFT;

    /// @notice Current Merkle root over all registered commitments.
    bytes32 public root;
    /// @notice Number of leaves used so far.
    uint32 public memberCount;

    /// @notice Every commitment ever registered, in leaf order, so anyone can
    ///         rebuild the tree offchain and check `root` for themselves.
    bytes32[] public commitments;

    /// @notice tokenId => the voting key registered against it. One per NFT, forever.
    mapping(uint256 => bytes32) public commitmentOfToken;
    mapping(bytes32 => bool) public commitmentTaken;

    bytes32[TREE_DEPTH] internal filledSubtrees;
    bytes32[TREE_DEPTH] internal zeros;

    event MemberRegistered(
        address indexed member, uint256 indexed tokenId, bytes32 commitment, uint32 leafIndex, bytes32 newRoot
    );

    error NotAMember();
    error AlreadyRegistered();
    error CommitmentTaken();
    error InvalidCommitment();
    error TreeFull();

    constructor(IMembershipNFT nft) {
        membershipNFT = nft;
        // zeros[i] is the root of an all-zero subtree of height i.
        bytes32 z = bytes32(0);
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            zeros[i] = z;
            filledSubtrees[i] = z;
            z = FieldHash.hash2(z, z);
        }
        root = z;
    }

    /// @notice Publish the voting key for one membership NFT.
    /// @param tokenId a membership NFT the caller owns.
    /// @param commitment H(secret), computed offchain. The secret never leaves the
    ///        member's machine - this contract only ever sees its hash.
    /// @dev Keyed on the token, not on the caller. Keying on the caller would let a
    ///      transferable NFT be registered twice - register, transfer, the new holder
    ///      registers again - which is both a second vote and, because the extra leaf
    ///      is controlled by one party, a smaller real anonymity set than the leaf
    ///      count suggests.
    function register(uint256 tokenId, bytes32 commitment) external returns (uint32 leafIndex) {
        if (membershipNFT.ownerOf(tokenId) != msg.sender) revert NotAMember();
        if (commitmentOfToken[tokenId] != bytes32(0)) revert AlreadyRegistered();
        if (commitment == bytes32(0) || !FieldHash.inFieldRange(commitment)) revert InvalidCommitment();
        // Two members must not share a leaf, or they also share every nullifier and
        // one of them silently loses their vote.
        if (commitmentTaken[commitment]) revert CommitmentTaken();

        commitmentOfToken[tokenId] = commitment;
        commitmentTaken[commitment] = true;
        leafIndex = _insert(commitment);
        commitments.push(commitment);

        emit MemberRegistered(msg.sender, tokenId, commitment, leafIndex, root);
    }

    /// @notice The whole leaf list in one call, for offchain tree rebuilding.
    function allCommitments() external view returns (bytes32[] memory) {
        return commitments;
    }

    /// @dev Standard incremental Merkle insert: only the path from the new leaf to
    ///      the root is touched, so a registration costs TREE_DEPTH hashes.
    function _insert(bytes32 leaf) internal returns (uint32 insertedAt) {
        uint32 index = memberCount;
        if (index == MAX_MEMBERS) revert TreeFull();

        uint32 cursor = index;
        bytes32 node = leaf;
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (cursor % 2 == 0) {
                // Left child: our right sibling is still empty, and this node is the
                // subtree the next insertion at this level will pair against.
                filledSubtrees[i] = node;
                node = FieldHash.hash2(node, zeros[i]);
            } else {
                node = FieldHash.hash2(filledSubtrees[i], node);
            }
            cursor /= 2;
        }

        root = node;
        memberCount = index + 1;
        return index;
    }
}
