// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {HonkVerifier} from "../src/HonkVerifier.sol";
import {IMembershipNFT} from "../src/IMembershipNFT.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {AnonVoting} from "../src/AnonVoting.sol";
import {MockMembershipNFT} from "../src/mocks/MockMembershipNFT.sol";

/// Real proofs are exercised end to end by scripts/demo-local.sh; these tests pin
/// the hashing to the JS mirror and cover the contract-side rules.
contract AnonVotingTest is Test {
    uint256 constant FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    MockMembershipNFT nft;
    MemberRegistry registry;
    AnonVoting voting;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    function setUp() public {
        nft = new MockMembershipNFT();
        nft.mint(alice); // 1
        nft.mint(bob); // 2
        nft.mint(carol); // 3
        registry = new MemberRegistry(IMembershipNFT(address(nft)));
        voting = new AnonVoting(new HonkVerifier(), registry, 3);
    }

    function test_PoseidonMatchesNoirAndJs() public pure {
        // Same constant as the Noir test and poseidon-lite poseidon2([1n, 2n]).
        assertEq(PoseidonT3.hash([uint256(1), 2]), 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a);
    }

    function test_TreeMatchesJsMirror() public {
        // Expected roots from scripts/shared/tree.mjs MirrorTree with the same operations.
        assertEq(registry.root(), 0x1b7201da72494f1e28717ad1a52eb469f95892f957713533de6175e5da190af2);
        vm.prank(alice);
        registry.register(1, 11);
        vm.prank(bob);
        registry.register(2, 22);
        vm.prank(carol);
        registry.register(3, 33);
        assertEq(registry.root(), 0x14ec4bb7c4794c226712e2f599af89d6211426e59c3337589cfcf48aa2a66f77);

        vm.prank(bob); // key rotation overwrites bob's leaf in place
        registry.register(2, 44);
        assertEq(registry.root(), 0x095ad6d103b2c41a19f0f067223670770a7b1e57d03a2cb530f5821c6ca685f5);

        vm.prank(bob); // bob sells the NFT; anyone can evict the stale leaf
        nft.transferFrom(bob, alice, 2);
        registry.evict(2);
        assertEq(registry.root(), 0x07462459205c0a9ecfd4f9f32086f995d00e5dde77e5c8a36189539a0bc57c82);
        assertEq(registry.activeMembers(), 2);
    }

    function test_OnlyTokenOwnerRegisters() public {
        vm.prank(bob);
        vm.expectRevert(MemberRegistry.NotTokenOwner.selector);
        registry.register(1, 11);
    }

    function test_CannotEvictCurrentHolder() public {
        vm.prank(alice);
        registry.register(1, 11);
        vm.expectRevert(MemberRegistry.NotEvictable.selector);
        registry.evict(1);
    }

    function test_ProposalNeedsAnonymitySet() public {
        vm.prank(alice);
        registry.register(1, 11);
        vm.prank(alice);
        vm.expectRevert(AnonVoting.AnonymitySetTooSmall.selector);
        voting.createProposal(keccak256("p"), uint64(block.timestamp + 1 days));
    }

    function _openProposal() internal returns (uint256 id) {
        vm.prank(alice);
        registry.register(1, 11);
        vm.prank(bob);
        registry.register(2, 22);
        vm.prank(carol);
        registry.register(3, 33);
        vm.prank(alice);
        id = voting.createProposal(keccak256("p"), uint64(block.timestamp + 1 days));
    }

    function test_ProposalSnapshotsRoot() public {
        uint256 id = _openProposal();
        uint256 snap = registry.root();
        vm.prank(bob);
        registry.register(2, 99); // later changes don't move the open proposal's root
        assertEq(voting.getProposal(id).root, snap);
    }

    function test_RejectsNonCanonicalNullifier() public {
        uint256 id = _openProposal();
        vm.expectRevert(AnonVoting.NullifierUsed.selector);
        voting.castVote(id, FIELD + 5, true, hex"");
    }

    function test_RejectsBadProof() public {
        uint256 id = _openProposal();
        vm.expectRevert();
        voting.castVote(id, 5, true, new bytes(32));
        (uint256 yes, uint256 no,) = voting.tally(id);
        assertEq(yes + no, 0);
    }

    function test_RejectsAfterDeadline() public {
        uint256 id = _openProposal();
        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(AnonVoting.VotingClosed.selector);
        voting.castVote(id, 5, true, hex"");
    }
}
