// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IVerifier} from "./VoteVerifier.sol";
import {MemberRegistry} from "./MemberRegistry.sol";

/// @notice Yes/no proposals voted on with ZK membership proofs.
/// castVote is permissionless and ignores msg.sender: members must NOT send it from
/// their own wallet — a relayer (or any unlinked account) submits it for them.
contract AnonymousVoting {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416417980263064491575221009009;

    struct Proposal {
        bytes32 descriptionHash;
        uint256 root; // member tree root snapshotted at creation
        uint256 memberCount; // leaves in that snapshot (lets clients rebuild the exact tree)
        uint256 scope; // external nullifier bound into every proof for this proposal
        uint64 deadline;
        uint32 yes;
        uint32 no;
    }

    MemberRegistry public immutable registry;
    IVerifier public immutable verifier;
    /// A proposal cannot open until at least this many members are in the tree.
    uint256 public immutable minAnonymitySet;

    Proposal[] internal proposals;
    mapping(uint256 nullifierHash => bool) public nullifierUsed;

    event ProposalCreated(
        uint256 indexed proposalId, bytes32 descriptionHash, uint256 root, uint256 memberCount, uint256 scope, uint64 deadline
    );
    event VoteCast(uint256 indexed proposalId, uint256 nullifierHash, bool support);

    error NotMember();
    error AnonymitySetTooSmall();
    error UnknownProposal();
    error VotingClosed();
    error VotingOpen();
    error AlreadyVoted();
    error InvalidNullifier();
    error InvalidProof();

    constructor(MemberRegistry _registry, IVerifier _verifier, uint256 _minAnonymitySet) {
        registry = _registry;
        verifier = _verifier;
        minAnonymitySet = _minAnonymitySet;
    }

    function createProposal(uint256 tokenId, bytes32 descriptionHash, uint64 votingPeriod)
        external
        returns (uint256 proposalId)
    {
        if (registry.membershipNft().ownerOf(tokenId) != msg.sender) revert NotMember();
        uint256 count = registry.nextIndex();
        if (count < minAnonymitySet) revert AnonymitySetTooSmall();

        proposalId = proposals.length;
        uint256 scope = uint256(keccak256(abi.encode(block.chainid, address(this), proposalId))) % SNARK_SCALAR_FIELD;
        uint64 deadline = uint64(block.timestamp) + votingPeriod;
        proposals.push(Proposal(descriptionHash, registry.root(), count, scope, deadline, 0, 0));
        emit ProposalCreated(proposalId, descriptionHash, registry.root(), count, scope, deadline);
    }

    function castVote(uint256 proposalId, bool support, uint256 nullifierHash, bytes calldata proof) external {
        if (proposalId >= proposals.length) revert UnknownProposal();
        Proposal storage p = proposals[proposalId];
        if (block.timestamp >= p.deadline) revert VotingClosed();
        if (nullifierHash >= SNARK_SCALAR_FIELD) revert InvalidNullifier();
        if (nullifierUsed[nullifierHash]) revert AlreadyVoted();

        // Order must match the `pub` params of circuits/vote/src/main.nr:
        // (root, scope, vote, nullifier_hash). Root and scope come from storage,
        // so a proof can only count against this proposal's snapshot.
        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = bytes32(p.root);
        publicInputs[1] = bytes32(p.scope);
        publicInputs[2] = bytes32(uint256(support ? 1 : 0));
        publicInputs[3] = bytes32(nullifierHash);
        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        nullifierUsed[nullifierHash] = true;
        if (support) p.yes++;
        else p.no++;
        emit VoteCast(proposalId, nullifierHash, support);
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        if (proposalId >= proposals.length) revert UnknownProposal();
        return proposals[proposalId];
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    /// Final tally, available once the deadline has passed.
    function result(uint256 proposalId) external view returns (uint256 yes, uint256 no, bool passed) {
        if (proposalId >= proposals.length) revert UnknownProposal();
        Proposal storage p = proposals[proposalId];
        if (block.timestamp < p.deadline) revert VotingOpen();
        return (p.yes, p.no, p.yes > p.no);
    }
}
