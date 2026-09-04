// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IVerifier} from "./verifiers/HonkVerifierBase.sol";
import {IMembership, MemberRegistry} from "./MemberRegistry.sol";

/// @title Ballot
/// @notice Yes/no governance votes with no vote attribution.
///
/// A proposal snapshots the registry root at creation. To vote you prove, in
/// zero knowledge, that you know the secret behind *some* leaf of that root,
/// and you publish a nullifier that is deterministic in (secret, proposal).
/// The nullifier stops you voting twice on this proposal and is uncorrelated
/// with your nullifier on every other proposal.
///
/// Nothing here reads `msg.sender`. That is the point: the ballot transaction
/// is meant to be relayed by a wallet with no link to the member, and the
/// proof is bound to the ballot, so the relayer cannot flip the vote.
contract Ballot {
    struct Proposal {
        bytes32 root; // registry root snapshotted at creation
        uint32 memberCount; // size of the anonymity set at that moment
        uint64 deadline;
        uint32 yesVotes;
        uint32 noVotes;
        bytes32 descriptionHash;
    }

    MemberRegistry public immutable registry;
    IMembership public immutable membership;
    IVerifier public immutable voteVerifier;

    /// @notice A proposal is refused unless at least this many members have
    ///         joined the anonymity set. A vote among three people is not
    ///         anonymous no matter how good the cryptography is.
    uint32 public immutable minAnonymitySet;
    uint64 public immutable minVotingPeriod;

    /// @dev Internal so that no on-chain contract can branch on a running
    ///      tally; see `tally`.
    Proposal[] internal proposals;

    mapping(uint256 => mapping(bytes32 => bool)) public nullifierUsed;

    event ProposalCreated(
        uint256 indexed proposalId, bytes32 descriptionHash, bytes32 root, uint32 memberCount, uint64 deadline
    );
    event VoteCast(uint256 indexed proposalId, bytes32 nullifier, bool support);

    error NotAMember();
    error AnonymitySetTooSmall(uint32 have, uint32 need);
    error VotingPeriodTooShort();
    error NoSuchProposal();
    error VotingClosed();
    error VotingStillOpen();
    error AlreadyVoted();
    error InvalidProof();

    constructor(
        MemberRegistry _registry,
        IMembership _membership,
        IVerifier _voteVerifier,
        uint32 _minAnonymitySet,
        uint64 _minVotingPeriod
    ) {
        registry = _registry;
        membership = _membership;
        voteVerifier = _voteVerifier;
        minAnonymitySet = _minAnonymitySet;
        minVotingPeriod = _minVotingPeriod;
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    /// @notice Open a proposal against the registry as it stands right now.
    /// @dev The root is read straight from the registry, so proposal creation
    ///      cannot be used to shrink or forge the anonymity set. Members who
    ///      join after this call cannot vote on this proposal.
    function createProposal(bytes32 descriptionHash, uint64 votingPeriod) external returns (uint256 proposalId) {
        if (membership.balanceOf(msg.sender) == 0) revert NotAMember();
        if (votingPeriod < minVotingPeriod) revert VotingPeriodTooShort();

        uint32 count = registry.memberCount();
        if (count < minAnonymitySet) revert AnonymitySetTooSmall(count, minAnonymitySet);

        uint64 deadline = uint64(block.timestamp) + votingPeriod;
        proposalId = proposals.length;
        proposals.push(
            Proposal({
                root: registry.root(),
                memberCount: count,
                deadline: deadline,
                yesVotes: 0,
                noVotes: 0,
                descriptionHash: descriptionHash
            })
        );

        emit ProposalCreated(proposalId, descriptionHash, registry.root(), count, deadline);
    }

    /// @notice Everything a voter needs to build a proof, minus the tally.
    function proposalInfo(uint256 proposalId)
        external
        view
        returns (bytes32 root, uint32 memberCount, uint64 deadline, bytes32 descriptionHash)
    {
        Proposal storage p = _proposal(proposalId);
        return (p.root, p.memberCount, p.deadline, p.descriptionHash);
    }

    /// @notice Domain separator mixed into every nullifier.
    /// @dev Ties a proof to this chain, this Ballot and this proposal, so a
    ///      proof produced for a testnet or a previous deployment cannot be
    ///      replayed here.
    function proposalContext(uint256 proposalId) public view returns (bytes32) {
        // Shifted right 8 bits so the value is always a valid BN254 field element.
        return bytes32(uint256(keccak256(abi.encode(block.chainid, address(this), proposalId))) >> 8);
    }

    /// @notice Cast one anonymous ballot.
    /// @dev Callable by anyone; the caller is expected to be a relayer or a
    ///      burner wallet, never the member's own NFT wallet.
    function castVote(uint256 proposalId, bool support, bytes32 nullifier, bytes calldata proof) external {
        Proposal storage p = _proposal(proposalId);
        if (block.timestamp >= p.deadline) revert VotingClosed();
        if (nullifierUsed[proposalId][nullifier]) revert AlreadyVoted();

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = p.root;
        publicInputs[1] = proposalContext(proposalId);
        publicInputs[2] = support ? bytes32(uint256(1)) : bytes32(0);
        publicInputs[3] = nullifier;
        // Defensive: the generated UltraHonk verifier reverts with its own error
        // (e.g. Errors.SumcheckFailed) rather than returning false, so this branch
        // only matters if the verifier is ever swapped for one that returns a bool.
        if (!voteVerifier.verify(proof, publicInputs)) revert InvalidProof();

        nullifierUsed[proposalId][nullifier] = true;
        unchecked {
            if (support) p.yesVotes++;
            else p.noVotes++;
        }

        emit VoteCast(proposalId, nullifier, support);
    }

    /// @notice The result, readable by anyone once voting has closed.
    /// @dev Gating this is about on-chain composability, not secrecy: no other
    ///      contract can condition on a half-finished vote. A human watching
    ///      the chain can still add up the `VoteCast` events as they land.
    function tally(uint256 proposalId) external view returns (uint32 yesVotes, uint32 noVotes) {
        Proposal storage p = _proposal(proposalId);
        if (block.timestamp < p.deadline) revert VotingStillOpen();
        return (p.yesVotes, p.noVotes);
    }

    function _proposal(uint256 proposalId) internal view returns (Proposal storage) {
        if (proposalId >= proposals.length) revert NoSuchProposal();
        return proposals[proposalId];
    }
}
