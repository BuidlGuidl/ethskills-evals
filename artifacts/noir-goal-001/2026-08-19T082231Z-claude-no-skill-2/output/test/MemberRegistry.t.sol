// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TestBase} from "./TestBase.sol";
import {FieldHash} from "../src/FieldHash.sol";
import {MemberRegistry, IMembershipNFT} from "../src/MemberRegistry.sol";
import {MembershipNFT} from "../src/demo/MembershipNFT.sol";

contract MemberRegistryTest is TestBase {
    MembershipNFT nft;
    MemberRegistry registry;

    address constant ADMIN = address(0xA11CE);
    address constant MEMBER_1 = address(0x1111);
    address constant MEMBER_2 = address(0x2222);
    address constant OUTSIDER = address(0xDEAD);

    /// tokenId 1 belongs to MEMBER_1, tokenId 2 to MEMBER_2.
    uint256 constant TOKEN_1 = 1;
    uint256 constant TOKEN_2 = 2;

    function setUp() public {
        vm.prank(ADMIN);
        nft = new MembershipNFT(ADMIN);
        vm.prank(ADMIN);
        nft.mint(MEMBER_1);
        vm.prank(ADMIN);
        nft.mint(MEMBER_2);
        registry = new MemberRegistry(IMembershipNFT(address(nft)));
    }

    /// @dev Always bind the commitment to a local BEFORE `vm.prank`. `FieldHash`
    ///      staticcalls the sha256 precompile, and that call would consume the prank.
    function _commitment(uint256 secret) internal pure returns (bytes32) {
        return FieldHash.hash1(bytes32(secret));
    }

    function test_emptyRootIsTheAllZeroTree() public view {
        bytes32 node = bytes32(0);
        for (uint256 i = 0; i < registry.TREE_DEPTH(); i++) {
            node = FieldHash.hash2(node, node);
        }
        assertEq(registry.root(), node, "empty root is wrong");
        assertEq(registry.memberCount(), 0, "empty registry should have no members");
    }

    function test_onlyTheTokenOwnerCanRegisterIt() public {
        bytes32 commitment = _commitment(1);
        vm.prank(OUTSIDER);
        vm.expectRevert(MemberRegistry.NotAMember.selector);
        registry.register(TOKEN_1, commitment);

        // Holding *a* membership NFT is not enough - it must be that one.
        vm.prank(MEMBER_2);
        vm.expectRevert(MemberRegistry.NotAMember.selector);
        registry.register(TOKEN_1, commitment);
    }

    function test_oneCommitmentPerToken() public {
        bytes32 first = _commitment(1);
        bytes32 second = _commitment(99);

        vm.prank(MEMBER_1);
        registry.register(TOKEN_1, first);

        vm.prank(MEMBER_1);
        vm.expectRevert(MemberRegistry.AlreadyRegistered.selector);
        registry.register(TOKEN_1, second);
    }

    /// Registering, transferring the NFT and registering again would be a second vote
    /// for one membership - and an extra tree leaf under one party's control.
    function test_transferringTheNftDoesNotUnlockASecondRegistration() public {
        bytes32 first = _commitment(1);
        bytes32 second = _commitment(99);

        vm.prank(MEMBER_1);
        registry.register(TOKEN_1, first);

        vm.prank(MEMBER_1);
        nft.transferFrom(MEMBER_1, MEMBER_2, TOKEN_1);

        vm.prank(MEMBER_2);
        vm.expectRevert(MemberRegistry.AlreadyRegistered.selector);
        registry.register(TOKEN_1, second);

        assertEq(registry.memberCount(), 1, "the tree grew from a transfer");
    }

    /// Two members sharing a leaf would silently cost one of them their vote, because
    /// they would also share every nullifier.
    function test_commitmentsCannotBeShared() public {
        bytes32 commitment = _commitment(1);

        vm.prank(MEMBER_1);
        registry.register(TOKEN_1, commitment);

        vm.prank(MEMBER_2);
        vm.expectRevert(MemberRegistry.CommitmentTaken.selector);
        registry.register(TOKEN_2, commitment);
    }

    function test_rejectsCommitmentsOutsideTheField() public {
        vm.prank(MEMBER_1);
        vm.expectRevert(MemberRegistry.InvalidCommitment.selector);
        registry.register(TOKEN_1, bytes32(type(uint256).max));

        vm.prank(MEMBER_1);
        vm.expectRevert(MemberRegistry.InvalidCommitment.selector);
        registry.register(TOKEN_1, bytes32(0));
    }

    /// The incremental root must equal a root computed the naive way over the whole
    /// padded leaf array. This is the property members rely on when they rebuild the
    /// tree offchain from `MemberRegistered` events before proving against it.
    function test_incrementalRootMatchesFullRecomputation() public {
        bytes32 leaf0 = _commitment(1);
        bytes32 leaf1 = _commitment(2);

        vm.prank(MEMBER_1);
        registry.register(TOKEN_1, leaf0);
        assertEq(registry.root(), _fullRoot(_leaves(1)), "root wrong after 1 leaf");

        vm.prank(MEMBER_2);
        registry.register(TOKEN_2, leaf1);
        assertEq(registry.root(), _fullRoot(_leaves(2)), "root wrong after 2 leaves");
        assertEq(registry.memberCount(), 2, "member count wrong");
        assertEq(registry.commitments(0), leaf0, "leaf 0 wrong");
        assertEq(registry.commitments(1), leaf1, "leaf 1 wrong");
    }

    function _leaves(uint256 n) internal pure returns (bytes32[] memory leaves) {
        leaves = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            leaves[i] = FieldHash.hash1(bytes32(i + 1));
        }
    }

    /// Recompute the root by hashing every level in full, zero-padding as needed.
    function _fullRoot(bytes32[] memory leaves) internal view returns (bytes32) {
        uint256 depth = registry.TREE_DEPTH();
        uint256 width = 1 << depth;
        bytes32[] memory level = new bytes32[](width);
        for (uint256 i = 0; i < leaves.length; i++) {
            level[i] = leaves[i];
        }
        while (width > 1) {
            width /= 2;
            for (uint256 i = 0; i < width; i++) {
                level[i] = FieldHash.hash2(level[2 * i], level[2 * i + 1]);
            }
        }
        return level[0];
    }
}
