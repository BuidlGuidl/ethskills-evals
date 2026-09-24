// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {HonkVerifier, IVerifier} from "../src/verifier/HonkVerifier.sol";
import {AnonVoting} from "../src/AnonVoting.sol";
import {DemoMembershipNFT} from "../src/DemoMembershipNFT.sol";

/// Contract-level rules with the real verifier. The full happy path (member proof
/// accepted by AnonVoting) is exercised by scripts/demo-local.mjs against anvil.
contract AnonVotingTest is Test {
    HonkVerifier verifier;
    DemoMembershipNFT nft;
    AnonVoting voting;
    address[4] members = [address(0xA1), address(0xA2), address(0xA3), address(0xA4)];
    address relayer = address(0xBEEF);

    function setUp() public {
        verifier = new HonkVerifier();
        nft = new DemoMembershipNFT(address(this));
        for (uint256 i; i < members.length; i++) nft.mint(members[i]); // token ids 1..4
        voting = new AnonVoting(IERC721(address(nft)), IVerifier(address(verifier)), 3);
    }

    function _registerFirst(uint256 n) internal {
        for (uint256 i; i < n; i++) {
            vm.prank(members[i]);
            voting.register(i + 1, uint256(keccak256(abi.encode(i))) % 2 ** 250);
        }
    }

    function test_realProofVerifies() public view {
        string memory json = vm.readFile("test/fixtures/vote_proof.json");
        bytes memory proof = vm.parseJsonBytes(json, ".proof");
        bytes32[] memory inputs = vm.parseJsonBytes32Array(json, ".publicInputs");
        assertTrue(verifier.verify(proof, inputs));
    }

    function test_realProofRejectsFlippedVote() public {
        string memory json = vm.readFile("test/fixtures/vote_proof.json");
        bytes memory proof = vm.parseJsonBytes(json, ".proof");
        bytes32[] memory inputs = vm.parseJsonBytes32Array(json, ".publicInputs");
        inputs[3] = bytes32(0);
        vm.expectRevert();
        verifier.verify(proof, inputs);
    }

    function test_registerOnlyByTokenOwner() public {
        vm.prank(members[1]);
        vm.expectRevert(AnonVoting.NotTokenOwner.selector);
        voting.register(1, 123);
    }

    function test_oneSeatPerToken() public {
        vm.prank(members[0]);
        voting.register(1, 123);
        // even after the NFT moves to a fresh wallet
        vm.prank(members[0]);
        nft.transferFrom(members[0], address(0xF00D), 1);
        vm.prank(address(0xF00D));
        vm.expectRevert(AnonVoting.AlreadyRegistered.selector);
        voting.register(1, 456);
    }

    function test_proposalNeedsAnonymitySet() public {
        _registerFirst(2);
        vm.prank(members[0]);
        vm.expectRevert(abi.encodeWithSelector(AnonVoting.AnonymitySetTooSmall.selector, 2, 3));
        voting.createProposal(bytes32(0), 1 days);
    }

    function test_proposalSnapshotsRoot() public {
        _registerFirst(3);
        vm.prank(members[0]);
        uint256 id = voting.createProposal(keccak256("p"), 1 days);
        uint256 snap = voting.getProposal(id).memberRoot;
        vm.prank(members[3]);
        voting.register(4, 999);
        assertEq(voting.getProposal(id).memberRoot, snap);
        assertTrue(voting.memberRoot() != snap);
        assertEq(voting.getProposal(id).memberCount, 3);
    }

    function test_nonMemberCannotPropose() public {
        _registerFirst(3);
        vm.prank(relayer);
        vm.expectRevert(AnonVoting.NotMember.selector);
        voting.createProposal(bytes32(0), 1 days);
    }

    function test_castVoteRejectsLinkableSenders() public {
        _registerFirst(3);
        vm.prank(members[0]);
        uint256 id = voting.createProposal(bytes32(0), 1 days);
        // registrant who has since moved their NFT away
        vm.prank(members[0]);
        nft.transferFrom(members[0], address(0xF00D), 1);
        vm.prank(members[0]);
        vm.expectRevert(AnonVoting.SenderIsLinkable.selector);
        voting.castVote(id, true, 1, hex"");
        // NFT holder who never registered
        vm.prank(members[3]);
        vm.expectRevert(AnonVoting.SenderIsLinkable.selector);
        voting.castVote(id, true, 1, hex"");
    }

    function test_castVoteRejectsBadProof() public {
        _registerFirst(3);
        vm.prank(members[0]);
        uint256 id = voting.createProposal(bytes32(0), 1 days);
        bytes memory proof = vm.parseJsonBytes(vm.readFile("test/fixtures/vote_proof.json"), ".proof");
        vm.prank(relayer);
        vm.expectRevert(AnonVoting.InvalidProof.selector);
        voting.castVote(id, true, 1, proof);
    }

    function test_votingClosesAtDeadline() public {
        _registerFirst(3);
        vm.prank(members[0]);
        uint256 id = voting.createProposal(bytes32(0), 1 days);
        vm.warp(block.timestamp + 1 days);
        vm.prank(relayer);
        vm.expectRevert(AnonVoting.VotingClosed.selector);
        voting.castVote(id, true, 1, hex"");
        (,, bool closed) = voting.tally(id);
        assertTrue(closed);
    }

    function test_externalNullifierIsPerProposalAndInField() public {
        uint256 a = voting.externalNullifierFor(0);
        uint256 b = voting.externalNullifierFor(1);
        assertTrue(a != b);
        assertLt(a, 21888242871839275222246405745257275088548364400416034343698204186575808495617);
    }
}
