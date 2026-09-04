// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MemberRegistry} from "./MemberRegistry.sol";

interface IVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

/// @title PrivateBallot
/// @notice Yes/no DAO proposals where the tally is public but no vote can be
///         attributed to a member.
///
/// @dev The privacy argument, in one place:
///
///      * A vote carries no sender identity that matters. Anyone may submit any
///        valid proof, so `msg.sender` is a relayer or a throwaway key, not the
///        member. The contract never looks at `msg.sender` in `castVote`.
///      * A vote carries no member identity in its data either. The only
///        member-derived value on-chain is `nullifier = keccak(2, secret, id)`,
///        which is unlinkable to the member's registered
///        `commitment = keccak(1, secret, 0)` without the secret.
///      * Double voting is still blocked, because the nullifier is
///        deterministic in (secret, proposalId): the same member always produces
///        the same tag for a given proposal, and a different one for every other
///        proposal, so votes cannot be linked across proposals either.
///
///      What remains visible is the `support` bit of each individual vote, since
///      it sits in calldata and the contract must be able to add it up. See
///      NOTES.md -- hiding that too requires threshold decryption and therefore
///      a trusted committee, which is exactly what the DAO asked to avoid.
contract PrivateBallot {
    /// @notice Number of public inputs of the vote circuit.
    uint256 private constant PUBLIC_INPUT_COUNT = 4;

    MemberRegistry public immutable registry;
    IVerifier public immutable verifier;
    /// @notice May open proposals. Has no power over the outcome or over privacy.
    address public immutable admin;
    /// @notice A proposal cannot open unless at least this many members have
    ///         registered, so a vote is never hidden in a crowd of one.
    uint256 public immutable minAnonymitySet;

    struct Proposal {
        string description;
        uint256 memberRoot;
        uint64 votingEnds;
        uint64 anonymitySetSize;
        uint128 yesVotes;
        uint128 noVotes;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) private _proposals;
    /// @notice proposalId => nullifier => spent.
    mapping(uint256 => mapping(uint256 => bool)) public nullifierSpent;

    event ProposalCreated(
        uint256 indexed proposalId,
        string description,
        uint256 memberRoot,
        uint64 votingEnds,
        uint64 anonymitySetSize
    );
    /// @dev Deliberately does NOT include the support bit. It is still readable
    ///      from calldata; not emitting it avoids handing indexers a
    ///      pre-decoded, easily joined stream of votes.
    event VoteCast(uint256 indexed proposalId, uint256 nullifier);

    error NotAdmin();
    error NoSuchProposal();
    error VotingClosed();
    error VotingStillOpen();
    error AlreadyVoted();
    error InvalidSupport();
    error InvalidProof();
    error AnonymitySetTooSmall(uint256 have, uint256 need);
    error BadVotingPeriod();

    constructor(MemberRegistry registry_, IVerifier verifier_, address admin_, uint256 minAnonymitySet_) {
        registry = registry_;
        verifier = verifier_;
        admin = admin_;
        minAnonymitySet = minAnonymitySet_;
    }

    /// @notice Open a proposal. Sent by the DAO admin wallet.
    /// @dev Snapshots the current member root. Members who register later cannot
    ///      vote on this proposal, which also stops anyone from growing the tree
    ///      mid-vote to change the anonymity set under a voter's feet.
    function createProposal(string calldata description, uint64 votingPeriodSeconds)
        external
        returns (uint256 proposalId)
    {
        if (msg.sender != admin) revert NotAdmin();
        if (votingPeriodSeconds == 0) revert BadVotingPeriod();

        uint256 members = registry.memberCount();
        if (members < minAnonymitySet) revert AnonymitySetTooSmall(members, minAnonymitySet);

        proposalId = ++proposalCount;
        uint64 votingEnds = uint64(block.timestamp) + votingPeriodSeconds;

        _proposals[proposalId] = Proposal({
            description: description,
            memberRoot: registry.root(),
            votingEnds: votingEnds,
            anonymitySetSize: uint64(members),
            yesVotes: 0,
            noVotes: 0
        });

        emit ProposalCreated(proposalId, description, registry.root(), votingEnds, uint64(members));
    }

    /// @notice Cast one anonymous vote.
    /// @dev Callable by ANY address. The caller is a relayer or a fresh key with
    ///      no link to the member; `msg.sender` is intentionally unused.
    /// @param proposalId Proposal being voted on.
    /// @param nullifier keccak(2, secret, proposalId), proven inside the circuit.
    /// @param support 1 = yes, 0 = no.
    /// @param proof UltraHonk proof over (memberRoot, proposalId, nullifier, support).
    function castVote(uint256 proposalId, uint256 nullifier, uint8 support, bytes calldata proof) external {
        Proposal storage p = _proposals[proposalId];
        if (p.votingEnds == 0) revert NoSuchProposal();
        if (block.timestamp >= p.votingEnds) revert VotingClosed();
        if (support > 1) revert InvalidSupport();
        if (nullifierSpent[proposalId][nullifier]) revert AlreadyVoted();

        // Order must match the `pub` parameter order of circuits/vote/src/main.nr.
        bytes32[] memory publicInputs = new bytes32[](PUBLIC_INPUT_COUNT);
        publicInputs[0] = bytes32(p.memberRoot);
        publicInputs[1] = bytes32(proposalId);
        publicInputs[2] = bytes32(nullifier);
        publicInputs[3] = bytes32(uint256(support));

        // The generated Honk verifier signals a bad proof by reverting (e.g.
        // SumcheckFailed) rather than by returning false. Normalise both paths
        // to one error so callers get a predictable failure either way.
        try verifier.verify(proof, publicInputs) returns (bool ok) {
            if (!ok) revert InvalidProof();
        } catch {
            revert InvalidProof();
        }

        // Mark spent before mutating the tally; the nullifier is what makes this
        // one-member-one-vote without knowing which member.
        nullifierSpent[proposalId][nullifier] = true;

        unchecked {
            if (support == 1) {
                p.yesVotes += 1;
            } else {
                p.noVotes += 1;
            }
        }

        emit VoteCast(proposalId, nullifier);
    }

    /// @notice Final tally. Readable by anyone once voting has closed.
    function tally(uint256 proposalId) external view returns (uint256 yesVotes, uint256 noVotes) {
        Proposal storage p = _proposals[proposalId];
        if (p.votingEnds == 0) revert NoSuchProposal();
        if (block.timestamp < p.votingEnds) revert VotingStillOpen();
        return (p.yesVotes, p.noVotes);
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        Proposal storage p = _proposals[proposalId];
        if (p.votingEnds == 0) revert NoSuchProposal();
        return p;
    }

    /// @notice How many votes have been cast, without revealing the split while
    ///         voting is open.
    function turnout(uint256 proposalId) external view returns (uint256) {
        Proposal storage p = _proposals[proposalId];
        if (p.votingEnds == 0) revert NoSuchProposal();
        return uint256(p.yesVotes) + uint256(p.noVotes);
    }
}
