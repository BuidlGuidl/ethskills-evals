// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {AnonymousBallot, IVerifier} from "../src/AnonymousBallot.sol";
import {IMembership} from "../src/IMembership.sol";
import {HonkVerifier} from "../src/verifier/HonkVerifier.sol";

/// @notice End-to-end against the REAL verifier and a REAL proof.
///
/// The proof in contracts/test/fixtures/ballot.json was produced by
/// scripts/gen-fixture.mjs from the compiled circuit. That makes this test the
/// thing that catches the classic silent break: someone edits the circuit, or
/// the public input order, or the tree depth, and forgets to regenerate
/// HonkVerifier.sol. Nothing else in the repo would notice.
contract AnonymousBallotTest is Test {
    MembershipNFT membership;
    MemberRegistry registry;
    HonkVerifier verifier;
    AnonymousBallot ballot;

    address constant ISSUER = address(0xDA0);
    /// @dev Holds no membership NFT. Ballots arrive from here.
    address constant RELAYER = address(0xBEEF);

    uint256[] commitments;
    uint256 fixtureRoot;
    uint256 nullifierHash;
    uint8 voteValue;
    bytes proof;

    function setUp() public {
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/contracts/test/fixtures/ballot.json"));
        commitments = vm.parseJsonUintArray(json, ".commitments");
        fixtureRoot = vm.parseJsonUint(json, ".root");
        nullifierHash = vm.parseJsonUint(json, ".nullifierHash");
        voteValue = uint8(vm.parseJsonUint(json, ".vote"));
        proof = vm.parseJsonBytes(json, ".proof");

        vm.prank(ISSUER);
        membership = new MembershipNFT(ISSUER);
        registry = new MemberRegistry(IMembership(address(membership)));
        verifier = new HonkVerifier();
        ballot = new AnonymousBallot(IMembership(address(membership)), registry, IVerifier(address(verifier)), 8);

        // Every member gets a seat and joins with the fixture's commitment,
        // reproducing the tree the proof was generated against.
        for (uint256 i = 0; i < commitments.length; ++i) {
            address member = _member(i);
            vm.prank(ISSUER);
            membership.issue(member);
            vm.prank(member);
            registry.join(commitments[i]);
        }
    }

    function _member(uint256 i) internal pure returns (address) {
        return address(uint160(0x1000 + i));
    }

    function _openProposal() internal returns (uint256 id) {
        vm.prank(_member(0));
        id = ballot.createProposal(keccak256("Fund the grants program with 40 ETH"), 1 hours);
    }

    /// The onchain tree and the offchain mirror the proof was built from must
    /// land on the same root, or nothing downstream can work.
    function test_onchainTreeMatchesTheProversTree() public view {
        assertEq(registry.root(), fixtureRoot, "registry root != prover root");
        assertEq(registry.leafCount(), commitments.length);
    }

    function test_castVoteAndTally() public {
        uint256 id = _openProposal();
        assertEq(id, 1);

        (, uint256 snapshotRoot, uint64 eligible,) = ballot.proposalInfo(id);
        assertEq(snapshotRoot, fixtureRoot);
        assertEq(eligible, commitments.length);

        // Sent by a wallet with no membership NFT: the sender identifies nobody.
        vm.prank(RELAYER);
        ballot.castVote(id, nullifierHash, voteValue, proof);

        assertTrue(ballot.nullifierSpent(id, nullifierHash));

        // Tally is not readable while voting is open.
        vm.expectRevert(AnonymousBallot.VotingStillOpen.selector);
        ballot.result(id);

        vm.warp(block.timestamp + 1 hours + 1);
        (uint64 yes, uint64 no, uint64 turnout) = ballot.result(id);
        assertEq(yes, 1);
        assertEq(no, 0);
        assertEq(turnout, 1);
    }

    /// One member, one ballot per proposal — enforced by the nullifier.
    function test_replayIsRejected() public {
        uint256 id = _openProposal();
        vm.prank(RELAYER);
        ballot.castVote(id, nullifierHash, voteValue, proof);

        vm.prank(RELAYER);
        vm.expectRevert(AnonymousBallot.AlreadyVoted.selector);
        ballot.castVote(id, nullifierHash, voteValue, proof);
    }

    /// The vote direction is a public input, so a relayer cannot flip it in
    /// flight — the proof stops matching.
    function test_relayerCannotFlipTheVote() public {
        uint256 id = _openProposal();
        vm.prank(RELAYER);
        vm.expectRevert(AnonymousBallot.BadProof.selector);
        ballot.castVote(id, nullifierHash, voteValue == 1 ? 0 : 1, proof);
    }

    /// A proof is bound to its proposal id, so a valid ballot cannot be
    /// replayed onto the next proposal.
    function test_proofDoesNotTransferToAnotherProposal() public {
        _openProposal();
        vm.prank(_member(1));
        uint256 second = ballot.createProposal(keccak256("something else"), 1 hours);

        vm.prank(RELAYER);
        vm.expectRevert(AnonymousBallot.BadProof.selector);
        ballot.castVote(second, nullifierHash, voteValue, proof);
    }

    function test_garbageProofIsRejected() public {
        uint256 id = _openProposal();
        bytes memory tampered = proof;
        tampered[64] = bytes1(uint8(tampered[64]) ^ 0xff);

        vm.prank(RELAYER);
        vm.expectRevert();
        ballot.castVote(id, nullifierHash, voteValue, tampered);
    }

    function test_votingClosesAtTheDeadline() public {
        uint256 id = _openProposal();
        vm.warp(block.timestamp + 1 hours);
        vm.prank(RELAYER);
        vm.expectRevert(AnonymousBallot.VotingClosed.selector);
        ballot.castVote(id, nullifierHash, voteValue, proof);
    }

    function test_nonMemberCannotJoin() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(MemberRegistry.NotAMember.selector);
        registry.join(uint256(keccak256("anything")));
    }

    function test_memberCannotJoinTwice() public {
        vm.prank(_member(0));
        vm.expectRevert(MemberRegistry.AlreadyJoined.selector);
        registry.join(uint256(keccak256("a second leaf")));
    }

    function test_commitmentCannotBeFrontRun() public {
        address newcomer = address(0xC0FFEE);
        vm.prank(ISSUER);
        membership.issue(newcomer);

        vm.prank(newcomer);
        vm.expectRevert(MemberRegistry.CommitmentTaken.selector);
        registry.join(commitments[0]);
    }

    /// A proposal must not open onto an anonymity set small enough to make the
    /// proof pointless.
    function test_proposalNeedsAnAnonymitySet() public {
        MemberRegistry fresh = new MemberRegistry(IMembership(address(membership)));
        AnonymousBallot strict =
            new AnonymousBallot(IMembership(address(membership)), fresh, IVerifier(address(verifier)), 8);

        vm.prank(_member(0));
        vm.expectRevert(abi.encodeWithSelector(AnonymousBallot.AnonymitySetTooSmall.selector, 0, 8));
        strict.createProposal(keccak256("too early"), 1 hours);
    }

    function test_nonMemberCannotOpenAProposal() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(AnonymousBallot.NotAMember.selector);
        ballot.createProposal(keccak256("hostile"), 1 hours);
    }
}
