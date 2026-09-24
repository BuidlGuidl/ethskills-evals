// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {IVerifier} from "../src/HonkVerifier.sol";
import {AnonVoting} from "../src/AnonVoting.sol";

/// Accepts a proof iff it equals keccak of the public inputs, so tests can
/// check that AnonVoting passes the right inputs in the right order. The real
/// verifier is exercised end-to-end by js/e2e-local.mjs.
contract MockVerifier is IVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external pure returns (bool) {
        return keccak256(proof) == keccak256(abi.encode(publicInputs));
    }
}

contract AnonVotingTest is Test {
    MembershipNFT nft;
    AnonVoting voting;
    address[3] members = [address(0xA1), address(0xA2), address(0xA3)];
    address relayer = address(0xBEEF);
    uint256 constant FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    function setUp() public {
        nft = new MembershipNFT(address(this));
        voting = new AnonVoting(IERC721(address(nft)), new MockVerifier(), 3);
        for (uint256 i = 0; i < 3; i++) {
            nft.mint(members[i]);
            vm.prank(members[i]);
            voting.register(i + 1, 1000 + i);
        }
    }

    function _proof(uint256 id, bool support, uint256 nullifier) internal view returns (bytes memory) {
        AnonVoting.Proposal memory p = voting.getProposal(id);
        bytes32[] memory pi = new bytes32[](4);
        pi[0] = bytes32(p.root);
        pi[1] = bytes32(p.scope);
        pi[2] = bytes32(uint256(support ? 1 : 0));
        pi[3] = bytes32(nullifier);
        return abi.encode(pi);
    }

    function _propose() internal returns (uint256) {
        vm.prank(members[0]);
        return voting.createProposal(keccak256("p"), 1 days);
    }

    function test_registerRules() public {
        nft.mint(address(0xA4)); // token 4
        vm.expectRevert(AnonVoting.NotTokenOwner.selector);
        voting.register(4, 5);
        vm.startPrank(address(0xA4));
        vm.expectRevert(AnonVoting.InvalidCommitment.selector);
        voting.register(4, 1000); // commitment already used
        vm.expectRevert(AnonVoting.InvalidCommitment.selector);
        voting.register(4, FIELD);
        voting.register(4, 5);
        vm.expectRevert(AnonVoting.TokenAlreadyRegistered.selector);
        voting.register(4, 6);
        vm.stopPrank();
        assertEq(voting.memberCount(), 4);
    }

    function test_minAnonymitySet() public {
        AnonVoting v2 = new AnonVoting(IERC721(address(nft)), new MockVerifier(), 5);
        vm.prank(members[0]);
        vm.expectRevert(abi.encodeWithSelector(AnonVoting.AnonymitySetTooSmall.selector, 0, 5));
        v2.createProposal(bytes32(0), 1 days);
    }

    function test_snapshotRootIsFixed() public {
        uint256 id = _propose();
        uint256 snap = voting.getProposal(id).root;
        nft.mint(address(0xA4));
        vm.prank(address(0xA4));
        voting.register(4, 77);
        assertTrue(voting.memberRoot() != snap);
        assertEq(voting.getProposal(id).root, snap);
        assertEq(voting.getProposal(id).memberCount, 3);
    }

    function test_voteAndTally() public {
        uint256 id = _propose();
        vm.startPrank(relayer, relayer);
        voting.castVote(id, true, 11, _proof(id, true, 11));
        voting.castVote(id, false, 12, _proof(id, false, 12));
        voting.castVote(id, true, 13, _proof(id, true, 13));
        vm.stopPrank();

        vm.expectRevert(AnonVoting.VotingStillOpen.selector);
        voting.tally(id);

        vm.warp(block.timestamp + 1 days);
        (uint256 yes, uint256 no, uint256 eligible) = voting.tally(id);
        assertEq(yes, 2);
        assertEq(no, 1);
        assertEq(eligible, 3);
    }

    function test_voteRejections() public {
        uint256 id = _propose();
        // Build proofs up front: _proof makes a call, which would otherwise be
        // the call that vm.expectRevert inspects.
        bytes memory yes11 = _proof(id, true, 11);
        bytes memory no11 = _proof(id, false, 11);
        bytes memory aliased = _proof(id, true, 11 + FIELD);
        bytes memory yes21 = _proof(id, true, 21);
        bytes memory yes22 = _proof(id, true, 22);

        vm.startPrank(relayer, relayer);
        // vote flipped by the submitter => proof no longer matches
        vm.expectRevert(AnonVoting.InvalidProof.selector);
        voting.castVote(id, false, 11, yes11);

        voting.castVote(id, true, 11, yes11);
        vm.expectRevert(AnonVoting.NullifierAlreadyUsed.selector);
        voting.castVote(id, false, 11, no11);

        vm.expectRevert(AnonVoting.InvalidNullifier.selector);
        voting.castVote(id, true, 11 + FIELD, aliased);

        vm.expectRevert(AnonVoting.UnknownProposal.selector);
        voting.castVote(99, true, 20, "");
        vm.stopPrank();

        // member wallet sending directly is refused
        vm.prank(members[1], members[1]);
        vm.expectRevert(AnonVoting.SenderIsMember.selector);
        voting.castVote(id, true, 21, yes21);

        vm.warp(block.timestamp + 1 days);
        vm.prank(relayer, relayer);
        vm.expectRevert(AnonVoting.VotingClosed.selector);
        voting.castVote(id, true, 22, yes22);
    }

    function test_scopesDifferPerProposal() public {
        uint256 a = _propose();
        uint256 b = _propose();
        assertTrue(voting.getProposal(a).scope != voting.getProposal(b).scope);
        assertLt(voting.getProposal(a).scope, FIELD);
    }
}
