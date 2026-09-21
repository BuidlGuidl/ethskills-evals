// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {MembershipNFT, IMembershipNFT} from "../src/MembershipNFT.sol";
import {VoterRegistry} from "../src/VoterRegistry.sol";
import {AnonymousVoting} from "../src/AnonymousVoting.sol";
import {IVerifier} from "../src/HonkVerifier.sol";
import {PoseidonT3} from "../src/PoseidonT3.sol";

/// Accepts proofs whose first byte is 0x01.
/// Real-proof verification is exercised end to end by scripts/demo-local.sh.
contract MockVerifier is IVerifier {
    function verify(bytes calldata proof, bytes32[] calldata inputs) external pure returns (bool) {
        return proof.length > 0 && proof[0] == 0x01 && inputs.length == 4;
    }
}

contract AnonymousVotingTest is Test {
    uint256 constant F = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    MembershipNFT nft;
    VoterRegistry registry;
    MockVerifier verifier;
    AnonymousVoting voting;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address relayer = makeAddr("relayer");

    function setUp() public {
        nft = new MembershipNFT(address(this));
        nft.mint(alice); // 1
        nft.mint(bob); // 2
        nft.mint(carol); // 3
        registry = new VoterRegistry(IMembershipNFT(address(nft)));
        verifier = new MockVerifier();
        voting = new AnonymousVoting(registry, verifier, 3);
    }

    function _registerAll() internal {
        vm.prank(alice);
        registry.register(1, 111);
        vm.prank(bob);
        registry.register(2, 222);
        vm.prank(carol);
        registry.register(3, 333);
    }

    // Reference root: rebuild the full tree naively from the leaves.
    function _naiveRoot(uint256[] memory leaves) internal pure returns (uint256) {
        uint256 n = 1 << 10;
        uint256[] memory layer = new uint256[](n);
        for (uint256 i = 0; i < leaves.length; i++) layer[i] = leaves[i];
        while (n > 1) {
            n >>= 1;
            for (uint256 i = 0; i < n; i++) {
                layer[i] = PoseidonT3.hash([layer[2 * i], layer[2 * i + 1]]);
            }
        }
        return layer[0];
    }

    function test_poseidonMatchesCircomlib() public pure {
        assertEq(PoseidonT3.hash([uint256(1), uint256(2)]), 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a);
    }

    function test_treeMatchesNaive_insertRekeyEvict() public {
        _registerAll();
        uint256[] memory leaves = new uint256[](3);
        leaves[0] = 111;
        leaves[1] = 222;
        leaves[2] = 333;
        assertEq(registry.root(), _naiveRoot(leaves));
        assertEq(registry.activeMembers(), 3);

        vm.prank(bob); // key rotation replaces the leaf in place
        registry.register(2, 444);
        leaves[1] = 444;
        assertEq(registry.root(), _naiveRoot(leaves));
        assertEq(registry.activeMembers(), 3);

        vm.prank(alice); // alice sells her NFT; anyone can evict her leaf
        nft.transferFrom(alice, bob, 1);
        vm.prank(relayer);
        registry.evict(1);
        leaves[0] = 0;
        assertEq(registry.root(), _naiveRoot(leaves));
        assertEq(registry.activeMembers(), 2);

        vm.prank(bob); // new holder registers a fresh identity on the same token
        registry.register(1, 555);
        leaves[0] = 555;
        assertEq(registry.root(), _naiveRoot(leaves));
        assertEq(registry.activeMembers(), 3);
    }

    function test_registerRules() public {
        vm.prank(bob);
        vm.expectRevert(VoterRegistry.NotTokenHolder.selector);
        registry.register(1, 111);

        vm.startPrank(alice);
        vm.expectRevert(VoterRegistry.InvalidCommitment.selector);
        registry.register(1, 0);
        vm.expectRevert(VoterRegistry.InvalidCommitment.selector);
        registry.register(1, F);
        registry.register(1, 111);
        vm.expectRevert(VoterRegistry.CommitmentAlreadyUsed.selector);
        registry.register(1, 111);
        vm.expectRevert(VoterRegistry.RegistrantStillHolds.selector);
        registry.evict(1);
        vm.stopPrank();
    }

    function test_proposalNeedsAnonymitySet() public {
        vm.prank(alice);
        registry.register(1, 111);
        vm.prank(alice);
        vm.expectRevert(AnonymousVoting.AnonymitySetTooSmall.selector);
        voting.createProposal(keccak256("p"), uint64(block.timestamp + 1 days));
    }

    function test_voteFlow() public {
        _registerAll();
        vm.prank(alice);
        uint256 id = voting.createProposal(keccak256("p"), uint64(block.timestamp + 1 days));
        (, uint256 root,,,,) = voting.proposals(id);
        assertEq(root, registry.root());

        bytes memory proof = hex"01";
        vm.startPrank(relayer);
        voting.castVote(id, true, 1001, proof);
        voting.castVote(id, true, 1002, proof);
        voting.castVote(id, false, 1003, proof);

        vm.expectRevert(AnonymousVoting.AlreadyVoted.selector);
        voting.castVote(id, false, 1001, proof);
        vm.expectRevert(AnonymousVoting.InvalidNullifier.selector);
        voting.castVote(id, false, 1001 + F, proof);
        vm.expectRevert(AnonymousVoting.InvalidProof.selector);
        voting.castVote(id, false, 1004, hex"00");
        vm.expectRevert(AnonymousVoting.VotingOpen.selector);
        voting.tally(id);

        vm.warp(block.timestamp + 1 days);
        vm.expectRevert(AnonymousVoting.VotingClosed.selector);
        voting.castVote(id, true, 1005, proof);
        vm.stopPrank();

        (uint256 yes, uint256 no, uint256 electorate) = voting.tally(id);
        assertEq(yes, 2);
        assertEq(no, 1);
        assertEq(electorate, 3);
    }

    function test_scopeDiffersPerProposal() public view {
        assertTrue(voting.scopeOf(1) != voting.scopeOf(2));
        assertLt(voting.scopeOf(1), F);
    }
}
