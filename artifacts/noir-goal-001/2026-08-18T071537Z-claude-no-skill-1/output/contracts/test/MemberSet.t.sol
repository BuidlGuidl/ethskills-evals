// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Keccak248} from "../src/Keccak248.sol";
import {MemberSet} from "../src/MemberSet.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";

contract MemberSetTest is Test {
    MembershipNFT nft;
    MemberSet set;

    address constant ADMIN = address(0xA11CE);

    function setUp() public {
        vm.prank(ADMIN);
        nft = new MembershipNFT(ADMIN);
        set = new MemberSet(nft);
    }

    function _member(uint256 i) internal returns (address who, uint256 tokenId) {
        who = address(uint160(0x1000 + i));
        vm.prank(ADMIN);
        tokenId = nft.mint(who);
    }

    /// The circuit hardcodes these tags (circuits/private_vote/src/main.nr).
    /// If either side is ever edited alone, every proof stops verifying, so
    /// pin them here.
    function test_DomainTagsMatchTheCircuit() public pure {
        assertEq(
            bytes32(uint256(keccak256("dao.private-ballot.v1.commitment")) & Keccak248.MASK),
            bytes32(0x0034ecca8b4f6d9dafdf3ced9eebc753ee17df9b6c7fc62c869ebd579303eb36),
            "TAG_COMMITMENT drifted from main.nr"
        );
        assertEq(
            bytes32(uint256(keccak256("dao.private-ballot.v1.nullifier")) & Keccak248.MASK),
            bytes32(0x00e33d762b98f0a02efaae6d0fb2a7b484b96dbaab3c09061884c16e3088d6f9),
            "TAG_NULLIFIER drifted from main.nr"
        );
    }

    function test_TruncatedHashIsAlwaysAFieldElement() public pure {
        // BN254 modulus; a value above it cannot be a circuit input.
        uint256 p = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        for (uint256 i = 0; i < 64; i++) {
            bytes32 h = Keccak248.hash2(bytes32(i), bytes32(i * 7 + 1));
            assertLt(uint256(h), p);
            assertLt(uint256(h), 2 ** 248);
        }
    }

    /// The incremental root must equal a from-scratch rebuild of the same
    /// leaves -- that rebuild is exactly what a member does off chain to get
    /// their Merkle path, so a mismatch means nobody can prove membership.
    function test_IncrementalRootMatchesFullRebuild() public {
        uint256 n = 150;
        bytes32[] memory commitments = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            (address who, uint256 tokenId) = _member(i);
            commitments[i] = Keccak248.hash2(bytes32(i + 1), bytes32(uint256(0xBEEF)));
            vm.prank(who);
            set.enroll(tokenId, commitments[i]);
            // Rebuilding is O(2^depth); spot-check the shapes that matter
            // (first leaf, both child sides, a full subtree, the real set).
            uint256 c = i + 1;
            if (c == 1 || c == 2 || c == 3 || c == 8 || c == 33 || c == n) {
                assertEq(set.root(), _rebuild(commitments, c), "root diverged from full rebuild");
            }
        }
        assertEq(set.memberCount(), n);
        assertEq(set.allLeaves().length, n);
        assertEq(set.leavesAt(10).length, 10);
    }

    function _rebuild(bytes32[] memory commitments, uint256 count) internal view returns (bytes32) {
        uint256 depth = set.TREE_DEPTH();
        uint256 width = 2 ** depth;
        bytes32[] memory level = new bytes32[](width);
        for (uint256 i = 0; i < width; i++) {
            level[i] = i < count ? commitments[i] : set.EMPTY_LEAF();
        }
        for (uint256 d = 0; d < depth; d++) {
            width /= 2;
            for (uint256 i = 0; i < width; i++) {
                level[i] = Keccak248.hash2(level[2 * i], level[2 * i + 1]);
            }
        }
        return level[0];
    }

    function test_OnlyTheTokenHolderCanEnroll() public {
        (, uint256 tokenId) = _member(1);
        vm.prank(address(0xBAD));
        vm.expectRevert(MemberSet.NotTokenHolder.selector);
        set.enroll(tokenId, bytes32(uint256(1)));
    }

    function test_OneCommitmentPerSeat() public {
        (address who, uint256 tokenId) = _member(1);
        vm.startPrank(who);
        set.enroll(tokenId, bytes32(uint256(1)));
        vm.expectRevert(MemberSet.AlreadyEnrolled.selector);
        set.enroll(tokenId, bytes32(uint256(2)));
        vm.stopPrank();
    }

    /// Enrolment is a public transaction, so a duplicate commitment is what a
    /// griefer submits after copying one out of the mempool. Rejecting it would
    /// lock the victim out for good -- their commitment is derived from their
    /// wallet and cannot be changed. So duplicates are allowed, and are only
    /// ever self-harm: the copied leaf is spendable by whoever knows the secret,
    /// and the nullifier still caps that secret at one ballot per proposal.
    function test_ACopiedCommitmentCannotLockTheRealMemberOut() public {
        (address victim, uint256 victimToken) = _member(1);
        (address griefer, uint256 grieferToken) = _member(2);
        bytes32 commitment = Keccak248.hash2(bytes32(uint256(0xDECAF)), bytes32(uint256(1)));

        // Griefer front-runs the victim with the victim's own commitment.
        vm.prank(griefer);
        set.enroll(grieferToken, commitment);

        // The victim still gets in.
        vm.prank(victim);
        uint256 leafIndex = set.enroll(victimToken, commitment);
        assertEq(leafIndex, 1);
        assertEq(set.memberCount(), 2);
        assertTrue(set.enrolled(victimToken));
    }

    function test_RejectsCommitmentsTheCircuitCannotHold() public {
        (address who, uint256 tokenId) = _member(1);
        vm.prank(who);
        vm.expectRevert(MemberSet.InvalidCommitment.selector);
        set.enroll(tokenId, bytes32(0));

        vm.prank(who);
        vm.expectRevert(MemberSet.InvalidCommitment.selector);
        set.enroll(tokenId, bytes32(type(uint256).max));
    }

    function test_MembershipIsSoulbound() public {
        (address who,) = _member(1);
        vm.prank(who);
        vm.expectRevert(MembershipNFT.Soulbound.selector);
        nft.transferFrom(who, address(0xBEEF), 1);
    }
}
