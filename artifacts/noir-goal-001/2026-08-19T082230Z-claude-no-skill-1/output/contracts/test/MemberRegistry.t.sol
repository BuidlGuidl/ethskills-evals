// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

import {DevMembershipNFT} from "../src/dev/DevMembershipNFT.sol";
import {IHonkVerifier} from "../src/interfaces/IHonkVerifier.sol";
import {IMembershipNFT} from "../src/interfaces/IMembershipNFT.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {MockVerifier} from "./mocks/MockVerifier.sol";

contract MemberRegistryTest is Test {
    DevMembershipNFT nft;
    MockVerifier verifier;
    MemberRegistry registry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address outsider = makeAddr("outsider");

    bytes constant PROOF = hex"c0ffee";

    /// Cached: reading it inside a pranked line would consume the prank.
    bytes32 emptyRoot;

    function setUp() public {
        nft = new DevMembershipNFT(address(this));
        nft.mint(alice); // token 0
        nft.mint(bob); // token 1

        verifier = new MockVerifier();
        registry = new MemberRegistry(IMembershipNFT(address(nft)), IHonkVerifier(address(verifier)));
        emptyRoot = registry.EMPTY_ROOT();
    }

    function test_startsAtTheEmptyRoot() public view {
        assertEq(registry.root(), emptyRoot);
        assertEq(registry.memberCount(), 0);
    }

    function test_joinAppendsAndMovesTheRoot() public {
        bytes32 newRoot = keccak256("root-1");

        vm.prank(alice);
        registry.join(0, keccak256("alice"), emptyRoot, newRoot, PROOF);

        assertEq(registry.root(), newRoot);
        assertEq(registry.memberCount(), 1);
        assertTrue(registry.tokenHasJoined(0));
        assertTrue(registry.commitmentTaken(keccak256("alice")));
    }

    /// The root, the next index and the commitment are all pinned by the
    /// contract, not chosen by the caller. Getting this wrong is how a member
    /// would sneak extra leaves into the tree.
    function test_bindsCurrentRootAndNextIndexIntoTheProof() public {
        bytes32 newRoot = keccak256("root-1");
        bytes32 commitment = keccak256("alice");

        bytes32[] memory expected = new bytes32[](4);
        expected[0] = emptyRoot;
        expected[1] = newRoot;
        expected[2] = commitment;
        expected[3] = bytes32(uint256(0));
        verifier.expectPublicInputs(expected);

        vm.prank(alice);
        registry.join(0, commitment, emptyRoot, newRoot, PROOF);

        // Second append must be pinned to index 1 and the *new* root.
        bytes32 secondRoot = keccak256("root-2");
        expected[0] = newRoot;
        expected[1] = secondRoot;
        expected[2] = keccak256("bob");
        expected[3] = bytes32(uint256(1));
        verifier.expectPublicInputs(expected);

        vm.prank(bob);
        registry.join(1, keccak256("bob"), newRoot, secondRoot, PROOF);
        assertEq(registry.memberCount(), 2);
    }

    function test_rejectsANonHolder() public {
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(MemberRegistry.NotTokenHolder.selector, 0, outsider));
        registry.join(0, keccak256("x"), emptyRoot, keccak256("root-1"), PROOF);
    }

    /// Otherwise passing the NFT around would buy a seat per hop.
    function test_rejectsASecondJoinForTheSameToken() public {
        vm.prank(alice);
        registry.join(0, keccak256("alice"), emptyRoot, keccak256("root-1"), PROOF);

        vm.prank(alice);
        nft.transfer(bob, 0);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(MemberRegistry.TokenAlreadyJoined.selector, 0));
        registry.join(0, keccak256("bob"), keccak256("root-1"), keccak256("root-2"), PROOF);
    }

    function test_rejectsADuplicateCommitment() public {
        vm.prank(alice);
        registry.join(0, keccak256("same"), emptyRoot, keccak256("root-1"), PROOF);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(MemberRegistry.CommitmentAlreadyRegistered.selector, keccak256("same")));
        registry.join(1, keccak256("same"), keccak256("root-1"), keccak256("root-2"), PROOF);
    }

    /// Two members racing gives one of them a clear "rebuild and retry".
    function test_rejectsAJoinBuiltOnAStaleRoot() public {
        vm.prank(alice);
        registry.join(0, keccak256("alice"), emptyRoot, keccak256("root-1"), PROOF);

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(MemberRegistry.StaleRoot.selector, keccak256("root-1"), emptyRoot)
        );
        registry.join(1, keccak256("bob"), emptyRoot, keccak256("root-2"), PROOF);
    }

    function test_rejectsABadProof() public {
        verifier.setAccepts(false);
        vm.prank(alice);
        vm.expectRevert(MemberRegistry.InvalidJoinProof.selector);
        registry.join(0, keccak256("alice"), emptyRoot, keccak256("root-1"), PROOF);
    }

    function test_capacityMatchesTheCircuitDepth() public view {
        assertEq(registry.TREE_DEPTH(), 8);
        assertEq(registry.CAPACITY(), 256);
    }
}
