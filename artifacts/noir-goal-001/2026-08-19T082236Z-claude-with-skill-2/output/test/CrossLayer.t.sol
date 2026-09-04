// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {MembershipNFT} from "../contracts/MembershipNFT.sol";
import {VoterRegistry} from "../contracts/VoterRegistry.sol";

/// The single most load-bearing assumption in this system: Noir, Solidity and JavaScript
/// must agree on Poseidon and on the tree layout. If they drift, proofs stop verifying with
/// no error message worth reading. These vectors were produced by the other two layers.
contract CrossLayerTest is Test {
    MembershipNFT internal nft;
    VoterRegistry internal registry;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        nft = new MembershipNFT(address(this));
        registry = new VoterRegistry(nft);
    }

    // From `nargo execute` on poseidon::poseidon::bn254::hash_2([1, 2])
    // and from poseidon-lite's poseidon2([1n, 2n]).
    function test_PoseidonAgreesWithNoirAndJs() public pure {
        assertEq(
            PoseidonT3.hash([uint256(1), uint256(2)]),
            0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a,
            "Solidity Poseidon diverged from the circuit"
        );
    }

    // From the zk-kit IMT mirror: new IMT(poseidon2, 10, ZERO_VALUE, 2, []).root
    function test_EmptyRootAgreesWithJsMirror() public view {
        assertEq(
            registry.root(), 0x1ce3cff30d404f5a1c4c3aee8ad5144ce86808e2fd9a89377315c92facff1738
        );
    }

    // From the same mirror after inserting 111, 222, 333 in order.
    function test_RootAfterThreeJoinsAgreesWithJsMirror() public {
        _joinAs(alice, 111);
        _joinAs(bob, 222);
        _joinAs(address(0xCA11), 333);

        assertEq(registry.leafCount(), 3);
        assertEq(
            registry.root(), 0x1b5f8c67698c395eb7ff48b62b82fcb832c887b1e4bda77b2a00cb298174ed55
        );
    }

    function test_JoinEmitsWhatTheMirrorNeeds() public {
        uint256 tokenId = nft.mint(alice);
        vm.expectEmit(true, false, false, false);
        emit VoterRegistry.CommitmentAdded(0, 111, 0);
        vm.prank(alice);
        registry.join(tokenId, 111);
    }

    function test_JoinRequiresOwningTheBadge() public {
        uint256 tokenId = nft.mint(alice);
        vm.prank(bob);
        vm.expectRevert(VoterRegistry.NotTokenOwner.selector);
        registry.join(tokenId, 111);
    }

    function test_OneJoinPerBadge() public {
        uint256 tokenId = _joinAs(alice, 111);
        vm.prank(alice);
        vm.expectRevert(VoterRegistry.TokenAlreadyJoined.selector);
        registry.join(tokenId, 222);
    }

    function test_CommitmentMustBeInField() public {
        uint256 tokenId = nft.mint(alice);
        vm.prank(alice);
        vm.expectRevert(VoterRegistry.CommitmentOutOfField.selector);
        registry.join(tokenId, type(uint256).max);
    }

    function test_MembershipIsOnePerWallet() public {
        nft.mint(alice);
        vm.expectRevert(MembershipNFT.AlreadyMember.selector);
        nft.mint(alice);
    }

    function _joinAs(address member, uint256 commitment) internal returns (uint256 tokenId) {
        tokenId = nft.mint(member);
        vm.prank(member);
        registry.join(tokenId, commitment);
    }
}
