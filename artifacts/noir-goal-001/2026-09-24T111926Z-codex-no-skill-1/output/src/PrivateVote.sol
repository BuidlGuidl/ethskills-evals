// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface INoirVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

interface IMembershipNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract DemoMembershipNFT {
    string public constant name = "DAO Membership";
    string public constant symbol = "DAOM";

    address public immutable owner;
    uint256 public nextTokenId = 1;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error NotOwner();
    error InvalidRecipient();
    error TokenDoesNotExist();

    constructor() {
        owner = msg.sender;
    }

    function mint(address to) external returns (uint256 tokenId) {
        if (msg.sender != owner) revert NotOwner();
        if (to == address(0)) revert InvalidRecipient();

        tokenId = nextTokenId++;
        _owners[tokenId] = to;
        balanceOf[to] += 1;

        emit Transfer(address(0), to, tokenId);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address tokenOwner = _owners[tokenId];
        if (tokenOwner == address(0)) revert TokenDoesNotExist();
        return tokenOwner;
    }
}

contract PrivateVote {
    uint256 public constant TREE_DEPTH = 8;
    uint256 public constant MAX_LEAVES = 256;
    uint256 public constant FIELD_MODULUS =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    IMembershipNFT public immutable membership;
    INoirVerifier public verifier;
    address public owner;

    uint256 public leafCount;
    uint256[TREE_DEPTH] public filledSubtrees;
    mapping(uint256 => bool) public knownRoots;
    mapping(uint256 => bool) public registeredCommitments;
    mapping(uint256 => uint256) public tokenCommitment;

    struct Proposal {
        uint256 merkleRoot;
        uint64 deadline;
        uint64 yesVotes;
        uint64 noVotes;
        bool exists;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(uint256 => bool)) public nullifierUsed;

    event CommitmentRegistered(uint256 indexed tokenId, uint256 indexed commitment, uint256 leafIndex, uint256 root);
    event ProposalCreated(uint256 indexed proposalId, uint256 indexed merkleRoot, uint64 deadline);
    event VoteCast(uint256 indexed proposalId, uint256 indexed nullifier, uint8 vote);
    event VerifierUpdated(address indexed verifier);

    error NotOwner();
    error NotMemberTokenOwner();
    error AlreadyRegistered();
    error TreeFull();
    error UnknownRoot();
    error ProposalExists();
    error ProposalMissing();
    error DeadlinePassed();
    error VotingOpen();
    error NullifierAlreadyUsed();
    error InvalidVote();
    error InvalidProof();
    error InvalidFieldElement();
    error InvalidVerifier();

    constructor(IMembershipNFT membership_, INoirVerifier verifier_) {
        membership = membership_;
        verifier = verifier_;
        owner = msg.sender;

        uint256 zero = zeroValue();
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            filledSubtrees[i] = zero;
            zero = hash2(zero, zero);
        }
        knownRoots[zeroRoot()] = true;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setVerifier(INoirVerifier verifier_) external onlyOwner {
        if (address(verifier_) == address(0)) revert InvalidVerifier();
        verifier = verifier_;
        emit VerifierUpdated(address(verifier_));
    }

    function register(uint256 tokenId, uint256 commitment) external returns (uint256 leafIndex, uint256 root) {
        if (membership.ownerOf(tokenId) != msg.sender) revert NotMemberTokenOwner();
        if (commitment == 0 || commitment >= FIELD_MODULUS) revert InvalidFieldElement();
        if (tokenCommitment[tokenId] != 0 || registeredCommitments[commitment]) revert AlreadyRegistered();
        if (leafCount >= MAX_LEAVES) revert TreeFull();

        leafIndex = leafCount;
        leafCount += 1;
        tokenCommitment[tokenId] = commitment;
        registeredCommitments[commitment] = true;

        root = _insert(commitment, leafIndex);
        knownRoots[root] = true;

        emit CommitmentRegistered(tokenId, commitment, leafIndex, root);
    }

    function createProposal(uint256 proposalId, uint256 merkleRoot, uint64 deadline) external {
        if (!knownRoots[merkleRoot]) revert UnknownRoot();
        if (proposals[proposalId].exists) revert ProposalExists();
        if (deadline <= block.timestamp) revert DeadlinePassed();

        proposals[proposalId] =
            Proposal({merkleRoot: merkleRoot, deadline: deadline, yesVotes: 0, noVotes: 0, exists: true});

        emit ProposalCreated(proposalId, merkleRoot, deadline);
    }

    function castVote(uint256 proposalId, uint256 merkleRoot, uint256 nullifier, uint8 vote, bytes calldata proof)
        external
    {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.exists) revert ProposalMissing();
        if (block.timestamp >= proposal.deadline) revert DeadlinePassed();
        if (merkleRoot != proposal.merkleRoot || !knownRoots[merkleRoot]) revert UnknownRoot();
        if (nullifier >= FIELD_MODULUS) revert InvalidFieldElement();
        if (vote > 1) revert InvalidVote();
        if (nullifierUsed[proposalId][nullifier]) revert NullifierAlreadyUsed();

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = bytes32(proposalId);
        publicInputs[1] = bytes32(merkleRoot);
        publicInputs[2] = bytes32(nullifier);
        publicInputs[3] = bytes32(uint256(vote));

        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        nullifierUsed[proposalId][nullifier] = true;
        if (vote == 1) {
            proposal.yesVotes += 1;
        } else {
            proposal.noVotes += 1;
        }

        emit VoteCast(proposalId, nullifier, vote);
    }

    function tally(uint256 proposalId) external view returns (uint64 yesVotes, uint64 noVotes, bool final_) {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.exists) revert ProposalMissing();
        return (proposal.yesVotes, proposal.noVotes, block.timestamp >= proposal.deadline);
    }

    function currentRoot() external view returns (uint256 root) {
        root = _computeRootFromFilledSubtrees(leafCount);
    }

    function zeroRoot() public pure returns (uint256 root) {
        root = zeroValue();
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            root = hash2(root, root);
        }
    }

    function zeroValue() public pure returns (uint256) {
        return hash2(1, 0);
    }

    function hash2(uint256 left, uint256 right) public pure returns (uint256) {
        if (left >= FIELD_MODULUS || right >= FIELD_MODULUS) revert InvalidFieldElement();

        uint256 state = addmod(left, 3, FIELD_MODULUS);
        uint256 key = addmod(right, 3, FIELD_MODULUS);

        for (uint256 i = 0; i < 91; i++) {
            uint256 c = addmod(mulmod(i, i, FIELD_MODULUS), 7, FIELD_MODULUS);
            state = pow5(addmod(addmod(state, key, FIELD_MODULUS), c, FIELD_MODULUS));
        }

        return addmod(state, key, FIELD_MODULUS);
    }

    function _insert(uint256 leaf, uint256 index) private returns (uint256 root) {
        uint256 current = leaf;
        uint256 currentIndex = index;

        for (uint256 level = 0; level < TREE_DEPTH; level++) {
            if (currentIndex % 2 == 0) {
                filledSubtrees[level] = current;
                current = hash2(current, zeroAt(level));
            } else {
                current = hash2(filledSubtrees[level], current);
            }
            currentIndex /= 2;
        }

        root = current;
    }

    function _computeRootFromFilledSubtrees(uint256 count) private view returns (uint256 root) {
        root = zeroValue();
        uint256 currentIndex = count;
        for (uint256 level = 0; level < TREE_DEPTH; level++) {
            if (currentIndex % 2 == 0) {
                root = hash2(root, zeroAt(level));
            } else {
                root = hash2(filledSubtrees[level], root);
            }
            currentIndex /= 2;
        }
    }

    function zeroAt(uint256 level) public pure returns (uint256 value) {
        value = zeroValue();
        for (uint256 i = 0; i < level; i++) {
            value = hash2(value, value);
        }
    }

    function pow5(uint256 x) private pure returns (uint256) {
        uint256 x2 = mulmod(x, x, FIELD_MODULUS);
        uint256 x4 = mulmod(x2, x2, FIELD_MODULUS);
        return mulmod(x4, x, FIELD_MODULUS);
    }
}
