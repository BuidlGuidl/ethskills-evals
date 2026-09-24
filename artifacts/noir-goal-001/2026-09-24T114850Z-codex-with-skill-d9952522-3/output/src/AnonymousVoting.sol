// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {MembershipNFT} from "./MembershipNFT.sol";
import {IVerifier} from "./interfaces/IVerifier.sol";

contract AnonymousVoting {
    uint8 public constant TREE_DEPTH = 8;
    uint256 public constant MAX_MEMBERS = 256;
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct Proposal {
        uint64 deadline;
        uint128 yes;
        uint128 no;
        bool exists;
    }

    MembershipNFT public immutable membership;
    IVerifier public verifier;
    address public immutable owner;

    uint256 public nextLeafIndex;
    uint256 public currentRoot;

    mapping(uint256 level => uint256 zero) public zeroes;
    mapping(uint256 level => uint256 filledSubtree) public filledSubtrees;
    mapping(uint256 root => bool known) public knownRoots;
    mapping(uint256 commitment => bool used) public commitments;
    mapping(address memberWallet => bool joined) public hasJoined;
    mapping(uint256 proposalId => Proposal proposal) public proposals;
    mapping(uint256 proposalId => mapping(uint256 nullifierHash => bool used)) public nullifierUsed;

    event VerifierUpdated(address indexed verifier);
    event CommitmentInserted(address indexed memberWallet, uint256 indexed leafIndex, uint256 commitment, uint256 root);
    event ProposalCreated(uint256 indexed proposalId, uint64 deadline);
    event VoteCast(uint256 indexed proposalId, uint256 indexed nullifierHash, uint8 vote);

    error NotOwner();
    error NotMember();
    error AlreadyJoined();
    error TreeFull();
    error InvalidField();
    error UnknownRoot();
    error ProposalMissing();
    error ProposalAlreadyExists();
    error VotingClosed();
    error VotingOpen();
    error NullifierAlreadyUsed();
    error InvalidVote();
    error InvalidProof();
    error ZeroVerifier();

    constructor(MembershipNFT membership_, IVerifier verifier_) {
        membership = membership_;
        owner = msg.sender;
        _setVerifier(verifier_);

        zeroes[0] = 0;
        for (uint8 i = 1; i <= TREE_DEPTH; i++) {
            zeroes[i] = PoseidonT3.hash([zeroes[i - 1], zeroes[i - 1]]);
        }

        currentRoot = zeroes[TREE_DEPTH];
        knownRoots[currentRoot] = true;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setVerifier(IVerifier newVerifier) external onlyOwner {
        _setVerifier(newVerifier);
    }

    function join(uint256 commitment) external returns (uint256 leafIndex, uint256 newRoot) {
        if (membership.balanceOf(msg.sender) == 0) revert NotMember();
        if (hasJoined[msg.sender]) revert AlreadyJoined();
        if (commitment == 0 || commitment >= SNARK_SCALAR_FIELD) revert InvalidField();
        if (commitments[commitment]) revert AlreadyJoined();
        if (nextLeafIndex >= MAX_MEMBERS) revert TreeFull();

        hasJoined[msg.sender] = true;
        commitments[commitment] = true;
        leafIndex = nextLeafIndex++;

        uint256 node = commitment;
        uint256 index = leafIndex;
        for (uint8 level = 0; level < TREE_DEPTH; level++) {
            if (index & 1 == 1) {
                node = PoseidonT3.hash([filledSubtrees[level], node]);
            } else {
                filledSubtrees[level] = node;
                node = PoseidonT3.hash([node, zeroes[level]]);
            }
            index >>= 1;
        }

        currentRoot = node;
        knownRoots[node] = true;
        emit CommitmentInserted(msg.sender, leafIndex, commitment, node);
        return (leafIndex, node);
    }

    function createProposal(uint256 proposalId, uint64 deadline) external onlyOwner {
        if (proposals[proposalId].exists) revert ProposalAlreadyExists();
        proposals[proposalId] = Proposal({deadline: deadline, yes: 0, no: 0, exists: true});
        emit ProposalCreated(proposalId, deadline);
    }

    function castVote(
        uint256 proposalId,
        uint256 root,
        uint256 nullifierHash,
        uint8 vote,
        bytes calldata proof
    ) external {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.exists) revert ProposalMissing();
        if (block.timestamp > proposal.deadline) revert VotingClosed();
        if (!knownRoots[root]) revert UnknownRoot();
        if (nullifierHash == 0 || nullifierHash >= SNARK_SCALAR_FIELD) revert InvalidField();
        if (vote > 1) revert InvalidVote();
        if (nullifierUsed[proposalId][nullifierHash]) revert NullifierAlreadyUsed();

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = bytes32(root);
        publicInputs[1] = bytes32(proposalId);
        publicInputs[2] = bytes32(nullifierHash);
        publicInputs[3] = bytes32(uint256(vote));

        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        nullifierUsed[proposalId][nullifierHash] = true;
        if (vote == 1) {
            proposal.yes += 1;
        } else {
            proposal.no += 1;
        }

        emit VoteCast(proposalId, nullifierHash, vote);
    }

    function tally(uint256 proposalId) external view returns (uint128 yes, uint128 no, bool final_) {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.exists) revert ProposalMissing();
        if (block.timestamp <= proposal.deadline) revert VotingOpen();
        return (proposal.yes, proposal.no, true);
    }

    function _setVerifier(IVerifier newVerifier) private {
        if (address(newVerifier) == address(0)) revert ZeroVerifier();
        verifier = newVerifier;
        emit VerifierUpdated(address(newVerifier));
    }
}
