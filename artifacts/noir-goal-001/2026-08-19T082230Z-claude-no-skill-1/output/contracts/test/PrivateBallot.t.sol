// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

import {DevMembershipNFT} from "../src/dev/DevMembershipNFT.sol";
import {IHonkVerifier} from "../src/interfaces/IHonkVerifier.sol";
import {IMembershipNFT} from "../src/interfaces/IMembershipNFT.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {PrivateBallot} from "../src/PrivateBallot.sol";
import {MockVerifier} from "./mocks/MockVerifier.sol";

contract PrivateBallotTest is Test {
    DevMembershipNFT nft;
    MockVerifier joinVerifier;
    MockVerifier voteVerifier;
    MemberRegistry registry;
    PrivateBallot ballot;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address outsider = makeAddr("outsider");
    address relayer = makeAddr("relayer");

    bytes constant PROOF = hex"c0ffee";
    uint64 constant WEEK = 7 days;

    bytes32 emptyRoot;
    bytes32 rootAfterAlice = keccak256("root-1");
    bytes32 rootAfterBob = keccak256("root-2");

    function setUp() public {
        nft = new DevMembershipNFT(address(this));
        nft.mint(alice); // token 0
        nft.mint(bob); // token 1

        joinVerifier = new MockVerifier();
        voteVerifier = new MockVerifier();
        registry = new MemberRegistry(IMembershipNFT(address(nft)), IHonkVerifier(address(joinVerifier)));
        ballot = new PrivateBallot(registry, IHonkVerifier(address(voteVerifier)));
        emptyRoot = registry.EMPTY_ROOT();

        vm.prank(alice);
        registry.join(0, keccak256("alice"), emptyRoot, rootAfterAlice, PROOF);
    }

    function _openProposal() internal returns (uint256 proposalId) {
        vm.prank(alice);
        return ballot.createProposal(keccak256("fund the grants round"), WEEK);
    }

    // --------------------------------------------------------- proposals

    function test_snapshotsTheMembershipRootAtCreation() public {
        uint256 proposalId = _openProposal();

        // Bob joining afterwards must not change this proposal's anonymity set.
        vm.prank(bob);
        registry.join(1, keccak256("bob"), rootAfterAlice, rootAfterBob, PROOF);

        (bytes32 root,,, uint32 anonymitySetSize) = ballot.proposalInfo(proposalId);
        assertEq(root, rootAfterAlice);
        assertEq(anonymitySetSize, 1);
        assertEq(registry.root(), rootAfterBob);
    }

    function test_onlyMembersCanPropose() public {
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(PrivateBallot.NotAMember.selector, outsider));
        ballot.createProposal(keccak256("x"), WEEK);
    }

    function test_rejectsAVotingWindowTooShortToHideIn() public {
        uint64 minimum = ballot.MIN_VOTING_PERIOD();
        uint64 tooShort = minimum - 1;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PrivateBallot.VotingPeriodTooShort.selector, tooShort, minimum));
        ballot.createProposal(keccak256("x"), tooShort);
    }

    // ------------------------------------------------------------ voting

    /// The whole design rests on this: the submitter is irrelevant, so a member
    /// never has to reveal themselves by paying for their own ballot.
    function test_anyoneCanSubmitABallot() public {
        uint256 proposalId = _openProposal();

        vm.prank(relayer);
        ballot.castBallot(proposalId, true, keccak256("nullifier-a"), PROOF);

        vm.warp(block.timestamp + WEEK);
        (uint32 yes, uint32 no, uint32 turnout) = ballot.tally(proposalId);
        assertEq(yes, 1);
        assertEq(no, 0);
        assertEq(turnout, 1);
    }

    /// The snapshot root, the proposal binding and the direction all come from
    /// the contract. If the direction were not bound, a relayer could flip it.
    function test_bindsRootProposalAndDirectionIntoTheProof() public {
        uint256 proposalId = _openProposal();

        bytes32[] memory expected = new bytes32[](4);
        expected[0] = rootAfterAlice;
        expected[1] = ballot.externalNullifier(proposalId);
        expected[2] = keccak256("nullifier-a");
        expected[3] = bytes32(uint256(1)); // yes
        voteVerifier.expectPublicInputs(expected);

        vm.prank(relayer);
        ballot.castBallot(proposalId, true, keccak256("nullifier-a"), PROOF);

        // The same proof submitted as a "no" must not verify.
        vm.prank(relayer);
        vm.expectRevert(PrivateBallot.InvalidVoteProof.selector);
        ballot.castBallot(proposalId, false, keccak256("nullifier-b"), PROOF);
    }

    function test_countsNoVotes() public {
        uint256 proposalId = _openProposal();

        vm.prank(relayer);
        ballot.castBallot(proposalId, false, keccak256("nullifier-a"), PROOF);
        vm.prank(relayer);
        ballot.castBallot(proposalId, true, keccak256("nullifier-b"), PROOF);

        vm.warp(block.timestamp + WEEK);
        (uint32 yes, uint32 no,) = ballot.tally(proposalId);
        assertEq(yes, 1);
        assertEq(no, 1);
    }

    function test_rejectsASecondBallotWithTheSameNullifier() public {
        uint256 proposalId = _openProposal();

        vm.prank(relayer);
        ballot.castBallot(proposalId, true, keccak256("nullifier-a"), PROOF);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PrivateBallot.AlreadyVoted.selector, keccak256("nullifier-a")));
        ballot.castBallot(proposalId, false, keccak256("nullifier-a"), PROOF);
    }

    /// Nullifiers are per proposal, so the same member votes once on each.
    function test_theSameNullifierIsFreeOnAnotherProposal() public {
        uint256 first = _openProposal();
        uint256 second = _openProposal();

        vm.prank(relayer);
        ballot.castBallot(first, true, keccak256("nullifier-a"), PROOF);
        vm.prank(relayer);
        ballot.castBallot(second, true, keccak256("nullifier-a"), PROOF);

        assertTrue(ballot.nullifierSpent(first, keccak256("nullifier-a")));
        assertTrue(ballot.nullifierSpent(second, keccak256("nullifier-a")));
    }

    /// Different proposals get different bindings, which is what stops a proof
    /// for one being replayed onto another.
    function test_externalNullifierDiffersPerProposal() public {
        uint256 first = _openProposal();
        uint256 second = _openProposal();
        assertTrue(ballot.externalNullifier(first) != ballot.externalNullifier(second));
    }

    function test_rejectsABallotAfterTheDeadline() public {
        uint256 proposalId = _openProposal();
        (,, uint64 deadline,) = ballot.proposalInfo(proposalId);

        vm.warp(deadline);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PrivateBallot.VotingClosed.selector, proposalId, deadline));
        ballot.castBallot(proposalId, true, keccak256("nullifier-a"), PROOF);
    }

    function test_rejectsABadProof() public {
        uint256 proposalId = _openProposal();
        voteVerifier.setAccepts(false);

        vm.prank(relayer);
        vm.expectRevert(PrivateBallot.InvalidVoteProof.selector);
        ballot.castBallot(proposalId, true, keccak256("nullifier-a"), PROOF);
    }

    function test_rejectsAnUnknownProposal() public {
        vm.expectRevert(abi.encodeWithSelector(PrivateBallot.UnknownProposal.selector, 7));
        ballot.castBallot(7, true, keccak256("nullifier-a"), PROOF);
    }

    // ------------------------------------------------------------- tally

    function test_tallyIsClosedUntilTheDeadline() public {
        uint256 proposalId = _openProposal();
        (,, uint64 deadline,) = ballot.proposalInfo(proposalId);

        vm.expectRevert(abi.encodeWithSelector(PrivateBallot.VotingStillOpen.selector, proposalId, deadline));
        ballot.tally(proposalId);

        vm.warp(deadline);
        ballot.tally(proposalId); // no revert
    }
}
