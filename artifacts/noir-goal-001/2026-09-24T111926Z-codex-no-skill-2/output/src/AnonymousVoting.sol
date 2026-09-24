// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZKVerifier} from "./IZKVerifier.sol";
import {MemberRootRegistry} from "./MemberRootRegistry.sol";

contract AnonymousVoting {
    struct Proposal {
        string metadataURI;
        uint64 deadline;
        uint64 yes;
        uint64 no;
        bool exists;
    }

    IZKVerifier public verifier;
    MemberRootRegistry public rootRegistry;
    address public owner;

    mapping(uint256 proposalId => Proposal proposal) public proposals;
    mapping(bytes32 nullifier => bool used) public nullifierUsed;

    event VerifierUpdated(address indexed verifier);
    event ProposalCreated(uint256 indexed proposalId, string metadataURI, uint64 deadline);
    event VoteSubmitted(uint256 indexed proposalId, bytes32 indexed nullifier, bool support);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address verifier_, address rootRegistry_) {
        owner = msg.sender;
        verifier = IZKVerifier(verifier_);
        rootRegistry = MemberRootRegistry(rootRegistry_);
    }

    function setVerifier(address verifier_) external onlyOwner {
        verifier = IZKVerifier(verifier_);
        emit VerifierUpdated(verifier_);
    }

    function createProposal(uint256 proposalId, string calldata metadataURI, uint64 deadline) external onlyOwner {
        require(!proposals[proposalId].exists, "proposal exists");
        require(deadline > block.timestamp, "deadline passed");

        proposals[proposalId] = Proposal({metadataURI: metadataURI, deadline: deadline, yes: 0, no: 0, exists: true});
        emit ProposalCreated(proposalId, metadataURI, deadline);
    }

    function submitVote(
        uint256 proposalId,
        bytes32 root,
        bytes32 nullifier,
        bool support,
        bytes calldata proof
    ) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.exists, "unknown proposal");
        require(block.timestamp < proposal.deadline, "voting closed");
        require(rootRegistry.isKnownRoot(root), "unknown member root");
        require(!nullifierUsed[nullifier], "nullifier used");

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = root;
        publicInputs[1] = bytes32(proposalId);
        publicInputs[2] = nullifier;
        publicInputs[3] = support ? bytes32(uint256(1)) : bytes32(0);

        require(verifier.verify(proof, publicInputs), "invalid proof");

        nullifierUsed[nullifier] = true;
        if (support) {
            proposal.yes += 1;
        } else {
            proposal.no += 1;
        }

        emit VoteSubmitted(proposalId, nullifier, support);
    }

    function tally(uint256 proposalId) external view returns (uint64 yes, uint64 no, uint64 deadline) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.exists, "unknown proposal");
        return (proposal.yes, proposal.no, proposal.deadline);
    }
}
