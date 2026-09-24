// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {IVerifier} from "./IVerifier.sol";
import {SimpleMembershipNFT} from "./SimpleMembershipNFT.sol";

contract PrivateVote {
    uint8 public constant TREE_DEPTH = 8;
    uint256 public constant MAX_LEAVES = 2 ** TREE_DEPTH;
    uint256 public constant FIELD_MODULUS =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct Proposal {
        uint64 deadline;
        uint32 yesVotes;
        uint32 noVotes;
        uint16 leafCount;
        bytes32 root;
        bool exists;
    }

    SimpleMembershipNFT public immutable membership;
    IVerifier public verifier;
    address public owner;
    uint256 public proposalCount;

    bytes32[TREE_DEPTH] public zeroes;
    mapping(uint256 proposalId => Proposal proposal) public proposals;
    mapping(uint256 proposalId => mapping(uint256 level => bytes32 subtree)) public filledSubtrees;
    mapping(uint256 proposalId => mapping(bytes32 root => bool known)) public knownRoots;
    mapping(uint256 proposalId => mapping(bytes32 commitment => bool used)) public commitments;
    mapping(uint256 proposalId => mapping(address member => bool joined)) public hasJoined;
    mapping(uint256 proposalId => mapping(bytes32 nullifierHash => bool used)) public nullifierHashes;

    event VerifierUpdated(address indexed verifier);
    event ProposalCreated(uint256 indexed proposalId, uint64 deadline, bytes32 initialRoot);
    event CommitmentInserted(
        uint256 indexed proposalId,
        address indexed member,
        bytes32 indexed commitment,
        uint256 leafIndex,
        bytes32 root
    );
    event VoteCast(uint256 indexed proposalId, bytes32 indexed nullifierHash, bool vote);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(SimpleMembershipNFT membership_, IVerifier verifier_) {
        membership = membership_;
        verifier = verifier_;
        owner = msg.sender;

        bytes32 current = bytes32(0);
        for (uint8 i = 0; i < TREE_DEPTH; i++) {
            zeroes[i] = current;
            current = _hashPair(current, current);
        }

        emit VerifierUpdated(address(verifier_));
    }

    function setVerifier(IVerifier verifier_) external onlyOwner {
        verifier = verifier_;
        emit VerifierUpdated(address(verifier_));
    }

    function createProposal(uint64 deadline) external onlyOwner returns (uint256 proposalId) {
        require(deadline > block.timestamp, "deadline elapsed");

        proposalId = ++proposalCount;
        Proposal storage proposal = proposals[proposalId];
        proposal.deadline = deadline;
        proposal.root = emptyRoot();
        proposal.exists = true;
        knownRoots[proposalId][proposal.root] = true;

        emit ProposalCreated(proposalId, deadline, proposal.root);
    }

    function joinProposal(uint256 proposalId, bytes32 commitment) external returns (uint256 leafIndex, bytes32 root) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.exists, "missing proposal");
        require(block.timestamp < proposal.deadline, "joining closed");
        require(membership.balanceOf(msg.sender) > 0, "not member");
        require(uint256(commitment) < FIELD_MODULUS, "commitment not field");
        require(!hasJoined[proposalId][msg.sender], "member joined");
        require(!commitments[proposalId][commitment], "commitment used");
        require(proposal.leafCount < MAX_LEAVES, "tree full");

        hasJoined[proposalId][msg.sender] = true;
        commitments[proposalId][commitment] = true;
        leafIndex = proposal.leafCount;
        proposal.leafCount += 1;
        root = _insert(proposalId, leafIndex, commitment);
        proposal.root = root;
        knownRoots[proposalId][root] = true;

        emit CommitmentInserted(proposalId, msg.sender, commitment, leafIndex, root);
    }

    function castVote(
        uint256 proposalId,
        bool vote,
        bytes32 root,
        bytes32 nullifierHash,
        bytes calldata proof
    ) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.exists, "missing proposal");
        require(block.timestamp < proposal.deadline, "voting closed");
        require(knownRoots[proposalId][root], "unknown root");
        require(!nullifierHashes[proposalId][nullifierHash], "already voted");
        require(uint256(nullifierHash) < FIELD_MODULUS, "nullifier not field");

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = root;
        publicInputs[1] = nullifierHash;
        publicInputs[2] = bytes32(proposalId);
        publicInputs[3] = vote ? bytes32(uint256(1)) : bytes32(0);

        require(verifier.verify(proof, publicInputs), "bad proof");

        nullifierHashes[proposalId][nullifierHash] = true;
        if (vote) {
            proposal.yesVotes += 1;
        } else {
            proposal.noVotes += 1;
        }

        emit VoteCast(proposalId, nullifierHash, vote);
    }

    function tally(uint256 proposalId) external view returns (uint32 yesVotes, uint32 noVotes) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.exists, "missing proposal");
        require(block.timestamp >= proposal.deadline, "tally not final");
        return (proposal.yesVotes, proposal.noVotes);
    }

    function emptyRoot() public pure returns (bytes32 current) {
        current = bytes32(0);
        for (uint8 i = 0; i < TREE_DEPTH; i++) {
            current = _hashPair(current, current);
        }
    }

    function hashPair(bytes32 left, bytes32 right) external pure returns (bytes32) {
        return _hashPair(left, right);
    }

    function _insert(uint256 proposalId, uint256 leafIndex, bytes32 leaf) internal returns (bytes32 current) {
        current = leaf;
        uint256 index = leafIndex;

        for (uint8 level = 0; level < TREE_DEPTH; level++) {
            if (index & 1 == 0) {
                filledSubtrees[proposalId][level] = current;
                current = _hashPair(current, zeroes[level]);
            } else {
                current = _hashPair(filledSubtrees[proposalId][level], current);
            }
            index >>= 1;
        }
    }

    function _hashPair(bytes32 left, bytes32 right) internal pure returns (bytes32) {
        uint256[2] memory inputs = [uint256(left), uint256(right)];
        return bytes32(PoseidonT3.hash(inputs));
    }
}
