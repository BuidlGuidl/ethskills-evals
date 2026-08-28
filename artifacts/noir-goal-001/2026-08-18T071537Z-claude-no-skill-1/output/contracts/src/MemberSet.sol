// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IMembershipNFT} from "./IMembershipNFT.sol";
import {Keccak248} from "./Keccak248.sol";

/// @title MemberSet
/// @notice The anonymity set. An append-only Merkle tree of one voting
///         commitment per membership token, built on chain with the same
///         truncated-keccak hash the Noir circuit uses.
///
/// @dev The point of building the tree here rather than accepting a root from
///      an operator: the root is a pure function of transactions anyone can
///      replay. There is no moment at which the DAO could slip an extra leaf in
///      (a ballot it could then cast, or a decoy that shrinks the real
///      anonymity set) without it being visible on chain.
///
///      Enrolling is public and attributable -- tokenId, sender and commitment
///      are all in the clear. That is fine and unavoidable: a member must prove
///      they hold a seat to get into the set. Privacy comes later, when a
///      ballot proves membership of this tree without saying which leaf.
contract MemberSet {
    using Keccak248 for bytes32;

    /// @dev 2^10 = 1024 seats for 150 members. MUST equal TREE_DEPTH in
    ///      circuits/private_vote/src/main.nr -- changing it means recompiling
    ///      the circuit and deploying a new verifier.
    uint256 public constant TREE_DEPTH = 10;
    uint256 public constant MAX_MEMBERS = 2 ** TREE_DEPTH;

    /// @dev keccak256("dao.private-ballot.v1.empty-leaf") & (2^248 - 1)
    bytes32 public constant EMPTY_LEAF =
        bytes32(uint256(keccak256("dao.private-ballot.v1.empty-leaf")) & Keccak248.MASK);

    IMembershipNFT public immutable membership;

    /// @notice Every commitment ever enrolled, in leaf order. Members read this
    ///         to rebuild their own Merkle path off chain.
    bytes32[] public leaves;

    /// @notice Current tree root. Proposals snapshot it at creation.
    bytes32 public root;

    /// @dev zeros[i] = hash of an all-empty subtree of height i.
    bytes32[TREE_DEPTH] private _zeros;
    /// @dev Rightmost filled node at each level, for O(depth) appends.
    bytes32[TREE_DEPTH] private _filledSubtrees;

    mapping(uint256 tokenId => bool) public enrolled;

    event Enrolled(uint256 indexed tokenId, bytes32 indexed commitment, uint256 leafIndex, bytes32 newRoot);

    error NotTokenHolder();
    error AlreadyEnrolled();
    error InvalidCommitment();
    error SetFull();

    constructor(IMembershipNFT membership_) {
        membership = membership_;

        bytes32 zero = EMPTY_LEAF;
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            _zeros[i] = zero;
            _filledSubtrees[i] = zero;
            zero = Keccak248.hash2(zero, zero);
        }
        root = zero;
    }

    /// @notice Join the vote: publish the commitment to a secret only you know.
    /// @param tokenId    a membership token held by msg.sender
    /// @param commitment keccak248(secret ++ TAG_COMMITMENT), computed off chain
    ///
    /// @dev One commitment per seat, permanently. Allowing a member to replace a
    ///      commitment would leave the old leaf in the tree and its nullifiers
    ///      still spendable -- two ballots from one seat.
    ///
    ///      Duplicate commitments across seats are deliberately NOT rejected.
    ///      Rejecting them would be a free griefing vector: enrolment is a
    ///      public transaction, so anyone could copy a pending commitment out of
    ///      the mempool, enrol it against their own seat first, and permanently
    ///      lock the victim out -- the victim's commitment is derived from their
    ///      wallet and cannot be changed. Allowing duplicates costs nothing: a
    ///      copied leaf is only spendable by whoever knows the secret, and the
    ///      nullifier still limits that secret to one ballot per proposal. The
    ///      copier has merely burned their own seat.
    function enroll(uint256 tokenId, bytes32 commitment) external returns (uint256 leafIndex) {
        if (membership.ownerOf(tokenId) != msg.sender) revert NotTokenHolder();
        if (enrolled[tokenId]) revert AlreadyEnrolled();
        // Must be a field element the circuit can represent, and non-trivial.
        if (commitment == bytes32(0) || uint256(commitment) > Keccak248.MASK) revert InvalidCommitment();
        if (leaves.length >= MAX_MEMBERS) revert SetFull();

        enrolled[tokenId] = true;
        leafIndex = _insert(commitment);

        emit Enrolled(tokenId, commitment, leafIndex, root);
    }

    function memberCount() external view returns (uint256) {
        return leaves.length;
    }

    /// @notice All commitments, for off-chain path reconstruction.
    function allLeaves() external view returns (bytes32[] memory) {
        return leaves;
    }

    /// @notice The first `count` commitments -- the exact set a proposal's
    ///         snapshot root was built from.
    function leavesAt(uint256 count) external view returns (bytes32[] memory out) {
        out = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            out[i] = leaves[i];
        }
    }

    function zeroAt(uint256 level) external view returns (bytes32) {
        return _zeros[level];
    }

    /// @dev Standard incremental append: only the path from the new leaf to the
    ///      root changes, so we keep the rightmost node per level and rehash
    ///      TREE_DEPTH times.
    function _insert(bytes32 leaf) private returns (uint256 index) {
        index = leaves.length;
        leaves.push(leaf);

        uint256 cursor = index;
        bytes32 node = leaf;
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (cursor % 2 == 0) {
                _filledSubtrees[i] = node;
                node = Keccak248.hash2(node, _zeros[i]);
            } else {
                node = Keccak248.hash2(_filledSubtrees[i], node);
            }
            cursor /= 2;
        }
        root = node;
    }
}
