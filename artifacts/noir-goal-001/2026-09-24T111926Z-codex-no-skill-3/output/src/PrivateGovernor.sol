// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IProofVerifier} from "./IProofVerifier.sol";
import {MembershipNFT} from "./MembershipNFT.sol";

contract PrivateGovernor {
    struct Proposal {
        bytes32 root;
        uint64 deadline;
        uint128 yesVotes;
        uint128 noVotes;
        bool exists;
    }

    MembershipNFT public immutable membership;
    IProofVerifier public verifier;
    address public owner;
    uint256 public nextProposalId = 1;

    mapping(uint256 proposalId => Proposal proposal) public proposals;
    mapping(uint256 proposalId => mapping(bytes32 nullifierHash => bool used)) public nullifierUsed;
    mapping(address member => bytes32 commitment) public commitmentOf;

    event VerifierSet(address indexed verifier);
    event CommitmentRegistered(address indexed member, bytes32 commitment);
    event ProposalCreated(uint256 indexed proposalId, bytes32 root, uint64 deadline);
    event VoteCast(uint256 indexed proposalId, bytes32 indexed nullifierHash, bool vote);

    error NotOwner();
    error NotMember();
    error ProposalMissing();
    error VoteClosed();
    error TallyNotReady();
    error AlreadyRegistered();
    error NullifierAlreadyUsed();
    error BadProof();
    error BadPublicInput();

    constructor(MembershipNFT membership_, IProofVerifier verifier_) {
        owner = msg.sender;
        membership = membership_;
        verifier = verifier_;
        emit VerifierSet(address(verifier_));
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setVerifier(IProofVerifier verifier_) external onlyOwner {
        verifier = verifier_;
        emit VerifierSet(address(verifier_));
    }

    function registerCommitment(bytes32 commitment) external {
        if (membership.balanceOf(msg.sender) == 0) revert NotMember();
        if (commitmentOf[msg.sender] != bytes32(0)) revert AlreadyRegistered();

        commitmentOf[msg.sender] = commitment;
        emit CommitmentRegistered(msg.sender, commitment);
    }

    function createProposal(bytes32 root, uint64 deadline) external onlyOwner returns (uint256 proposalId) {
        if (deadline <= block.timestamp) revert VoteClosed();

        proposalId = nextProposalId++;
        proposals[proposalId] = Proposal({root: root, deadline: deadline, yesVotes: 0, noVotes: 0, exists: true});

        emit ProposalCreated(proposalId, root, deadline);
    }

    function castVote(
        uint256 proposalId,
        bool vote,
        bytes32 nullifierHash,
        bytes calldata proof
    ) external {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.exists) revert ProposalMissing();
        if (block.timestamp >= proposal.deadline) revert VoteClosed();
        if (nullifierUsed[proposalId][nullifierHash]) revert NullifierAlreadyUsed();

        bytes32[] memory publicInputs = new bytes32[](6);
        publicInputs[0] = proposal.root;
        publicInputs[1] = bytes32(proposalId);
        publicInputs[2] = vote ? bytes32(uint256(1)) : bytes32(0);
        publicInputs[3] = nullifierHash;
        publicInputs[4] = bytes32(uint256(uint160(address(this))));
        publicInputs[5] = bytes32(block.chainid);

        if (!verifier.verify(proof, publicInputs)) revert BadProof();

        nullifierUsed[proposalId][nullifierHash] = true;
        if (vote) {
            proposal.yesVotes++;
        } else {
            proposal.noVotes++;
        }

        emit VoteCast(proposalId, nullifierHash, vote);
    }

    function tally(uint256 proposalId) external view returns (uint128 yesVotes, uint128 noVotes) {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.exists) revert ProposalMissing();
        if (block.timestamp < proposal.deadline) revert TallyNotReady();
        return (proposal.yesVotes, proposal.noVotes);
    }
}
