// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {Ballot} from "../src/Ballot.sol";
import {IMembership, MemberRegistry} from "../src/MemberRegistry.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {IVerifier} from "../src/verifiers/HonkVerifierBase.sol";
import {VoteVerifier} from "../src/verifiers/VoteVerifier.sol";

/// Always-agreeable verifier, so the ballot bookkeeping can be tested without
/// minting a fresh proof for every case. The real verifier gets its own test
/// at the bottom of this file.
contract YesVerifier is IVerifier {
    function verify(bytes calldata, bytes32[] calldata) external pure returns (bool) {
        return true;
    }
}

contract BallotTest is Test {
    uint32 constant MIN_ANONYMITY_SET = 8;
    uint64 constant MIN_PERIOD = 10 minutes;

    MembershipNFT nft;
    MemberRegistry registry;
    Ballot ballot;

    address proposer = address(0xA11CE);
    address relayer = address(0x2E14E4);

    function setUp() public {
        nft = new MembershipNFT("DAO Membership", "DAOM");
        registry = new MemberRegistry(IMembership(address(nft)), IVerifier(address(new YesVerifier())));
        ballot = new Ballot(
            registry, IMembership(address(nft)), IVerifier(address(new YesVerifier())), MIN_ANONYMITY_SET, MIN_PERIOD
        );
        nft.mint(proposer);
    }

    uint32 joined;

    function _joinMembers(uint32 count) internal {
        for (uint32 i = 0; i < count; i++) {
            address member = address(uint160(0x1000 + joined + i));
            nft.mint(member);
            vm.prank(member);
            registry.join(bytes32(uint256(0xC0FFEE + joined + i)), bytes32(uint256(0xB007 + joined + i)), "");
        }
        joined += count;
    }

    function _openProposal() internal returns (uint256) {
        vm.prank(proposer);
        return ballot.createProposal(keccak256("fund the grants program"), 1 hours);
    }

    // --- proposal creation --------------------------------------------------

    function test_proposalSnapshotsTheRegistry() public {
        _joinMembers(MIN_ANONYMITY_SET);
        bytes32 rootAtCreation = registry.root();

        uint256 id = _openProposal();
        (bytes32 root, uint32 count, uint64 deadline,) = ballot.proposalInfo(id);

        assertEq(root, rootAtCreation);
        assertEq(count, MIN_ANONYMITY_SET);
        assertEq(deadline, uint64(block.timestamp) + 1 hours);

        // Members who join later do not move the snapshot.
        _joinMembers(1);
        (bytes32 rootAfter,,,) = ballot.proposalInfo(id);
        assertEq(rootAfter, rootAtCreation);
    }

    function test_nonMemberCannotOpenAProposal() public {
        _joinMembers(MIN_ANONYMITY_SET);
        vm.prank(address(0xDEAD));
        vm.expectRevert(Ballot.NotAMember.selector);
        ballot.createProposal(keccak256("x"), 1 hours);
    }

    /// The whole scheme is pointless with a handful of members, so the
    /// contract refuses rather than quietly offering fake privacy.
    function test_proposalNeedsAnAnonymitySet() public {
        _joinMembers(MIN_ANONYMITY_SET - 1);
        vm.prank(proposer);
        vm.expectRevert(
            abi.encodeWithSelector(Ballot.AnonymitySetTooSmall.selector, MIN_ANONYMITY_SET - 1, MIN_ANONYMITY_SET)
        );
        ballot.createProposal(keccak256("x"), 1 hours);
    }

    function test_votingPeriodHasAFloor() public {
        _joinMembers(MIN_ANONYMITY_SET);
        vm.prank(proposer);
        vm.expectRevert(Ballot.VotingPeriodTooShort.selector);
        ballot.createProposal(keccak256("x"), MIN_PERIOD - 1);
    }

    // --- voting -------------------------------------------------------------

    function test_ballotsAreTalliedAndTheSenderIsIrrelevant() public {
        _joinMembers(MIN_ANONYMITY_SET);
        uint256 id = _openProposal();

        vm.prank(relayer);
        ballot.castVote(id, true, bytes32(uint256(1)), "");
        vm.prank(address(0xFEE));
        ballot.castVote(id, false, bytes32(uint256(2)), "");
        vm.prank(relayer);
        ballot.castVote(id, true, bytes32(uint256(3)), "");

        vm.warp(block.timestamp + 1 hours);
        (uint32 yes, uint32 no) = ballot.tally(id);
        assertEq(yes, 2);
        assertEq(no, 1);
    }

    function test_oneBallotPerNullifier() public {
        _joinMembers(MIN_ANONYMITY_SET);
        uint256 id = _openProposal();

        vm.startPrank(relayer);
        ballot.castVote(id, true, bytes32(uint256(1)), "");
        vm.expectRevert(Ballot.AlreadyVoted.selector);
        ballot.castVote(id, false, bytes32(uint256(1)), "");
        vm.stopPrank();
    }

    /// Nullifiers are per proposal, so the same member voting on a second
    /// proposal is not blocked — and the two ballots are not linkable.
    function test_nullifiersAreScopedToOneProposal() public {
        _joinMembers(MIN_ANONYMITY_SET);
        uint256 first = _openProposal();
        uint256 second = _openProposal();

        vm.startPrank(relayer);
        ballot.castVote(first, true, bytes32(uint256(1)), "");
        ballot.castVote(second, true, bytes32(uint256(1)), "");
        vm.stopPrank();

        assertTrue(ballot.proposalContext(first) != ballot.proposalContext(second));
    }

    function test_votingClosesAtTheDeadline() public {
        _joinMembers(MIN_ANONYMITY_SET);
        uint256 id = _openProposal();

        vm.warp(block.timestamp + 1 hours);
        vm.prank(relayer);
        vm.expectRevert(Ballot.VotingClosed.selector);
        ballot.castVote(id, true, bytes32(uint256(1)), "");
    }

    function test_tallyIsNotReadableWhileVotingIsOpen() public {
        _joinMembers(MIN_ANONYMITY_SET);
        uint256 id = _openProposal();

        vm.expectRevert(Ballot.VotingStillOpen.selector);
        ballot.tally(id);

        vm.warp(block.timestamp + 1 hours);
        ballot.tally(id); // now fine
    }

    function test_unknownProposalReverts() public {
        vm.expectRevert(Ballot.NoSuchProposal.selector);
        ballot.tally(0);
    }
}

