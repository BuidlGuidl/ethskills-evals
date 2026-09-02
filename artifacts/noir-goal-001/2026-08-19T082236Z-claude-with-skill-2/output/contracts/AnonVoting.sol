// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IVerifier} from "./verifier/HonkVerifier.sol";
import {VoterRegistry} from "./VoterRegistry.sol";
import {MembershipNFT} from "./MembershipNFT.sol";

/// @notice Yes/no DAO proposals decided by unattributable ballots.
///
/// `castVote` is deliberately permissionless: it makes no check at all on `msg.sender`.
/// That is the whole point. The ZK proof carries the authorisation, so the ballot can be —
/// and must be — relayed by a wallet with no connection to the voter. If members sent their
/// own ballots, `msg.sender` would attribute every vote and the circuit would be decoration.
contract AnonVoting {
    uint256 private constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct Proposal {
        bytes32 descriptionHash; // keccak256 of the proposal text hosted offchain
        uint256 root; // VoterRegistry root snapshotted at creation
        uint256 electorateSize; // leaves in the tree at that moment = size of the anonymity set
        uint64 deadline;
        uint32 yesVotes;
        uint32 noVotes;
    }

    IVerifier public immutable verifier;
    VoterRegistry public immutable registry;
    MembershipNFT public immutable membership;

    uint256 public proposalCount;
    mapping(uint256 proposalId => Proposal) internal _proposals;

    /// @dev Scoped per proposal because the circuit scopes the nullifier per proposal.
    mapping(uint256 proposalId => mapping(uint256 nullifierHash => bool)) public nullifierUsed;

    event ProposalCreated(
        uint256 indexed proposalId,
        bytes32 descriptionHash,
        uint256 root,
        uint256 electorateSize,
        uint64 deadline
    );
    /// @dev Intentionally carries no voter identifier beyond the per-proposal nullifier tag.
    event VoteCast(uint256 indexed proposalId, uint256 nullifierHash, bool support);

    error NotMember();
    error DeadlineInPast();
    error EmptyElectorate();
    error UnknownProposal();
    error VotingClosed();
    error VotingStillOpen();
    error NullifierAlreadyUsed();
    error FieldOverflow();
    error BadProof();

    constructor(IVerifier verifier_, VoterRegistry registry_) {
        verifier = verifier_;
        registry = registry_;
        membership = registry_.membership();
    }

    /// @notice Open a proposal. Sent by any member's own wallet; nothing private here.
    /// @dev Snapshotting the root freezes the electorate. It also means every ballot on this
    ///      proposal quotes the *same* root, so the public root leaks nothing about who voted.
    ///      A per-vote "any recent root" policy would instead narrow each voter down to the
    ///      slice of members who had joined by the root they picked.
    function createProposal(bytes32 descriptionHash, uint64 deadline)
        external
        returns (uint256 proposalId)
    {
        if (membership.tokenOf(msg.sender) == 0) revert NotMember();
        if (deadline <= block.timestamp) revert DeadlineInPast();

        uint256 electorateSize = registry.leafCount();
        if (electorateSize == 0) revert EmptyElectorate();

        proposalId = ++proposalCount;
        _proposals[proposalId] = Proposal({
            descriptionHash: descriptionHash,
            root: registry.root(),
            electorateSize: electorateSize,
            deadline: deadline,
            yesVotes: 0,
            noVotes: 0
        });

        emit ProposalCreated(
            proposalId, descriptionHash, _proposals[proposalId].root, electorateSize, deadline
        );
    }

    /// @notice Cast one anonymous ballot. Sent by a relayer, never by the voter.
    /// @param proposalId which proposal (also scopes the nullifier, in-circuit)
    /// @param nullifierHash Poseidon(nullifier, proposalId) — the one-ballot-per-member tag
    /// @param support true = yes
    /// @param proof UltraHonk proof over public inputs [root, proposalId, nullifierHash, vote]
    function castVote(uint256 proposalId, uint256 nullifierHash, bool support, bytes calldata proof)
        external
    {
        Proposal storage p = _proposals[proposalId];
        if (p.deadline == 0) revert UnknownProposal();
        if (block.timestamp >= p.deadline) revert VotingClosed();
        if (nullifierHash >= SNARK_SCALAR_FIELD) revert FieldOverflow();
        if (nullifierUsed[proposalId][nullifierHash]) revert NullifierAlreadyUsed();

        // Order must match the `pub` parameters of circuits/vote/src/main.nr.
        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = bytes32(p.root);
        publicInputs[1] = bytes32(proposalId);
        publicInputs[2] = bytes32(nullifierHash);
        publicInputs[3] = bytes32(uint256(support ? 1 : 0));

        // The generated verifier signals most failures by reverting with its own errors
        // (SumcheckFailed, ShpleminiFailed, ...) rather than returning false. Normalising both
        // paths to BadProof keeps the failure legible to relayers and to js/lib/chain.mjs's
        // decodeRevert; without it, a tampered ballot is indistinguishable from a client bug.
        bool ok;
        try verifier.verify(proof, publicInputs) returns (bool result) {
            ok = result;
        } catch {
            ok = false;
        }
        if (!ok) revert BadProof();

        // Only after the proof clears: burn the nullifier, then count.
        nullifierUsed[proposalId][nullifierHash] = true;
        if (support) p.yesVotes++;
        else p.noVotes++;

        emit VoteCast(proposalId, nullifierHash, support);
    }

    /// @notice Official result. Anyone may read it once voting has closed.
    function tally(uint256 proposalId) external view returns (uint32 yesVotes, uint32 noVotes) {
        Proposal storage p = _proposals[proposalId];
        if (p.deadline == 0) revert UnknownProposal();
        if (block.timestamp < p.deadline) revert VotingStillOpen();
        return (p.yesVotes, p.noVotes);
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        Proposal storage p = _proposals[proposalId];
        if (p.deadline == 0) revert UnknownProposal();
        return p;
    }
}
