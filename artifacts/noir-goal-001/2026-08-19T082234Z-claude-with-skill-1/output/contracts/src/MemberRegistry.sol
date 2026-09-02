// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {IMembership} from "./IMembership.sol";

/// @title MemberRegistry
/// @notice The anonymity set. Each DAO member joins ONCE, from their own
///         (publicly known) wallet, by publishing an identity commitment
///         `H(secret, nullifierSecret)`. Commitments accumulate in an
///         incremental Merkle tree; ballots later prove membership in that
///         tree without saying which leaf.
///
/// @dev Joining is deliberately linkable — membership is public anyway, and a
///      member must prove they hold the NFT. What must NOT be linkable is the
///      later vote, and that is handled in AnonymousBallot (see NOTES.md).
///
///      Hash is Poseidon over BN254 with circomlib parameters, byte-identical
///      to `poseidon::poseidon::bn254::hash_2` in circuits/vote and to
///      `poseidon2` from poseidon-lite in scripts/client/tree.mjs.
///      `scripts/check-hash-parity.mjs` asserts all three agree.
contract MemberRegistry {
    /// @dev 2^8 = 256 leaves, comfortably above the DAO's 150 seats.
    ///      Must equal TREE_DEPTH in circuits/vote/src/main.nr and in
    ///      scripts/client/tree.mjs. Changing it means recompiling the circuit
    ///      and regenerating the verifier.
    uint256 public constant DEPTH = 8;
    uint256 public constant MAX_MEMBERS = 1 << 8;

    uint256 internal constant FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    IMembership public immutable membership;

    /// @notice Current tree root. Proposals snapshot this at creation time.
    uint256 public root;
    /// @notice Number of leaves used so far; also the next leaf index.
    uint256 public leafCount;

    /// @dev zeros[i] = root of an empty subtree of height i. zeros[0] = 0.
    uint256[DEPTH] internal zeros;
    /// @dev Rightmost complete subtree at each level, standard incremental IMT.
    uint256[DEPTH] internal filledSubtrees;

    mapping(address => bool) public hasJoined;
    mapping(uint256 => bool) public commitmentUsed;

    /// @notice Everything a client needs to rebuild the tree offline. Clients
    ///         replay these logs into an identical tree and read their Merkle
    ///         path out of it; there is no onchain call that hands you a path.
    event MemberJoined(uint256 indexed leafIndex, uint256 commitment, uint256 newRoot);

    error NotAMember();
    error AlreadyJoined();
    error CommitmentTaken();
    error CommitmentOutOfField();
    error RegistryFull();

    constructor(IMembership _membership) {
        membership = _membership;

        uint256 z = 0;
        for (uint256 i = 0; i < DEPTH; ++i) {
            zeros[i] = z;
            filledSubtrees[i] = z;
            z = PoseidonT3.hash([z, z]);
        }
        root = z; // root of the empty tree
    }

    /// @notice Join the anonymity set. Sent by the member's own wallet.
    /// @param commitment Poseidon(secret, nullifierSecret), computed client-side.
    ///        The registry never learns either preimage.
    function join(uint256 commitment) external returns (uint256 leafIndex) {
        if (membership.balanceOf(msg.sender) == 0) revert NotAMember();
        if (hasJoined[msg.sender]) revert AlreadyJoined();
        if (commitment == 0 || commitment >= FIELD) revert CommitmentOutOfField();
        // Stops a bystander from re-publishing someone else's commitment.
        if (commitmentUsed[commitment]) revert CommitmentTaken();
        if (leafCount >= MAX_MEMBERS) revert RegistryFull();

        hasJoined[msg.sender] = true;
        commitmentUsed[commitment] = true;

        leafIndex = leafCount++;
        _insert(leafIndex, commitment);

        emit MemberJoined(leafIndex, commitment, root);
    }

    function _insert(uint256 leafIndex, uint256 leaf) internal {
        uint256 idx = leafIndex;
        uint256 node = leaf;
        for (uint256 i = 0; i < DEPTH; ++i) {
            if (idx & 1 == 0) {
                // node is a left child; its right sibling is still empty
                filledSubtrees[i] = node;
                node = PoseidonT3.hash([node, zeros[i]]);
            } else {
                node = PoseidonT3.hash([filledSubtrees[i], node]);
            }
            idx >>= 1;
        }
        root = node;
    }

    function emptySubtreeRoot(uint256 level) external view returns (uint256) {
        return zeros[level];
    }
}
