// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {InternalLeanIMT, LeanIMTData} from "@zk-kit/lean-imt.sol/InternalLeanIMT.sol";
import {SNARK_SCALAR_FIELD} from "@zk-kit/lean-imt.sol/Constants.sol";
import {IVerifier} from "./verifier/HonkVerifier.sol";

/// @title AnonVoting
/// @notice Yes/no governance votes for holders of a public membership NFT, where the
///         chain records *that* a member voted and *what* was voted, but not *which*
///         member cast which vote.
///
/// Flow
///   1. register     — sent by the member's NFT wallet, once per tokenId (not per proposal).
///                     Publishes a Poseidon commitment to a secret only the member knows.
///   2. createProposal — sent by any member wallet. Snapshots the member-tree root, so
///                     every voter proves against the same anonymity set.
///   3. castVote     — sent by a relayer (never the member's wallet). Carries a ZK proof
///                     "I own one of the commitments in the snapshot" plus a per-proposal
///                     nullifier hash that blocks double voting without identifying anyone.
///   4. tally        — anyone reads counts; `closed` tells you whether they are final.
contract AnonVoting {
    using InternalLeanIMT for LeanIMTData;

    struct Proposal {
        uint256 memberRoot; // member-tree root at creation: the anonymity set for this vote
        uint256 externalNullifier; // scopes nullifier hashes to this proposal on this deployment
        bytes32 descriptionHash; // keccak256 of the off-chain proposal text
        uint64 deadline;
        uint32 memberCount; // leaves in the snapshot = size of the anonymity set
        uint32 yes;
        uint32 no;
    }

    IERC721 public immutable membership;
    IVerifier public immutable verifier;
    /// @notice Proposals cannot be opened until at least this many members have registered.
    ///         Small trees make "anonymous" votes trivially attributable.
    uint256 public immutable minAnonymitySet;

    LeanIMTData internal tree;

    /// @notice tokenId => current commitment (0 if never registered). One seat per NFT,
    ///         so transferring an NFT to a new wallet cannot mint a second seat.
    mapping(uint256 => uint256) public commitmentOf;
    /// @notice Wallets that have ever registered a commitment. They are refused as vote
    ///         senders because a vote sent from them is attributable by construction.
    mapping(address => bool) public isRegistrant;

    Proposal[] internal _proposals;
    /// @notice nullifier hashes already spent. They are already proposal-scoped by the circuit.
    mapping(uint256 => bool) public nullifierUsed;

    event MemberRegistered(uint256 indexed tokenId, uint256 leafIndex, uint256 commitment, uint256 root);
    event MemberCommitmentReplaced(
        uint256 indexed tokenId, uint256 leafIndex, uint256 oldCommitment, uint256 newCommitment, uint256 root
    );
    event ProposalCreated(
        uint256 indexed proposalId,
        bytes32 descriptionHash,
        uint256 memberRoot,
        uint256 memberCount,
        uint256 externalNullifier,
        uint64 deadline
    );
    event VoteCast(uint256 indexed proposalId, uint256 nullifierHash, bool support);

    error NotTokenOwner();
    error AlreadyRegistered();
    error NotRegistered();
    error NotMember();
    error AnonymitySetTooSmall(uint256 size, uint256 required);
    error BadVotingPeriod();
    error UnknownProposal();
    error VotingClosed();
    error AlreadyVoted();
    error SenderIsLinkable();
    error InvalidProof();

    constructor(IERC721 _membership, IVerifier _verifier, uint256 _minAnonymitySet) {
        membership = _membership;
        verifier = _verifier;
        minAnonymitySet = _minAnonymitySet;
    }

    // ------------------------------------------------------------------ membership

    /// @notice Join the voter set. Sent by the wallet holding `tokenId`. Public: links
    ///         this wallet/tokenId to `commitment`, which is fine — the commitment reveals
    ///         nothing, and votes never reference it.
    function register(uint256 tokenId, uint256 commitment) external {
        if (membership.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (commitmentOf[tokenId] != 0) revert AlreadyRegistered();

        commitmentOf[tokenId] = commitment;
        isRegistrant[msg.sender] = true;
        uint256 leafIndex = tree.size;
        uint256 root = tree._insert(commitment); // reverts on 0, >= field, or duplicate
        emit MemberRegistered(tokenId, leafIndex, commitment, root);
    }

    /// @notice Replace the commitment of `tokenId` — for a new holder after an NFT
    ///         transfer, or a member who lost their secret. Only affects proposals created
    ///         afterwards; open proposals keep their snapshot. `siblingNodes` comes from
    ///         the offchain tree mirror.
    function replaceCommitment(uint256 tokenId, uint256 newCommitment, uint256[] calldata siblingNodes) external {
        if (membership.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        uint256 old = commitmentOf[tokenId];
        if (old == 0) revert NotRegistered();
        if (newCommitment == 0) revert NotRegistered();

        commitmentOf[tokenId] = newCommitment;
        isRegistrant[msg.sender] = true;
        uint256 leafIndex = tree._indexOf(old);
        uint256 root = tree._update(old, newCommitment, siblingNodes);
        emit MemberCommitmentReplaced(tokenId, leafIndex, old, newCommitment, root);
    }

    function memberRoot() external view returns (uint256) {
        return tree._root();
    }

    function memberCount() external view returns (uint256) {
        return tree.size;
    }

    // ------------------------------------------------------------------ proposals

    function createProposal(bytes32 descriptionHash, uint64 votingPeriod) external returns (uint256 proposalId) {
        if (membership.balanceOf(msg.sender) == 0) revert NotMember();
        if (votingPeriod == 0) revert BadVotingPeriod();
        uint256 size = tree.size;
        if (size < minAnonymitySet || size == 0) revert AnonymitySetTooSmall(size, minAnonymitySet);

        proposalId = _proposals.length;
        uint256 ext = externalNullifierFor(proposalId);
        uint64 deadline = uint64(block.timestamp) + votingPeriod;
        _proposals.push(
            Proposal({
                memberRoot: tree._root(),
                externalNullifier: ext,
                descriptionHash: descriptionHash,
                deadline: deadline,
                memberCount: uint32(size),
                yes: 0,
                no: 0
            })
        );
        emit ProposalCreated(proposalId, descriptionHash, tree._root(), size, ext, deadline);
    }

    /// @notice Per-proposal scope for nullifier hashes. Includes chain id and this
    ///         contract's address so the same member's tags on two deployments differ.
    function externalNullifierFor(uint256 proposalId) public view returns (uint256) {
        return uint256(keccak256(abi.encode(block.chainid, address(this), proposalId))) % SNARK_SCALAR_FIELD;
    }

    function proposalCount() external view returns (uint256) {
        return _proposals.length;
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        if (proposalId >= _proposals.length) revert UnknownProposal();
        return _proposals[proposalId];
    }

    // ------------------------------------------------------------------ voting

    /// @notice Cast an anonymous vote. MUST be sent by a relayer (or any wallet with no
    ///         onchain link to the member) — `msg.sender` is public. The contract refuses
    ///         the two obviously-linkable senders: NFT holders and registrants.
    /// @param nullifierHash Poseidon(Poseidon(2, externalNullifier), nullifier) from the proof.
    function castVote(uint256 proposalId, bool support, uint256 nullifierHash, bytes calldata proof) external {
        if (proposalId >= _proposals.length) revert UnknownProposal();
        Proposal storage p = _proposals[proposalId];
        if (block.timestamp >= p.deadline) revert VotingClosed();
        if (nullifierUsed[nullifierHash]) revert AlreadyVoted();
        if (isRegistrant[msg.sender] || membership.balanceOf(msg.sender) != 0) revert SenderIsLinkable();

        // The generated verifier reverts (with its own errors) on most bad proofs rather
        // than returning false; normalise both to InvalidProof.
        try verifier.verify(proof, _publicInputs(p, nullifierHash, support)) returns (bool ok) {
            if (!ok) revert InvalidProof();
        } catch {
            revert InvalidProof();
        }

        nullifierUsed[nullifierHash] = true;
        if (support) p.yes += 1;
        else p.no += 1;
        emit VoteCast(proposalId, nullifierHash, support);
    }

    /// @dev Order MUST match the `pub` parameters of circuits/vote/src/main.nr:
    ///      merkle_root, external_nullifier, nullifier_hash, vote.
    function _publicInputs(Proposal storage p, uint256 nullifierHash, bool support)
        internal
        view
        returns (bytes32[] memory inputs)
    {
        inputs = new bytes32[](4);
        inputs[0] = bytes32(p.memberRoot);
        inputs[1] = bytes32(p.externalNullifier);
        inputs[2] = bytes32(nullifierHash);
        inputs[3] = bytes32(uint256(support ? 1 : 0));
    }

    /// @notice Counts are public from the first vote (every VoteCast is onchain); they are
    ///         final once `closed` is true.
    function tally(uint256 proposalId) external view returns (uint256 yes, uint256 no, bool closed) {
        if (proposalId >= _proposals.length) revert UnknownProposal();
        Proposal storage p = _proposals[proposalId];
        return (p.yes, p.no, block.timestamp >= p.deadline);
    }
}
