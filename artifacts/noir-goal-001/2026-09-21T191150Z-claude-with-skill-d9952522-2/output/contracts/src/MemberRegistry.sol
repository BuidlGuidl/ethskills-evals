// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {IMembershipNFT} from "./IMembershipNFT.sol";

/// @title MemberRegistry
/// @notice Fixed-depth Poseidon Merkle tree of member commitments, one leaf per membership NFT.
///
/// A member registers ONCE, from the wallet holding their NFT, with
/// commitment = Poseidon(nullifier, secret). Registration is public on purpose —
/// membership already is. What stays private is which leaf later casts a vote.
///
/// Leaves can be overwritten (key rotation, NFT transferred to a new owner) or
/// zeroed (evicting a leaf whose NFT left the registrant's wallet). Each proposal
/// snapshots `root` at creation, so changes never affect an open proposal and a
/// rotated key can't vote twice on it.
///
/// Every change emits `LeafSet`, which is everything a client needs to rebuild
/// the tree offchain and derive its own Merkle path (see scripts/lib/tree.mjs).
contract MemberRegistry {
    uint256 public constant DEPTH = 10; // must match `DEPTH` in circuits/vote/src/main.nr
    uint256 internal constant FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    IMembershipNFT public immutable membership;

    uint256 public root;
    uint256 public nextIndex;
    uint256 public activeMembers;

    /// zeros[i] = root of an empty subtree of height i (empty leaf = 0).
    uint256[DEPTH + 1] public zeros;
    /// nodes[level][index]; 0 means "empty", read through `_node`.
    mapping(uint256 => mapping(uint256 => uint256)) internal nodes;

    mapping(uint256 tokenId => uint256) internal leafIndexPlusOne;
    mapping(uint256 tokenId => address) public registrant;
    mapping(uint256 commitment => bool) public commitmentUsed;

    event LeafSet(uint256 indexed tokenId, uint256 indexed leafIndex, uint256 commitment, uint256 root);

    error NotTokenOwner();
    error BadCommitment();
    error TreeFull();
    error NotEvictable();

    constructor(IMembershipNFT _membership) {
        membership = _membership;
        uint256 z = 0;
        for (uint256 i = 0; i <= DEPTH; i++) {
            zeros[i] = z;
            z = PoseidonT3.hash([z, z]);
        }
        root = zeros[DEPTH];
    }

    /// @notice Register (or rotate) the commitment for `tokenId`. Sent from the NFT holder's wallet.
    function register(uint256 tokenId, uint256 commitment) external {
        if (membership.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (commitment == 0 || commitment >= FIELD || commitmentUsed[commitment]) revert BadCommitment();
        commitmentUsed[commitment] = true;

        uint256 index;
        uint256 slot = leafIndexPlusOne[tokenId];
        if (slot == 0) {
            index = nextIndex;
            if (index >= (1 << DEPTH)) revert TreeFull();
            nextIndex = index + 1;
            leafIndexPlusOne[tokenId] = index + 1;
        } else {
            index = slot - 1;
        }
        if (nodes[0][index] == 0) activeMembers++;
        registrant[tokenId] = msg.sender;
        _setLeaf(tokenId, index, commitment);
    }

    /// @notice Anyone may clear the leaf of an NFT that is no longer held by whoever registered it.
    function evict(uint256 tokenId) external {
        uint256 slot = leafIndexPlusOne[tokenId];
        if (slot == 0 || nodes[0][slot - 1] == 0) revert NotEvictable();
        address owner;
        try membership.ownerOf(tokenId) returns (address o) {
            owner = o;
        } catch {} // burned token => owner stays address(0)
        if (owner == registrant[tokenId]) revert NotEvictable();
        activeMembers--;
        registrant[tokenId] = address(0);
        _setLeaf(tokenId, slot - 1, 0);
    }

    function leafIndexOf(uint256 tokenId) external view returns (bool registered, uint256 index) {
        uint256 slot = leafIndexPlusOne[tokenId];
        return (slot != 0, slot == 0 ? 0 : slot - 1);
    }

    function _node(uint256 level, uint256 index) internal view returns (uint256) {
        uint256 v = nodes[level][index];
        return v == 0 ? zeros[level] : v;
    }

    function _setLeaf(uint256 tokenId, uint256 index, uint256 leaf) internal {
        nodes[0][index] = leaf;
        uint256 node = leaf;
        uint256 idx = index;
        for (uint256 level = 0; level < DEPTH; level++) {
            uint256 sibling = _node(level, idx ^ 1);
            node = (idx & 1 == 0) ? PoseidonT3.hash([node, sibling]) : PoseidonT3.hash([sibling, node]);
            idx >>= 1;
            nodes[level + 1][idx] = node;
        }
        root = node;
        emit LeafSet(tokenId, index, leaf, node);
    }
}
