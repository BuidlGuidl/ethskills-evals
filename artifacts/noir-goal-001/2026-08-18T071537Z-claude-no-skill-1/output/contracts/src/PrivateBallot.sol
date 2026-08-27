// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IMembershipNFT} from "./IMembershipNFT.sol";
import {Keccak248} from "./Keccak248.sol";
import {MemberSet} from "./MemberSet.sol";

interface IHonkVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

/// @title PrivateBallot
/// @notice Yes/no proposals decided by unattributable ballots.
///
/// @dev What a ballot transaction contains: a proposal id, a yes/no, a
///      nullifier, and a proof. Nothing in it names a member, and nothing in it
///      can be correlated with the sender -- because the sender is not required
///      to be a member. Anybody can carry anybody's ballot, which is what makes
///      that true rather than merely hoped for. See NOTES.md.
///
///      The residual leak is deliberate and unavoidable: the running yes/no
///      counts are public as votes arrive, because they are the thing being
///      computed. What is protected is *attribution* -- which of the enrolled
///      members cast which ballot.
contract PrivateBallot {
    struct Proposal {
        bytes32 descriptionHash; // keccak256 of the proposal text, published off chain
        bytes32 memberRoot; // MemberSet root snapshotted at creation
        uint64 memberCount; // leaves behind that root; the anonymity set size
        uint64 deadline; // unix seconds, inclusive
        uint64 yesVotes;
        uint64 noVotes;
    }

    /// @dev Public inputs, in the order `main` declares them in
    ///      circuits/private_vote/src/main.nr:
    ///        0 root, 1 proposal_tag, 2 nullifier, 3 vote
    uint256 private constant PUBLIC_INPUT_COUNT = 4;

    IHonkVerifier public immutable verifier;
    MemberSet public immutable memberSet;
    IMembershipNFT public immutable membership;

    Proposal[] private _proposals;

    /// @dev proposalId => nullifier => spent. The nullifier is already
    ///      domain-separated per proposal by the circuit; nesting the mapping
    ///      just makes that obvious on chain.
    mapping(uint256 => mapping(bytes32 => bool)) public nullifierSpent;

    event ProposalCreated(
        uint256 indexed proposalId,
        bytes32 indexed descriptionHash,
        bytes32 memberRoot,
        uint64 memberCount,
        uint64 deadline
    );
    /// @dev Intentionally does not log msg.sender: the relayer is noise, not data.
    event VoteCast(uint256 indexed proposalId, bytes32 indexed nullifier, uint8 choice);

    error NotAMember();
    error DeadlineInPast();
    error NoMembersEnrolled();
    error NoSuchProposal();
    error VotingClosed();
    error VotingOpen();
    error NullifierAlreadySpent();
    error InvalidChoice();
    error InvalidProof();

    constructor(IHonkVerifier verifier_, MemberSet memberSet_) {
        verifier = verifier_;
        memberSet = memberSet_;
        membership = memberSet_.membership();
    }

    // ---------------------------------------------------------------- create

    /// @notice Open a proposal. Sent from a member's own wallet -- proposing is
    ///         public, only voting is not.
    /// @dev The member set is snapshotted here. Members who enroll afterwards
    ///      cannot vote on this proposal (their leaf is not under this root),
    ///      which is also what stops the DAO from inflating the set mid-vote.
    function createProposal(bytes32 descriptionHash, uint64 deadline)
        external
        returns (uint256 proposalId)
    {
        if (membership.balanceOf(msg.sender) == 0) revert NotAMember();
        if (deadline <= block.timestamp) revert DeadlineInPast();

        // MemberSet caps enrolment at MAX_MEMBERS (1024), so this fits in uint64.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 count = uint64(memberSet.memberCount());
        if (count == 0) revert NoMembersEnrolled();

        proposalId = _proposals.length;
        _proposals.push(
            Proposal({
                descriptionHash: descriptionHash,
                memberRoot: memberSet.root(),
                memberCount: count,
                deadline: deadline,
                yesVotes: 0,
                noVotes: 0
            })
        );

        emit ProposalCreated(
            proposalId, descriptionHash, _proposals[proposalId].memberRoot, count, deadline
        );
    }

    // ------------------------------------------------------------------ vote

    /// @notice Cast one ballot. Callable by *anyone* -- the caller only pays gas.
    ///
    /// @dev A member who sends this from their own wallet has deanonymised
    ///      themselves to within a one-vote anonymity set, and no contract can
    ///      prevent that. Send it from an unlinked address or hand it to a
    ///      relayer; see NOTES.md.
    function castVote(uint256 proposalId, uint8 choice, bytes32 nullifier, bytes calldata proof)
        external
    {
        Proposal storage p = _requireOpen(proposalId);
        if (nullifierSpent[proposalId][nullifier]) revert NullifierAlreadySpent();
        _record(p, proposalId, choice, nullifier, proof);
    }

    struct Ballot {
        uint8 choice;
        bytes32 nullifier;
        bytes proof;
    }

    /// @notice Cast several ballots in one transaction.
    ///
    /// @dev This is the recommended path. One transaction carrying ballots
    ///      collected from many members removes the timing correlation that a
    ///      drip of single-ballot transactions would otherwise leak, and makes
    ///      the sender obviously not the voter.
    ///
    ///      Ballots whose nullifier is already spent are skipped rather than
    ///      reverting the batch, so a single duplicate -- or someone
    ///      front-running one ballot out of the batch -- cannot grief the rest.
    ///      An invalid proof still reverts: that is a bug or an attack, not a race.
    function castVotes(uint256 proposalId, Ballot[] calldata ballots) external returns (uint256 counted) {
        Proposal storage p = _requireOpen(proposalId);
        for (uint256 i = 0; i < ballots.length; i++) {
            if (nullifierSpent[proposalId][ballots[i].nullifier]) continue;
            _record(p, proposalId, ballots[i].choice, ballots[i].nullifier, ballots[i].proof);
            counted++;
        }
    }

    function _requireOpen(uint256 proposalId) private view returns (Proposal storage p) {
        if (proposalId >= _proposals.length) revert NoSuchProposal();
        p = _proposals[proposalId];
        if (block.timestamp > p.deadline) revert VotingClosed();
    }

    function _record(
        Proposal storage p,
        uint256 proposalId,
        uint8 choice,
        bytes32 nullifier,
        bytes calldata proof
    ) private {
        if (choice > 1) revert InvalidChoice();

        bytes32[] memory publicInputs = new bytes32[](PUBLIC_INPUT_COUNT);
        publicInputs[0] = p.memberRoot;
        publicInputs[1] = proposalTag(proposalId);
        publicInputs[2] = nullifier;
        publicInputs[3] = bytes32(uint256(choice));

        // Binding all four means a relayer can drop a ballot but cannot alter
        // one: flipping the choice, retargeting the proposal or swapping the
        // nullifier all invalidate the proof.
        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        nullifierSpent[proposalId][nullifier] = true;
        if (choice == 1) p.yesVotes++;
        else p.noVotes++;

        emit VoteCast(proposalId, nullifier, choice);
    }

    // ----------------------------------------------------------------- reads

    /// @notice What the circuit is told the proposal is.
    /// @dev Domain-separated by this contract's address so a ballot proof is
    ///      useless anywhere else, and so nullifiers from two deployments of
    ///      this system can never be matched up against each other.
    function proposalTag(uint256 proposalId) public view returns (bytes32) {
        return Keccak248.hash2(bytes32(uint256(uint160(address(this)))), bytes32(proposalId));
    }

    function proposalCount() external view returns (uint256) {
        return _proposals.length;
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        if (proposalId >= _proposals.length) revert NoSuchProposal();
        return _proposals[proposalId];
    }

    /// @notice The tally, readable by anyone once voting has closed.
    function result(uint256 proposalId) external view returns (uint64 yes, uint64 no, bool passed) {
        if (proposalId >= _proposals.length) revert NoSuchProposal();
        Proposal storage p = _proposals[proposalId];
        if (block.timestamp <= p.deadline) revert VotingOpen();
        return (p.yesVotes, p.noVotes, p.yesVotes > p.noVotes);
    }
}
