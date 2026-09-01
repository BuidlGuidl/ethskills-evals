// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IHonkVerifier} from "./interfaces/IHonkVerifier.sol";
import {MemberRegistry} from "./MemberRegistry.sol";

/// @title PrivateBallot
/// @notice Yes/no proposals whose ballots are unattributable.
///
/// @dev What is hidden and what is not, precisely:
///
///      HIDDEN: which member cast a given ballot. A ballot proves membership of
///      the snapshot tree without revealing the leaf, so every registered member
///      is an equally good explanation for it. Nothing in a ballot is derived
///      from a wallet, a token or a leaf index, and `castBallot` never reads
///      `msg.sender` - anyone can relay a ballot for anyone.
///
///      NOT HIDDEN: that a ballot was cast, when, and in which direction - the
///      direction is an argument to `castBallot`, so it is in the calldata. That
///      is deliberate: it keeps the tally trustless (no decryption key exists, so
///      there is no key holder who could open individual ballots). Privacy comes
///      from anonymity, not from encryption. See NOTES.md.
///
///      Because the direction is public per ballot, `tally()`'s deadline gate is
///      about voting process, not confidentiality: an observer can already follow
///      the running count through calldata or `eth_getStorageAt`.
contract PrivateBallot {
    struct Proposal {
        /// Membership root snapshotted at creation. Fixes the anonymity set and
        /// stops members who join mid-vote from voting on it.
        bytes32 membershipRoot;
        /// keccak256 of the proposal text, which lives off-chain.
        bytes32 subject;
        uint64 deadline;
        /// Members in the tree at creation: the size of the anonymity set, and
        /// the honest upper bound on turnout.
        uint32 anonymitySetSize;
        uint32 yesVotes;
        uint32 noVotes;
    }

    /// @notice Floor on the voting window. A very short window would let an
    ///         observer correlate the handful of ballots in it with whatever
    ///         off-chain activity happened at the same moment.
    uint64 public constant MIN_VOTING_PERIOD = 1 hours;

    MemberRegistry public immutable registry;
    IHonkVerifier public immutable voteVerifier;

    Proposal[] private _proposals;

    /// @notice Spent one-vote-per-member tags, per proposal.
    mapping(uint256 proposalId => mapping(bytes32 nullifier => bool)) public nullifierSpent;

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        bytes32 subject,
        bytes32 membershipRoot,
        uint64 deadline,
        uint32 anonymitySetSize
    );

    /// @dev Carries the nullifier so double-vote attempts are auditable, and the
    ///      direction because it is public in the calldata regardless. It carries
    ///      no sender, no leaf index and no commitment.
    event BallotCast(uint256 indexed proposalId, bytes32 nullifier, bool inFavour);

    error NotAMember(address caller);
    error VotingPeriodTooShort(uint64 given, uint64 minimum);
    error NoMembersYet();
    error UnknownProposal(uint256 proposalId);
    error VotingClosed(uint256 proposalId, uint64 deadline);
    error VotingStillOpen(uint256 proposalId, uint64 deadline);
    error AlreadyVoted(bytes32 nullifier);
    error InvalidVoteProof();

    constructor(MemberRegistry registry_, IHonkVerifier voteVerifier_) {
        registry = registry_;
        voteVerifier = voteVerifier_;
    }

    /// @notice Open a proposal. Public and attributable to the proposer, which is
    ///         fine: what a proposer proposes is not what a voter votes.
    /// @param subject keccak256 of the proposal text.
    /// @param votingPeriod Seconds the vote stays open.
    function createProposal(bytes32 subject, uint64 votingPeriod) external returns (uint256 proposalId) {
        if (registry.membershipNFT().balanceOf(msg.sender) == 0) revert NotAMember(msg.sender);
        if (votingPeriod < MIN_VOTING_PERIOD) revert VotingPeriodTooShort(votingPeriod, MIN_VOTING_PERIOD);

        uint256 memberCount = registry.memberCount();
        if (memberCount == 0) revert NoMembersYet();

        bytes32 membershipRoot = registry.root();
        uint64 deadline = uint64(block.timestamp) + votingPeriod;

        proposalId = _proposals.length;
        _proposals.push(
            Proposal({
                membershipRoot: membershipRoot,
                subject: subject,
                deadline: deadline,
                anonymitySetSize: uint32(memberCount),
                yesVotes: 0,
                noVotes: 0
            })
        );

        emit ProposalCreated(proposalId, msg.sender, subject, membershipRoot, deadline, uint32(memberCount));
    }

    /// @notice The value the vote circuit binds a ballot to. Covers the chain,
    ///         this deployment and the proposal, so a proof cannot be lifted onto
    ///         another proposal, a redeployment, or a fork.
    /// @dev Shifted right by 8 bits so the result is always a canonical BN254
    ///      field element.
    function externalNullifier(uint256 proposalId) public view returns (bytes32) {
        return bytes32(uint256(keccak256(abi.encode(block.chainid, address(this), proposalId))) >> 8);
    }

    /// @notice Record one anonymous ballot.
    /// @dev `msg.sender` is intentionally unused. A member who submits their own
    ///      ballot from their NFT-holding wallet de-anonymises themselves; the
    ///      contract cannot prevent that, so it makes relaying free instead.
    /// @param inFavour  true = yes, false = no. Bound into the proof, so a relayer
    ///        can drop or delay a ballot but cannot flip it.
    /// @param nullifier `dao_zk::vote_nullifier(secret, externalNullifier(id))`.
    function castBallot(uint256 proposalId, bool inFavour, bytes32 nullifier, bytes calldata proof) external {
        Proposal storage proposal = _get(proposalId);
        if (block.timestamp >= proposal.deadline) revert VotingClosed(proposalId, proposal.deadline);
        if (nullifierSpent[proposalId][nullifier]) revert AlreadyVoted(nullifier);

        // Public inputs in the order the `vote` circuit declares them. Every one
        // of them comes from this contract's own state or from the calldata being
        // recorded, so the proof cannot be about a different tree, a different
        // proposal, or a different direction.
        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = proposal.membershipRoot;
        publicInputs[1] = externalNullifier(proposalId);
        publicInputs[2] = nullifier;
        publicInputs[3] = inFavour ? bytes32(uint256(1)) : bytes32(0);
        if (!voteVerifier.verify(proof, publicInputs)) revert InvalidVoteProof();

        nullifierSpent[proposalId][nullifier] = true;
        if (inFavour) {
            proposal.yesVotes += 1;
        } else {
            proposal.noVotes += 1;
        }

        emit BallotCast(proposalId, nullifier, inFavour);
    }

    /// @notice Final result, readable by anyone once voting has closed.
    function tally(uint256 proposalId) external view returns (uint32 yesVotes, uint32 noVotes, uint32 turnout) {
        Proposal storage proposal = _get(proposalId);
        if (block.timestamp < proposal.deadline) revert VotingStillOpen(proposalId, proposal.deadline);
        return (proposal.yesVotes, proposal.noVotes, proposal.yesVotes + proposal.noVotes);
    }

    /// @notice Everything about a proposal except the counts.
    function proposalInfo(uint256 proposalId)
        external
        view
        returns (bytes32 membershipRoot, bytes32 subject, uint64 deadline, uint32 anonymitySetSize)
    {
        Proposal storage proposal = _get(proposalId);
        return (proposal.membershipRoot, proposal.subject, proposal.deadline, proposal.anonymitySetSize);
    }

    function proposalCount() external view returns (uint256) {
        return _proposals.length;
    }

    function _get(uint256 proposalId) private view returns (Proposal storage) {
        if (proposalId >= _proposals.length) revert UnknownProposal(proposalId);
        return _proposals[proposalId];
    }
}
