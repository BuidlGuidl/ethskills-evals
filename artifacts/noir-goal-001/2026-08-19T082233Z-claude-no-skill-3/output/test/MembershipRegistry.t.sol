// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {MembershipNFT} from "../src/mocks/MembershipNFT.sol";
import {MembershipRegistry} from "../src/MembershipRegistry.sol";
import {IERC721Minimal} from "../src/interfaces/IERC721Minimal.sol";
import {Hash} from "../src/libraries/Hash.sol";

contract MembershipRegistryTest is Test {
    MembershipNFT internal nft;
    MembershipRegistry internal registry;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        nft = new MembershipNFT();
        registry = new MembershipRegistry(IERC721Minimal(address(nft)));
        nft.mint(alice, 1);
        nft.mint(bob, 2);
    }

    /// The incremental root the contract maintains must equal a plain
    /// bottom-up rebuild of the same tree - that rebuild is what every voter
    /// does locally in js/core/merkle.js.
    function test_incremental_root_matches_a_full_rebuild() public {
        uint256 empty = registry.root();
        assertEq(empty, _fullRoot(new uint256[](0)));

        uint256[] memory leaves = new uint256[](2);
        leaves[0] = Hash.pair(uint256(keccak256("alice")), 0);
        leaves[1] = Hash.pair(uint256(keccak256("bob")), 0);

        vm.prank(alice);
        registry.register(1, leaves[0]);
        uint256[] memory afterFirst = new uint256[](1);
        afterFirst[0] = leaves[0];
        assertEq(registry.root(), _fullRoot(afterFirst));

        vm.prank(bob);
        registry.register(2, leaves[1]);
        assertEq(registry.root(), _fullRoot(leaves));
        assertEq(registry.memberCount(), 2);
    }

    function test_only_the_nft_holder_can_join() public {
        vm.prank(bob);
        vm.expectRevert(MembershipRegistry.NotTokenOwner.selector);
        registry.register(1, Hash.pair(1, 0));
    }

    /// One leaf per membership NFT, not per wallet: moving the NFT to a fresh
    /// wallet must not buy a second vote.
    function test_a_transferred_nft_cannot_join_again() public {
        vm.prank(alice);
        registry.register(1, Hash.pair(uint256(keccak256("alice")), 0));

        vm.prank(alice);
        nft.transferFrom(alice, address(0xCAFE), 1);

        vm.prank(address(0xCAFE));
        vm.expectRevert(MembershipRegistry.TokenAlreadyRegistered.selector);
        registry.register(1, Hash.pair(uint256(keccak256("cafe")), 0));
    }

    /// Copying a leaf out of the logs must not be possible - it would burn the
    /// copier's own slot without ever letting them vote.
    function test_a_commitment_cannot_be_registered_twice() public {
        uint256 leaf = Hash.pair(uint256(keccak256("alice")), 0);

        vm.prank(alice);
        registry.register(1, leaf);

        vm.prank(bob);
        vm.expectRevert(MembershipRegistry.CommitmentAlreadyRegistered.selector);
        registry.register(2, leaf);
    }

    function test_commitments_must_be_field_elements() public {
        vm.prank(alice);
        vm.expectRevert(MembershipRegistry.CommitmentOutOfRange.selector);
        registry.register(1, type(uint256).max);

        vm.prank(alice);
        vm.expectRevert(MembershipRegistry.CommitmentOutOfRange.selector);
        registry.register(1, 0);
    }

    /// Straightforward reference implementation: pad to 2^depth leaves with
    /// EMPTY_LEAF and hash all the way up.
    function _fullRoot(uint256[] memory leaves) internal view returns (uint256) {
        uint256 depth = registry.TREE_DEPTH();
        uint256 width = 1 << depth;
        uint256[] memory level = new uint256[](width);

        for (uint256 i = 0; i < width; i++) {
            level[i] = i < leaves.length ? leaves[i] : registry.EMPTY_LEAF();
        }

        while (width > 1) {
            width /= 2;
            for (uint256 i = 0; i < width; i++) {
                level[i] = Hash.pair(level[2 * i], level[2 * i + 1]);
            }
        }
        return level[0];
    }
}
