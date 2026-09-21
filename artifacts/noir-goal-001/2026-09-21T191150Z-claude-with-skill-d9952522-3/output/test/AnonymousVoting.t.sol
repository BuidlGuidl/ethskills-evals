// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IVerifier} from "../contracts/HonkVerifier.sol";
import {AnonymousVoting} from "../contracts/AnonymousVoting.sol";
import {MembershipNFT} from "../contracts/MembershipNFT.sol";

/// Contract-level rules. The real proof path (NoirJS proof -> HonkVerifier) is exercised
/// end to end by scripts/demo.mjs against anvil.
contract AnonymousVotingTest is Test {
    MembershipNFT nft;
    AnonymousVoting voting;
    address verifier = makeAddr("verifier");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address relayer = makeAddr("relayer");

    function setUp() public {
        nft = new MembershipNFT(address(this));
        nft.mint(alice); // token 1
        nft.mint(bob); // token 2
        voting = new AnonymousVoting(IERC721(address(nft)), IVerifier(verifier), 2);
    }

    function test_poseidonMatchesCircuitAndJs() public pure {
        // Same vector printed by `nargo test --show-output` (hash_2([1,2])) and poseidon-lite.
        assertEq(PoseidonT3.hash([uint256(1), 2]), 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a);
    }

    function _registerBoth() internal {
        vm.prank(alice);
        voting.register(1, 111);
        vm.prank(bob);
        voting.register(2, 222);
    }

    function test_registerRequiresTokenOwnerAndOncePerToken() public {
        vm.prank(bob);
        vm.expectRevert(AnonymousVoting.NotTokenOwner.selector);
        voting.register(1, 111);

        vm.prank(alice);
        voting.register(1, 111);
        vm.prank(alice);
        vm.expectRevert(AnonymousVoting.AlreadyRegistered.selector);
        voting.register(1, 333);

        // Moving the NFT to a fresh wallet does not grant a second leaf.
        vm.prank(alice);
        nft.transferFrom(alice, bob, 1);
        vm.prank(bob);
        vm.expectRevert(AnonymousVoting.AlreadyRegistered.selector);
        voting.register(1, 444);
    }

    function test_rootMatchesLeanImt() public {
        _registerBoth();
        assertEq(voting.memberRoot(), PoseidonT3.hash([uint256(111), 222]));
    }

    function test_proposalNeedsAnonymitySet() public {
        vm.prank(alice);
        voting.register(1, 111);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AnonymousVoting.AnonymitySetTooSmall.selector, 1, 2));
        voting.createProposal("p", 1 days);
    }

    function test_voteFlowAndTally() public {
        _registerBoth();
        vm.prank(alice);
        uint256 id = voting.createProposal("p", 1 days);
        (uint256 root, uint256 scope,,) = voting.getProposal(id);

        bytes32[] memory inputs = new bytes32[](4);
        inputs[0] = bytes32(root);
        inputs[1] = bytes32(scope);
        inputs[2] = bytes32(uint256(1));
        inputs[3] = bytes32(uint256(999));
        vm.mockCall(verifier, abi.encodeCall(IVerifier.verify, (hex"01", inputs)), abi.encode(true));

        vm.prank(relayer);
        voting.castVote(id, 1, 999, hex"01");

        vm.prank(relayer);
        vm.expectRevert(AnonymousVoting.NullifierAlreadyUsed.selector);
        voting.castVote(id, 1, 999, hex"01");

        vm.expectRevert(AnonymousVoting.VotingOpen.selector);
        voting.tally(id);

        vm.warp(block.timestamp + 1 days + 1);
        (uint256 yes, uint256 no, uint256 eligible) = voting.tally(id);
        assertEq(yes, 1);
        assertEq(no, 0);
        assertEq(eligible, 2);

        vm.expectRevert(AnonymousVoting.VotingClosed.selector);
        voting.castVote(id, 0, 1000, hex"01");
    }

    function test_rejectsInvalidProof() public {
        _registerBoth();
        vm.prank(alice);
        uint256 id = voting.createProposal("p", 1 days);
        vm.mockCall(verifier, abi.encodeWithSelector(IVerifier.verify.selector), abi.encode(false));
        vm.expectRevert(AnonymousVoting.InvalidProof.selector);
        voting.castVote(id, 1, 999, hex"01");
    }

    function test_rejectsNonBinaryVote() public {
        _registerBoth();
        vm.prank(alice);
        uint256 id = voting.createProposal("p", 1 days);
        vm.expectRevert(AnonymousVoting.InvalidVote.selector);
        voting.castVote(id, 2, 999, hex"01");
    }

    function test_scopeDiffersPerProposal() public view {
        assertTrue(voting.scopeOf(0) != voting.scopeOf(1));
    }
}
