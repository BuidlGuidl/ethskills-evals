// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {MembershipNFT} from "../src/mocks/MembershipNFT.sol";
import {MembershipRegistry} from "../src/MembershipRegistry.sol";
import {PrivateBallot} from "../src/PrivateBallot.sol";
import {IERC721Minimal} from "../src/interfaces/IERC721Minimal.sol";
import {IVerifier} from "../src/interfaces/IVerifier.sol";
import {HonkVerifier} from "../src/verifiers/HonkVerifier.sol";

/// @notice Replays a real proof (test/fixtures/ballot.json, regenerate with
///         `node scripts/make-test-fixture.js`) against the real verifier.
contract PrivateBallotTest is Test {
    MembershipNFT internal nft;
    MembershipRegistry internal registry;
    PrivateBallot internal ballot;

    // From the fixture.
    bytes32[] internal commitments;
    uint256 internal fixtureRoot;
    uint256 internal nullifier;
    bool internal support;
    address internal submitter;
    bytes internal proof;

    address internal proposer = address(0xB0B);
    /// Fixed deployer + nonce so PrivateBallot lands on the address the
    /// fixture's nullifier scope was computed for.
    address internal ballotDeployer;
    uint256 internal proposalScope;

    function setUp() public {
        string memory json = vm.readFile("test/fixtures/ballot.json");
        commitments = vm.parseJsonBytes32Array(json, ".commitments");
        fixtureRoot = uint256(vm.parseJsonBytes32(json, ".root"));
        nullifier = uint256(vm.parseJsonBytes32(json, ".nullifier"));
        support = vm.parseJsonBool(json, ".support");
        ballotDeployer = vm.parseJsonAddress(json, ".ballotDeployer");
        proposalScope = uint256(vm.parseJsonBytes32(json, ".proposalScope"));
        vm.chainId(uint256(vm.parseJsonUint(json, ".chainId")));
        submitter = vm.parseJsonAddress(json, ".submitter");
        proof = vm.parseJsonBytes(json, ".proof");

        nft = new MembershipNFT();
        registry = new MembershipRegistry(IERC721Minimal(address(nft)));

        HonkVerifier verifier = new HonkVerifier();
        vm.setNonce(ballotDeployer, 0);
        vm.prank(ballotDeployer);
        ballot = new PrivateBallot(registry, IVerifier(address(verifier)));
        assertEq(address(ballot), vm.parseJsonAddress(json, ".ballotAddress"), "fixture ballot address drifted");

        // Every fixture leaf joins from its own wallet, in fixture order.
        for (uint256 i = 0; i < commitments.length; i++) {
            address member = address(uint160(0x1000 + i));
            nft.mint(member, i + 1);
            vm.prank(member);
            registry.register(i + 1, uint256(commitments[i]));
        }

        nft.mint(proposer, 1000);
    }

    /// The nullifier is bound to (secret, proposal, contract, chain).
    function test_nullifier_scope_matches_the_fixture() public view {
        assertEq(ballot.proposalScope(1), proposalScope);
    }

    /// The on-chain incremental tree, the JS tree builder and the circuit all
    /// have to agree on the root, or no proof would ever verify.
    function test_onchain_root_matches_the_offchain_tree() public view {
        assertEq(registry.root(), fixtureRoot, "root mismatch");
    }

    function test_a_real_ballot_verifies_and_counts() public {
        uint256 proposalId = _createProposal();

        vm.prank(submitter);
        ballot.castVote(proposalId, nullifier, support, submitter, proof);

        assertTrue(ballot.nullifierSpent(proposalId, nullifier));

        vm.warp(block.timestamp + 2 days);
        (uint32 yes, uint32 no, uint32 electorate) = ballot.tally(proposalId);
        assertEq(yes, 1);
        assertEq(no, 0);
        assertEq(electorate, uint32(commitments.length));
    }

    /// One member, one vote: the second ballot with the same nullifier dies
    /// before it even reaches the verifier.
    function test_the_same_member_cannot_vote_twice() public {
        uint256 proposalId = _createProposal();

        vm.prank(submitter);
        ballot.castVote(proposalId, nullifier, support, submitter, proof);

        vm.prank(submitter);
        vm.expectRevert(PrivateBallot.AlreadyVoted.selector);
        ballot.castVote(proposalId, nullifier, support, submitter, proof);
    }

    /// The submitter is bound into the proof, so a proof lifted from the
    /// mempool cannot be replayed from another address.
    function test_a_stranger_cannot_relay_someone_elses_proof() public {
        uint256 proposalId = _createProposal();

        vm.prank(address(0xDEAD));
        vm.expectRevert(PrivateBallot.WrongSubmitter.selector);
        ballot.castVote(proposalId, nullifier, support, submitter, proof);
    }

    /// Flipping the yes/no in the calldata invalidates the proof: the relayer
    /// cannot rewrite the ballot it was handed.
    function test_the_relayer_cannot_flip_the_vote() public {
        uint256 proposalId = _createProposal();

        vm.prank(submitter);
        vm.expectRevert(PrivateBallot.InvalidProof.selector);
        ballot.castVote(proposalId, nullifier, !support, submitter, proof);
    }

    /// A nullifier is bound to (secret, scope); the proof does not carry over
    /// to the next proposal.
    function test_a_ballot_does_not_carry_to_another_proposal() public {
        _createProposal();
        uint256 second = _createProposal();

        vm.prank(submitter);
        vm.expectRevert(PrivateBallot.InvalidProof.selector);
        ballot.castVote(second, nullifier, support, submitter, proof);
    }

    function test_voting_closes_at_the_deadline() public {
        uint256 proposalId = _createProposal();
        vm.warp(block.timestamp + 2 days);

        vm.prank(submitter);
        vm.expectRevert(PrivateBallot.VotingClosed.selector);
        ballot.castVote(proposalId, nullifier, support, submitter, proof);
    }

    function test_tally_is_only_final_after_the_deadline() public {
        uint256 proposalId = _createProposal();
        vm.expectRevert(PrivateBallot.VotingStillOpen.selector);
        ballot.tally(proposalId);
    }

    function test_only_members_open_proposals() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(PrivateBallot.NotAMember.selector);
        ballot.createProposal(keccak256("nope"), 1 days);
    }

    function _createProposal() internal returns (uint256 proposalId) {
        vm.prank(proposer);
        proposalId = ballot.createProposal(keccak256("Ship the thing?"), 1 days);
    }
}
