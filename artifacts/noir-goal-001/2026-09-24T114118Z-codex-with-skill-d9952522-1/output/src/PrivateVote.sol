// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IVerifier} from "./Verifier.sol";
import {PoseidonT3} from "./vendor/PoseidonT3.sol";

interface IMembershipNFT {
    function balanceOf(address holder) external view returns (uint256);
}

contract PrivateVote {
    uint256 public constant TREE_DEPTH = 8;
    uint256 public constant MAX_LEAVES = 256;
    uint256 public constant FIELD_MODULUS =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    IVerifier public immutable verifier;
    IMembershipNFT public immutable membership;
    address public immutable owner;

    uint256 public nextLeafIndex;
    uint256 public currentRoot;

    uint256[TREE_DEPTH] public zeroes;
    uint256[TREE_DEPTH] public filledSubtrees;

    mapping(address member => bool joined) public hasJoined;
    mapping(uint256 commitment => bool seen) public commitmentSeen;
    mapping(uint256 root => bool known) public knownRoot;
    mapping(uint256 proposalId => Proposal proposal) private proposals;
    mapping(uint256 proposalId => mapping(bytes32 nullifierHash => bool used)) public nullifierUsed;

    struct Proposal {
        uint64 deadline;
        uint64 yesVotes;
        uint64 noVotes;
        bool exists;
    }

    event CommitmentJoined(uint256 indexed commitment, uint256 indexed leafIndex, uint256 root);
    event ProposalCreated(uint256 indexed proposalId, uint64 deadline);
    event VoteSubmitted(
        uint256 indexed proposalId,
        bytes32 indexed nullifierHash,
        bool support,
        address indexed submitter
    );

    error NotOwner();
    error NotMember();
    error AlreadyJoined();
    error DuplicateCommitment();
    error TreeFull();
    error FieldElementTooLarge();
    error ProposalExists();
    error ProposalMissing();
    error VotingClosed();
    error VotingOpen();
    error BadPublicInputs();
    error UnknownRoot();
    error NullifierAlreadyUsed();
    error InvalidProof();

    constructor(address verifier_, address membership_) {
        owner = msg.sender;
        verifier = IVerifier(verifier_);
        membership = IMembershipNFT(membership_);

        uint256 zero = 0;
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            zeroes[i] = zero;
            filledSubtrees[i] = zero;
            zero = _hashPair(zero, zero);
        }

        currentRoot = zero;
        knownRoot[zero] = true;
    }

    function join(uint256 commitment) external returns (uint256 leafIndex, uint256 root) {
        if (membership.balanceOf(msg.sender) == 0) revert NotMember();
        if (hasJoined[msg.sender]) revert AlreadyJoined();
        if (commitment >= FIELD_MODULUS) revert FieldElementTooLarge();
        if (commitmentSeen[commitment]) revert DuplicateCommitment();

        leafIndex = nextLeafIndex;
        if (leafIndex >= MAX_LEAVES) revert TreeFull();

        nextLeafIndex = leafIndex + 1;
        hasJoined[msg.sender] = true;
        commitmentSeen[commitment] = true;

        uint256 current = commitment;
        uint256 index = leafIndex;

        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (index & 1 == 0) {
                filledSubtrees[i] = current;
                current = _hashPair(current, zeroes[i]);
            } else {
                current = _hashPair(filledSubtrees[i], current);
            }
            index >>= 1;
        }

        currentRoot = current;
        knownRoot[current] = true;
        root = current;

        emit CommitmentJoined(commitment, leafIndex, root);
    }

    function createProposal(uint256 proposalId, uint64 deadline) external {
        if (msg.sender != owner) revert NotOwner();
        if (proposalId >= FIELD_MODULUS) revert FieldElementTooLarge();
        if (proposals[proposalId].exists) revert ProposalExists();

        proposals[proposalId] = Proposal({deadline: deadline, yesVotes: 0, noVotes: 0, exists: true});
        emit ProposalCreated(proposalId, deadline);
    }

    function submitVote(
        uint256 proposalId,
        bool support,
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.exists) revert ProposalMissing();
        if (block.timestamp > proposal.deadline) revert VotingClosed();
        if (publicInputs.length != 4) revert BadPublicInputs();

        uint256 root = uint256(publicInputs[0]);
        uint256 proofProposalId = uint256(publicInputs[1]);
        uint256 proofVote = uint256(publicInputs[2]);
        bytes32 nullifierHash = publicInputs[3];

        if (proofProposalId != proposalId) revert BadPublicInputs();
        if (proofVote != (support ? 1 : 0)) revert BadPublicInputs();
        if (!knownRoot[root]) revert UnknownRoot();
        if (nullifierUsed[proposalId][nullifierHash]) revert NullifierAlreadyUsed();
        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        nullifierUsed[proposalId][nullifierHash] = true;

        if (support) {
            proposal.yesVotes += 1;
        } else {
            proposal.noVotes += 1;
        }

        emit VoteSubmitted(proposalId, nullifierHash, support, msg.sender);
    }

    function proposalInfo(uint256 proposalId)
        external
        view
        returns (uint64 deadline, bool exists)
    {
        Proposal storage proposal = proposals[proposalId];
        return (proposal.deadline, proposal.exists);
    }

    function finalTally(uint256 proposalId) external view returns (uint64 yesVotes, uint64 noVotes) {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.exists) revert ProposalMissing();
        if (block.timestamp <= proposal.deadline) revert VotingOpen();
        return (proposal.yesVotes, proposal.noVotes);
    }

    function _hashPair(uint256 left, uint256 right) internal pure returns (uint256) {
        return PoseidonT3.hash([left, right]);
    }
}
