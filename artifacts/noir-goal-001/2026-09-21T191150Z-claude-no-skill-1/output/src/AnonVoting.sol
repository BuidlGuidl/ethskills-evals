// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {IVerifier} from "./HonkVerifier.sol";

/// @title AnonVoting
/// @notice Yes/no voting where membership is public but individual votes are
///         not attributable.
///
///  - A member (holder of a membership NFT) registers once, from their member
///    wallet, publishing an identity commitment C = Poseidon(secret). This is
///    public: "wallet W / token T is member leaf C". It reveals nothing about
///    any future vote.
///  - Each proposal snapshots the member Merkle root at creation time. Everyone
///    voting on it proves membership against the same root, so all of them
///    share one anonymity set: every member registered before the proposal.
///  - A vote is a ZK proof that the sender knows the secret behind *some* leaf
///    of that root, plus a nullifier N = Poseidon(secret, scope(proposal)).
///    The contract rejects repeated nullifiers (one vote per member per
///    proposal) but cannot map N back to C, and nullifiers of the same member
///    on different proposals are unlinkable.
///  - Votes must be sent by a wallet unrelated to the member (a relayer).
///    castVote refuses senders that hold a membership NFT as a guard against
///    the most obvious way to de-anonymise yourself.
///
/// There is no owner and no admin function: nobody can add leaves without an
/// NFT, alter the tree, rewrite a snapshot, or read anything that the chain
/// does not already show everyone.
contract AnonVoting {
    /// BN254 scalar field; all public inputs to the circuit live in it.
    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    /// Must match TREE_DEPTH in circuits/vote/src/main.nr.
    uint256 public constant TREE_DEPTH = 16;
    uint256 public constant MAX_MEMBERS = 1 << TREE_DEPTH;

    IERC721 public immutable membership;
    IVerifier public immutable verifier;
    /// Proposals cannot be opened while fewer members than this have
    /// registered: the anonymity set of a vote is the registered set.
    uint256 public immutable minAnonymitySet;

    // ---------------------------------------------------------------- tree --
    uint256[TREE_DEPTH] internal zeros;
    uint256[TREE_DEPTH] internal filledSubtrees;
    uint256 public memberRoot;
    uint256 public memberCount;

    /// tokenId => commitment (0 = not registered). One registration per token.
    mapping(uint256 => uint256) public commitmentOfToken;
    mapping(uint256 => bool) public isCommitment;

    // ----------------------------------------------------------- proposals --
    struct Proposal {
        bytes32 descriptionHash; // hash of the off-chain proposal text
        uint64 deadline; // votes accepted while block.timestamp < deadline
        uint32 memberCount; // size of the snapshotted member set
        uint32 yes;
        uint32 no;
        uint256 root; // member root snapshotted at creation
        uint256 scope; // external nullifier for this proposal
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) internal proposals;

    /// Nullifiers are scoped per proposal inside the circuit, so one global
    /// set suffices.
    mapping(uint256 => bool) public nullifierUsed;

    // -------------------------------------------------------------- events --
    event MemberRegistered(uint256 indexed tokenId, uint256 commitment, uint256 leafIndex, uint256 newRoot);
    event ProposalCreated(
        uint256 indexed proposalId, bytes32 descriptionHash, uint256 root, uint256 memberCount, uint64 deadline
    );
    event VoteCast(uint256 indexed proposalId, uint256 nullifier, bool support);

    // -------------------------------------------------------------- errors --
    error NotTokenOwner();
    error TokenAlreadyRegistered();
    error InvalidCommitment();
    error TreeFull();
    error NotMember();
    error AnonymitySetTooSmall(uint256 have, uint256 need);
    error UnknownProposal();
    error VotingClosed();
    error VotingStillOpen();
    error NullifierAlreadyUsed();
    error InvalidNullifier();
    error InvalidProof();
    error SenderIsMember();

    constructor(IERC721 membership_, IVerifier verifier_, uint256 minAnonymitySet_) {
        membership = membership_;
        verifier = verifier_;
        minAnonymitySet = minAnonymitySet_;

        uint256 z = 0; // empty leaf
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            zeros[i] = z;
            filledSubtrees[i] = z;
            z = PoseidonT3.hash([z, z]);
        }
        memberRoot = z;
    }

    // ---------------------------------------------------------- membership --

    /// @notice Sent by the member's own NFT-holding wallet. Publicly links the
    ///         wallet/token to `commitment`; the secret behind it stays private.
    function register(uint256 tokenId, uint256 commitment) external returns (uint256 leafIndex) {
        if (membership.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (commitmentOfToken[tokenId] != 0) revert TokenAlreadyRegistered();
        if (commitment == 0 || commitment >= SNARK_SCALAR_FIELD || isCommitment[commitment]) {
            revert InvalidCommitment();
        }
        leafIndex = memberCount;
        if (leafIndex >= MAX_MEMBERS) revert TreeFull();

        commitmentOfToken[tokenId] = commitment;
        isCommitment[commitment] = true;

        uint256 node = commitment;
        uint256 idx = leafIndex;
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (idx & 1 == 0) {
                filledSubtrees[i] = node;
                node = PoseidonT3.hash([node, zeros[i]]);
            } else {
                node = PoseidonT3.hash([filledSubtrees[i], node]);
            }
            idx >>= 1;
        }
        memberRoot = node;
        memberCount = leafIndex + 1;

        emit MemberRegistered(tokenId, commitment, leafIndex, node);
    }

    // ----------------------------------------------------------- proposals --

    /// @notice Any current NFT holder may open a proposal. The creator is
    ///         public; that is unrelated to how anyone votes.
    function createProposal(bytes32 descriptionHash, uint64 votingPeriod) external returns (uint256 proposalId) {
        if (membership.balanceOf(msg.sender) == 0) revert NotMember();
        if (memberCount < minAnonymitySet) revert AnonymitySetTooSmall(memberCount, minAnonymitySet);

        proposalId = ++proposalCount;
        uint64 deadline = uint64(block.timestamp) + votingPeriod;
        proposals[proposalId] = Proposal({
            descriptionHash: descriptionHash,
            deadline: deadline,
            memberCount: uint32(memberCount),
            yes: 0,
            no: 0,
            root: memberRoot,
            scope: scopeOf(proposalId)
        });
        emit ProposalCreated(proposalId, descriptionHash, memberRoot, memberCount, deadline);
    }

    /// @notice External nullifier for a proposal, bound to this chain and
    ///         contract so proofs/nullifiers cannot be replayed elsewhere.
    function scopeOf(uint256 proposalId) public view returns (uint256) {
        return uint256(keccak256(abi.encode(block.chainid, address(this), proposalId))) % SNARK_SCALAR_FIELD;
    }

    // -------------------------------------------------------------- voting --

    /// @notice Permissionless: anyone may submit a valid proof. The member
    ///         should hand it to a relayer (or any unlinked account). The vote
    ///         is a public input of the proof, so the submitter cannot flip it.
    function castVote(uint256 proposalId, bool support, uint256 nullifier, bytes calldata proof) external {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert UnknownProposal();
        if (block.timestamp >= p.deadline) revert VotingClosed();
        // Footgun guard: a vote sent from a member wallet is attributed to it.
        if (membership.balanceOf(msg.sender) != 0 || membership.balanceOf(tx.origin) != 0) revert SenderIsMember();
        // Canonical field element only, so N and N + p cannot both be used.
        if (nullifier >= SNARK_SCALAR_FIELD) revert InvalidNullifier();
        if (nullifierUsed[nullifier]) revert NullifierAlreadyUsed();

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = bytes32(p.root);
        publicInputs[1] = bytes32(p.scope);
        publicInputs[2] = bytes32(uint256(support ? 1 : 0));
        publicInputs[3] = bytes32(nullifier);
        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        nullifierUsed[nullifier] = true;
        if (support) p.yes++;
        else p.no++;

        emit VoteCast(proposalId, nullifier, support);
    }

    // --------------------------------------------------------------- views --

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    /// @notice Final result, available once the deadline has passed.
    /// @dev Running counts are necessarily visible on-chain before that (see
    ///      NOTES.md); this function just refuses to call a result early.
    function tally(uint256 proposalId) external view returns (uint256 yes, uint256 no, uint256 eligible) {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert UnknownProposal();
        if (block.timestamp < p.deadline) revert VotingStillOpen();
        return (p.yes, p.no, p.memberCount);
    }
}
