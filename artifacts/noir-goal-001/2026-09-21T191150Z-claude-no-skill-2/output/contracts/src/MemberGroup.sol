// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {PoseidonT3} from "../vendor/PoseidonT3.sol";

interface IMembershipNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
}

/// @notice The set of members who have joined anonymous voting.
///
/// Each membership NFT can register exactly one identity commitment
/// (commitment = Poseidon(secret)). Commitments are the leaves of an
/// append-only Poseidon Merkle tree whose root the vote circuit proves against.
///
/// Registration is deliberately public and attributable: it reveals "token #7
/// joined with commitment C", which says nothing about any vote. Anonymity
/// comes from votes proving membership in this tree without saying which leaf.
/// Joining is one-time; the same commitment is reused for every proposal.
contract MemberGroup {
    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    /// @dev Must match DEPTH in circuits/vote/src/main.nr.
    uint256 public constant DEPTH = 10;

    IMembershipNFT public immutable membership;

    uint256 public root;
    uint256 public size;
    uint256[DEPTH] internal zeros;
    uint256[DEPTH] internal filledSubtrees;

    mapping(uint256 tokenId => bool) public tokenRegistered;
    mapping(uint256 commitment => bool) public commitmentRegistered;

    event MemberRegistered(uint256 indexed tokenId, uint256 indexed leafIndex, uint256 commitment, uint256 root);

    error NotTokenOwner();
    error TokenAlreadyRegistered();
    error InvalidCommitment();
    error CommitmentAlreadyRegistered();
    error TreeFull();

    constructor(IMembershipNFT membership_) {
        membership = membership_;
        uint256 zero = 0;
        for (uint256 i = 0; i < DEPTH; i++) {
            zeros[i] = zero;
            zero = PoseidonT3.hash([zero, zero]);
        }
        root = zero;
    }

    /// @notice Join anonymous voting. Must be sent by the wallet holding `tokenId`.
    function register(uint256 tokenId, uint256 commitment) external returns (uint256 leafIndex) {
        if (membership.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (tokenRegistered[tokenId]) revert TokenAlreadyRegistered();
        if (commitment == 0 || commitment >= SNARK_SCALAR_FIELD) revert InvalidCommitment();
        if (commitmentRegistered[commitment]) revert CommitmentAlreadyRegistered();

        leafIndex = size;
        if (leafIndex >= (1 << DEPTH)) revert TreeFull();

        tokenRegistered[tokenId] = true;
        commitmentRegistered[commitment] = true;

        uint256 node = commitment;
        for (uint256 i = 0; i < DEPTH; i++) {
            if ((leafIndex >> i) & 1 == 0) {
                filledSubtrees[i] = node;
                node = PoseidonT3.hash([node, zeros[i]]);
            } else {
                node = PoseidonT3.hash([filledSubtrees[i], node]);
            }
        }
        root = node;
        size = leafIndex + 1;

        emit MemberRegistered(tokenId, leafIndex, commitment, node);
    }
}
