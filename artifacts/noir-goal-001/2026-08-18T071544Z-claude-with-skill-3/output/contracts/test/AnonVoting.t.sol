// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {HonkVerifier} from "../src/verifiers/HonkVerifier.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {AnonVoting} from "../src/AnonVoting.sol";
import {SNARK_SCALAR_FIELD} from "@zk-kit/lean-imt.sol/Constants.sol";

/// Exercises the real HonkVerifier against real proofs produced by
/// js/fixtures.mjs. Nothing here is mocked: if the Poseidon parameters, the tree
/// construction, the public-input ordering or the proof serialisation drift apart
/// between Noir, JS and Solidity, these tests fail.
contract AnonVotingTest is Test {
    using stdJson for string;

    AnonVoting voting;
    MembershipNFT nft;
    HonkVerifier verifier;

    address admin = address(0xA11CE);
    address relayer = address(0xBEEF);

    string fixture;
    uint256[] commitments;
    uint256 expectedRoot;

    struct Ballot {
        uint256 nullifierHash;
        bytes proof;
        uint8 vote;
    }

    function setUp() public {
        fixture = vm.readFile("./test/fixtures/ballots.json");
        commitments = fixture.readUintArray(".commitments");
        expectedRoot = fixture.readUint(".root");

        verifier = new HonkVerifier();
        vm.prank(admin);
        nft = new MembershipNFT(admin);
        voting = new AnonVoting(address(verifier), address(nft), commitments.length);

        for (uint256 i = 0; i < commitments.length; i++) {
            address member = memberAddress(i);
            vm.prank(admin);
            nft.mint(member);
            vm.prank(member);
            voting.register(commitments[i]);
        }
    }

    function memberAddress(uint256 i) internal pure returns (address) {
        return address(uint160(0x1000 + i));
    }

    function ballot(uint256 i) internal view returns (Ballot memory b) {
        string memory key = string.concat(".ballots[", vm.toString(i), "]");
        b.nullifierHash = fixture.readUint(string.concat(key, ".nullifierHash"));
        b.proof = fixture.readBytes(string.concat(key, ".proof"));
        b.vote = uint8(fixture.readUint(string.concat(key, ".vote")));
    }

    function openProposal() internal returns (uint256 id) {
        vm.prank(memberAddress(0));
        id = voting.createProposal("Fund the Q3 grants round", 1 days);
    }

    // -------------------------------------------------- hash / tree parity

    /// PoseidonT3 (Solidity) must agree with poseidon-lite (JS) and with
    /// `poseidon::poseidon::bn254::hash_2` (Noir). The Noir side is printed by
    /// `nargo test --show-output print_parity_vectors`.
    function test_poseidonParityWithNoirAndJs() public view {
        assertEq(
            PoseidonT3.hash([uint256(1), uint256(2)]),
            0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a,
            "hash_2(1,2) mismatch vs Noir"
        );

        uint256[] memory a = fixture.readUintArray(".poseidonVectors.a");
        uint256[] memory b = fixture.readUintArray(".poseidonVectors.b");
        uint256[] memory expected = fixture.readUintArray(".poseidonVectors.expected");
        for (uint256 i = 0; i < expected.length; i++) {
            assertEq(PoseidonT3.hash([a[i], b[i]]), expected[i], "hash_2 mismatch vs JS");
        }
    }

    /// The onchain LeanIMT must land on exactly the root the offchain mirror computed.
    function test_onchainRootMatchesOffchainMirror() public view {
        assertEq(voting.currentRoot(), expectedRoot);
        assertEq(voting.memberCount(), commitments.length);
    }

    // ------------------------------------------------------- happy path

    function test_castVoteWithRealProof() public {
        uint256 id = openProposal();
        Ballot memory b = ballot(0);

        vm.prank(relayer);
        voting.castVote(id, b.vote, b.nullifierHash, b.proof);

        assertTrue(voting.nullifierSpent(b.nullifierHash));
        (,,, uint64 ballotsCast,) = voting.proposalInfo(id);
        assertEq(ballotsCast, 1);
    }

    function test_tallyAfterDeadline() public {
        uint256 id = openProposal();

        Ballot memory yes = ballot(0);
        Ballot memory no = ballot(1);
        vm.prank(relayer);
        voting.castVote(id, yes.vote, yes.nullifierHash, yes.proof);
        vm.prank(address(0xCAFE));
        voting.castVote(id, no.vote, no.nullifierHash, no.proof);

        vm.expectRevert(AnonVoting.VotingStillOpen.selector);
        voting.result(id);

        vm.warp(block.timestamp + 1 days + 1);
        (uint256 yesVotes, uint256 noVotes) = voting.result(id);
        assertEq(yesVotes, 1);
        assertEq(noVotes, 1);
    }

    // ------------------------------------------------------ failure paths

    function test_rejectsReusedNullifier() public {
        uint256 id = openProposal();
        Ballot memory b = ballot(0);

        vm.prank(relayer);
        voting.castVote(id, b.vote, b.nullifierHash, b.proof);

        vm.prank(address(0xCAFE));
        vm.expectRevert(AnonVoting.NullifierAlreadySpent.selector);
        voting.castVote(id, b.vote, b.nullifierHash, b.proof);
    }

    /// A relayer cannot flip a ballot: the vote bit is a public input of the proof.
    function test_rejectsFlippedVote() public {
        uint256 id = openProposal();
        Ballot memory b = ballot(0);

        // HonkVerifier reverts (SumcheckFailed) rather than returning false; either
        // way the ballot never lands. AnonVoting.InvalidProof covers the returns-false case.
        vm.prank(relayer);
        vm.expectRevert();
        voting.castVote(id, b.vote == 1 ? 0 : 1, b.nullifierHash, b.proof);
    }

    /// A ballot cannot be replayed onto a different proposal: the proposal id is a
    /// public input, and the nullifier is derived from it.
    function test_rejectsReplayOntoAnotherProposal() public {
        openProposal();
        vm.prank(memberAddress(1));
        uint256 second = voting.createProposal("Something else", 1 days);

        Ballot memory b = ballot(0);
        vm.prank(relayer);
        vm.expectRevert();
        voting.castVote(second, b.vote, b.nullifierHash, b.proof);
    }

    /// Swapping in someone else's nullifier hash breaks the proof.
    function test_rejectsForeignNullifier() public {
        uint256 id = openProposal();
        Ballot memory b = ballot(0);
        uint256 foreign = fixture.readUint(".unusedNullifier");

        vm.prank(relayer);
        vm.expectRevert();
        voting.castVote(id, b.vote, foreign, b.proof);
    }

    /// `nullifierHash + p` reduces to `nullifierHash` in the verifier but keys a
    /// different mapping slot — it must not be accepted as a fresh nullifier.
    function test_rejectsNullifierAboveFieldOrder() public {
        uint256 id = openProposal();
        Ballot memory b = ballot(0);

        vm.prank(relayer);
        voting.castVote(id, b.vote, b.nullifierHash, b.proof);

        uint256 shifted = b.nullifierHash + SNARK_SCALAR_FIELD;
        vm.prank(address(0xCAFE));
        vm.expectRevert(AnonVoting.NotAFieldElement.selector);
        voting.castVote(id, b.vote, shifted, b.proof);
    }

    function test_rejectsTamperedProof() public {
        uint256 id = openProposal();
        Ballot memory b = ballot(0);
        b.proof[64] = bytes1(uint8(b.proof[64]) ^ 0xff);

        vm.prank(relayer);
        vm.expectRevert();
        voting.castVote(id, b.vote, b.nullifierHash, b.proof);
    }

    /// The stale-root case: the proposal pinned an 8-leaf root, so a proof against
    /// a 9-leaf tree no longer matches. Here we add a member after the proposal
    /// opened and confirm the pinned root did not move.
    function test_proposalRootIsPinnedAtOpenTime() public {
        uint256 id = openProposal();
        (uint256 pinnedRoot, uint256 memberCount,,,) = voting.proposalInfo(id);

        address latecomer = address(0xD00D);
        vm.prank(admin);
        nft.mint(latecomer);
        vm.prank(latecomer);
        voting.register(uint256(keccak256("late commitment")) >> 8);

        (uint256 rootAfter, uint256 countAfter,,,) = voting.proposalInfo(id);
        assertEq(rootAfter, pinnedRoot, "pinned root moved");
        assertEq(countAfter, memberCount, "pinned member count moved");
        assertTrue(voting.currentRoot() != pinnedRoot, "tree root should have advanced");

        // The earlier ballot still verifies against the pinned root.
        Ballot memory b = ballot(0);
        vm.prank(relayer);
        voting.castVote(id, b.vote, b.nullifierHash, b.proof);
    }

    function test_rejectsBallotFromRegisteredMemberWallet() public {
        uint256 id = openProposal();
        Ballot memory b = ballot(0);

        vm.prank(memberAddress(4));
        vm.expectRevert(AnonVoting.BallotFromMemberWallet.selector);
        voting.castVote(id, b.vote, b.nullifierHash, b.proof);
    }

    function test_rejectsBallotAfterDeadline() public {
        uint256 id = openProposal();
        Ballot memory b = ballot(0);

        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(relayer);
        vm.expectRevert(AnonVoting.VotingClosed.selector);
        voting.castVote(id, b.vote, b.nullifierHash, b.proof);
    }

    // ------------------------------------------------- registration rules

    function test_onlyMembersRegister() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(AnonVoting.NotAMember.selector);
        voting.register(12345);
    }

    function test_oneCommitmentPerMember() public {
        vm.prank(memberAddress(0));
        vm.expectRevert(AnonVoting.AlreadyRegistered.selector);
        voting.register(99999);
    }

    function test_proposalNeedsMinimumAnonymitySet() public {
        AnonVoting strict = new AnonVoting(address(verifier), address(nft), commitments.length + 1);
        vm.prank(memberAddress(0));
        vm.expectRevert(abi.encodeWithSelector(AnonVoting.AnonymitySetTooSmall.selector, 0, commitments.length + 1));
        strict.createProposal("too early", 1 days);
    }
}
