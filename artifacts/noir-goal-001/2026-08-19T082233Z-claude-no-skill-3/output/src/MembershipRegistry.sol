// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC721Minimal} from "./interfaces/IERC721Minimal.sol";
import {Hash} from "./libraries/Hash.sol";

/// @title MembershipRegistry
/// @notice The anonymity set. Every member who wants to vote privately puts
///         one leaf - a commitment to a secret only they know - into an
///         append-only Merkle tree, once per membership NFT.
///
/// @dev    The join transaction is public and linkable: the chain sees
///         "wallet 0xA added leaf L". That is fine and unavoidable, because
///         membership is public anyway. Privacy comes later: a ballot proves
///         "one of these leaves is mine" without saying which, and the
///         per-proposal nullifier is derived from the secret, never from the
///         leaf, so no ballot can be traced back to a join.
///
///         The tree is maintained on-chain (keccak, ~4k gas per level) rather
///         than published by an operator, so the root nobody can lie about:
///         anyone can recompute it from the `MemberJoined` logs.
contract MembershipRegistry {
    /// @dev 2^8 = 256 leaves, room for the 150 members plus growth.
    uint256 public constant TREE_DEPTH = 8;
    uint256 public constant MAX_MEMBERS = 1 << TREE_DEPTH;

    /// @dev Value of an unused leaf. Must match `js/core/merkle.js`.
    uint256 public constant EMPTY_LEAF = uint256(keccak256("dao-private-vote.empty-leaf")) >> 8;

    IERC721Minimal public immutable membershipNft;

    /// @notice Current Merkle root of the membership tree.
    uint256 public root;

    /// @notice Leaves in insertion order. Public on purpose: every member
    ///         needs the full list to build their own Merkle path locally,
    ///         and downloading only "their" leaf would leak which one it is.
    uint256[] public commitments;

    /// @dev zeros[i] = root of an all-empty subtree of height i.
    uint256[TREE_DEPTH] public zeros;
    /// @dev Left-hand siblings on the current insertion path.
    uint256[TREE_DEPTH] private filledSubtrees;

    /// @notice One leaf per membership NFT, not per wallet: moving the NFT to
    ///         a fresh wallet must not buy a second vote.
    mapping(uint256 tokenId => bool) public tokenRegistered;
    /// @notice Stops a member from re-registering a leaf copied from the logs
    ///         (they could not vote with it, but it would burn their own slot).
    mapping(uint256 commitment => bool) public commitmentRegistered;

    event MemberJoined(uint256 indexed leafIndex, uint256 commitment, uint256 tokenId, uint256 newRoot);

    error NotTokenOwner();
    error TokenAlreadyRegistered();
    error CommitmentAlreadyRegistered();
    error CommitmentOutOfRange();
    error TreeFull();

    constructor(IERC721Minimal membershipNft_) {
        membershipNft = membershipNft_;

        uint256 node = EMPTY_LEAF;
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            zeros[i] = node;
            filledSubtrees[i] = node;
            node = Hash.pair(node, node);
        }
        root = node;
    }

    /// @notice Join the anonymity set for future proposals.
    /// @param tokenId    A membership NFT held by the caller.
    /// @param commitment hash_pair(secret, 0), computed off-chain. The secret
    ///                   must be a full-entropy 32-byte value: a guessable
    ///                   secret can be brute-forced against this public leaf
    ///                   and would deanonymise every ballot it ever casts.
    function register(uint256 tokenId, uint256 commitment) external returns (uint256 leafIndex) {
        if (membershipNft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (tokenRegistered[tokenId]) revert TokenAlreadyRegistered();
        if (commitmentRegistered[commitment]) revert CommitmentAlreadyRegistered();
        if (commitment == 0 || commitment >= Hash.FIELD_SAFE_BOUND) revert CommitmentOutOfRange();
        if (commitments.length >= MAX_MEMBERS) revert TreeFull();

        tokenRegistered[tokenId] = true;
        commitmentRegistered[commitment] = true;

        leafIndex = commitments.length;
        commitments.push(commitment);
        _insert(leafIndex, commitment);

        emit MemberJoined(leafIndex, commitment, tokenId, root);
    }

    /// @notice Whether an address currently holds a membership NFT.
    function isHolder(address account) external view returns (bool) {
        return membershipNft.balanceOf(account) > 0;
    }

    function memberCount() external view returns (uint256) {
        return commitments.length;
    }

    /// @notice The whole leaf set, for building a Merkle path off-chain.
    function getCommitments() external view returns (uint256[] memory) {
        return commitments;
    }

    /// @dev Standard incremental insert: walk from the new leaf to the root,
    ///      pairing with the stored left sibling or the empty-subtree root.
    function _insert(uint256 leafIndex, uint256 leaf) private {
        uint256 index = leafIndex;
        uint256 node = leaf;

        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (index & 1 == 0) {
                filledSubtrees[i] = node;
                node = Hash.pair(node, zeros[i]);
            } else {
                node = Hash.pair(filledSubtrees[i], node);
            }
            index >>= 1;
        }

        root = node;
    }
}
