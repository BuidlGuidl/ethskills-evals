// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {InternalLeanIMT, LeanIMTData} from "@zk-kit/lean-imt.sol/InternalLeanIMT.sol";
import {SNARK_SCALAR_FIELD} from "@zk-kit/lean-imt.sol/Constants.sol";

interface IVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

interface IMembership {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title AnonVoting
/// @notice Yes/no DAO governance where the member set is public but individual
///         ballots are not attributable to any member.
///
/// Three transactions make up the lifecycle, and they are deliberately sent by
/// different wallets:
///
///   1. `register`      - member wallet (must hold the membership NFT). Publishes an
///                        identity commitment. Links wallet <-> commitment on purpose:
///                        the set of registered commitments IS the anonymity set.
///   2. `createProposal`- any member wallet. Pins the current member-tree root, so the
///                        eligible set for this proposal is fixed at open time.
///   3. `castVote`      - a fresh/relayer wallet that is NOT a registered member wallet.
///                        Carries a ZK proof of "I am some commitment under the pinned
///                        root" plus a proposal-scoped nullifier. Reveals the ballot but
///                        not the balloter.
///
/// The contract has no owner, no admin key and no tally authority. There is no
/// role that can learn who cast which ballot - the information simply is not
/// onchain and never passes through any privileged party.
contract AnonVoting {
    using InternalLeanIMT for LeanIMTData;

    /// @notice Number of `pub` inputs of the ballot circuit, in circuit order.
    uint256 private constant PUBLIC_INPUT_COUNT = 4;

    IVerifier public immutable verifier;
    IMembership public immutable membership;

    /// @notice A proposal may not open unless the member tree already holds at
    ///         least this many commitments; a 1-of-2 anonymity set is not anonymity.
    uint256 public immutable minAnonymitySet;

    /// @notice Poseidon LeanIMT over identity commitments. Same hash and same
    ///         construction as the offchain mirror in js/lib/tree.mjs and as
    ///         `binary_merkle_root(hash_2, ...)` in circuits/ballot.
    LeanIMTData internal memberTree;

    /// @notice One identity commitment per member wallet.
    mapping(address => bool) public hasRegistered;

    /// @notice Spent ballots. The nullifier hash is already bound to a proposal id
    ///         inside the circuit, so a single global mapping cannot collide across
    ///         proposals and one member's ballots on different proposals are unlinkable.
    mapping(uint256 => bool) public nullifierSpent;

    struct Proposal {
        uint256 root; // member-tree root pinned when the proposal opened
        uint256 memberCount; // size of the anonymity set at that moment
        uint64 deadline; // ballots accepted while block.timestamp < deadline
        uint64 ballotsCast;
        uint64 yesVotes;
        uint64 noVotes;
        string description;
    }

    Proposal[] internal proposals;

    event MemberRegistered(uint256 indexed commitment, uint256 leafIndex, uint256 newRoot);
    event ProposalCreated(uint256 indexed proposalId, uint256 root, uint256 memberCount, uint64 deadline);
    /// @dev Intentionally carries no sender-derived data: a nullifier hash and a ballot.
    event BallotCast(uint256 indexed proposalId, uint256 nullifierHash, uint8 vote);

    error NotAMember();
    error AlreadyRegistered();
    error AnonymitySetTooSmall(uint256 have, uint256 need);
    error ZeroVotingPeriod();
    error NoSuchProposal();
    error VotingClosed();
    error VotingStillOpen();
    error NullifierAlreadySpent();
    error VoteNotBinary();
    error InvalidProof();
    error BallotFromMemberWallet();
    error NotAFieldElement();

    constructor(address _verifier, address _membership, uint256 _minAnonymitySet) {
        verifier = IVerifier(_verifier);
        membership = IMembership(_membership);
        minAnonymitySet = _minAnonymitySet;
    }

    // ---------------------------------------------------------------- joining

    /// @notice Join the vote. Sent by the member's own (NFT-holding) wallet.
    /// @param commitment poseidon(1, poseidon(identityNullifier, identityTrapdoor)).
    ///        Both preimages stay on the member's machine; losing them means losing
    ///        the ability to vote (see NOTES.md, "Known gaps").
    function register(uint256 commitment) external {
        if (membership.balanceOf(msg.sender) == 0) revert NotAMember();
        if (hasRegistered[msg.sender]) revert AlreadyRegistered();

        hasRegistered[msg.sender] = true;
        uint256 leafIndex = memberTree.size;
        uint256 newRoot = memberTree._insert(commitment);

        emit MemberRegistered(commitment, leafIndex, newRoot);
    }

    // -------------------------------------------------------------- proposals

    /// @notice Open a proposal. Sent by any member wallet.
    /// @dev Root policy: a proposal pins exactly one root, the tree root at open
    ///      time. There is no rolling window of accepted roots, so a member who
    ///      registers after the proposal opens cannot vote on it - and equally, no
    ///      commitment can be slipped into the set once voting has begun.
    function createProposal(string calldata description, uint64 votingPeriod) external returns (uint256 proposalId) {
        if (membership.balanceOf(msg.sender) == 0) revert NotAMember();
        if (votingPeriod == 0) revert ZeroVotingPeriod();

        uint256 memberCount = memberTree.size;
        if (memberCount < minAnonymitySet) revert AnonymitySetTooSmall(memberCount, minAnonymitySet);

        uint256 root = memberTree._root();
        uint64 deadline = uint64(block.timestamp) + votingPeriod;

        proposalId = proposals.length;
        proposals.push(
            Proposal({
                root: root,
                memberCount: memberCount,
                deadline: deadline,
                ballotsCast: 0,
                yesVotes: 0,
                noVotes: 0,
                description: description
            })
        );

        emit ProposalCreated(proposalId, root, memberCount, deadline);
    }

    // ----------------------------------------------------------------- voting

    /// @notice Cast one anonymous ballot.
    /// @dev Anyone may submit: the proof, not `msg.sender`, is the authorisation.
    ///      That is what lets a member hand the ballot to a relayer or a funded
    ///      burner. Registered member wallets are refused precisely because
    ///      self-submitting would re-attach the ballot to an identity.
    /// @param proposalId  proposal being voted on (bound into the nullifier by the circuit)
    /// @param vote        0 = no, 1 = yes (bound into the proof, so a relayer cannot flip it)
    /// @param nullifierHash poseidon(poseidon(2, proposalId), identityNullifier)
    /// @param proof       UltraHonk (keccak, ZK) proof bytes from circuits/ballot
    function castVote(uint256 proposalId, uint8 vote, uint256 nullifierHash, bytes calldata proof) external {
        if (proposalId >= proposals.length) revert NoSuchProposal();
        Proposal storage p = proposals[proposalId];

        if (block.timestamp >= p.deadline) revert VotingClosed();
        if (vote > 1) revert VoteNotBinary();
        // Public inputs are field elements. Without this, `nullifierHash + p` would
        // reduce to `nullifierHash` inside the verifier while keying a different slot
        // in `nullifierSpent` - i.e. a second ballot from the same identity. The
        // generated verifier happens to reject out-of-range inputs too; we do not
        // want that safety to live in a contract we regenerate.
        if (nullifierHash >= SNARK_SCALAR_FIELD) revert NotAFieldElement();
        if (nullifierSpent[nullifierHash]) revert NullifierAlreadySpent();
        if (hasRegistered[msg.sender]) revert BallotFromMemberWallet();

        // Order must match the circuit's `pub` parameters exactly:
        // merkle_root, proposal_id, nullifier_hash, vote.
        bytes32[] memory publicInputs = new bytes32[](PUBLIC_INPUT_COUNT);
        publicInputs[0] = bytes32(p.root);
        publicInputs[1] = bytes32(proposalId);
        publicInputs[2] = bytes32(nullifierHash);
        publicInputs[3] = bytes32(uint256(vote));

        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        // State changes only after the proof is accepted.
        nullifierSpent[nullifierHash] = true;
        p.ballotsCast += 1;
        if (vote == 1) {
            p.yesVotes += 1;
        } else {
            p.noVotes += 1;
        }

        emit BallotCast(proposalId, nullifierHash, vote);
    }

    // ------------------------------------------------------------------ views

    /// @notice Final tally. Readable by anyone once the deadline has passed.
    /// @dev The guard is a convenience, not a secrecy mechanism: the counters live
    ///      in public storage and each ballot is a public transaction, so the running
    ///      tally is observable throughout. See NOTES.md, "What is not hidden".
    function result(uint256 proposalId) external view returns (uint256 yesVotes, uint256 noVotes) {
        if (proposalId >= proposals.length) revert NoSuchProposal();
        Proposal storage p = proposals[proposalId];
        if (block.timestamp < p.deadline) revert VotingStillOpen();
        return (p.yesVotes, p.noVotes);
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    /// @notice Everything a prover needs to build a ballot for `proposalId`.
    function proposalInfo(uint256 proposalId)
        external
        view
        returns (uint256 root, uint256 setSize, uint64 deadline, uint64 ballotsCast, string memory description)
    {
        if (proposalId >= proposals.length) revert NoSuchProposal();
        Proposal storage p = proposals[proposalId];
        return (p.root, p.memberCount, p.deadline, p.ballotsCast, p.description);
    }

    /// @notice Current member-tree root (the root a *new* proposal would pin).
    function currentRoot() external view returns (uint256) {
        return memberTree._root();
    }

    function memberCount() external view returns (uint256) {
        return memberTree.size;
    }

    function isCommitmentRegistered(uint256 commitment) external view returns (bool) {
        return memberTree._has(commitment);
    }
}
