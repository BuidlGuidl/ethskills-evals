// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TestBase} from "./TestBase.sol";
import {MemberRegistry, IMembershipNFT} from "../src/MemberRegistry.sol";
import {PrivateBallot, IHonkVerifier} from "../src/PrivateBallot.sol";
import {MembershipNFT} from "../src/demo/MembershipNFT.sol";
import {HonkVerifier} from "../src/verifiers/HonkVerifier.sol";

/// End-to-end onchain checks against real proofs from `js/gen-fixture.js`.
///
/// The fixture proofs are bound to a specific ballot address (because `voteScope`
/// hashes it) and to a specific submitter (because the submitter is a public input),
/// so the ballot contract is deployed at the pinned address and the votes are sent
/// from the pinned relayer. Everything else - the member set, the registry, the
/// verifier - is built here from scratch.
contract PrivateBallotTest is TestBase {
    string constant FIXTURE_PATH = "test/fixtures/ballot.json";

    address constant ADMIN = address(0xA11CE);

    MembershipNFT nft;
    MemberRegistry registry;
    PrivateBallot ballot;
    HonkVerifier verifier;

    string fixture;
    address pinnedBallot;
    address relayer;
    uint256 proposalId;
    bytes32 expectedRoot;
    address[] members;

    function setUp() public {
        fixture = vm.readFile(FIXTURE_PATH);
        pinnedBallot = vm.parseJsonAddress(fixture, ".ballot");
        relayer = vm.parseJsonAddress(fixture, ".relayer");
        proposalId = vm.parseJsonUint(fixture, ".proposalId");
        expectedRoot = vm.parseJsonBytes32(fixture, ".root");
        bytes32[] memory commitments = vm.parseJsonBytes32Array(fixture, ".commitments");

        vm.prank(ADMIN);
        nft = new MembershipNFT(ADMIN);
        registry = new MemberRegistry(IMembershipNFT(address(nft)));
        verifier = new HonkVerifier();

        // Register the fixture's member set, in order, each from its own wallet.
        for (uint256 i = 0; i < commitments.length; i++) {
            address member = address(uint160(0x1000 + i));
            members.push(member);
            vm.prank(ADMIN);
            uint256 tokenId = nft.mint(member);
            vm.prank(member);
            registry.register(tokenId, commitments[i]);
        }

        deployTo(
            "PrivateBallot.sol:PrivateBallot",
            abi.encode(address(registry), address(verifier)),
            pinnedBallot
        );
        ballot = PrivateBallot(pinnedBallot);

        vm.prank(members[0]);
        uint256 created = ballot.createProposal("Fund the audit from the treasury?", 1 days);
        assertEq(created, proposalId, "fixture assumes this is the first proposal");
    }

    /// The registry must independently arrive at the root the proofs were made against.
    function test_registryRootMatchesTheFixtureTree() public view {
        assertEq(registry.root(), expectedRoot, "onchain tree disagrees with the offchain one");
        assertEq(ballot.getProposal(proposalId).root, expectedRoot, "proposal pinned the wrong root");
    }

    function test_voteScopeMatchesTheFixture() public view {
        assertEq(
            ballot.voteScope(proposalId), vm.parseJsonBytes32(fixture, ".voteScope"), "vote scope drifted"
        );
    }

    function test_acceptsAValidBallot() public {
        _castA();

        (uint32 yes, uint32 no,) = _tally();
        assertEq(yes, 1, "yes not counted");
        assertEq(no, 0, "unexpected no");
        assertTrue(
            ballot.nullifierSpent(proposalId, vm.parseJsonBytes32(fixture, ".ballotANullifier")),
            "nullifier not marked spent"
        );
    }

    function test_countsTwoBallotsFromDifferentMembers() public {
        _castA();
        _castB();

        (uint32 yes, uint32 no, uint32 eligible) = _tally();
        assertEq(yes, 1, "yes wrong");
        assertEq(no, 1, "no wrong");
        assertEq(eligible, members.length, "anonymity set wrong");
    }

    /// One vote per member per proposal. The nullifier is deterministic in
    /// (secret, proposal), so a second ballot cannot dodge this by re-proving.
    function test_rejectsTheSameNullifierTwice() public {
        _castA();

        vm.prank(relayer);
        vm.expectRevert(PrivateBallot.NullifierAlreadyUsed.selector);
        ballot.castVote(
            proposalId,
            vm.parseJsonBool(fixture, ".ballotASupport"),
            vm.parseJsonBytes32(fixture, ".ballotANullifier"),
            vm.parseJsonBytes(fixture, ".ballotAProof")
        );
    }

    /// The submitter is a public input of the proof, so a proof lifted out of the
    /// mempool is worthless to anyone else.
    function test_rejectsAProofSubmittedByADifferentWallet() public {
        address thief = address(0xBADBAD);
        vm.prank(thief);
        vm.expectRevert(PrivateBallot.InvalidProof.selector);
        ballot.castVote(
            proposalId,
            vm.parseJsonBool(fixture, ".ballotASupport"),
            vm.parseJsonBytes32(fixture, ".ballotANullifier"),
            vm.parseJsonBytes(fixture, ".ballotAProof")
        );
    }

    /// The vote direction is a public input too: flipping it in calldata invalidates
    /// the proof, so a relayer cannot quietly change what it was handed.
    function test_rejectsAFlippedVote() public {
        vm.prank(relayer);
        vm.expectRevert(PrivateBallot.InvalidProof.selector);
        ballot.castVote(
            proposalId,
            !vm.parseJsonBool(fixture, ".ballotASupport"),
            vm.parseJsonBytes32(fixture, ".ballotANullifier"),
            vm.parseJsonBytes(fixture, ".ballotAProof")
        );
    }

    function test_rejectsAForgedNullifier() public {
        vm.prank(relayer);
        vm.expectRevert(PrivateBallot.InvalidProof.selector);
        ballot.castVote(
            proposalId,
            vm.parseJsonBool(fixture, ".ballotASupport"),
            bytes32(uint256(0x1234)),
            vm.parseJsonBytes(fixture, ".ballotAProof")
        );
    }

    function test_rejectsVotesAfterTheDeadline() public {
        vm.warp(block.timestamp + 2 days);
        vm.prank(relayer);
        vm.expectRevert(PrivateBallot.VotingClosed.selector);
        ballot.castVote(
            proposalId,
            vm.parseJsonBool(fixture, ".ballotASupport"),
            vm.parseJsonBytes32(fixture, ".ballotANullifier"),
            vm.parseJsonBytes(fixture, ".ballotAProof")
        );
    }

    function test_tallyIsSealedUntilTheDeadline() public {
        vm.expectRevert(PrivateBallot.VotingStillOpen.selector);
        ballot.tally(proposalId);
    }

    function test_onlyMembersCanOpenProposals() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(PrivateBallot.NotAMember.selector);
        ballot.createProposal("who let you in", 1 days);
    }

    function test_rejectsAbsurdVotingPeriods() public {
        vm.prank(members[0]);
        vm.expectRevert(PrivateBallot.BadVotingPeriod.selector);
        ballot.createProposal("too short", 1 minutes);

        vm.prank(members[0]);
        vm.expectRevert(PrivateBallot.BadVotingPeriod.selector);
        ballot.createProposal("too long", 365 days);
    }

    // ------------------------------------------------------------------ helpers

    function _castA() internal {
        vm.prank(relayer);
        ballot.castVote(
            proposalId,
            vm.parseJsonBool(fixture, ".ballotASupport"),
            vm.parseJsonBytes32(fixture, ".ballotANullifier"),
            vm.parseJsonBytes(fixture, ".ballotAProof")
        );
    }

    function _castB() internal {
        vm.prank(relayer);
        ballot.castVote(
            proposalId,
            vm.parseJsonBool(fixture, ".ballotBSupport"),
            vm.parseJsonBytes32(fixture, ".ballotBNullifier"),
            vm.parseJsonBytes(fixture, ".ballotBProof")
        );
    }

    function _tally() internal returns (uint32 yes, uint32 no, uint32 eligible) {
        vm.warp(block.timestamp + 2 days);
        return ballot.tally(proposalId);
    }
}
