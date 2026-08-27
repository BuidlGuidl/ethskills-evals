// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IVerifier} from "./IVerifier.sol";
import {MembershipRegistry} from "./MembershipRegistry.sol";

/// @title AnonymousVoting
/// @notice Yes/no DAO proposals where the tally is public but no ballot can be
/// attributed to a member — not by the DAO, not by the contract, not by anyone
/// reading the chain.
///
/// A ballot is a ZK proof of three statements at once:
///   1. "my commitment is in the member tree snapshotted by this proposal"
///   2. "this nullifier is the only one I can produce for this proposal"
///   3. "this yes/no choice is the one I signed into the proof"
/// None of the three reveals which leaf of the tree the prover owns.
///
/// `castVote` is deliberately callable by anyone: the ballot is bound to the
/// proof, not to `msg.sender`, so a member can hand the proof to a relayer and
/// never let a wallet of theirs appear in the transaction at all.
contract AnonymousVoting {
    struct Proposal {
        /// @dev Member tree root at creation. Anyone who joins later cannot
        /// vote on this proposal — and the anonymity set is fixed and known.
        uint256 snapshotRoot;
        /// @dev Per-proposal, per-deployment nullifier scope. Fed to the
        /// circuit as `proposal_id`.
        uint256 scope;
        uint64 deadline;
        uint32 snapshotMemberCount;
        uint32 yesVotes;
        uint32 noVotes;
        string description;
    }

    /// @notice bb-generated HonkVerifier for circuits/vote.
    IVerifier public immutable verifier;
    /// @notice Source of the anonymity set.
    MembershipRegistry public immutable registry;
    /// @dev Domain separator making nullifiers unique to this deployment, so a
    /// member's nullifier for proposal 3 here cannot be matched against their
    /// nullifier for proposal 3 in any other DAO or on any other chain.
    bytes32 public immutable daoScopeSeed;

    Proposal[] internal proposals;

    /// @notice scope => nullifierHash => spent. One vote per member per proposal.
    mapping(uint256 => mapping(bytes32 => bool)) public nullifierSpent;

    event ProposalCreated(
        uint256 indexed proposalId,
        uint256 snapshotRoot,
        uint256 scope,
        uint64 deadline,
        uint32 snapshotMemberCount,
        string description
    );
    /// @dev Carries no identity, no leaf index and no wallet: a chain observer
    /// learns only "one of the N snapshotted members voted, and it was a yes".
    event VoteCast(uint256 indexed proposalId, bytes32 nullifierHash, bool support);

    error NotAMember();
    error NoSuchProposal();
    error VotingClosed();
    error VotingStillOpen();
    error UnknownRoot();
    error AlreadyVoted();
    error InvalidProof();
    error InvalidVotingPeriod();

    constructor(IVerifier _verifier, MembershipRegistry _registry, bytes32 _daoScopeSeed) {
        verifier = _verifier;
        registry = _registry;
        daoScopeSeed = _daoScopeSeed;
    }

    /// @notice Open a proposal. Sent by an NFT holder from their public wallet;
    /// it says nothing about how anyone will vote.
    function createProposal(string calldata description, uint64 votingPeriod)
        external
        returns (uint256 proposalId)
    {
        if (registry.membershipNft().balanceOf(msg.sender) == 0) revert NotAMember();
        if (votingPeriod == 0) revert InvalidVotingPeriod();

        proposalId = proposals.length;
        uint256 snapshotRoot = registry.root();
        uint64 deadline = uint64(block.timestamp) + votingPeriod;
        uint32 memberCount = uint32(registry.memberCount());

        proposals.push(
            Proposal({
                snapshotRoot: snapshotRoot,
                scope: scopeOf(proposalId),
                deadline: deadline,
                snapshotMemberCount: memberCount,
                yesVotes: 0,
                noVotes: 0,
                description: description
            })
        );

        emit ProposalCreated(proposalId, snapshotRoot, scopeOf(proposalId), deadline, memberCount, description);
    }

    /// @notice Submit one anonymous ballot.
    /// @dev Sent by a fresh wallet or a relayer — never by the member's known
    /// wallet, or the anonymity is lost off-chain even though it holds on-chain.
    /// @param proposalId Which proposal.
    /// @param nullifierHash Poseidon(Poseidon(2, scope), identityNullifier).
    /// @param support true = yes, false = no.
    /// @param proof bb UltraHonk proof over circuits/vote.
    function castVote(uint256 proposalId, bytes32 nullifierHash, bool support, bytes calldata proof) external {
        if (proposalId >= proposals.length) revert NoSuchProposal();
        Proposal storage p = proposals[proposalId];

        if (block.timestamp >= p.deadline) revert VotingClosed();
        if (nullifierSpent[p.scope][nullifierHash]) revert AlreadyVoted();
        // Defence in depth: the snapshot came from the registry, so this can
        // only fail if the registry was swapped underneath us.
        if (!registry.isKnownRoot(p.snapshotRoot)) revert UnknownRoot();

        // Order must match the `pub` parameters of circuits/vote/src/main.nr:
        // merkle_root, proposal_id, nullifier_hash, vote.
        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = bytes32(p.snapshotRoot);
        publicInputs[1] = bytes32(p.scope);
        publicInputs[2] = nullifierHash;
        publicInputs[3] = bytes32(uint256(support ? 1 : 0));

        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        // State only changes after the proof is accepted.
        nullifierSpent[p.scope][nullifierHash] = true;
        if (support) {
            p.yesVotes += 1;
        } else {
            p.noVotes += 1;
        }

        emit VoteCast(proposalId, nullifierHash, support);
    }

    /// @notice Final tally. Readable by anyone once voting has closed.
    function tally(uint256 proposalId)
        external
        view
        returns (uint256 yesVotes, uint256 noVotes, uint256 eligibleMembers, bool passed)
    {
        if (proposalId >= proposals.length) revert NoSuchProposal();
        Proposal storage p = proposals[proposalId];
        if (block.timestamp < p.deadline) revert VotingStillOpen();
        return (p.yesVotes, p.noVotes, p.snapshotMemberCount, p.yesVotes > p.noVotes);
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        if (proposalId >= proposals.length) revert NoSuchProposal();
        return proposals[proposalId];
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    /// @notice The value a client must pass to the circuit as `proposal_id`.
    /// @dev Shifted right by 8 bits so it always fits in the BN254 scalar field.
    function scopeOf(uint256 proposalId) public view returns (uint256) {
        return uint256(keccak256(abi.encode(daoScopeSeed, proposalId))) >> 8;
    }
}
