// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {LeanIMT, LeanIMTData} from "node_modules/@zk-kit/lean-imt.sol/LeanIMT.sol";
import {SNARK_SCALAR_FIELD} from "node_modules/@zk-kit/lean-imt.sol/Constants.sol";
import {IHonkVerifier} from "./interfaces/IHonkVerifier.sol";

interface IMembershipNFT {
    function balanceOf(address owner) external view returns (uint256);
}

contract NoirPrivateVoting {
    using LeanIMT for LeanIMTData;

    struct Proposal {
        uint64 deadline;
        uint64 yesVotes;
        uint64 noVotes;
        bool exists;
    }

    IHonkVerifier public immutable verifier;
    IMembershipNFT public immutable membershipNft;
    address public immutable owner;

    LeanIMTData private tree;
    uint256 public nextProposalId = 1;

    mapping(address member => bool joined) public hasJoined;
    mapping(bytes32 root => bool known) public knownRoots;
    mapping(bytes32 nullifierHash => bool used) public usedNullifiers;
    mapping(uint256 proposalId => Proposal proposal) public proposals;

    event CommitmentInserted(bytes32 indexed commitment, uint256 indexed leafIndex, bytes32 root);
    event ProposalCreated(uint256 indexed proposalId, uint64 deadline);
    event VoteCast(uint256 indexed proposalId, bytes32 indexed nullifierHash, bool support);

    error NotOwner();
    error NotMember();
    error AlreadyJoined();
    error BadCommitment();
    error UnknownRoot();
    error BadProposal();
    error VotingClosed();
    error NullifierUsed();
    error BadProof();

    constructor(address verifier_, address membershipNft_) {
        verifier = IHonkVerifier(verifier_);
        membershipNft = IMembershipNFT(membershipNft_);
        owner = msg.sender;
    }

    function createProposal(uint64 deadline) external returns (uint256 proposalId) {
        if (msg.sender != owner) revert NotOwner();
        if (deadline <= block.timestamp) revert BadProposal();

        proposalId = nextProposalId++;
        proposals[proposalId] = Proposal({deadline: deadline, yesVotes: 0, noVotes: 0, exists: true});

        emit ProposalCreated(proposalId, deadline);
    }

    function joinVote(bytes32 commitment) external returns (uint256 leafIndex, bytes32 root) {
        if (membershipNft.balanceOf(msg.sender) == 0) revert NotMember();
        if (hasJoined[msg.sender]) revert AlreadyJoined();

        uint256 leaf = uint256(commitment);
        if (leaf == 0 || leaf >= SNARK_SCALAR_FIELD) revert BadCommitment();

        leafIndex = tree.size;
        root = bytes32(tree.insert(leaf));
        knownRoots[root] = true;
        hasJoined[msg.sender] = true;

        emit CommitmentInserted(commitment, leafIndex, root);
    }

    function castVote(
        bytes calldata proof,
        bytes32 merkleRoot,
        uint256 proposalId,
        bool support,
        bytes32 nullifierHash
    ) external {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.exists || proposalId >= SNARK_SCALAR_FIELD) revert BadProposal();
        if (block.timestamp > proposal.deadline) revert VotingClosed();
        if (!knownRoots[merkleRoot]) revert UnknownRoot();
        if (usedNullifiers[nullifierHash]) revert NullifierUsed();

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = merkleRoot;
        publicInputs[1] = bytes32(proposalId);
        publicInputs[2] = support ? bytes32(uint256(1)) : bytes32(0);
        publicInputs[3] = nullifierHash;

        if (!verifier.verify(proof, publicInputs)) revert BadProof();

        usedNullifiers[nullifierHash] = true;
        if (support) {
            proposal.yesVotes += 1;
        } else {
            proposal.noVotes += 1;
        }

        emit VoteCast(proposalId, nullifierHash, support);
    }

    function currentRoot() external view returns (bytes32) {
        return bytes32(tree.root());
    }

    function memberCount() external view returns (uint256) {
        return tree.size;
    }

    function finalTally(uint256 proposalId) external view returns (uint64 yesVotes, uint64 noVotes) {
        Proposal memory proposal = proposals[proposalId];
        if (!proposal.exists) revert BadProposal();
        if (block.timestamp <= proposal.deadline) revert VotingClosed();
        return (proposal.yesVotes, proposal.noVotes);
    }
}
