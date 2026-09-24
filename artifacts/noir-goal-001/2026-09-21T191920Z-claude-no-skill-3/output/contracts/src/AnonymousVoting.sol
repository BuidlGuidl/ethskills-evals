// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IMembershipNFT} from "./MembershipNFT.sol";
import {VoterRegistry} from "./VoterRegistry.sol";
import {IVerifier} from "./HonkVerifier.sol";

/// @notice Yes/no proposals voted on with zero-knowledge membership proofs.
///
/// castVote() is deliberately callable by ANY address: the proof, not msg.sender, is the
/// credential. Members must submit through a relayer or any wallet that is not linked to
/// their membership NFT; sending from the NFT wallet would attribute the vote.
contract AnonymousVoting {
    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    VoterRegistry public immutable registry;
    IVerifier public immutable verifier;
    IMembershipNFT public immutable nft;
    /// Refuse to open a proposal while fewer than this many members are registered:
    /// the anonymity set of every vote is the set of registered members at snapshot.
    uint256 public immutable minAnonymitySet;

    struct Proposal {
        bytes32 contentHash; // hash of the proposal text published offchain
        uint256 root; // registry root snapshot = electorate
        uint64 deadline;
        uint32 electorate; // registered members at snapshot
        uint32 yes;
        uint32 no;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 proposalId => mapping(uint256 nullifier => bool)) public nullifierUsed;

    event ProposalCreated(uint256 indexed id, bytes32 contentHash, uint256 root, uint64 deadline, uint256 electorate);
    event VoteCast(uint256 indexed id, uint256 nullifier, bool support);

    error NotMember();
    error AnonymitySetTooSmall();
    error BadDeadline();
    error UnknownProposal();
    error VotingClosed();
    error VotingOpen();
    error AlreadyVoted();
    error InvalidNullifier();
    error InvalidProof();

    constructor(VoterRegistry registry_, IVerifier verifier_, uint256 minAnonymitySet_) {
        registry = registry_;
        verifier = verifier_;
        nft = registry_.nft();
        minAnonymitySet = minAnonymitySet_;
    }

    /// @notice Open a proposal. Any membership-NFT holder may propose (proposing is public).
    function createProposal(bytes32 contentHash, uint64 deadline) external returns (uint256 id) {
        if (nft.balanceOf(msg.sender) == 0) revert NotMember();
        if (deadline <= block.timestamp) revert BadDeadline();
        uint256 electorate = registry.activeMembers();
        if (electorate < minAnonymitySet) revert AnonymitySetTooSmall();

        id = ++proposalCount;
        uint256 root = registry.root();
        proposals[id] = Proposal({
            contentHash: contentHash,
            root: root,
            deadline: deadline,
            electorate: uint32(electorate),
            yes: 0,
            no: 0
        });
        emit ProposalCreated(id, contentHash, root, deadline, electorate);
    }

    /// @notice Per-proposal nullifier domain. Binding chainid and this contract's address
    ///         keeps a member's nullifiers unlinkable across proposals and deployments.
    function scopeOf(uint256 id) public view returns (uint256) {
        return uint256(keccak256(abi.encode(block.chainid, address(this), id))) % SNARK_SCALAR_FIELD;
    }

    /// @notice Record one anonymous vote. May be sent by anyone (normally a relayer).
    function castVote(uint256 id, bool support, uint256 nullifier, bytes calldata proof) external {
        Proposal storage p = proposals[id];
        if (p.deadline == 0) revert UnknownProposal();
        if (block.timestamp >= p.deadline) revert VotingClosed();
        // Public inputs are field elements; without this check nullifier and
        // nullifier + p would both verify and count twice.
        if (nullifier >= SNARK_SCALAR_FIELD) revert InvalidNullifier();
        if (nullifierUsed[id][nullifier]) revert AlreadyVoted();

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = bytes32(p.root);
        publicInputs[1] = bytes32(scopeOf(id));
        publicInputs[2] = bytes32(uint256(support ? 1 : 0));
        publicInputs[3] = bytes32(nullifier);
        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        nullifierUsed[id][nullifier] = true;
        if (support) p.yes++;
        else p.no++;
        emit VoteCast(id, nullifier, support);
    }

    /// @notice Final tally. Reverts until the deadline has passed.
    /// @dev    Counts live in public storage/events, so a determined observer can watch
    ///         them during voting; this function only defines the official result.
    function tally(uint256 id) external view returns (uint256 yes, uint256 no, uint256 electorate) {
        Proposal storage p = proposals[id];
        if (p.deadline == 0) revert UnknownProposal();
        if (block.timestamp < p.deadline) revert VotingOpen();
        return (p.yes, p.no, p.electorate);
    }
}
