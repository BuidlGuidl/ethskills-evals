// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {AnonymousVoting} from "../src/AnonymousVoting.sol";
import {DemoMembershipNFT} from "../src/DemoMembershipNFT.sol";
import {IVerifier} from "../src/IVerifier.sol";
import {MembershipRegistry} from "../src/MembershipRegistry.sol";
import {HonkVerifier} from "../src/verifiers/HonkVerifier.sol";

/// @notice End-to-end tests against the *real* generated verifier and a *real*
/// UltraHonk proof produced by `npm run fixtures`. No mock verifier anywhere:
/// a mock would pass even if the circuit and the contract had drifted apart.
contract AnonymousVotingTest is Test {
    /// Must equal DAO_SCOPE_SEED in client/make-fixtures.mjs.
    bytes32 constant DAO_SCOPE_SEED = keccak256("dao-anonymous-voting/test");
    uint64 constant VOTING_PERIOD = 3 days;

    DemoMembershipNFT nft;
    MembershipRegistry registry;
    AnonymousVoting voting;

    bytes32[] commitments;
    bytes32 fixtureRoot;
    bytes32 fixtureScope;
    bytes32 nullifierHash;
    bytes proof;
    bool support;

    // Second ballot, cast by a different member on the same proposal.
    bytes32 secondNullifierHash;
    bytes secondProof;
    bool secondSupport;

    address relayer = makeAddr("relayer");

    function setUp() public {
        string memory json = vm.readFile("test/fixtures/vote.json");
        assertEq(vm.parseJsonBytes32(json, ".daoScopeSeed"), DAO_SCOPE_SEED, "fixture seed drifted");
        commitments = vm.parseJsonBytes32Array(json, ".commitments");
        fixtureRoot = vm.parseJsonBytes32(json, ".root");
        fixtureScope = vm.parseJsonBytes32(json, ".scope");
        nullifierHash = vm.parseJsonBytes32(json, ".nullifierHash");
        proof = vm.parseJsonBytes(json, ".proof");
        support = vm.parseJsonBool(json, ".support");

        string memory second = vm.readFile("test/fixtures/vote_second_member.json");
        secondNullifierHash = vm.parseJsonBytes32(second, ".nullifierHash");
        secondProof = vm.parseJsonBytes(second, ".proof");
        secondSupport = vm.parseJsonBool(second, ".support");

        nft = new DemoMembershipNFT();
        registry = new MembershipRegistry(IERC721(address(nft)));
        voting = new AnonymousVoting(IVerifier(address(new HonkVerifier())), registry, DAO_SCOPE_SEED);

        for (uint256 i = 0; i < commitments.length; i++) {
            address member = memberAt(i);
            uint256 tokenId = nft.mint(member);
            vm.prank(member);
            registry.join(tokenId, uint256(commitments[i]));
        }
    }

    function memberAt(uint256 i) internal returns (address) {
        return makeAddr(string.concat("member", vm.toString(i)));
    }

    function openProposal() internal returns (uint256 proposalId) {
        vm.prank(memberAt(0));
        proposalId = voting.createProposal("Fund the grants round", VOTING_PERIOD);
    }

    /// The client mirrors the tree in JS; the contract builds it in Solidity.
    /// Equal roots means poseidon-lite and PoseidonT3 agree on every node.
    function test_offchainAndOnchainTreesAgree() public view {
        assertEq(bytes32(registry.root()), fixtureRoot);
        assertEq(registry.memberCount(), commitments.length);
        assertLe(registry.depth(), 16, "tree deeper than the circuit's MAX_DEPTH");
    }

    function test_scopeMatchesTheOneProvenAgainst() public view {
        assertEq(bytes32(voting.scopeOf(0)), fixtureScope);
    }

    /// A real proof, over the real verifier, ending in a real tally.
    function test_endToEnd_realProof() public {
        uint256 proposalId = openProposal();

        AnonymousVoting.Proposal memory p = voting.getProposal(proposalId);
        assertEq(bytes32(p.snapshotRoot), fixtureRoot);
        assertEq(p.snapshotMemberCount, uint32(commitments.length));

        // Sent by a relayer that holds no NFT and is in no registry: the ballot
        // is bound to the proof, never to msg.sender.
        vm.prank(relayer);
        voting.castVote(proposalId, nullifierHash, support, proof);

        assertTrue(voting.nullifierSpent(uint256(fixtureScope), nullifierHash));

        vm.warp(block.timestamp + VOTING_PERIOD);
        (uint256 yes, uint256 no, uint256 eligible, bool passed) = voting.tally(proposalId);
        assertEq(yes, 1);
        assertEq(no, 0);
        assertEq(eligible, commitments.length);
        assertTrue(passed);
    }

    function test_twoMembersVoteOnTheSameProposal() public {
        uint256 proposalId = openProposal();

        vm.prank(relayer);
        voting.castVote(proposalId, nullifierHash, support, proof);
        vm.prank(relayer);
        voting.castVote(proposalId, secondNullifierHash, secondSupport, secondProof);

        assertTrue(nullifierHash != secondNullifierHash, "two members shared a nullifier");

        vm.warp(block.timestamp + VOTING_PERIOD);
        (uint256 yes, uint256 no,, bool passed) = voting.tally(proposalId);
        assertEq(yes, 1);
        assertEq(no, 1);
        assertFalse(passed, "a tie is not a pass");
    }

    function test_revert_sameMemberVotesTwice() public {
        uint256 proposalId = openProposal();
        vm.prank(relayer);
        voting.castVote(proposalId, nullifierHash, support, proof);

        vm.expectRevert(AnonymousVoting.AlreadyVoted.selector);
        vm.prank(relayer);
        voting.castVote(proposalId, nullifierHash, support, proof);
    }

    /// A relayer holding a yes-proof cannot turn it into a no.
    function test_revert_relayerCannotFlipTheBallot() public {
        uint256 proposalId = openProposal();
        vm.expectRevert();
        vm.prank(relayer);
        voting.castVote(proposalId, nullifierHash, !support, proof);
    }

    /// Nor can it re-point the proof at a nullifier of its choosing.
    function test_revert_tamperedNullifier() public {
        uint256 proposalId = openProposal();
        vm.expectRevert();
        vm.prank(relayer);
        voting.castVote(proposalId, bytes32(uint256(nullifierHash) ^ 1), support, proof);
    }

    /// The same identity's proof for proposal 0 is worthless on proposal 1,
    /// because the scope (and therefore the nullifier) differs.
    function test_revert_proofIsNotReplayableOnAnotherProposal() public {
        openProposal();
        vm.prank(memberAt(0));
        uint256 other = voting.createProposal("Unrelated proposal", VOTING_PERIOD);

        assertTrue(voting.scopeOf(0) != voting.scopeOf(other), "scopes collided");

        vm.expectRevert();
        vm.prank(relayer);
        voting.castVote(other, nullifierHash, support, proof);
    }

    function test_revert_voteAfterDeadline() public {
        uint256 proposalId = openProposal();
        vm.warp(block.timestamp + VOTING_PERIOD);

        vm.expectRevert(AnonymousVoting.VotingClosed.selector);
        vm.prank(relayer);
        voting.castVote(proposalId, nullifierHash, support, proof);
    }

    function test_revert_tallyBeforeDeadline() public {
        uint256 proposalId = openProposal();
        vm.expectRevert(AnonymousVoting.VotingStillOpen.selector);
        voting.tally(proposalId);
    }

    function test_revert_unknownProposal() public {
        vm.expectRevert(AnonymousVoting.NoSuchProposal.selector);
        vm.prank(relayer);
        voting.castVote(42, nullifierHash, support, proof);
    }

    function test_revert_nonHolderCannotJoin() public {
        address outsider = makeAddr("outsider");
        vm.expectRevert(MembershipRegistry.NotTokenOwner.selector);
        vm.prank(outsider);
        registry.join(0, uint256(keccak256("outsider commitment")));
    }

    function test_revert_tokenCannotJoinTwice() public {
        vm.expectRevert(MembershipRegistry.AlreadyJoined.selector);
        vm.prank(memberAt(0));
        registry.join(0, uint256(keccak256("a second commitment")));
    }

    /// The registration slot belongs to the NFT, not to a wallet — otherwise a
    /// member could pass their NFT to a second address of their own, join
    /// again and vote twice from one membership.
    function test_revert_transferringTheNftDoesNotBuyASecondLeaf() public {
        address secondWallet = makeAddr("second wallet of member 0");
        vm.prank(memberAt(0));
        nft.transferFrom(memberAt(0), secondWallet, 0);

        vm.expectRevert(MembershipRegistry.AlreadyJoined.selector);
        vm.prank(secondWallet);
        registry.join(0, uint256(keccak256("sockpuppet commitment")));

        assertEq(registry.memberCount(), commitments.length);
    }

    function test_revert_nonHolderCannotOpenProposal() public {
        vm.expectRevert(AnonymousVoting.NotAMember.selector);
        vm.prank(relayer);
        voting.createProposal("spam", VOTING_PERIOD);
    }

    /// Joining after a proposal opened must not change that proposal's
    /// anonymity set, or an in-flight proof would stop verifying.
    function test_lateJoinerDoesNotDisturbAnOpenProposal() public {
        uint256 proposalId = openProposal();

        address latecomer = makeAddr("latecomer");
        uint256 tokenId = nft.mint(latecomer);
        vm.prank(latecomer);
        registry.join(tokenId, uint256(keccak256("late commitment")));

        assertTrue(bytes32(registry.root()) != fixtureRoot, "root should have moved");
        assertEq(bytes32(voting.getProposal(proposalId).snapshotRoot), fixtureRoot);

        vm.prank(relayer);
        voting.castVote(proposalId, nullifierHash, support, proof);
    }
}
