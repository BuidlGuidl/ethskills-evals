// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IVerifier} from "./IVerifier.sol";
import {MemberRegistry} from "./MemberRegistry.sol";

/// @notice Yes/no DAO proposals where the tally is public but the voter is not.
///
/// A vote is accepted on proof of three facts, none of which name the voter:
///   1. the prover knows the preimage of some commitment in the registry tree as it stood when
///      the proposal was created,
///   2. the nullifier hash they publish is the one derived from that commitment and this
///      proposal id — so a second vote on the same proposal is detectable,
///   3. the ballot is 0 or 1.
///
/// `castVote` never reads `msg.sender`. The sender is therefore free to be a fresh burner wallet
/// or a relayer; nothing in the proof or the state binds the ballot to whoever paid the gas.
contract AnonVoting {
    /// @dev Order is load-bearing: it must match the `pub` parameter order of `circuits/anon_vote`
    ///      and the order of `proof.publicInputs` produced by NoirJS.
    uint256 private constant PUBLIC_INPUT_COUNT = 4;

    IVerifier public immutable verifier;
    MemberRegistry public immutable registry;

    struct Proposal {
        bytes32 descriptionHash;
        uint256 merkleRoot; // registry root snapshotted at creation
        uint256 merkleDepth; // registry depth at creation; clients pad witnesses to it
        uint64 deadline;
        uint64 yesVotes;
        uint64 noVotes;
    }

    uint256 public proposalCount;
    mapping(uint256 proposalId => Proposal) internal proposals;
    mapping(uint256 proposalId => mapping(bytes32 nullifierHash => bool)) public nullifierUsed;

    event ProposalCreated(
        uint256 indexed proposalId, bytes32 descriptionHash, uint256 merkleRoot, uint256 merkleDepth, uint64 deadline
    );
    /// @dev Intentionally carries no sender and no voter identity: a nullifier hash, and a ballot.
    event VoteCast(uint256 indexed proposalId, bytes32 nullifierHash, uint8 support);

    error NotAMember();
    error DeadlineInPast();
    error EmptyRegistry();
    error UnknownProposal();
    error VotingClosed();
    error VotingOpen();
    error NullifierAlreadyUsed();
    error InvalidSupport();
    error InvalidProof();

    constructor(IVerifier verifier_, MemberRegistry registry_) {
        verifier = verifier_;
        registry = registry_;
    }

    /// @notice Open a proposal against the registry as it stands right now.
    /// @dev Any membership NFT holder may propose; this transaction is openly attributable and is
    ///      meant to be. Members who register after this call cannot vote on this proposal.
    function createProposal(bytes32 descriptionHash, uint64 deadline) external returns (uint256 proposalId) {
        if (IERC721(registry.membershipNFT()).balanceOf(msg.sender) == 0) revert NotAMember();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        uint256 size = registry.size();
        if (size == 0) revert EmptyRegistry();

        proposalId = ++proposalCount;
        uint256 root = registry.root();
        uint256 treeDepth = registry.depth();
        proposals[proposalId] = Proposal({
            descriptionHash: descriptionHash,
            merkleRoot: root,
            merkleDepth: treeDepth,
            deadline: deadline,
            yesVotes: 0,
            noVotes: 0
        });

        emit ProposalCreated(proposalId, descriptionHash, root, treeDepth, deadline);
    }

    /// @notice Cast one anonymous ballot. Send this from a wallet with no history linking it to a
    ///         membership NFT, or hand it to a relayer — the contract does not care who calls it.
    function castVote(uint256 proposalId, bytes calldata proof, bytes32 nullifierHash, uint8 support) external {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert UnknownProposal();
        if (block.timestamp >= p.deadline) revert VotingClosed();
        if (support > 1) revert InvalidSupport();
        if (nullifierUsed[proposalId][nullifierHash]) revert NullifierAlreadyUsed();

        bytes32[] memory publicInputs = new bytes32[](PUBLIC_INPUT_COUNT);
        publicInputs[0] = bytes32(p.merkleRoot); // pub merkle_root
        publicInputs[1] = bytes32(proposalId); // pub proposal_id
        publicInputs[2] = nullifierHash; // pub nullifier_hash
        publicInputs[3] = bytes32(uint256(support)); // pub vote
        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        // State only moves after the proof is verified.
        nullifierUsed[proposalId][nullifierHash] = true;
        if (support == 1) {
            p.yesVotes++;
        } else {
            p.noVotes++;
        }

        emit VoteCast(proposalId, nullifierHash, support);
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        if (proposals[proposalId].deadline == 0) revert UnknownProposal();
        return proposals[proposalId];
    }

    /// @notice Final tally. Reverts while voting is still open.
    /// @dev This only gates the convenience getter. `getProposal` and the `VoteCast` log expose a
    ///      running tally to anyone watching the chain — that is inherent to counting plaintext
    ///      ballots onchain, and it leaks nothing about *who* cast them. See NOTES.md.
    function result(uint256 proposalId) external view returns (uint64 yesVotes, uint64 noVotes, bool passed) {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert UnknownProposal();
        if (block.timestamp < p.deadline) revert VotingOpen();
        return (p.yesVotes, p.noVotes, p.yesVotes > p.noVotes);
    }
}
