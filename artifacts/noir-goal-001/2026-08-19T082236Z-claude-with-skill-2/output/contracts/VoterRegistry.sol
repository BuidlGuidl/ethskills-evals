// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {MembershipNFT} from "./MembershipNFT.sol";

/// @notice Fixed-depth incremental Merkle tree of voter commitments.
///
/// A member joins once, ever, by publishing `commitment = Poseidon(secret, nullifier)`
/// from their own (publicly known) member wallet. That transaction links the wallet to a
/// leaf index — and that is fine, because it says nothing about any future ballot. What
/// must never be linkable is the *vote* transaction, which is why that one is relayed.
///
/// The hash here (PoseidonT3, i.e. circomlib BN254 Poseidon with two inputs) is byte-for-byte
/// the same function as `poseidon::poseidon::bn254::hash_2` in circuits/vote/src/main.nr and
/// `poseidon2` from poseidon-lite in js/lib/poseidon.mjs. test/Poseidon.t.sol pins the shared
/// vector. If those three ever drift, every proof silently stops verifying.
contract VoterRegistry {
    uint256 public constant TREE_DEPTH = 10; // 1024 leaves — must equal TREE_DEPTH in main.nr

    /// @dev keccak256("dao-anon-vote:empty-leaf") % BN254_SCALAR_FIELD
    uint256 public constant ZERO_VALUE =
        0x12f949bf41c66dad37ca7791faef394b9fd39ad1a1584bf6425dea559d17ddbe;

    MembershipNFT public immutable membership;

    uint256 public root;
    uint256 public leafCount;

    uint256[TREE_DEPTH] internal filledSubtrees;
    uint256[TREE_DEPTH] internal zeros;

    mapping(uint256 tokenId => bool) public hasJoined;

    /// @notice Everything a client needs to rebuild the tree offchain by replaying logs.
    event CommitmentAdded(uint256 indexed leafIndex, uint256 commitment, uint256 root);

    error NotTokenOwner();
    error TokenAlreadyJoined();
    error TreeFull();
    error CommitmentOutOfField();

    uint256 private constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    constructor(MembershipNFT membership_) {
        membership = membership_;

        uint256 current = ZERO_VALUE;
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            zeros[i] = current;
            filledSubtrees[i] = current;
            current = PoseidonT3.hash([current, current]);
        }
        root = current;
    }

    /// @notice Publish your voter commitment. Sent by the member's own wallet.
    /// @param tokenId the caller's membership badge
    /// @param commitment Poseidon(secret, nullifier), both drawn at random by the member
    function join(uint256 tokenId, uint256 commitment) external returns (uint256 leafIndex) {
        if (membership.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (hasJoined[tokenId]) revert TokenAlreadyJoined();
        if (commitment >= SNARK_SCALAR_FIELD) revert CommitmentOutOfField();

        hasJoined[tokenId] = true;
        leafIndex = _insert(commitment);
        emit CommitmentAdded(leafIndex, commitment, root);
    }

    function _insert(uint256 leaf) internal returns (uint256 leafIndex) {
        leafIndex = leafCount;
        if (leafIndex >= (1 << TREE_DEPTH)) revert TreeFull();

        uint256 index = leafIndex;
        uint256 current = leaf;
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            uint256 left;
            uint256 right;
            if (index % 2 == 0) {
                left = current;
                right = zeros[i];
                filledSubtrees[i] = current;
            } else {
                left = filledSubtrees[i];
                right = current;
            }
            current = PoseidonT3.hash([left, right]);
            index /= 2;
        }

        root = current;
        leafCount = leafIndex + 1;
    }
}
