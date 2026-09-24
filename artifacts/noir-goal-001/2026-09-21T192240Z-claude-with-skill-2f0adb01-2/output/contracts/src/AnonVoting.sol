// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {LeanIMT, LeanIMTData} from "@zk-kit/lean-imt.sol/LeanIMT.sol";

/// @dev Mirrors the bb-generated HonkVerifier ABI exactly.
interface IVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

interface IMembership {
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
}

/// @title AnonVoting
/// @notice Yes/no DAO votes where membership is public but individual votes are not.
///
/// Two phases, sent from two unrelated wallets:
///  1. register(): the member's *public* wallet (it holds the NFT) inserts a
///     hiding commitment Poseidon(1, Poseidon(n, t)) into a LeanIMT — once, reused
///     for every future proposal.
///  2. castVote(): *any* wallet (normally a relayer) submits a ZK proof that the
///     vote comes from some commitment in the proposal's snapshotted tree, plus a
///     per-proposal nullifier hash. msg.sender is never used, so the vote carries
///     no link to the member's wallet.
contract AnonVoting {
    using LeanIMT for LeanIMTData;

    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct Proposal {
        bytes32 descriptionHash; // hash of the proposal text published offchain
        uint64 deadline; // votes accepted while block.timestamp < deadline
        uint256 snapshotRoot; // member tree root when the proposal was created
        uint256 scope; // external nullifier: keccak(chainid, this, id) mod p
        uint128 yes;
        uint128 no;
    }

    IMembership public immutable membership;
    IVerifier public immutable verifier;
    /// @notice Proposals can only be created once at least this many members are
    /// registered — the registered set is each vote's anonymity set.
    uint256 public immutable minAnonymitySet;

    LeanIMTData internal tree;
    uint256 public activeMembers;
    mapping(uint256 tokenId => uint256 commitment) public commitmentOf;

    Proposal[] internal proposals;
    /// @dev Nullifier hashes already include the proposal scope, so one flat set suffices.
    mapping(uint256 nullifierHash => bool) public nullifierUsed;

    // Tree events: clients replay these, in log order, to rebuild the LeanIMT offchain.
    event MemberRegistered(uint256 indexed tokenId, uint256 indexed leafIndex, uint256 commitment, uint256 root);
    event MemberRotated(
        uint256 indexed tokenId, uint256 indexed leafIndex, uint256 oldCommitment, uint256 newCommitment, uint256 root
    );
    event MemberEvicted(uint256 indexed tokenId, uint256 indexed leafIndex, uint256 oldCommitment, uint256 root);

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        bytes32 descriptionHash,
        uint64 deadline,
        uint256 snapshotRoot,
        uint256 scope
    );
    event VoteCast(uint256 indexed proposalId, uint256 nullifierHash, bool support);

    error NotTokenOwner();
    error NotAMember();
    error AlreadyRegistered();
    error NotRegistered();
    error StillAMember();
    error InvalidCommitment();
    error AnonymitySetTooSmall();
    error BadVotingPeriod();
    error UnknownProposal();
    error VotingClosed();
    error VotingOpen();
    error AlreadyVoted();
    error InvalidNullifier();
    error InvalidProof();

    constructor(IMembership _membership, IVerifier _verifier, uint256 _minAnonymitySet) {
        membership = _membership;
        verifier = _verifier;
        minAnonymitySet = _minAnonymitySet;
    }

    // ------------------------------------------------------------ membership --

    /// @notice Sent by the member's NFT-holding wallet. Public: "token #id joined
    /// the anonymous voter set". The commitment reveals nothing about the secrets.
    function register(uint256 tokenId, uint256 commitment) external {
        if (membership.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (commitmentOf[tokenId] != 0) revert AlreadyRegistered();
        _checkCommitment(commitment);

        uint256 leafIndex = tree.size;
        uint256 root = tree.insert(commitment); // reverts on duplicates / >= p
        commitmentOf[tokenId] = commitment;
        activeMembers++;
        emit MemberRegistered(tokenId, leafIndex, commitment, root);
    }

    /// @notice Replace the commitment for a token: lost note, suspected leak, or
    /// the NFT changed hands (the new holder rotates, which evicts the previous
    /// holder's commitment from all *future* snapshots). Proposals already open
    /// keep their snapshot, so each token still gets one vote per proposal.
    /// @param siblings LeanIMT sibling path of the current leaf (from the offchain mirror).
    function rotate(uint256 tokenId, uint256 newCommitment, uint256[] calldata siblings) external {
        if (membership.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        uint256 old = commitmentOf[tokenId];
        if (old == 0) revert NotRegistered();
        _checkCommitment(newCommitment);

        uint256 leafIndex = tree.indexOf(old);
        uint256 root = tree.update(old, newCommitment, siblings);
        commitmentOf[tokenId] = newCommitment;
        emit MemberRotated(tokenId, leafIndex, old, newCommitment, root);
    }

    /// @notice Anyone may evict the commitment of a token that no longer exists
    /// (burned = member removed), so it drops out of future snapshots.
    function evict(uint256 tokenId, uint256[] calldata siblings) external {
        uint256 old = commitmentOf[tokenId];
        if (old == 0) revert NotRegistered();
        if (_tokenExists(tokenId)) revert StillAMember();

        uint256 leafIndex = tree.indexOf(old);
        uint256 root = tree.remove(old, siblings);
        delete commitmentOf[tokenId];
        activeMembers--;
        emit MemberEvicted(tokenId, leafIndex, old, root);
    }

    // ------------------------------------------------------------- proposals --

    /// @notice Any member may open a proposal. The current member root is frozen
    /// into it: only members registered *before* this call can vote on it.
    function createProposal(bytes32 descriptionHash, uint64 votingPeriod) external returns (uint256 proposalId) {
        if (membership.balanceOf(msg.sender) == 0) revert NotAMember();
        if (activeMembers < minAnonymitySet || activeMembers == 0) revert AnonymitySetTooSmall();
        if (votingPeriod == 0) revert BadVotingPeriod();

        proposalId = proposals.length;
        uint256 scope = uint256(keccak256(abi.encode(block.chainid, address(this), proposalId))) % SNARK_SCALAR_FIELD;
        uint64 deadline = uint64(block.timestamp) + votingPeriod;
        uint256 root = tree.root();

        proposals.push(
            Proposal({
                descriptionHash: descriptionHash,
                deadline: deadline,
                snapshotRoot: root,
                scope: scope,
                yes: 0,
                no: 0
            })
        );
        emit ProposalCreated(proposalId, msg.sender, descriptionHash, deadline, root, scope);
    }

    // ---------------------------------------------------------------- voting --

    /// @notice Permissionless: the proof, not msg.sender, authorises the vote.
    /// Meant to be sent by a relayer so the member's wallet never appears.
    function castVote(uint256 proposalId, bool support, uint256 nullifierHash, bytes calldata proof) external {
        Proposal storage p = _proposal(proposalId);
        if (block.timestamp >= p.deadline) revert VotingClosed();
        // A value >= p would alias nullifierHash - p inside the field and allow a double vote.
        if (nullifierHash == 0 || nullifierHash >= SNARK_SCALAR_FIELD) revert InvalidNullifier();
        if (nullifierUsed[nullifierHash]) revert AlreadyVoted();

        // HonkVerifier reverts on most bad proofs; the check also covers a false return.
        if (!verifier.verify(proof, _publicInputs(p.snapshotRoot, p.scope, nullifierHash, support))) {
            revert InvalidProof();
        }

        nullifierUsed[nullifierHash] = true;
        if (support) p.yes++;
        else p.no++;
        emit VoteCast(proposalId, nullifierHash, support);
    }

    /// @notice Final tally, available once the deadline has passed.
    /// (Storage and VoteCast events are public, so this gate is a convenience,
    /// not secrecy — see NOTES.md on running-tally visibility.)
    function result(uint256 proposalId) external view returns (uint256 yes, uint256 no, bool passed) {
        Proposal storage p = _proposal(proposalId);
        if (block.timestamp < p.deadline) revert VotingOpen();
        return (p.yes, p.no, p.yes > p.no);
    }

    // ----------------------------------------------------------------- views --

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return _proposal(proposalId);
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    function memberRoot() external view returns (uint256) {
        return tree.root();
    }

    function memberTreeSize() external view returns (uint256) {
        return tree.size;
    }

    // -------------------------------------------------------------- internal --

    /// @dev Order MUST match the circuit's pub params: merkle_root, scope, nullifier_hash, vote.
    function _publicInputs(uint256 root, uint256 scope, uint256 nullifierHash, bool support)
        internal
        pure
        returns (bytes32[] memory inputs)
    {
        inputs = new bytes32[](4);
        inputs[0] = bytes32(root);
        inputs[1] = bytes32(scope);
        inputs[2] = bytes32(nullifierHash);
        inputs[3] = bytes32(uint256(support ? 1 : 0));
    }

    function _proposal(uint256 proposalId) internal view returns (Proposal storage) {
        if (proposalId >= proposals.length) revert UnknownProposal();
        return proposals[proposalId];
    }

    function _checkCommitment(uint256 commitment) internal pure {
        if (commitment == 0 || commitment >= SNARK_SCALAR_FIELD) revert InvalidCommitment();
    }

    function _tokenExists(uint256 tokenId) internal view returns (bool) {
        try membership.ownerOf(tokenId) returns (address owner) {
            return owner != address(0);
        } catch {
            return false;
        }
    }
}
