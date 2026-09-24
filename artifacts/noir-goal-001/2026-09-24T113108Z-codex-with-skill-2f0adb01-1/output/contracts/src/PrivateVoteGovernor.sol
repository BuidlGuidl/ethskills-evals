// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {LeanIMT, LeanIMTData} from "node_modules/@zk-kit/lean-imt.sol/LeanIMT.sol";
import {SNARK_SCALAR_FIELD} from "node_modules/@zk-kit/lean-imt.sol/Constants.sol";
import {IHonkVerifier} from "./interfaces/IHonkVerifier.sol";

interface IERC721Balance {
    function balanceOf(address owner) external view returns (uint256);
}

contract PrivateVoteGovernor {
    using LeanIMT for LeanIMTData;

    uint256 public constant TREE_DEPTH = 8;
    uint256 public constant MAX_MEMBERS = 2 ** TREE_DEPTH;
    uint256 public constant DOMAIN_COMMITMENT = 1;
    uint256 public constant DOMAIN_NULLIFIER = 2;

    struct Proposal {
        uint64 joinDeadline;
        uint64 voteDeadline;
        uint256 yesVotes;
        uint256 noVotes;
        bool exists;
        LeanIMTData tree;
    }

    IHonkVerifier public immutable verifier;
    IERC721Balance public immutable membershipNft;
    address public immutable admin;
    uint256 public nextProposalId = 1;

    mapping(uint256 proposalId => Proposal proposal) private proposals;
    mapping(uint256 proposalId => mapping(address member => bool joined)) public hasJoined;
    mapping(uint256 proposalId => mapping(uint256 root => bool known)) public knownRoot;
    mapping(uint256 proposalId => mapping(uint256 nullifierHash => bool used)) public usedNullifier;

    event ProposalCreated(uint256 indexed proposalId, uint64 joinDeadline, uint64 voteDeadline);
    event CommitmentInserted(
        uint256 indexed proposalId,
        uint256 indexed leafIndex,
        uint256 commitment,
        uint256 root,
        address indexed memberWallet
    );
    event VoteCast(uint256 indexed proposalId, uint256 indexed nullifierHash, bool support, address indexed sender);

    error NotAdmin();
    error ProposalMissing();
    error BadDeadline();
    error JoinClosed();
    error VoteClosed();
    error NotMember();
    error AlreadyJoined();
    error ProposalFull();
    error FieldOutOfRange();
    error UnknownRoot();
    error NullifierUsed();
    error InvalidVoteChoice();
    error InvalidProof();
    error TallyNotFinal();

    constructor(address membershipNft_, address verifier_) {
        membershipNft = IERC721Balance(membershipNft_);
        verifier = IHonkVerifier(verifier_);
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    function createProposal(uint64 joinDeadline, uint64 voteDeadline) external onlyAdmin returns (uint256 proposalId) {
        if (block.timestamp >= joinDeadline || joinDeadline > voteDeadline) revert BadDeadline();

        proposalId = nextProposalId++;
        Proposal storage proposal = proposals[proposalId];
        proposal.joinDeadline = joinDeadline;
        proposal.voteDeadline = voteDeadline;
        proposal.exists = true;

        emit ProposalCreated(proposalId, joinDeadline, voteDeadline);
    }

    function joinProposal(uint256 proposalId, uint256 commitment) external returns (uint256 leafIndex, uint256 root) {
        Proposal storage proposal = _proposal(proposalId);

        if (block.timestamp > proposal.joinDeadline) revert JoinClosed();
        if (membershipNft.balanceOf(msg.sender) == 0) revert NotMember();
        if (hasJoined[proposalId][msg.sender]) revert AlreadyJoined();
        if (proposal.tree.size >= MAX_MEMBERS) revert ProposalFull();
        _requireField(commitment);

        hasJoined[proposalId][msg.sender] = true;
        leafIndex = proposal.tree.size;
        root = proposal.tree.insert(commitment);
        knownRoot[proposalId][root] = true;

        emit CommitmentInserted(proposalId, leafIndex, commitment, root, msg.sender);
    }

    function castVote(
        uint256 proposalId,
        uint256 merkleRoot,
        bool support,
        uint256 nullifierHash,
        bytes calldata proof
    ) external {
        Proposal storage proposal = _proposal(proposalId);

        if (block.timestamp > proposal.voteDeadline) revert VoteClosed();
        if (!knownRoot[proposalId][merkleRoot]) revert UnknownRoot();
        if (usedNullifier[proposalId][nullifierHash]) revert NullifierUsed();
        _requireField(proposalId);
        _requireField(merkleRoot);
        _requireField(nullifierHash);

        uint256 voteChoice = support ? 1 : 0;
        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = bytes32(merkleRoot);
        publicInputs[1] = bytes32(proposalId);
        publicInputs[2] = bytes32(voteChoice);
        publicInputs[3] = bytes32(nullifierHash);

        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        usedNullifier[proposalId][nullifierHash] = true;
        if (support) {
            proposal.yesVotes += 1;
        } else {
            proposal.noVotes += 1;
        }

        emit VoteCast(proposalId, nullifierHash, support, msg.sender);
    }

    function tally(uint256 proposalId) external view returns (uint256 yesVotes, uint256 noVotes, bool final_) {
        Proposal storage proposal = _proposal(proposalId);
        final_ = block.timestamp > proposal.voteDeadline;
        if (!final_) revert TallyNotFinal();
        return (proposal.yesVotes, proposal.noVotes, true);
    }

    function proposalInfo(uint256 proposalId)
        external
        view
        returns (uint64 joinDeadline, uint64 voteDeadline, uint256 yesVotes, uint256 noVotes, uint256 treeSize, uint256 root)
    {
        Proposal storage proposal = _proposal(proposalId);
        return (
            proposal.joinDeadline,
            proposal.voteDeadline,
            proposal.yesVotes,
            proposal.noVotes,
            proposal.tree.size,
            proposal.tree.root()
        );
    }

    function _proposal(uint256 proposalId) internal view returns (Proposal storage proposal) {
        proposal = proposals[proposalId];
        if (!proposal.exists) revert ProposalMissing();
    }

    function _requireField(uint256 value) internal pure {
        if (value == 0 || value >= SNARK_SCALAR_FIELD) revert FieldOutOfRange();
    }
}
