// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";

/// @notice Anonymity set for voting. Each membership NFT may register exactly one
/// identity commitment = Poseidon(identityNullifier, identityTrapdoor). Commitments
/// go into an append-only Poseidon Merkle tree (fixed depth, zero leaves = 0).
/// Registration is done once, from the member's public wallet, and reused for every
/// proposal. It reveals "NFT #k joined the anonymity set", nothing about any vote.
contract MemberRegistry {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416417980263064491575221009009;
    uint256 public constant DEPTH = 10; // must match DEPTH in circuits/vote/src/main.nr

    IERC721 public immutable membershipNft;

    uint256 public root;
    uint256 public nextIndex;
    uint256[DEPTH] public zeros;
    uint256[DEPTH] internal filledSubtrees;

    mapping(uint256 tokenId => bool) public tokenRegistered;
    mapping(uint256 commitment => bool) public commitmentUsed;

    /// Everything a client needs to rebuild the tree offchain.
    event MemberRegistered(uint256 indexed tokenId, uint256 commitment, uint256 leafIndex, uint256 newRoot);

    error NotTokenOwner();
    error AlreadyRegistered();
    error InvalidCommitment();
    error TreeFull();

    constructor(IERC721 _membershipNft) {
        membershipNft = _membershipNft;
        uint256 z = 0;
        for (uint256 i = 0; i < DEPTH; i++) {
            zeros[i] = z;
            filledSubtrees[i] = z;
            z = PoseidonT3.hash([z, z]);
        }
        root = z; // root of the empty tree
    }

    function register(uint256 tokenId, uint256 commitment) external returns (uint256 leafIndex) {
        if (membershipNft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        // Keyed by token, not wallet: transferring the NFT does not grant a second leaf.
        if (tokenRegistered[tokenId]) revert AlreadyRegistered();
        if (commitment == 0 || commitment >= SNARK_SCALAR_FIELD || commitmentUsed[commitment]) {
            revert InvalidCommitment();
        }
        leafIndex = nextIndex;
        if (leafIndex >= 2 ** DEPTH) revert TreeFull();

        tokenRegistered[tokenId] = true;
        commitmentUsed[commitment] = true;

        uint256 node = commitment;
        uint256 idx = leafIndex;
        for (uint256 i = 0; i < DEPTH; i++) {
            if (idx & 1 == 0) {
                filledSubtrees[i] = node;
                node = PoseidonT3.hash([node, zeros[i]]);
            } else {
                node = PoseidonT3.hash([filledSubtrees[i], node]);
            }
            idx >>= 1;
        }
        root = node;
        nextIndex = leafIndex + 1;
        emit MemberRegistered(tokenId, commitment, leafIndex, node);
    }
}
