// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IMembership} from "./IMembership.sol";
import {MemberRegistry} from "./MemberRegistry.sol";

interface IVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

/// @title AnonymousBallot
/// @notice Yes/no DAO proposals where the tally is public but attribution is not.
///
/// A ballot is accepted on the strength of a Noir proof that says: "some leaf of
/// the registry root snapshotted by this proposal knows its preimage, and that
/// leaf is spending its one vote on this proposal, in this direction." The proof
/// never says which leaf.
///
/// @dev Two things make this actually anonymous, and both live outside the ZK:
///
///  1. `castVote` never reads `msg.sender`. Any wallet may carry any valid
///     ballot. The member is expected to hand the proof to a relayer (or an
///     ERC-4337 bundler) rather than send it from the wallet that holds their
///     membership NFT — that wallet is public, and sending from it would link
///     the vote to the voter in one hop, ZK or no ZK.
///
///  2. A proposal pins ONE registry root for its whole lifetime, taken at
///     creation. If ballots were checked against a moving root, the root a
///     ballot proved against would narrow the voter down to the members who had
///     joined by that moment. Everyone votes against the same root, so the root
///     says nothing.
contract AnonymousBallot {
    uint256 internal constant FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    IMembership public immutable membership;
    MemberRegistry public immutable registry;
    IVerifier public immutable verifier;

    /// @notice A proposal will not open unless at least this many members have
    ///         joined the registry. A ballot drawn from a set of three is not
    ///         anonymous however good the proof is.
    uint64 public immutable minAnonymitySet;

    struct Proposal {
        bytes32 descriptionHash; // keccak of the proposal text, which lives offchain
        uint256 snapshotRoot; // registry root pinned at creation
        uint64 eligibleMembers; // size of the anonymity set at creation
        uint64 deadline; // unix seconds; ballots accepted strictly before this
        uint64 yes;
        uint64 no;
    }

    uint256 public proposalCount;
    /// @dev Tallies stay internal until the deadline: see `result`.
    mapping(uint256 => Proposal) internal proposals;
    /// @dev proposalId => nullifierHash => spent. Scoped per proposal, so the
    ///      same member's ballots on two proposals share nothing.
    mapping(uint256 => mapping(uint256 => bool)) public nullifierSpent;

    event ProposalCreated(
        uint256 indexed proposalId,
        bytes32 descriptionHash,
        uint256 snapshotRoot,
        uint64 eligibleMembers,
        uint64 deadline
    );
    /// @dev Deliberately does NOT carry the vote direction — see NOTES.md for
    ///      what an observer can still reconstruct from calldata.
    event VoteCast(uint256 indexed proposalId, uint256 nullifierHash);

    error NotAMember();
    error AnonymitySetTooSmall(uint64 have, uint64 need);
    error VotingPeriodTooShort();
    error NoSuchProposal();
    error VotingClosed();
    error VotingStillOpen();
    error AlreadyVoted();
    error NotAField();
    error BadVoteValue();
    error BadProof();

    constructor(IMembership _membership, MemberRegistry _registry, IVerifier _verifier, uint64 _minAnonymitySet) {
        membership = _membership;
        registry = _registry;
        verifier = _verifier;
        minAnonymitySet = _minAnonymitySet;
    }

    /// @notice Open a proposal. Sent by a member's own wallet; who proposes is
    ///         public and that is fine — only how people vote is secret.
    function createProposal(bytes32 descriptionHash, uint64 votingPeriod) external returns (uint256 proposalId) {
        if (membership.balanceOf(msg.sender) == 0) revert NotAMember();
        if (votingPeriod < 1 hours) revert VotingPeriodTooShort();

        uint64 eligible = uint64(registry.leafCount());
        if (eligible < minAnonymitySet) revert AnonymitySetTooSmall(eligible, minAnonymitySet);

        proposalId = ++proposalCount;
        uint64 deadline = uint64(block.timestamp) + votingPeriod;

        proposals[proposalId] = Proposal({
            descriptionHash: descriptionHash,
            snapshotRoot: registry.root(),
            eligibleMembers: eligible,
            deadline: deadline,
            yes: 0,
            no: 0
        });

        emit ProposalCreated(proposalId, descriptionHash, registry.root(), eligible, deadline);
    }

    /// @notice Cast one anonymous ballot.
    /// @dev Permissionless by design: `msg.sender` is neither checked nor
    ///      recorded. Send it from a relayer, not from the member's wallet.
    ///
    ///      `vote` is a public input to the proof, so a relayer that tried to
    ///      flip it would invalidate the proof. A relayer can drop a ballot or
    ///      stall it; it cannot change or forge one.
    function castVote(uint256 proposalId, uint256 nullifierHash, uint8 vote, bytes calldata proof) external {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert NoSuchProposal();
        if (block.timestamp >= p.deadline) revert VotingClosed();
        if (vote > 1) revert BadVoteValue();
        if (nullifierHash == 0 || nullifierHash >= FIELD) revert NotAField();
        if (nullifierSpent[proposalId][nullifierHash]) revert AlreadyVoted();

        // Order must match the `pub` parameters of circuits/vote/src/main.nr:
        // root, proposal_id, nullifier_hash, vote.
        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = bytes32(p.snapshotRoot);
        publicInputs[1] = bytes32(proposalId);
        publicInputs[2] = bytes32(nullifierHash);
        publicInputs[3] = bytes32(uint256(vote));

        // The generated Honk verifier REVERTS on a bad proof (SumcheckFailed,
        // ShpleminiFailed, ProofLengthWrong...) rather than returning false, so
        // the boolean alone is not enough to lean on. Normalise both outcomes to
        // one error: a relayer holding a stale or tampered ballot gets a single
        // legible reason, and a verifier that ever does return false is still
        // rejected here.
        bool ok;
        try verifier.verify(proof, publicInputs) returns (bool v) {
            ok = v;
        } catch {
            ok = false;
        }
        if (!ok) revert BadProof();

        // Only after the proof checks out: burn the nullifier, then count.
        nullifierSpent[proposalId][nullifierHash] = true;
        if (vote == 1) {
            p.yes += 1;
        } else {
            p.no += 1;
        }

        emit VoteCast(proposalId, nullifierHash);
    }

    /// @notice Final tally. Withheld until the deadline so the contract does not
    ///         serve a live running count.
    /// @dev This is a courtesy, not a guarantee: each ballot's direction sits in
    ///      its own calldata, so anyone decoding transactions can keep their own
    ///      running total. It does not attribute — that is the property that
    ///      matters — but do not describe the interim count as secret.
    function result(uint256 proposalId) external view returns (uint64 yes, uint64 no, uint64 turnout) {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert NoSuchProposal();
        if (block.timestamp < p.deadline) revert VotingStillOpen();
        return (p.yes, p.no, p.yes + p.no);
    }

    /// @notice Everything about a proposal except the running tally.
    function proposalInfo(uint256 proposalId)
        external
        view
        returns (bytes32 descriptionHash, uint256 snapshotRoot, uint64 eligibleMembers, uint64 deadline)
    {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert NoSuchProposal();
        return (p.descriptionHash, p.snapshotRoot, p.eligibleMembers, p.deadline);
    }
}
