// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Hashes} from "../src/Hashes.sol";
import {MemberRegistry, IMembershipNFT} from "../src/MemberRegistry.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";

contract MemberRegistryTest is Test {
    MembershipNFT internal nft;
    MemberRegistry internal registry;

    function setUp() public {
        nft = new MembershipNFT();
        registry = new MemberRegistry(IMembershipNFT(address(nft)));
    }

    function _member(uint256 i) internal pure returns (address) {
        return address(uint160(0x1000 + i));
    }

    function _mintAndRegister(uint256 i, uint256 commitment) internal {
        address who = _member(i);
        nft.mint(who, i);
        vm.prank(who);
        registry.register(i, commitment);
    }

    /// @dev Independent, naive full-tree recomputation used to check the
    ///      incremental insert. Deliberately written the slow, obvious way.
    function _referenceRoot(uint256[] memory leaves) internal pure returns (uint256) {
        uint256 depth = registryDepth();
        uint256[] memory zeros = new uint256[](depth + 1);
        zeros[0] = 0;
        for (uint256 i = 1; i <= depth; i++) {
            zeros[i] = Hashes.hashPair(zeros[i - 1], zeros[i - 1]);
        }

        uint256[] memory level = leaves;
        for (uint256 d = 0; d < depth; d++) {
            uint256 n = (level.length + 1) / 2;
            uint256[] memory next = new uint256[](n);
            for (uint256 i = 0; i < n; i++) {
                uint256 left = level[2 * i];
                uint256 right = (2 * i + 1 < level.length) ? level[2 * i + 1] : zeros[d];
                next[i] = Hashes.hashPair(left, right);
            }
            level = next;
        }
        return level[0];
    }

    function registryDepth() internal pure returns (uint256) {
        return 8;
    }

    function test_emptyRootIsAllZerosSubtree() public view {
        uint256 expected = 0;
        for (uint256 i = 0; i < 8; i++) expected = Hashes.hashPair(expected, expected);
        assertEq(registry.root(), expected);
        // Same value the JS library computes for an empty tree.
        assertEq(registry.root(), uint256(0x00e532d9e90b6e20db6dc99c4ffebba0906f367aa498d542d49e5035899f1fa0));
    }

    /// @notice The incremental root must equal the JS-computed root for the same
    ///         three leaves -- this is the on-chain/off-chain agreement that lets
    ///         a member build a valid Merkle path from public data.
    function test_rootMatchesJsReferenceVector() public {
        _mintAndRegister(0, 111);
        _mintAndRegister(1, 222);
        _mintAndRegister(2, 333);
        assertEq(registry.root(), uint256(0x0030c8b9bd40429ed2d866bf512776c57fea13dbdd1db56b3114bece881ab55c));
    }

    function test_incrementalRootMatchesFullRecomputation() public {
        uint256[] memory leaves = new uint256[](0);
        for (uint256 i = 0; i < 20; i++) {
            uint256 commitment = uint256(keccak256(abi.encode("member", i))) >> 8;
            _mintAndRegister(i, commitment);

            uint256[] memory grown = new uint256[](leaves.length + 1);
            for (uint256 j = 0; j < leaves.length; j++) grown[j] = leaves[j];
            grown[leaves.length] = commitment;
            leaves = grown;

            assertEq(registry.root(), _referenceRoot(leaves), "incremental root diverged");
        }
        assertEq(registry.memberCount(), 20);
    }

    function test_onlyTokenOwnerCanRegister() public {
        nft.mint(_member(1), 1);
        vm.prank(_member(2));
        vm.expectRevert(MemberRegistry.NotTokenOwner.selector);
        registry.register(1, 999);
    }

    function test_tokenCannotRegisterTwice() public {
        _mintAndRegister(1, 111);
        vm.prank(_member(1));
        vm.expectRevert(MemberRegistry.TokenAlreadyRegistered.selector);
        registry.register(1, 222);
    }

    /// @dev Transferring the NFT must not mint a second vote.
    function test_transferredTokenCannotRegisterAgain() public {
        _mintAndRegister(1, 111);
        vm.prank(_member(1));
        nft.transferFrom(_member(1), _member(2), 1);

        vm.prank(_member(2));
        vm.expectRevert(MemberRegistry.TokenAlreadyRegistered.selector);
        registry.register(1, 222);
    }

    function test_duplicateCommitmentRejected() public {
        _mintAndRegister(1, 111);
        nft.mint(_member(2), 2);
        vm.prank(_member(2));
        vm.expectRevert(MemberRegistry.CommitmentAlreadyRegistered.selector);
        registry.register(2, 111);
    }

    function test_outOfRangeCommitmentRejected() public {
        nft.mint(_member(1), 1);
        vm.prank(_member(1));
        vm.expectRevert(MemberRegistry.CommitmentOutOfRange.selector);
        registry.register(1, Hashes.DIGEST_BOUND);

        vm.prank(_member(1));
        vm.expectRevert(MemberRegistry.CommitmentOutOfRange.selector);
        registry.register(1, 0);
    }
}
