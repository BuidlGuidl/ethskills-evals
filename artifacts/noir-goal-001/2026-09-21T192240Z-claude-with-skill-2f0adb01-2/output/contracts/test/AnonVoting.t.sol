// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {HonkVerifier} from "../src/verifiers/HonkVerifier.sol";
import {AnonVoting, IMembership, IVerifier} from "../src/AnonVoting.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";

/// Uses the REAL generated verifier and a real proof from scripts/gen-fixture.mjs.
contract AnonVotingTest is Test {
    uint256 constant P = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    MembershipNFT nft;
    AnonVoting voting;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address relayer = makeAddr("relayer");

    uint256[] commitments;
    uint256 root;
    uint256 scope;
    uint256 nullifierHash;
    bool support;
    bytes proof;

    function setUp() public {
        string memory fx = vm.readFile("test/fixtures/vote.json");
        nft = new MembershipNFT();
        voting = new AnonVoting(IMembership(address(nft)), IVerifier(address(new HonkVerifier())), 3);
        require(
            address(voting) == vm.parseJsonAddress(fx, ".voting"),
            string.concat(
                "fixture stale: run VOTING=", vm.toString(address(voting)), " node scripts/gen-fixture.mjs"
            )
        );

        commitments = vm.parseJsonUintArray(fx, ".commitments");
        root = vm.parseJsonUint(fx, ".root");
        scope = vm.parseJsonUint(fx, ".scope");
        nullifierHash = vm.parseJsonUint(fx, ".nullifierHash");
        support = vm.parseJsonBool(fx, ".support");
        proof = vm.parseJsonBytes(fx, ".proof");

        address[3] memory members = [alice, bob, carol];
        for (uint256 i; i < 3; i++) {
            uint256 id = nft.mint(members[i]);
            vm.prank(members[i]);
            voting.register(id, commitments[i]);
        }
    }

    function _open() internal returns (uint256 id) {
        vm.prank(alice);
        id = voting.createProposal(keccak256("proposal"), 1 days);
    }

    // ---------------------------------------------------------- parity ----

    function test_poseidonParityWithCircuitAndJs() public pure {
        // Same vector is asserted in circuits/vote (nargo test).
        assertEq(PoseidonT3.hash([uint256(1), 2]), 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a);
    }

    function test_onchainRootMatchesJsMirror() public view {
        assertEq(voting.memberRoot(), root);
    }

    // ---------------------------------------------------------- voting ----

    function test_relayedVoteCounts() public {
        uint256 id = _open();
        AnonVoting.Proposal memory p = voting.getProposal(id);
        assertEq(p.snapshotRoot, root);
        assertEq(p.scope, scope);

        vm.expectEmit(address(voting));
        emit AnonVoting.VoteCast(id, nullifierHash, support);
        vm.prank(relayer); // any wallet — not bob
        voting.castVote(id, support, nullifierHash, proof);

        vm.warp(block.timestamp + 1 days);
        (uint256 yes, uint256 no, bool passed) = voting.result(id);
        assertEq(yes, 1);
        assertEq(no, 0);
        assertTrue(passed);
    }

    function test_revert_doubleVote() public {
        uint256 id = _open();
        voting.castVote(id, support, nullifierHash, proof);
        vm.expectRevert(AnonVoting.AlreadyVoted.selector);
        voting.castVote(id, support, nullifierHash, proof);
    }

    function test_revert_aliasedNullifier() public {
        uint256 id = _open();
        voting.castVote(id, support, nullifierHash, proof);
        vm.expectRevert(AnonVoting.InvalidNullifier.selector);
        voting.castVote(id, support, nullifierHash + P, proof);
    }

    function test_revert_flippedVote() public {
        uint256 id = _open();
        vm.expectRevert(); // the generated verifier reverts (e.g. SumcheckFailed) rather than returning false
        voting.castVote(id, !support, nullifierHash, proof);
    }

    function test_revert_proofReplayedOnOtherProposal() public {
        _open();
        uint256 other = _open(); // same root, different scope
        vm.expectRevert();
        voting.castVote(other, support, nullifierHash, proof);
    }

    function test_revert_afterDeadline() public {
        uint256 id = _open();
        vm.warp(block.timestamp + 1 days);
        vm.expectRevert(AnonVoting.VotingClosed.selector);
        voting.castVote(id, support, nullifierHash, proof);
    }

    function test_revert_resultBeforeDeadline() public {
        uint256 id = _open();
        vm.expectRevert(AnonVoting.VotingOpen.selector);
        voting.result(id);
    }

    function test_revert_corruptedProof() public {
        uint256 id = _open();
        bytes memory bad = proof;
        bad[100] = bytes1(uint8(bad[100]) ^ 1);
        vm.expectRevert();
        voting.castVote(id, support, nullifierHash, bad);
    }

    // ------------------------------------------------------ membership ----

    function test_revert_registerNotOwner() public {
        uint256 id = nft.mint(alice);
        vm.prank(bob);
        vm.expectRevert(AnonVoting.NotTokenOwner.selector);
        voting.register(id, 123);
    }

    function test_revert_registerTwice() public {
        vm.prank(alice);
        vm.expectRevert(AnonVoting.AlreadyRegistered.selector);
        voting.register(1, 456);
    }

    function test_revert_proposalBeforeAnonymitySet() public {
        AnonVoting fresh = new AnonVoting(IMembership(address(nft)), IVerifier(address(1)), 3);
        vm.prank(alice);
        vm.expectRevert(AnonVoting.AnonymitySetTooSmall.selector);
        fresh.createProposal(keccak256("x"), 1 days);
    }

    function test_revert_nonMemberCannotPropose() public {
        vm.prank(relayer);
        vm.expectRevert(AnonVoting.NotAMember.selector);
        voting.createProposal(keccak256("x"), 1 days);
    }

    /// NFT changes hands mid-vote: the new holder rotates the commitment. The open
    /// proposal keeps its snapshot (old holder's vote still valid, new holder can't
    /// vote on it); future proposals use the new root.
    function test_transferAndRotateKeepsOneVotePerToken() public {
        uint256 id = _open();
        address dave = makeAddr("dave");
        vm.prank(bob);
        nft.transferFrom(bob, dave, 2);

        uint256[] memory siblings = new uint256[](2);
        siblings[0] = commitments[0];
        siblings[1] = commitments[2];
        vm.prank(dave);
        voting.rotate(2, 999, siblings);
        assertTrue(voting.memberRoot() != root);

        voting.castVote(id, support, nullifierHash, proof); // snapshot still honoured
        vm.prank(alice);
        uint256 next = voting.createProposal(keccak256("next"), 1 days);
        assertEq(voting.getProposal(next).snapshotRoot, voting.memberRoot());
    }

    function test_evictBurnedMember() public {
        vm.expectRevert(AnonVoting.StillAMember.selector);
        voting.evict(3, new uint256[](0));

        nft.burn(3);
        uint256[] memory siblings = new uint256[](1);
        siblings[0] = PoseidonT3.hash([commitments[0], commitments[1]]);
        voting.evict(3, siblings);
        assertEq(voting.activeMembers(), 2);
    }
}
