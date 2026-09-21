// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {HonkVerifier} from "../src/verifiers/HonkVerifier.sol";
import {IBallotVerifier} from "../src/interfaces/IBallotVerifier.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {AnonymousVoting} from "../src/AnonymousVoting.sol";

/// Integration tests against the REAL generated verifier. Proofs are produced
/// by NoirJS/bb.js through FFI (scripts/test/prove-ballot.mjs), so these also
/// check Poseidon parity (Solidity PoseidonT3 / LeanIMT ↔ poseidon-lite ↔ Noir)
/// and public-input ordering. Requires `bash scripts/build-circuit.sh` first.
contract AnonymousVotingTest is Test {
    uint256 constant MEMBERS = 5;
    uint256 constant R = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    MembershipNFT nft;
    AnonymousVoting voting;
    address[] wallets;
    address relayer = makeAddr("relayer");

    function setUp() public {
        nft = new MembershipNFT(address(this));
        voting = new AnonymousVoting(IERC721(address(nft)), IBallotVerifier(address(new HonkVerifier())), MEMBERS);
        for (uint256 i; i < MEMBERS; i++) {
            address w = makeAddr(string.concat("member", vm.toString(i)));
            wallets.push(w);
            uint256 tokenId = nft.mint(w);
            uint256 c = commitment(i); // PoseidonT3 is an external library call: compute before prank
            vm.prank(w);
            voting.register(tokenId, c);
        }
    }

    // Same deterministic identities as scripts/test/prove-ballot.mjs.
    function commitment(uint256 i) internal pure returns (uint256) {
        uint256 inner = PoseidonT3.hash([1000 * i + 1, 1000 * i + 2]);
        return PoseidonT3.hash([uint256(1), inner]);
    }

    function prove(uint256 member, uint256 proposalId, bool support)
        internal
        returns (bytes32 nullifierHash, bytes memory proof)
    {
        string[] memory cmd = new string[](6);
        cmd[0] = "node";
        cmd[1] = "../scripts/test/prove-ballot.mjs";
        cmd[2] = vm.toString(MEMBERS);
        cmd[3] = vm.toString(member);
        cmd[4] = vm.toString(voting.scopeOf(proposalId));
        cmd[5] = support ? "1" : "0";
        return abi.decode(vm.ffi(cmd), (bytes32, bytes));
    }

    function open() internal returns (uint256) {
        vm.prank(wallets[0]);
        return voting.createProposal(1, keccak256("proposal"), uint64(block.timestamp + 1 days));
    }

    function test_voteAndTally() public {
        uint256 pid = open();
        (bytes32 n1, bytes memory p1) = prove(1, pid, true);
        (bytes32 n2, bytes memory p2) = prove(2, pid, false);

        vm.startPrank(relayer); // ballots come from a non-member wallet
        voting.castVote(pid, true, n1, p1);
        voting.castVote(pid, false, n2, p2);
        vm.stopPrank();

        vm.expectRevert(AnonymousVoting.VotingOpen.selector);
        voting.tally(pid);

        vm.warp(block.timestamp + 1 days);
        (uint256 yes, uint256 no, uint256 eligible) = voting.tally(pid);
        assertEq(yes, 1);
        assertEq(no, 1);
        assertEq(eligible, MEMBERS);
    }

    function test_rejectsSecondBallotFromSameMember() public {
        uint256 pid = open();
        (bytes32 n, bytes memory p) = prove(3, pid, true);
        voting.castVote(pid, true, n, p);
        vm.expectRevert(AnonymousVoting.AlreadyVoted.selector);
        voting.castVote(pid, true, n, p);
    }

    function test_rejectsFlippedVote() public {
        uint256 pid = open();
        (bytes32 n, bytes memory p) = prove(3, pid, true);
        // The generated verifier reverts (e.g. SumcheckFailed) rather than returning false.
        vm.expectRevert();
        voting.castVote(pid, false, n, p); // relayer tries to flip a yes into a no
    }

    function test_rejectsNonCanonicalNullifier() public {
        uint256 pid = open();
        (bytes32 n, bytes memory p) = prove(3, pid, true);
        vm.expectRevert(AnonymousVoting.InvalidNullifier.selector);
        voting.castVote(pid, true, bytes32(uint256(n) + R), p);
    }

    function test_proofIsBoundToProposal_andNullifiersDifferAcrossProposals() public {
        uint256 pidA = open();
        uint256 pidB = open();
        (bytes32 nA, bytes memory pA) = prove(4, pidA, true);
        vm.expectRevert();
        voting.castVote(pidB, true, nA, pA);

        (bytes32 nB, bytes memory pB) = prove(4, pidB, true);
        assertTrue(nA != nB, "same member must get unlinkable nullifiers per proposal");
        voting.castVote(pidA, true, nA, pA);
        voting.castVote(pidB, true, nB, pB);
    }

    function test_rejectsAfterDeadline() public {
        uint256 pid = open();
        (bytes32 n, bytes memory p) = prove(1, pid, true);
        vm.warp(block.timestamp + 1 days);
        vm.expectRevert(AnonymousVoting.VotingClosed.selector);
        voting.castVote(pid, true, n, p);
    }

    function test_membersRegisteredAfterSnapshotCannotVote() public {
        uint256 pid = open();
        address late = makeAddr("late");
        uint256 tokenId = nft.mint(late);
        uint256 c = commitment(MEMBERS);
        vm.prank(late);
        voting.register(tokenId, c);
        (, uint256 snapshotRoot, uint256 snapshotSize,,) = voting.getProposal(pid);
        assertEq(snapshotSize, MEMBERS);
        assertTrue(snapshotRoot != voting.membershipRoot());
    }

    function test_registrationRules() public {
        vm.expectRevert(AnonymousVoting.NotTokenOwner.selector);
        voting.register(1, 123); // caller doesn't hold token 1
        vm.prank(wallets[0]);
        vm.expectRevert(AnonymousVoting.TokenAlreadyRegistered.selector);
        voting.register(1, 456);
    }

    function test_refusesProposalWithSmallAnonymitySet() public {
        AnonymousVoting v = new AnonymousVoting(IERC721(address(nft)), IBallotVerifier(address(1)), 100);
        vm.prank(wallets[0]);
        vm.expectRevert(abi.encodeWithSelector(AnonymousVoting.AnonymitySetTooSmall.selector, 0, 100));
        v.createProposal(1, bytes32(0), uint64(block.timestamp + 1));
    }
}
