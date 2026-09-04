// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Hashes} from "./Hashes.sol";

interface IMembershipNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title MemberRegistry
/// @notice Append-only Merkle tree of member voting commitments.
///
/// @dev Why the tree is built on-chain rather than published by an admin:
///      the anonymity set of a vote is exactly the set of leaves under the root
///      a proof is checked against. An admin who could choose that root could
///      publish a tree containing one real member plus 255 commitments they
///      generated themselves; any vote against that root that is not one of
///      their own would then be attributable to that single member. Deriving the
///      root from NFT-gated registrations removes that power from everyone,
///      including the DAO.
contract MemberRegistry {
    /// @notice Tree depth. 2**8 = 256 leaves, comfortably above the ~150 members.
    uint256 public constant DEPTH = 8;
    /// @notice Maximum number of registered members.
    uint256 public constant CAPACITY = 1 << DEPTH;

    IMembershipNFT public immutable membershipNFT;

    /// @notice Current Merkle root over all registered commitments.
    uint256 public root;
    /// @notice Number of leaves inserted so far; also the next free leaf index.
    uint256 public nextLeafIndex;

    /// @notice Every commitment ever registered, in leaf order, so that anyone
    ///         can rebuild the tree from public data and check `root`.
    uint256[] public commitments;

    /// @notice One registration per membership token.
    mapping(uint256 => bool) public tokenRegistered;
    /// @notice Rejects a commitment that is already a leaf.
    mapping(uint256 => bool) public commitmentRegistered;

    uint256[DEPTH] private _filledSubtrees;
    uint256[DEPTH] private _zeros;

    event MemberRegistered(uint256 indexed leafIndex, uint256 commitment, uint256 newRoot);

    error TreeFull();
    error NotTokenOwner();
    error TokenAlreadyRegistered();
    error CommitmentAlreadyRegistered();
    error CommitmentOutOfRange();

    constructor(IMembershipNFT membershipNFT_) {
        membershipNFT = membershipNFT_;

        // zeros[i] is the root of an empty subtree of height i.
        uint256 current = 0;
        for (uint256 i = 0; i < DEPTH; i++) {
            _zeros[i] = current;
            _filledSubtrees[i] = current;
            current = Hashes.hashPair(current, current);
        }
        root = current;
    }

    /// @notice Join the anonymous voter set.
    /// @dev Sent by the member's own NFT-holding wallet. This transaction is
    ///      deliberately attributable: it says "this member can vote", which is
    ///      already public information. It says nothing about any future vote,
    ///      because `commitment` is a keccak digest of a secret the member never
    ///      discloses.
    /// @param tokenId The membership token proving the caller is a member.
    /// @param commitment tagged(1, secret, 0), computed off-chain by the member.
    function register(uint256 tokenId, uint256 commitment) external returns (uint256 leafIndex) {
        if (membershipNFT.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (tokenRegistered[tokenId]) revert TokenAlreadyRegistered();
        if (commitmentRegistered[commitment]) revert CommitmentAlreadyRegistered();
        // Must be a well-formed truncated digest, otherwise it is not a valid
        // BN254 field element and no proof could ever open it.
        if (commitment == 0 || commitment >= Hashes.DIGEST_BOUND) revert CommitmentOutOfRange();

        tokenRegistered[tokenId] = true;
        commitmentRegistered[commitment] = true;

        leafIndex = _insert(commitment);
        commitments.push(commitment);

        emit MemberRegistered(leafIndex, commitment, root);
    }

    function memberCount() external view returns (uint256) {
        return commitments.length;
    }

    /// @notice All commitments in leaf order, for rebuilding the tree client-side.
    function allCommitments() external view returns (uint256[] memory) {
        return commitments;
    }

    /// @dev Standard incremental Merkle insert: only the path of the new leaf is
    ///      recomputed, so registration is O(DEPTH) hashes rather than O(n).
    function _insert(uint256 leaf) private returns (uint256 index) {
        index = nextLeafIndex;
        if (index >= CAPACITY) revert TreeFull();

        uint256 currentIndex = index;
        uint256 currentHash = leaf;

        for (uint256 i = 0; i < DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                // Left child: our right sibling is still empty, and this node is
                // the newest complete subtree at this height.
                _filledSubtrees[i] = currentHash;
                currentHash = Hashes.hashPair(currentHash, _zeros[i]);
            } else {
                currentHash = Hashes.hashPair(_filledSubtrees[i], currentHash);
            }
            currentIndex /= 2;
        }

        root = currentHash;
        nextLeafIndex = index + 1;
    }
}
