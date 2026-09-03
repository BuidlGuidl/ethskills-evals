// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPoseidonT3} from "./interfaces/IPoseidonT3.sol";
import {IMembershipNFT} from "./interfaces/IMembershipNFT.sol";

/// @title MemberRegistry
/// @notice Fixed-depth incremental Merkle tree of member identity commitments.
///
/// A member registers once, from the wallet that holds their membership NFT. That
/// transaction is public and links wallet -> commitment; that is fine and expected,
/// because membership is already public. What must never be public is the link from
/// a commitment to a *vote*, and no transaction here touches a vote.
///
/// The tree is Poseidon(left, right) over BN254, depth 10 (1024 slots), empty leaves
/// valued 0 -- identical to the tree the Noir circuit walks and the mirror in
/// client/src/tree.js rebuilds from `MemberRegistered` events.
contract MemberRegistry {
    uint256 public constant DEPTH = 10;
    uint256 public constant MAX_MEMBERS = 1 << DEPTH;

    IPoseidonT3 public immutable poseidon;
    IMembershipNFT public immutable membershipNFT;

    /// @dev zeros[i] is the root of an all-empty subtree of height i.
    uint256[DEPTH] public zeros;
    /// @dev filledSubtrees[i] is the left-hand node cached at level i (Tornado-style).
    uint256[DEPTH] internal filledSubtrees;

    uint256 public root;
    uint32 public memberCount;

    mapping(uint256 commitment => bool) public commitmentRegistered;
    /// @dev One commitment per membership NFT, not per wallet: transferring the NFT
    ///      must not mint a second vote.
    mapping(uint256 tokenId => bool) public tokenRegistered;

    /// @notice Everything a client needs to rebuild its offchain mirror of this tree.
    event MemberRegistered(uint256 indexed commitment, uint32 leafIndex, uint256 newRoot);

    error NotTokenOwner();
    error TokenAlreadyRegistered();
    error CommitmentAlreadyRegistered();
    error CommitmentOutOfRange();
    error TreeFull();

    /// @dev BN254 scalar field modulus. Commitments are field elements.
    uint256 internal constant FIELD_MODULUS =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    constructor(IPoseidonT3 _poseidon, IMembershipNFT _membershipNFT) {
        poseidon = _poseidon;
        membershipNFT = _membershipNFT;

        // zeros[0] = 0 (the empty-leaf value), zeros[i] = H(zeros[i-1], zeros[i-1]).
        uint256 current = 0;
        for (uint256 i = 0; i < DEPTH; i++) {
            zeros[i] = current;
            filledSubtrees[i] = current;
            current = _poseidon.hash([current, current]);
        }
        root = current; // root of the wholly empty depth-10 tree
    }

    /// @notice Register the identity commitment for a membership NFT you own.
    /// @param tokenId The caller's membership NFT.
    /// @param commitment Poseidon(identitySecret, identityTrapdoor), computed offchain.
    ///        Both preimages stay on the member's machine forever; losing them means
    ///        losing the ability to vote, with no recovery path.
    function register(uint256 tokenId, uint256 commitment) external returns (uint32 leafIndex) {
        if (membershipNFT.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (tokenRegistered[tokenId]) revert TokenAlreadyRegistered();
        // 0 is the empty-leaf value; a 0 leaf would forge membership in unused slots.
        if (commitment == 0 || commitment >= FIELD_MODULUS) revert CommitmentOutOfRange();
        if (commitmentRegistered[commitment]) revert CommitmentAlreadyRegistered();

        tokenRegistered[tokenId] = true;
        commitmentRegistered[commitment] = true;

        leafIndex = _insert(commitment);
        emit MemberRegistered(commitment, leafIndex, root);
    }

    function _insert(uint256 leaf) internal returns (uint32 leafIndex) {
        leafIndex = memberCount;
        if (leafIndex >= MAX_MEMBERS) revert TreeFull();

        uint256 idx = leafIndex;
        uint256 current = leaf;
        for (uint256 i = 0; i < DEPTH; i++) {
            uint256 left;
            uint256 right;
            if (idx % 2 == 0) {
                // current is a left child; its right sibling is still empty
                left = current;
                right = zeros[i];
                filledSubtrees[i] = current;
            } else {
                left = filledSubtrees[i];
                right = current;
            }
            current = poseidon.hash([left, right]);
            idx /= 2;
        }

        root = current;
        memberCount = leafIndex + 1;
    }
}
