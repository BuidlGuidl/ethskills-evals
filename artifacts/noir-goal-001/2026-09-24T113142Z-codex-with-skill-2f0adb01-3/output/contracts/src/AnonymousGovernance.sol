// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";

interface IHonkVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs)
        external
        view
        returns (bool);
}

interface IMembershipToken {
    function balanceOf(address account) external view returns (uint256);
}

contract AnonymousGovernance {
    uint8 public constant TREE_DEPTH = 8;
    uint256 public constant MAX_LEAVES = 256;
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    IHonkVerifier public immutable verifier;
    IMembershipToken public immutable membershipToken;

    uint256[TREE_DEPTH] public zeroes;
    mapping(uint256 proposalId => Proposal) public proposals;
    mapping(uint256 proposalId => mapping(address member => bool joined)) public hasJoined;
    mapping(uint256 proposalId => mapping(bytes32 nullifierHash => bool used)) public nullifierUsed;
    mapping(uint256 proposalId => mapping(bytes32 root => bool known)) public knownRoots;

    struct Proposal {
        uint64 joinDeadline;
        uint64 voteDeadline;
        uint256 nextLeafIndex;
        uint256 currentRoot;
        uint256 yesVotes;
        uint256 noVotes;
        uint256[TREE_DEPTH] filledSubtrees;
    }

    event ProposalCreated(uint256 indexed proposalId, uint64 joinDeadline, uint64 voteDeadline);
    event CommitmentInserted(
        uint256 indexed proposalId,
        bytes32 indexed commitment,
        uint256 indexed leafIndex,
        bytes32 root,
        address member
    );
    event VoteCast(
        uint256 indexed proposalId,
        bytes32 indexed nullifierHash,
        uint8 voteChoice,
        address relayer
    );

    error InvalidDeadline();
    error ProposalMissing();
    error JoinClosed();
    error VoteClosed();
    error NotMember();
    error AlreadyJoined();
    error TreeFull();
    error NotFieldElement();
    error UnknownRoot();
    error NullifierAlreadyUsed();
    error InvalidVoteChoice();
    error InvalidProof();

    constructor(address verifier_, address membershipToken_) {
        verifier = IHonkVerifier(verifier_);
        membershipToken = IMembershipToken(membershipToken_);

        uint256 currentZero = 0;
        for (uint8 i = 0; i < TREE_DEPTH; i++) {
            zeroes[i] = currentZero;
            currentZero = _hashLeftRight(currentZero, currentZero);
        }
    }

    function createProposal(uint256 proposalId, uint64 joinDeadline, uint64 voteDeadline) external {
        if (proposalId == 0 || proposals[proposalId].voteDeadline != 0) revert InvalidDeadline();
        if (block.timestamp >= joinDeadline || joinDeadline > voteDeadline) revert InvalidDeadline();

        Proposal storage proposal = proposals[proposalId];
        proposal.joinDeadline = joinDeadline;
        proposal.voteDeadline = voteDeadline;
        proposal.currentRoot = emptyRoot();
        knownRoots[proposalId][bytes32(proposal.currentRoot)] = true;

        emit ProposalCreated(proposalId, joinDeadline, voteDeadline);
    }

    function joinProposal(uint256 proposalId, bytes32 commitment) external returns (uint256 leafIndex) {
        Proposal storage proposal = _proposal(proposalId);
        if (block.timestamp > proposal.joinDeadline) revert JoinClosed();
        if (membershipToken.balanceOf(msg.sender) == 0) revert NotMember();
        if (hasJoined[proposalId][msg.sender]) revert AlreadyJoined();

        uint256 leaf = uint256(commitment);
        if (leaf >= SNARK_SCALAR_FIELD) revert NotFieldElement();
        if (proposal.nextLeafIndex >= MAX_LEAVES) revert TreeFull();

        hasJoined[proposalId][msg.sender] = true;
        leafIndex = proposal.nextLeafIndex++;
        proposal.currentRoot = _insert(proposal, leaf, leafIndex);
        knownRoots[proposalId][bytes32(proposal.currentRoot)] = true;

        emit CommitmentInserted(
            proposalId, commitment, leafIndex, bytes32(proposal.currentRoot), msg.sender
        );
    }

    function castVote(
        uint256 proposalId,
        bytes calldata proof,
        bytes32 merkleRoot,
        bytes32 nullifierHash,
        uint8 voteChoice
    ) external {
        Proposal storage proposal = _proposal(proposalId);
        if (block.timestamp > proposal.voteDeadline) revert VoteClosed();
        if (voteChoice > 1) revert InvalidVoteChoice();
        if (!knownRoots[proposalId][merkleRoot]) revert UnknownRoot();
        if (nullifierUsed[proposalId][nullifierHash]) revert NullifierAlreadyUsed();

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = merkleRoot;
        publicInputs[1] = bytes32(proposalId);
        publicInputs[2] = nullifierHash;
        publicInputs[3] = bytes32(uint256(voteChoice));

        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        nullifierUsed[proposalId][nullifierHash] = true;
        if (voteChoice == 1) {
            proposal.yesVotes += 1;
        } else {
            proposal.noVotes += 1;
        }

        emit VoteCast(proposalId, nullifierHash, voteChoice, msg.sender);
    }

    function tally(uint256 proposalId) external view returns (uint256 yesVotes, uint256 noVotes) {
        Proposal storage proposal = _proposal(proposalId);
        return (proposal.yesVotes, proposal.noVotes);
    }

    function emptyRoot() public pure returns (uint256 root) {
        root = 0;
        for (uint8 i = 0; i < TREE_DEPTH; i++) {
            root = _hashLeftRight(root, root);
        }
    }

    function _proposal(uint256 proposalId) internal view returns (Proposal storage proposal) {
        proposal = proposals[proposalId];
        if (proposal.voteDeadline == 0) revert ProposalMissing();
    }

    function _insert(Proposal storage proposal, uint256 leaf, uint256 leafIndex)
        internal
        returns (uint256 root)
    {
        uint256 current = leaf;
        uint256 index = leafIndex;

        for (uint8 level = 0; level < TREE_DEPTH; level++) {
            if (index & 1 == 0) {
                proposal.filledSubtrees[level] = current;
                current = _hashLeftRight(current, zeroes[level]);
            } else {
                current = _hashLeftRight(proposal.filledSubtrees[level], current);
            }
            index >>= 1;
        }

        return current;
    }

    function _hashLeftRight(uint256 left, uint256 right) internal pure returns (uint256) {
        return PoseidonT3.hash([left, right]);
    }
}
