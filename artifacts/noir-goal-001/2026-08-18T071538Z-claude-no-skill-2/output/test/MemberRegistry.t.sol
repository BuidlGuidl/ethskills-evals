// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {IMembership, MemberRegistry} from "../src/MemberRegistry.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {IVerifier} from "../src/verifiers/HonkVerifierBase.sol";
import {RegisterVerifier} from "../src/verifiers/RegisterVerifier.sol";

/// Exercises the registry against the real circuit and the real generated
/// verifier, using the proof in test/fixtures/register.json
/// (regenerate with `node scripts/make-fixtures.mjs`).
contract MemberRegistryTest is Test {
    MembershipNFT nft;
    MemberRegistry registry;

    address member = address(0xA11CE);
    address outsider = address(0xB0B);

    bytes32 oldRoot;
    bytes32 newRoot;
    bytes32 leaf;
    bytes proof;

    function setUp() public {
        nft = new MembershipNFT("DAO Membership", "DAOM");
        registry = new MemberRegistry(IMembership(address(nft)), IVerifier(address(new RegisterVerifier())));
        nft.mint(member);

        string memory json = vm.readFile("test/fixtures/register.json");
        oldRoot = vm.parseJsonBytes32(json, ".oldRoot");
        newRoot = vm.parseJsonBytes32(json, ".newRoot");
        leaf = vm.parseJsonBytes32(json, ".leaf");
        proof = vm.parseJsonBytes(json, ".proof");
    }

    function test_emptyRootMatchesTheCircuit() public view {
        assertEq(registry.root(), oldRoot, "EMPTY_ROOT disagrees with circuits/common");
        assertEq(registry.root(), registry.EMPTY_ROOT());
    }

    function test_memberJoinsAndTheRootAdvances() public {
        vm.prank(member);
        registry.join(leaf, newRoot, proof);

        assertEq(registry.root(), newRoot);
        assertEq(registry.memberCount(), 1);
        assertEq(registry.commitments(0), leaf);
        assertTrue(registry.hasJoined(member));
    }

    function test_nonMemberCannotJoin() public {
        vm.prank(outsider);
        vm.expectRevert(MemberRegistry.NotAMember.selector);
        registry.join(leaf, newRoot, proof);
    }

    function test_memberCannotJoinTwice() public {
        vm.startPrank(member);
        registry.join(leaf, newRoot, proof);
        vm.expectRevert(MemberRegistry.AlreadyJoined.selector);
        registry.join(leaf, newRoot, proof);
        vm.stopPrank();
    }

    /// The proof is over (old_root, new_root, leaf, index); claiming a
    /// different root than the one proved cannot pass verification.
    function test_forgedRootIsRejected() public {
        nft.mint(outsider);
        vm.prank(outsider);
        vm.expectRevert();
        registry.join(leaf, bytes32(uint256(newRoot) ^ 1), proof);
    }

    /// A second member replaying the first member's proof would be claiming
    /// index 0, which is no longer the next free slot.
    function test_replayedProofAtTheWrongIndexIsRejected() public {
        vm.prank(member);
        registry.join(leaf, newRoot, proof);

        address second = address(0xC0FFEE);
        nft.mint(second);
        vm.prank(second);
        vm.expectRevert(MemberRegistry.CommitmentAlreadyUsed.selector);
        registry.join(leaf, newRoot, proof);
    }

    function test_zeroCommitmentIsRejected() public {
        vm.prank(member);
        vm.expectRevert(MemberRegistry.ZeroCommitment.selector);
        registry.join(bytes32(0), newRoot, proof);
    }
}
