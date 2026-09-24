// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {LeanIMT, LeanIMTData} from "lean-imt/LeanIMT.sol";
import {SNARK_SCALAR_FIELD} from "lean-imt/Constants.sol";
import {IBallotVerifier} from "./interfaces/IBallotVerifier.sol";

/// @title AnonymousVoting
/// @notice Yes/no DAO votes where ballots cannot be attributed to members.
///
/// Two phases, two different wallets:
///  1. `register` — sent ONCE by a member's (public) NFT wallet. It adds an
///     identity commitment Poseidon(1, Poseidon(idNullifier, idTrapdoor)) to a
///     LeanIMT. The commitment reveals nothing about the secret; it is the
///     member's entry in the anonymity set.
///  2. `castVote` — sent per proposal by ANY wallet (a relayer / unlinked
///     wallet, never the member wallet). It carries a ZK proof that "some
///     registered member" votes `support`, plus a per-proposal nullifier that
///     blocks a second ballot from the same member without identifying them.
///
/// Each proposal freezes the tree root at creation (`snapshotRoot`), so the set
/// a voter hides in is exactly the members registered at that moment, and a
/// proposal cannot be opened while that set is smaller than `minAnonymitySet`.
contract AnonymousVoting {
    using LeanIMT for LeanIMTData;

    struct Proposal {
        bytes32 descriptionHash; // keccak256 of the proposal text published offchain
        uint256 snapshotRoot;    // membership root votes must prove against
        uint256 snapshotSize;    // members registered at creation (= anonymity set bound)
        uint256 scope;           // circuit `scope`: external nullifier for this proposal
        uint64 deadline;         // voting closes at this timestamp (exclusive)
        uint32 yes;
        uint32 no;
    }

    IERC721 public immutable membership;
    IBallotVerifier public immutable verifier;
    uint256 public immutable minAnonymitySet;

    LeanIMTData internal tree;
    mapping(uint256 tokenId => bool) public tokenRegistered;

    uint256 public proposalCount;
    mapping(uint256 proposalId => Proposal) internal proposals;
    mapping(uint256 proposalId => mapping(bytes32 nullifierHash => bool)) public nullifierUsed;

    /// Replayed by clients (scripts/lib/tree.mjs) to rebuild the tree and derive
    /// Merkle paths — the contract never hands out witnesses.
    event MemberRegistered(uint256 indexed tokenId, uint256 commitment, uint256 leafIndex, uint256 root);
    event ProposalCreated(
        uint256 indexed proposalId,
        bytes32 descriptionHash,
        uint256 snapshotRoot,
        uint256 snapshotSize,
        uint256 scope,
        uint64 deadline
    );
    /// Deliberately carries nothing about the sender: tx.from is a relayer.
    event VoteCast(uint256 indexed proposalId, bool support, bytes32 nullifierHash);

    error NotTokenOwner();
    error TokenAlreadyRegistered();
    error AnonymitySetTooSmall(uint256 size, uint256 required);
    error DeadlineInPast();
    error UnknownProposal();
    error VotingClosed();
    error VotingOpen();
    error AlreadyVoted();
    error InvalidNullifier();
    error InvalidProof();

    constructor(IERC721 membership_, IBallotVerifier verifier_, uint256 minAnonymitySet_) {
        membership = membership_;
        verifier = verifier_;
        minAnonymitySet = minAnonymitySet_;
    }

    // ---------------------------------------------------------------- members

    /// @notice One-time enrollment, sent from the member's NFT wallet. Publicly
    /// links wallet → commitment, which is fine: the commitment is a hiding
    /// hash, and nothing later refers to it except inside a ZK proof.
    /// @dev LeanIMT rejects zero, duplicate and out-of-field leaves.
    function register(uint256 tokenId, uint256 commitment) external {
        if (membership.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (tokenRegistered[tokenId]) revert TokenAlreadyRegistered();
        tokenRegistered[tokenId] = true;

        uint256 root = tree.insert(commitment);
        emit MemberRegistered(tokenId, commitment, tree.size - 1, root);
    }

    // -------------------------------------------------------------- proposals

    /// @notice Any member may open a proposal. The proposer is public (they
    /// send this tx from their NFT wallet); their eventual ballot is not.
    function createProposal(uint256 proposerTokenId, bytes32 descriptionHash, uint64 deadline)
        external
        returns (uint256 proposalId)
    {
        if (membership.ownerOf(proposerTokenId) != msg.sender) revert NotTokenOwner();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        uint256 size = tree.size;
        if (size < minAnonymitySet) revert AnonymitySetTooSmall(size, minAnonymitySet);

        proposalId = ++proposalCount;
        uint256 scope = scopeOf(proposalId);
        uint256 root = tree.root();
        proposals[proposalId] = Proposal({
            descriptionHash: descriptionHash,
            snapshotRoot: root,
            snapshotSize: size,
            scope: scope,
            deadline: deadline,
            yes: 0,
            no: 0
        });
        emit ProposalCreated(proposalId, descriptionHash, root, size, scope, deadline);
    }

    /// @notice External nullifier for a proposal. Bound to chain + this contract
    /// so a nullifier can't be replayed across deployments, and different per
    /// proposal so a member's ballots on different proposals are unlinkable.
    /// Shifted to 248 bits so it is always a valid BN254 field element.
    function scopeOf(uint256 proposalId) public view returns (uint256) {
        return uint256(keccak256(abi.encode(block.chainid, address(this), proposalId))) >> 8;
    }

    // ----------------------------------------------------------------- voting

    /// @notice Cast an anonymous ballot. Callable by anyone: `msg.sender` is
    /// intentionally ignored. The proof binds `support`, so the relayer who
    /// submits it can neither flip the vote nor re-target another proposal.
    function castVote(uint256 proposalId, bool support, bytes32 nullifierHash, bytes calldata proof) external {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert UnknownProposal();
        if (block.timestamp >= p.deadline) revert VotingClosed();
        // Must be a canonical field element: otherwise `n` and `n + r` would be
        // two distinct mapping keys for the same in-circuit nullifier.
        if (uint256(nullifierHash) >= SNARK_SCALAR_FIELD) revert InvalidNullifier();
        if (nullifierUsed[proposalId][nullifierHash]) revert AlreadyVoted();

        if (!verifier.verify(proof, _publicInputs(p, support, nullifierHash))) revert InvalidProof();

        nullifierUsed[proposalId][nullifierHash] = true;
        if (support) p.yes++;
        else p.no++;
        emit VoteCast(proposalId, support, nullifierHash);
    }

    /// Order MUST match the `pub` parameters of circuits/vote/src/main.nr.
    function _publicInputs(Proposal storage p, bool support, bytes32 nullifierHash)
        internal
        view
        returns (bytes32[] memory inputs)
    {
        inputs = new bytes32[](4);
        inputs[0] = bytes32(p.snapshotRoot); // merkle_root
        inputs[1] = bytes32(p.scope);        // scope
        inputs[2] = bytes32(uint256(support ? 1 : 0)); // vote
        inputs[3] = nullifierHash;           // nullifier_hash
    }

    // ------------------------------------------------------------------ views

    /// @notice Final tally, available once the deadline has passed.
    /// @dev Individual `VoteCast` events are public while voting is open, so
    ///      this gate is presentation only; it hides nothing from a chain reader.
    function tally(uint256 proposalId) external view returns (uint256 yes, uint256 no, uint256 eligible) {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert UnknownProposal();
        if (block.timestamp < p.deadline) revert VotingOpen();
        return (p.yes, p.no, p.snapshotSize);
    }

    function getProposal(uint256 proposalId)
        external
        view
        returns (bytes32 descriptionHash, uint256 snapshotRoot, uint256 snapshotSize, uint256 scope, uint64 deadline)
    {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert UnknownProposal();
        return (p.descriptionHash, p.snapshotRoot, p.snapshotSize, p.scope, p.deadline);
    }

    function memberCount() external view returns (uint256) {
        return tree.size;
    }

    function membershipRoot() external view returns (uint256) {
        return tree.root();
    }
}
