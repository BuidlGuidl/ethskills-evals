// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {HonkVerifier, IVerifier} from "../src/VoteVerifier.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {AnonymousVoting} from "../src/AnonymousVoting.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";

contract VotingTest is Test {
    MembershipNFT nft;
    MemberRegistry registry;
    HonkVerifier verifier;
    AnonymousVoting voting;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 commitment;
    bytes32 root;
    bytes32 scope;
    bytes32 nullifierHash;
    bytes proof;

    function setUp() public {
        nft = new MembershipNFT(address(this));
        nft.mint(alice); // token 1
        nft.mint(bob); // token 2
        registry = new MemberRegistry(IERC721(address(nft)));
        verifier = new HonkVerifier();
        voting = new AnonymousVoting(registry, verifier, 1);

        string memory j = vm.readFile("test/fixtures/vote_proof.json");
        commitment = vm.parseJsonUint(j, ".commitment");
        root = vm.parseJsonBytes32(j, ".root");
        scope = vm.parseJsonBytes32(j, ".scope");
        nullifierHash = vm.parseJsonBytes32(j, ".nullifierHash");
        proof = vm.parseJsonBytes(j, ".proof");
    }

    function _inputs(uint256 vote) internal view returns (bytes32[] memory pi) {
        pi = new bytes32[](4);
        (pi[0], pi[1], pi[2], pi[3]) = (root, scope, bytes32(vote), nullifierHash);
    }

    // Solidity PoseidonT3 tree == poseidon-lite + zk-kit IMT tree == Noir hash_2 tree.
    function test_PoseidonParity_RegistryRootMatchesCircuitRoot() public {
        vm.prank(alice);
        registry.register(1, commitment);
        assertEq(bytes32(registry.root()), root);
    }

    function test_RealProofVerifies() public view {
        assertTrue(verifier.verify(proof, _inputs(1)));
    }

    function test_FlippedVoteRejected() public {
        // A relayer cannot change a yes into a no: the vote is bound by the proof.
        try verifier.verify(proof, _inputs(0)) returns (bool ok) {
            assertFalse(ok);
        } catch {}
    }

    function test_OnlyTokenOwnerRegisters_Once() public {
        vm.prank(bob);
        vm.expectRevert(MemberRegistry.NotTokenOwner.selector);
        registry.register(1, commitment);

        vm.prank(alice);
        registry.register(1, commitment);

        // Transferring the NFT does not buy a second leaf.
        vm.prank(alice);
        nft.transferFrom(alice, bob, 1);
        vm.prank(bob);
        vm.expectRevert(MemberRegistry.AlreadyRegistered.selector);
        registry.register(1, 999);
    }

    function test_ProposalNeedsMemberAndAnonymitySet() public {
        AnonymousVoting strict = new AnonymousVoting(registry, verifier, 2);
        vm.prank(alice);
        registry.register(1, commitment);

        vm.prank(bob);
        vm.expectRevert(AnonymousVoting.NotMember.selector);
        strict.createProposal(1, bytes32(0), 1 days);

        vm.prank(alice);
        vm.expectRevert(AnonymousVoting.AnonymitySetTooSmall.selector);
        strict.createProposal(1, bytes32(0), 1 days);
    }

    function test_WrongProposalScopeRejected() public {
        // The fixture proof was made for scope 42; a real proposal's scope differs,
        // so the same proof cannot be counted there.
        vm.prank(alice);
        registry.register(1, commitment);
        vm.prank(alice);
        uint256 id = voting.createProposal(1, bytes32(0), 1 days);
        assertEq(bytes32(voting.getProposal(id).root), root);
        vm.expectRevert();
        voting.castVote(id, true, uint256(nullifierHash), proof);
        assertFalse(voting.nullifierUsed(uint256(nullifierHash)));
    }
}