/// The generated verifier against a proof the vote circuit actually produced
/// (test/fixtures/vote.json — regenerate with `node scripts/make-fixtures.mjs`).
/// Address-independent, so it stays valid however the tests above change.
contract VoteVerifierTest is Test {
    VoteVerifier verifier;

    bytes32 root;
    bytes32 proposalContext;
    bytes32 nullifier;
    bytes proof;

    function setUp() public {
        verifier = new VoteVerifier();
        string memory json = vm.readFile("test/fixtures/vote.json");
        root = vm.parseJsonBytes32(json, ".root");
        proposalContext = vm.parseJsonBytes32(json, ".proposalContext");
        nullifier = vm.parseJsonBytes32(json, ".nullifier");
        proof = vm.parseJsonBytes(json, ".proof");
    }

    function _publicInputs(bytes32 _root, bytes32 _context, uint256 _vote, bytes32 _nullifier)
        internal
        pure
        returns (bytes32[] memory inputs)
    {
        inputs = new bytes32[](4);
        inputs[0] = _root;
        inputs[1] = _context;
        inputs[2] = bytes32(_vote);
        inputs[3] = _nullifier;
    }

    function test_acceptsARealBallotProof() public view {
        assertTrue(verifier.verify(proof, _publicInputs(root, proposalContext, 1, nullifier)));
    }

    /// A relayer holding the proof cannot turn a yes into a no.
    function test_rejectsAFlippedVote() public {
        vm.expectRevert();
        verifier.verify(proof, _publicInputs(root, proposalContext, 0, nullifier));
    }

    /// Nor can it be replayed against another proposal...
    function test_rejectsAnotherProposalsContext() public {
        vm.expectRevert();
        verifier.verify(proof, _publicInputs(root, bytes32(uint256(proposalContext) ^ 1), 1, nullifier));
    }

    /// ...or another registry snapshot...
    function test_rejectsAnotherRoot() public {
        vm.expectRevert();
        verifier.verify(proof, _publicInputs(bytes32(uint256(root) ^ 1), proposalContext, 1, nullifier));
    }

    /// ...and the nullifier cannot be swapped to vote a second time.
    function test_rejectsASwappedNullifier() public {
        vm.expectRevert();
        verifier.verify(proof, _publicInputs(root, proposalContext, 1, bytes32(uint256(nullifier) ^ 1)));
    }

    function test_rejectsGarbage() public {
        vm.expectRevert();
        verifier.verify(new bytes(proof.length), _publicInputs(root, proposalContext, 1, nullifier));
    }
}
