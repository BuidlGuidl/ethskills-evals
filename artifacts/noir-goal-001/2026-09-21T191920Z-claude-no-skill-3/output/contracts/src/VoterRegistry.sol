// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IMembershipNFT} from "./MembershipNFT.sol";
import {PoseidonT3} from "./PoseidonT3.sol";

/// @notice Onchain Poseidon Merkle tree of anonymous voting identities.
///
/// Each membership NFT can have exactly one leaf. The leaf is an identity commitment
/// H1(secret) chosen by the NFT holder; the secret never touches the chain. Registration
/// is public (holder wallet -> tokenId -> commitment), which is fine: the vote circuit
/// never reveals which leaf is voting, and the per-proposal nullifier H2(secret, scope)
/// cannot be linked to the commitment without the secret.
///
/// Leaves are updated in place, so the tree always has at most one live leaf per token:
///   - register() on a token that already has a leaf replaces it (key rotation, or a new
///     holder taking over a transferred NFT);
///   - evict() zeroes the leaf of a token whose registrant no longer holds it.
/// Proposals snapshot `root`, so each proposal's electorate is fixed at creation.
contract VoterRegistry {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant DEPTH = 10; // must match TREE_DEPTH in circuits/vote
    uint256 public constant CAPACITY = 1 << DEPTH;

    IMembershipNFT public immutable nft;

    uint256 public root;
    uint256 public nextIndex; // leaves ever allocated
    uint256 public activeMembers; // leaves currently non-zero

    uint256[DEPTH] public zeros; // zeros[l] = root of an all-empty subtree of height l
    mapping(uint256 => uint256) private _nodes; // (level << 32 | index) => node

    struct Registration {
        uint32 leafIndexPlusOne; // 0 = token never registered
        address registrant; // wallet that set the current leaf
    }

    mapping(uint256 tokenId => Registration) public registrations;
    mapping(uint256 commitment => bool) public commitmentUsed;

    /// @dev Everything a client needs to rebuild the tree and its own Merkle path.
    event LeafSet(uint256 indexed tokenId, uint256 indexed leafIndex, uint256 commitment, uint256 newRoot);

    error NotTokenHolder();
    error InvalidCommitment();
    error CommitmentAlreadyUsed();
    error TreeFull();
    error NotRegistered();
    error RegistrantStillHolds();

    constructor(IMembershipNFT nft_) {
        nft = nft_;
        uint256 z = 0;
        for (uint256 l = 0; l < DEPTH; l++) {
            zeros[l] = z;
            z = PoseidonT3.hash([z, z]);
        }
        root = z;
    }

    /// @notice Set (or replace) the identity commitment for `tokenId`. Sent by the NFT holder.
    function register(uint256 tokenId, uint256 commitment) external {
        if (nft.ownerOf(tokenId) != msg.sender) revert NotTokenHolder();
        if (commitment == 0 || commitment >= SNARK_SCALAR_FIELD) revert InvalidCommitment();
        // Commitments are single-use forever: reusing one would reuse the secret, and so
        // the nullifiers, across leaves.
        if (commitmentUsed[commitment]) revert CommitmentAlreadyUsed();
        commitmentUsed[commitment] = true;

        Registration storage r = registrations[tokenId];
        uint256 index;
        if (r.leafIndexPlusOne == 0) {
            index = nextIndex;
            if (index >= CAPACITY) revert TreeFull();
            nextIndex = index + 1;
            r.leafIndexPlusOne = uint32(index + 1);
            activeMembers++;
        } else {
            index = r.leafIndexPlusOne - 1;
            if (_leaf(index) == 0) activeMembers++; // re-activating an evicted token
        }
        r.registrant = msg.sender;
        _setLeaf(tokenId, index, commitment);
    }

    /// @notice Zero the leaf of a token whose registrant no longer holds it (transferred or
    ///         burned). Callable by anyone, so a sold NFT stops carrying the seller's vote.
    function evict(uint256 tokenId) external {
        Registration storage r = registrations[tokenId];
        if (r.leafIndexPlusOne == 0) revert NotRegistered();
        uint256 index = r.leafIndexPlusOne - 1;
        if (_leaf(index) == 0) revert NotRegistered();
        address holder;
        try nft.ownerOf(tokenId) returns (address o) {
            holder = o;
        } catch {}
        if (holder == r.registrant) revert RegistrantStillHolds();
        r.registrant = address(0);
        activeMembers--;
        _setLeaf(tokenId, index, 0);
    }

    // ------------------------------------------------------------------ internals

    function _leaf(uint256 index) internal view returns (uint256) {
        return _nodes[index];
    }

    /// @dev Node at (level, index). Subtrees that start at or beyond `nextIndex` have never
    ///      been written and are the empty-subtree constant. Evicted leaves are 0, which
    ///      is consistent with zeros[] since zeros[0] == 0.
    function _node(uint256 level, uint256 index) internal view returns (uint256) {
        if ((index << level) >= nextIndex) return zeros[level];
        return _nodes[(level << 32) | index];
    }

    function _setLeaf(uint256 tokenId, uint256 index, uint256 value) internal {
        _nodes[index] = value;
        uint256 node = value;
        uint256 i = index;
        for (uint256 level = 0; level < DEPTH; level++) {
            uint256 sibling = _node(level, i ^ 1);
            node = (i & 1 == 0) ? PoseidonT3.hash([node, sibling]) : PoseidonT3.hash([sibling, node]);
            i >>= 1;
            if (level + 1 < DEPTH) _nodes[((level + 1) << 32) | i] = node;
        }
        root = node;
        emit LeafSet(tokenId, index, value, node);
    }
}
