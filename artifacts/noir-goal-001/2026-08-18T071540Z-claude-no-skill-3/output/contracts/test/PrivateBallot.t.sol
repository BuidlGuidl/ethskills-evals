// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MemberRegistry, IMembershipNFT} from "../src/MemberRegistry.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {PrivateBallot, IVerifier} from "../src/PrivateBallot.sol";
import {HonkVerifier} from "../src/verifier/HonkVerifier.sol";

/// @notice End-to-end test against a REAL UltraHonk proof.
///
/// @dev The fixture in test/fixtures/vote_proof.hex was produced by
///      `bb prove -t evm` over circuits/vote for this exact scenario:
///        members  = secrets 1, 2, 3 (commitments below)
///        voter    = the member holding secret 1, at leaf index 0
///        proposal = 1, vote = yes
///      Regenerate it with `npm run fixtures`.
///
///      This ties the whole stack together: the root asserted here is computed
///      by the Solidity registry, the proof was built by Noir against a Merkle
///      path assembled in JS, and it is checked by the generated verifier.
contract PrivateBallotTest is Test {
    // Commitments = tagged(1, secret, 0) for secrets 1, 2, 3.
    uint256 constant COMMITMENT_1 = 0x00d5eb26a4673c3bf5bb325d407fe1544f0325b97d4b68afa6a28851b6dbbbd2;
    uint256 constant COMMITMENT_2 = 0x0025709ff08e817e4d69c96350c24d3b65079a6416b07e8b7414e2a5a270a726;
    uint256 constant COMMITMENT_3 = 0x00489c8a9cebfada630e213007ccb8f47d05c192a32e495ad8e2c9f52f4984aa;

    uint256 constant EXPECTED_ROOT = 0x00acf6d4bf8a22a4e3412d7a79cd4d17b00bfc0bcf1345d880af8e4733cb8c19;
    // tagged(2, secret=1, proposalId=1)
    uint256 constant NULLIFIER = 0x00df92d62175d67607cc8aab61268e34e39c3407c7a4b2b2b172f05931f43d44;

    uint64 constant VOTING_PERIOD = 3 days;

    MembershipNFT internal nft;
    MemberRegistry internal registry;
    PrivateBallot internal ballot;
    HonkVerifier internal verifier;

    address internal admin = address(0xA11CE);
    /// @dev A throwaway key with no membership NFT: exactly who submits votes.
    address internal relayer = address(0xBEEF);

    bytes internal proof;

    function setUp() public {
        proof = vm.parseBytes(vm.readFile("test/fixtures/vote_proof.hex"));

        nft = new MembershipNFT();
        registry = new MemberRegistry(IMembershipNFT(address(nft)));
        verifier = new HonkVerifier();
        ballot = new PrivateBallot(registry, IVerifier(address(verifier)), admin, 3);

        uint256[3] memory commitments = [COMMITMENT_1, COMMITMENT_2, COMMITMENT_3];
        for (uint256 i = 0; i < 3; i++) {
            address member = address(uint160(0x2000 + i));
            nft.mint(member, i + 1);
            vm.prank(member);
            registry.register(i + 1, commitments[i]);
        }
    }

    /// @notice The on-chain root must equal the root the circuit proved against.
    function test_onchainRootMatchesProvenRoot() public view {
        assertEq(registry.root(), EXPECTED_ROOT);
    }

    function _openProposal() internal returns (uint256 proposalId) {
        vm.prank(admin);
        proposalId = ballot.createProposal("Fund the grants program?", VOTING_PERIOD);
    }

    function test_anonymousVoteIsAcceptedAndCounted() public {
        uint256 proposalId = _openProposal();

        // Submitted by a wallet that holds no NFT and never registered.
        vm.prank(relayer);
        ballot.castVote(proposalId, NULLIFIER, 1, proof);

        assertEq(ballot.turnout(proposalId), 1);
        assertTrue(ballot.nullifierSpent(proposalId, NULLIFIER));

        vm.warp(block.timestamp + VOTING_PERIOD);
        (uint256 yes, uint256 no) = ballot.tally(proposalId);
        assertEq(yes, 1);
        assertEq(no, 0);
    }

    /// @notice One member, one vote: the nullifier blocks a replay even though
    ///         nobody knows which member it belongs to.
    function test_sameNullifierCannotVoteTwice() public {
        uint256 proposalId = _openProposal();

        vm.prank(relayer);
        ballot.castVote(proposalId, NULLIFIER, 1, proof);

        vm.prank(address(0xCAFE));
        vm.expectRevert(PrivateBallot.AlreadyVoted.selector);
        ballot.castVote(proposalId, NULLIFIER, 1, proof);
    }

    /// @notice A relayer cannot flip the vote it is carrying: `support` is a
    ///         public input, so changing it invalidates the proof.
    function test_relayerCannotFlipTheVote() public {
        uint256 proposalId = _openProposal();

        vm.prank(relayer);
        vm.expectRevert(PrivateBallot.InvalidProof.selector);
        ballot.castVote(proposalId, NULLIFIER, 0, proof);
    }

    /// @notice Nor can it re-target the proof at a different proposal.
    function test_proofCannotBeReplayedOnAnotherProposal() public {
        _openProposal();
        vm.prank(admin);
        uint256 second = ballot.createProposal("Unrelated proposal", VOTING_PERIOD);

        vm.prank(relayer);
        vm.expectRevert(PrivateBallot.InvalidProof.selector);
        ballot.castVote(second, NULLIFIER, 1, proof);
    }

    function test_madeUpNullifierIsRejected() public {
        uint256 proposalId = _openProposal();

        vm.prank(relayer);
        vm.expectRevert(PrivateBallot.InvalidProof.selector);
        ballot.castVote(proposalId, NULLIFIER + 1, 1, proof);
    }

    function test_votingClosesAtDeadline() public {
        uint256 proposalId = _openProposal();
        vm.warp(block.timestamp + VOTING_PERIOD);

        vm.prank(relayer);
        vm.expectRevert(PrivateBallot.VotingClosed.selector);
        ballot.castVote(proposalId, NULLIFIER, 1, proof);
    }

    function test_tallyIsSealedUntilTheDeadline() public {
        uint256 proposalId = _openProposal();
        vm.expectRevert(PrivateBallot.VotingStillOpen.selector);
        ballot.tally(proposalId);

        vm.warp(block.timestamp + VOTING_PERIOD);
        ballot.tally(proposalId);
    }

    function test_onlyAdminOpensProposals() public {
        vm.prank(relayer);
        vm.expectRevert(PrivateBallot.NotAdmin.selector);
        ballot.createProposal("Sneaky", VOTING_PERIOD);
    }

    /// @notice A proposal cannot open against a member set too small to hide in.
    function test_proposalRejectedWhenAnonymitySetTooSmall() public {
        MemberRegistry freshRegistry = new MemberRegistry(IMembershipNFT(address(nft)));
        PrivateBallot strict = new PrivateBallot(freshRegistry, IVerifier(address(verifier)), admin, 10);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(PrivateBallot.AnonymitySetTooSmall.selector, 0, 10));
        strict.createProposal("Too early", VOTING_PERIOD);
    }

    /// @notice Members who join after a proposal opens cannot vote on it, so the
    ///         anonymity set a voter reasoned about cannot be changed underneath them.
    function test_proposalRootIsSnapshotAtCreation() public {
        uint256 proposalId = _openProposal();

        address latecomer = address(0x3000);
        nft.mint(latecomer, 99);
        vm.prank(latecomer);
        registry.register(99, uint256(keccak256("late")) >> 8);

        assertTrue(registry.root() != EXPECTED_ROOT);
        assertEq(ballot.getProposal(proposalId).memberRoot, EXPECTED_ROOT);

        // The existing proof still verifies against the snapshotted root.
        vm.prank(relayer);
        ballot.castVote(proposalId, NULLIFIER, 1, proof);
        assertEq(ballot.turnout(proposalId), 1);
    }
}
