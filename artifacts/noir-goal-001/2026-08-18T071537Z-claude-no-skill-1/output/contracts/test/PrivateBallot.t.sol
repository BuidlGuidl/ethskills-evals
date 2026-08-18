// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Keccak248} from "../src/Keccak248.sol";
import {MemberSet} from "../src/MemberSet.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {PrivateBallot, IHonkVerifier} from "../src/PrivateBallot.sol";
import {MockVerifier} from "./mocks/MockVerifier.sol";

contract PrivateBallotTest is Test {
    MembershipNFT nft;
    MemberSet set;
    MockVerifier verifier;
    PrivateBallot ballot;

    address constant ADMIN = address(0xA11CE);
    address constant ALICE = address(0xA1);
    address constant BOB = address(0xB0);
    /// A wallet that holds no membership NFT -- the one that should be sending
    /// ballots, precisely because it is nobody in particular.
    address constant RELAYER = address(0x9E1A);

    uint64 deadline;
    uint256 proposalId;

    function setUp() public {
        vm.warp(1_800_000_000);
        vm.prank(ADMIN);
        nft = new MembershipNFT(ADMIN);
        set = new MemberSet(nft);
        verifier = new MockVerifier();
        ballot = new PrivateBallot(IHonkVerifier(address(verifier)), set);

        _enroll(ALICE, 0xA11);
        _enroll(BOB, 0xB0B);

        deadline = uint64(block.timestamp + 3 days);
        vm.prank(ALICE);
        proposalId = ballot.createProposal(keccak256("raise the treasury cap"), deadline);
    }

    function _enroll(address who, uint256 secretish) internal {
        vm.prank(ADMIN);
        uint256 tokenId = nft.mint(who);
        vm.prank(who);
        set.enroll(tokenId, Keccak248.hash2(bytes32(secretish), bytes32(uint256(1))));
    }

    /// Mirrors what the member's node script builds and the circuit proves.
    function _ballotFor(uint256 id, uint8 choice, bytes32 nullifier)
        internal
        view
        returns (bytes memory proof)
    {
        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = ballot.getProposal(id).memberRoot;
        publicInputs[1] = ballot.proposalTag(id);
        publicInputs[2] = nullifier;
        publicInputs[3] = bytes32(uint256(choice));
        return verifier.proofFor(publicInputs);
    }

    // ------------------------------------------------------------- proposals

    function test_ProposalSnapshotsTheMemberSet() public view {
        PrivateBallot.Proposal memory p = ballot.getProposal(proposalId);
        assertEq(p.memberRoot, set.root());
        assertEq(p.memberCount, 2);
        assertEq(p.deadline, deadline);
    }

    /// Members who enrol after a proposal opens are not under its root, so the
    /// DAO cannot pad the set mid-vote -- and cannot shrink it either.
    function test_LaterEnrolmentsDoNotChangeAnOpenProposal() public {
        bytes32 rootAtCreation = ballot.getProposal(proposalId).memberRoot;
        _enroll(address(0xC0C0), 0xC0C0);
        assertTrue(set.root() != rootAtCreation);
        assertEq(ballot.getProposal(proposalId).memberRoot, rootAtCreation);
    }

    function test_OnlyMembersCanOpenProposals() public {
        vm.prank(RELAYER);
        vm.expectRevert(PrivateBallot.NotAMember.selector);
        ballot.createProposal(keccak256("hostile takeover"), deadline);
    }

    function test_RejectsADeadlineInThePast() public {
        vm.prank(ALICE);
        vm.expectRevert(PrivateBallot.DeadlineInPast.selector);
        ballot.createProposal(keccak256("too late"), uint64(block.timestamp));
    }

    /// A proof made for one deployment must be worthless in another, or two
    /// DAOs running this code could match each other's nullifiers up.
    function test_ProposalTagIsBoundToThisContract() public {
        PrivateBallot other = new PrivateBallot(IHonkVerifier(address(verifier)), set);
        assertTrue(ballot.proposalTag(0) != other.proposalTag(0));
        assertTrue(ballot.proposalTag(0) != ballot.proposalTag(1));
        assertLt(uint256(ballot.proposalTag(0)), 2 ** 248);
    }

    // ----------------------------------------------------------------- votes

    /// The whole point: the ballot lands, and it is sent by an address that
    /// holds no membership token at all.
    function test_AnyoneCanCarryABallot() public {
        bytes32 nullifier = keccak256("alice/proposal-0");
        vm.prank(RELAYER);
        ballot.castVote(proposalId, 1, nullifier, _ballotFor(proposalId, 1, nullifier));

        PrivateBallot.Proposal memory p = ballot.getProposal(proposalId);
        assertEq(p.yesVotes, 1);
        assertEq(p.noVotes, 0);
        assertTrue(ballot.nullifierSpent(proposalId, nullifier));
        assertEq(nft.balanceOf(RELAYER), 0);
    }

    function test_TalliesNoVotes() public {
        bytes32 nullifier = keccak256("bob/proposal-0");
        vm.prank(RELAYER);
        ballot.castVote(proposalId, 0, nullifier, _ballotFor(proposalId, 0, nullifier));
        assertEq(ballot.getProposal(proposalId).noVotes, 1);
    }

    function test_OneBallotPerNullifier() public {
        bytes32 nullifier = keccak256("alice/proposal-0");
        bytes memory yesProof = _ballotFor(proposalId, 1, nullifier);
        bytes memory noProof = _ballotFor(proposalId, 0, nullifier);

        vm.startPrank(RELAYER);
        ballot.castVote(proposalId, 1, nullifier, yesProof);
        vm.expectRevert(PrivateBallot.NullifierAlreadySpent.selector);
        ballot.castVote(proposalId, 0, nullifier, noProof);
        vm.stopPrank();
    }

    /// The choice is a public input, so a relayer holding someone's ballot
    /// cannot resubmit it as the opposite vote.
    function test_ARelayerCannotFlipAChoice() public {
        bytes32 nullifier = keccak256("alice/proposal-0");
        bytes memory yesProof = _ballotFor(proposalId, 1, nullifier);
        vm.prank(RELAYER);
        vm.expectRevert(PrivateBallot.InvalidProof.selector);
        ballot.castVote(proposalId, 0, nullifier, yesProof);
    }

    function test_ABallotCannotBeMovedToAnotherProposal() public {
        vm.prank(ALICE);
        uint256 other = ballot.createProposal(keccak256("second"), deadline);
        bytes32 nullifier = keccak256("alice/proposal-0");
        bytes memory proof = _ballotFor(proposalId, 1, nullifier);
        vm.prank(RELAYER);
        vm.expectRevert(PrivateBallot.InvalidProof.selector);
        ballot.castVote(other, 1, nullifier, proof);
    }

    function test_RejectsANonBinaryChoice() public {
        bytes32 nullifier = keccak256("alice/proposal-0");
        bytes memory proof = _ballotFor(proposalId, 2, nullifier);
        vm.prank(RELAYER);
        vm.expectRevert(PrivateBallot.InvalidChoice.selector);
        ballot.castVote(proposalId, 2, nullifier, proof);
    }

    function test_RejectsGarbageProofs() public {
        bytes32 nullifier = keccak256("alice/proposal-0");
        vm.prank(RELAYER);
        vm.expectRevert(PrivateBallot.InvalidProof.selector);
        ballot.castVote(proposalId, 1, nullifier, hex"deadbeef");
    }

    function test_RejectsVotesAfterTheDeadline() public {
        bytes32 nullifier = keccak256("alice/proposal-0");
        bytes memory proof = _ballotFor(proposalId, 1, nullifier);
        vm.warp(deadline + 1);
        vm.prank(RELAYER);
        vm.expectRevert(PrivateBallot.VotingClosed.selector);
        ballot.castVote(proposalId, 1, nullifier, proof);
    }

    // --------------------------------------------------------------- batches

    function test_BatchCountsEveryFreshBallot() public {
        PrivateBallot.Ballot[] memory batch = new PrivateBallot.Ballot[](3);
        batch[0] = _mk(1, keccak256("n1"));
        batch[1] = _mk(0, keccak256("n2"));
        batch[2] = _mk(1, keccak256("n3"));

        vm.prank(RELAYER);
        assertEq(ballot.castVotes(proposalId, batch), 3);

        PrivateBallot.Proposal memory p = ballot.getProposal(proposalId);
        assertEq(p.yesVotes, 2);
        assertEq(p.noVotes, 1);
    }

    /// Front-running one ballot out of a batch must not take the batch down
    /// with it, or anyone watching the mempool could stall a vote.
    function test_BatchSkipsAlreadySpentNullifiersInsteadOfReverting() public {
        bytes32 spent = keccak256("n1");
        vm.prank(RELAYER);
        ballot.castVote(proposalId, 1, spent, _ballotFor(proposalId, 1, spent));

        PrivateBallot.Ballot[] memory batch = new PrivateBallot.Ballot[](2);
        batch[0] = _mk(1, spent);
        batch[1] = _mk(0, keccak256("n2"));

        vm.prank(RELAYER);
        assertEq(ballot.castVotes(proposalId, batch), 1);
        assertEq(ballot.getProposal(proposalId).noVotes, 1);
        assertEq(ballot.getProposal(proposalId).yesVotes, 1);
    }

    function _mk(uint8 choice, bytes32 nullifier) internal view returns (PrivateBallot.Ballot memory) {
        return PrivateBallot.Ballot({
            choice: choice,
            nullifier: nullifier,
            proof: _ballotFor(proposalId, choice, nullifier)
        });
    }

    // ---------------------------------------------------------------- tally

    function test_TallyIsSealedUntilTheDeadline() public {
        vm.expectRevert(PrivateBallot.VotingOpen.selector);
        ballot.result(proposalId);
    }

    function test_AnyoneReadsTheTallyAfterTheDeadline() public {
        PrivateBallot.Ballot[] memory batch = new PrivateBallot.Ballot[](3);
        batch[0] = _mk(1, keccak256("n1"));
        batch[1] = _mk(1, keccak256("n2"));
        batch[2] = _mk(0, keccak256("n3"));
        vm.prank(RELAYER);
        ballot.castVotes(proposalId, batch);

        vm.warp(deadline + 1);
        vm.prank(address(0xDEAD));
        (uint64 yes, uint64 no, bool passed) = ballot.result(proposalId);
        assertEq(yes, 2);
        assertEq(no, 1);
        assertTrue(passed);
    }

    function test_UnknownProposalsRevert() public {
        vm.expectRevert(PrivateBallot.NoSuchProposal.selector);
        ballot.getProposal(99);
        vm.expectRevert(PrivateBallot.NoSuchProposal.selector);
        ballot.castVote(99, 1, bytes32(uint256(1)), hex"00");
    }
}
