// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IVerifier} from "./interfaces/IVerifier.sol";
import {MembershipRegistry} from "./MembershipRegistry.sol";
import {Hash} from "./libraries/Hash.sol";

/// @title PrivateBallot
/// @notice Yes/no proposals decided by unattributable ballots.
///
///         A ballot carries a zero-knowledge proof that its sender knows the
///         secret behind *some* leaf of the membership snapshot, plus a
///         nullifier = hash(secret, proposalId). The nullifier is what stops a
///         second ballot from the same member on the same proposal; because it
///         is keyed on the proposal it is a fresh, unlinkable value every time,
///         so ballots on different proposals cannot be tied to one another.
///
/// @dev    What this contract does NOT hide: how many ballots were cast, and
///         the yes/no carried by each individual ballot (it is in the
///         transaction's calldata). What it hides is *whose* ballot it is.
///         See NOTES.md, "What a chain observer learns".
contract PrivateBallot {
    /// @dev Public inputs of circuits/vote/src/main.nr, in declaration order.
    uint256 private constant PUBLIC_INPUT_COUNT = 5;

    MembershipRegistry public immutable registry;
    IVerifier public immutable verifier;

    /// @notice Ties every nullifier to this contract on this chain, so a
    ///         ballot cannot be replayed onto a redeployment of this contract
    ///         or onto the same DAO on another chain.
    uint256 public immutable domain;

    struct Proposal {
        bytes32 descriptionHash;
        /// @dev Membership snapshot taken at creation: joining later does not
        ///      let you vote on an already-running proposal, and a member
        ///      cannot be removed from an electorate mid-vote.
        uint256 membershipRoot;
        uint64 createdAt;
        uint64 votingEnds;
        uint32 electorate;
        uint32 yesVotes;
        uint32 noVotes;
    }

    /// @dev Proposal id is `index + 1`; id 0 is reserved as the leaf domain
    ///      tag in the circuit (see LEAF_TAG), so it must never be votable.
    Proposal[] private proposals;

    /// @notice proposalId => nullifier => already voted.
    mapping(uint256 => mapping(uint256 => bool)) public nullifierSpent;

    event ProposalCreated(
        uint256 indexed proposalId,
        bytes32 descriptionHash,
        uint256 membershipRoot,
        uint64 votingEnds,
        uint32 electorate
    );
    /// @dev `support` is in the calldata of every ballot anyway; logging it
    ///      adds no leak and keeps indexers off `eth_getStorageAt`.
    event BallotCast(uint256 indexed proposalId, uint256 nullifier, bool support);

    error NotAMember();
    error NoElectorate();
    error VotingPeriodTooShort();
    error UnknownProposal();
    error VotingClosed();
    error VotingStillOpen();
    error WrongSubmitter();
    error NullifierOutOfRange();
    error AlreadyVoted();
    error InvalidProof();

    uint64 public constant MIN_VOTING_PERIOD = 1 hours;

    constructor(MembershipRegistry registry_, IVerifier verifier_) {
        registry = registry_;
        verifier = verifier_;
        domain = Hash.pair(uint256(uint160(address(this))), block.chainid);
    }

    /// @notice What a ballot's nullifier is actually derived from:
    ///         nullifier = hash_pair(secret, proposalScope(proposalId)).
    function proposalScope(uint256 proposalId) public view returns (uint256) {
        return Hash.pair(domain, proposalId);
    }

    /// @notice Open a proposal. Any current NFT holder may do this; the caller
    ///         is public, which is why this must never be the same wallet as
    ///         the one relaying ballots.
    /// @param descriptionHash Hash of the off-chain proposal text.
    /// @param votingPeriod    Seconds the poll stays open.
    function createProposal(bytes32 descriptionHash, uint64 votingPeriod) external returns (uint256 proposalId) {
        if (!registry.isHolder(msg.sender)) revert NotAMember();
        if (votingPeriod < MIN_VOTING_PERIOD) revert VotingPeriodTooShort();

        uint256 electorate = registry.memberCount();
        if (electorate == 0) revert NoElectorate();

        uint64 votingEnds = uint64(block.timestamp) + votingPeriod;
        proposals.push(
            Proposal({
                descriptionHash: descriptionHash,
                membershipRoot: registry.root(),
                createdAt: uint64(block.timestamp),
                votingEnds: votingEnds,
                electorate: uint32(electorate),
                yesVotes: 0,
                noVotes: 0
            })
        );
        proposalId = proposals.length;

        emit ProposalCreated(
            proposalId, descriptionHash, proposals[proposalId - 1].membershipRoot, votingEnds, uint32(electorate)
        );
    }

    /// @notice Cast one anonymous ballot.
    /// @param proposalId The proposal being voted on.
    /// @param nullifier  hash_pair(secret, proposalScope(proposalId)).
    /// @param support    true = yes, false = no.
    /// @param submitter  Address allowed to send this transaction, bound into
    ///                   the proof. Use the relayer's address to stop anyone
    ///                   else from front-running the ballot out of the
    ///                   mempool, or address(0) to let anybody submit it.
    /// @param proof      Honk proof from circuits/vote.
    /// @dev Deliberately callable by *any* address: the whole design assumes
    ///      the voter's own wallet is not the sender.
    function castVote(uint256 proposalId, uint256 nullifier, bool support, address submitter, bytes calldata proof)
        external
    {
        Proposal storage proposal = _proposal(proposalId);
        if (block.timestamp >= proposal.votingEnds) revert VotingClosed();
        if (submitter != address(0) && submitter != msg.sender) revert WrongSubmitter();

        // A nullifier is a hash_pair output, so it is always < 2^248. Pinning
        // the range keeps the double-vote key canonical.
        if (nullifier >= Hash.FIELD_SAFE_BOUND) revert NullifierOutOfRange();
        if (nullifierSpent[proposalId][nullifier]) revert AlreadyVoted();

        bytes32[] memory publicInputs = new bytes32[](PUBLIC_INPUT_COUNT);
        publicInputs[0] = bytes32(proposal.membershipRoot);
        publicInputs[1] = bytes32(proposalScope(proposalId));
        publicInputs[2] = bytes32(nullifier);
        publicInputs[3] = bytes32(uint256(support ? 1 : 0));
        publicInputs[4] = bytes32(uint256(uint160(submitter)));

        // The generated verifier reverts with its own errors on a bad proof
        // and returns false on others; both mean the same thing here.
        try verifier.verify(proof, publicInputs) returns (bool ok) {
            if (!ok) revert InvalidProof();
        } catch {
            revert InvalidProof();
        }

        nullifierSpent[proposalId][nullifier] = true;
        if (support) {
            proposal.yesVotes += 1;
        } else {
            proposal.noVotes += 1;
        }

        emit BallotCast(proposalId, nullifier, support);
    }

    /// @notice The result, once voting has closed.
    /// @dev Gating this on the deadline is a UI convention, not a privacy
    ///      boundary: ballots are public as they land, so anyone can keep a
    ///      running count. It only exists so "the tally" has one canonical,
    ///      final source.
    function tally(uint256 proposalId) external view returns (uint32 yesVotes, uint32 noVotes, uint32 electorate) {
        Proposal storage proposal = _proposal(proposalId);
        if (block.timestamp < proposal.votingEnds) revert VotingStillOpen();
        return (proposal.yesVotes, proposal.noVotes, proposal.electorate);
    }

    /// @notice Everything a voter needs to build a proof for this proposal.
    function proposalInfo(uint256 proposalId)
        external
        view
        returns (bytes32 descriptionHash, uint256 membershipRoot, uint64 votingEnds, uint32 electorate)
    {
        Proposal storage proposal = _proposal(proposalId);
        return (proposal.descriptionHash, proposal.membershipRoot, proposal.votingEnds, proposal.electorate);
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    function _proposal(uint256 proposalId) private view returns (Proposal storage) {
        if (proposalId == 0 || proposalId > proposals.length) revert UnknownProposal();
        return proposals[proposalId - 1];
    }
}
