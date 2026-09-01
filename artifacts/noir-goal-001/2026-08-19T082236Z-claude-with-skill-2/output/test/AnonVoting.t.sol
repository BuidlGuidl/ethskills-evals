// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MembershipNFT} from "../contracts/MembershipNFT.sol";
import {VoterRegistry} from "../contracts/VoterRegistry.sol";
import {AnonVoting} from "../contracts/AnonVoting.sol";
import {HonkVerifier, IVerifier} from "../contracts/verifier/HonkVerifier.sol";

/// Exercises the real generated verifier against a real proof produced by js/fixture.mjs.
/// No mock verifier appears anywhere in this suite: a mock would pass every test here while
/// the deployed system accepted forged ballots.
contract AnonVotingTest is Test {
    MembershipNFT internal nft;
    VoterRegistry internal registry;
    AnonVoting internal voting;

    struct Fixture {
        uint256[] commitments;
        uint256 root;
        uint256 proposalId;
        uint256 nullifierHash;
        bool support;
        bytes proof;
    }

    Fixture internal fx;
    address internal proposer = address(0xBEEF);
    address internal relayer = address(0x11E1A4); // no membership badge, on purpose

    function setUp() public {
        string memory json = vm.readFile("./test/fixtures/vote-proof.json");
        fx.commitments = vm.parseJsonUintArray(json, ".commitments");
        fx.root = vm.parseJsonUint(json, ".root");
        fx.proposalId = vm.parseJsonUint(json, ".proposalId");
        fx.nullifierHash = vm.parseJsonUint(json, ".nullifierHash");
        fx.support = vm.parseJsonBool(json, ".support");
        fx.proof = vm.parseJsonBytes(json, ".proof");

        nft = new MembershipNFT(address(this));
        registry = new VoterRegistry(nft);
        voting = new AnonVoting(IVerifier(address(new HonkVerifier())), registry);

        // Replay the fixture's electorate in order so the onchain root matches the one the
        // proof was built against. If VoterRegistry's tree ever diverges from the JS mirror,
        // this assert fires before any proof is even attempted.
        for (uint256 i = 0; i < fx.commitments.length; i++) {
            address member = address(uint160(0x1000 + i));
            uint256 tokenId = nft.mint(member);
            vm.prank(member);
            registry.join(tokenId, fx.commitments[i]);
        }
        assertEq(registry.root(), fx.root, "onchain tree diverged from the offchain mirror");

        nft.mint(proposer);
        vm.prank(proposer);
        uint256 id = voting.createProposal(keccak256("test proposal"), uint64(block.timestamp + 1 days));
        assertEq(id, fx.proposalId, "fixture assumes it is the first proposal");
    }

    function test_RealProofIsAcceptedFromAWalletWithNoMembership() public {
        // The relayer holds no badge and is nobody's wallet. That must be fine.
        vm.prank(relayer);
        voting.castVote(fx.proposalId, fx.nullifierHash, fx.support, fx.proof);

        vm.warp(block.timestamp + 2 days);
        (uint32 yes, uint32 no) = voting.tally(fx.proposalId);
        assertEq(yes, 1);
        assertEq(no, 0);
    }

    function test_SameNullifierCannotVoteTwice() public {
        vm.prank(relayer);
        voting.castVote(fx.proposalId, fx.nullifierHash, fx.support, fx.proof);

        vm.prank(relayer);
        vm.expectRevert(AnonVoting.NullifierAlreadyUsed.selector);
        voting.castVote(fx.proposalId, fx.nullifierHash, fx.support, fx.proof);
    }

    /// A relayer must not be able to flip the ballot it was handed.
    function test_RelayerCannotFlipTheVoteBit() public {
        vm.prank(relayer);
        vm.expectRevert(AnonVoting.BadProof.selector);
        voting.castVote(fx.proposalId, fx.nullifierHash, !fx.support, fx.proof);
    }

    function test_RelayerCannotSwapTheNullifier() public {
        vm.prank(relayer);
        vm.expectRevert(AnonVoting.BadProof.selector);
        voting.castVote(fx.proposalId, fx.nullifierHash + 1, fx.support, fx.proof);
    }

    /// The nullifier is scoped to a proposal in-circuit, so a ballot cannot be replayed onto
    /// a different proposal even when both snapshot the same electorate root.
    function test_ProofCannotBeReplayedOntoAnotherProposal() public {
        vm.prank(proposer);
        uint256 other = voting.createProposal(keccak256("other"), uint64(block.timestamp + 1 days));

        vm.prank(relayer);
        vm.expectRevert(AnonVoting.BadProof.selector);
        voting.castVote(other, fx.nullifierHash, fx.support, fx.proof);
    }

    function test_GarbageProofIsRejected() public {
        bytes memory junk = fx.proof;
        junk[100] = bytes1(uint8(junk[100]) ^ 0xff);
        vm.prank(relayer);
        vm.expectRevert();
        voting.castVote(fx.proposalId, fx.nullifierHash, fx.support, junk);
    }

    function test_VotingClosesAtTheDeadline() public {
        vm.warp(block.timestamp + 2 days);
        vm.prank(relayer);
        vm.expectRevert(AnonVoting.VotingClosed.selector);
        voting.castVote(fx.proposalId, fx.nullifierHash, fx.support, fx.proof);
    }

    function test_TallyIsSealedUntilTheDeadline() public {
        vm.expectRevert(AnonVoting.VotingStillOpen.selector);
        voting.tally(fx.proposalId);
    }

    function test_NullifierAboveTheFieldIsRejected() public {
        vm.prank(relayer);
        vm.expectRevert(AnonVoting.FieldOverflow.selector);
        voting.castVote(fx.proposalId, type(uint256).max, fx.support, fx.proof);
    }

    function test_OnlyMembersOpenProposals() public {
        vm.prank(relayer);
        vm.expectRevert(AnonVoting.NotMember.selector);
        voting.createProposal(keccak256("x"), uint64(block.timestamp + 1 days));
    }

    function test_ProposalFreezesTheElectorate() public {
        AnonVoting.Proposal memory p = voting.getProposal(fx.proposalId);
        assertEq(p.electorateSize, fx.commitments.length);
        assertEq(p.root, fx.root);

        // A member who joins later does not change this proposal's root.
        address late = address(0xDEAD);
        uint256 tokenId = nft.mint(late);
        vm.prank(late);
        registry.join(tokenId, 999);
        assertEq(voting.getProposal(fx.proposalId).root, fx.root);
        assertTrue(registry.root() != fx.root);
    }
}
