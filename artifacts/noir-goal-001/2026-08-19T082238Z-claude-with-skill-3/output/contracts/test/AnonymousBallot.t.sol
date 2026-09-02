// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {HonkVerifier} from "../src/HonkVerifier.sol";
import {PoseidonT3Hasher} from "../src/PoseidonT3Hasher.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {AnonymousBallot} from "../src/AnonymousBallot.sol";
import {MembershipNFT} from "../src/demo/MembershipNFT.sol";
import {IPoseidonT3} from "../src/interfaces/IPoseidonT3.sol";
import {IMembershipNFT} from "../src/interfaces/IMembershipNFT.sol";
import {IVerifier} from "../src/interfaces/IVerifier.sol";

/// @notice End-to-end against the real generated verifier, using a real proof from
///         test/fixtures/vote-proof.json (regenerate with `node client/export-fixture.js`).
///         No mock verifier appears anywhere in this file or in the deploy script.
contract AnonymousBallotTest is Test {
    MembershipNFT nft;
    MemberRegistry registry;
    AnonymousBallot ballot;

    uint256[] commitments;
    uint256 fixtureRoot;
    uint256 nullifierHash;
    bool support;
    bytes proof;

    uint64 constant VOTING_PERIOD = 3 days;
    uint256 constant PROPOSAL_ID = 0;

    address constant PROPOSER = address(0xA11CE);
    address constant RELAYER = address(0x8E1A4);

    function setUp() public {
        string memory raw = vm.readFile("test/fixtures/vote-proof.json");
        commitments = vm.parseJsonUintArray(raw, ".commitments");
        fixtureRoot = vm.parseJsonUint(raw, ".root");
        nullifierHash = vm.parseJsonUint(raw, ".nullifierHash");
        support = vm.parseJsonBool(raw, ".support");
        proof = vm.parseJsonBytes(raw, ".proof");

        nft = new MembershipNFT(address(this));
        PoseidonT3Hasher poseidon = new PoseidonT3Hasher();
        HonkVerifier verifier = new HonkVerifier();
        registry = new MemberRegistry(IPoseidonT3(address(poseidon)), IMembershipNFT(address(nft)));
        ballot = new AnonymousBallot(
            IVerifier(address(verifier)), registry, IMembershipNFT(address(nft)), 2
        );

        // Member 0 is the proposer; the rest are anonymous holders.
        nft.mint(PROPOSER);
        for (uint256 i = 1; i < commitments.length; i++) {
            nft.mint(address(uint160(0x1000 + i)));
        }

        // Each member registers from their own wallet, in leaf order.
        vm.prank(PROPOSER);
        registry.register(0, commitments[0]);
        for (uint256 i = 1; i < commitments.length; i++) {
            vm.prank(address(uint160(0x1000 + i)));
            registry.register(i, commitments[i]);
        }

        vm.prank(PROPOSER);
        uint256 id = ballot.createProposal(0, "raise the grant budget", VOTING_PERIOD);
        assertEq(id, PROPOSAL_ID);
    }

    /// The onchain tree and the JS mirror in client/src/tree.js must land on the same
    /// root, or no member could ever prove membership.
    function test_onchainRootMatchesOffchainMirror() public view {
        assertEq(registry.root(), fixtureRoot);
        (, uint256 snapshotRoot,,,,) = ballot.proposals(PROPOSAL_ID);
        assertEq(snapshotRoot, fixtureRoot);
    }

    function test_relayerCastsValidVoteAndItIsCounted() public {
        vm.prank(RELAYER); // not the voter's wallet; the contract never records it
        ballot.castVote(PROPOSAL_ID, nullifierHash, support, proof);

        (,,,, uint32 yes, uint32 no) = ballot.proposals(PROPOSAL_ID);
        assertEq(yes, 1);
        assertEq(no, 0);
        assertTrue(ballot.nullifierSpent(PROPOSAL_ID, nullifierHash));
    }

    /// A copied proof -- e.g. lifted from the mempool -- cannot vote twice.
    function test_replayOfTheSameProofReverts() public {
        vm.prank(RELAYER);
        ballot.castVote(PROPOSAL_ID, nullifierHash, support, proof);

        vm.prank(RELAYER);
        vm.expectRevert(AnonymousBallot.NullifierAlreadySpent.selector);
        ballot.castVote(PROPOSAL_ID, nullifierHash, support, proof);
    }

    /// The relayer holds the proof in transit; it must not be able to change the vote.
    /// @dev The generated HonkVerifier reverts (SumcheckFailed) rather than returning
    ///      false, so the ballot's own InvalidProof guard is belt-and-braces. Either
    ///      way the transaction reverts and no vote is counted.
    function test_relayerCannotFlipTheVote() public {
        vm.prank(RELAYER);
        vm.expectRevert();
        ballot.castVote(PROPOSAL_ID, nullifierHash, !support, proof);

        (,,,, uint32 yes, uint32 no) = ballot.proposals(PROPOSAL_ID);
        assertEq(yes + no, 0);
    }

    /// The nullifier is scoped to the proposal in-circuit, so a proof cannot be
    /// carried across to another proposal even with an identical member tree.
    function test_proofDoesNotTransferToAnotherProposal() public {
        vm.prank(PROPOSER);
        uint256 other = ballot.createProposal(0, "a different question", VOTING_PERIOD);

        vm.prank(RELAYER);
        vm.expectRevert();
        ballot.castVote(other, nullifierHash, support, proof);
    }

    function test_garbageProofReverts() public {
        bytes memory tampered = proof;
        tampered[64] = bytes1(uint8(tampered[64]) ^ 0xff);

        vm.prank(RELAYER);
        vm.expectRevert();
        ballot.castVote(PROPOSAL_ID, nullifierHash, support, tampered);
    }

    function test_votingClosesAtTheDeadline() public {
        vm.warp(block.timestamp + VOTING_PERIOD);
        vm.prank(RELAYER);
        vm.expectRevert(AnonymousBallot.VotingClosed.selector);
        ballot.castVote(PROPOSAL_ID, nullifierHash, support, proof);
    }

    function test_tallyIsReadableOnlyAfterTheDeadline() public {
        vm.prank(RELAYER);
        ballot.castVote(PROPOSAL_ID, nullifierHash, support, proof);

        vm.expectRevert(AnonymousBallot.VotingStillOpen.selector);
        ballot.result(PROPOSAL_ID);

        vm.warp(block.timestamp + VOTING_PERIOD);
        (uint32 yes, uint32 no, uint32 turnout, uint32 anonymitySet) = ballot.result(PROPOSAL_ID);
        assertEq(yes, 1);
        assertEq(no, 0);
        assertEq(turnout, 1);
        assertEq(anonymitySet, uint32(commitments.length));
    }

    function test_proposalNeedsAnAnonymitySet() public {
        AnonymousBallot strict = new AnonymousBallot(
            ballot.verifier(), registry, IMembershipNFT(address(nft)), 50
        );
        vm.prank(PROPOSER);
        vm.expectRevert(
            abi.encodeWithSelector(
                AnonymousBallot.AnonymitySetTooSmall.selector, uint32(commitments.length), uint32(50)
            )
        );
        strict.createProposal(0, "too early to be anonymous", VOTING_PERIOD);
    }
}
