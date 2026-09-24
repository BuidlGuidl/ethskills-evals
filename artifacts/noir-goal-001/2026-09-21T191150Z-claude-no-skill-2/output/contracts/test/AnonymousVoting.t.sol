// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {IVerifier} from "../verifier/HonkVerifier.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {MemberGroup, IMembershipNFT} from "../src/MemberGroup.sol";
import {AnonymousVoting} from "../src/AnonymousVoting.sol";

/// Real proofs are exercised end-to-end by scripts/demo.sh.
contract MockVerifier is IVerifier {
    bool public result = true;

    function setResult(bool r) external {
        result = r;
    }

    function verify(bytes calldata, bytes32[] calldata) external view returns (bool) {
        return result;
    }
}

contract AnonymousVotingTest is Test {
    uint256 constant FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    MembershipNFT nft;
    MemberGroup group;
    MockVerifier verifier;
    AnonymousVoting voting;
    address[] members;

    function setUp() public {
        nft = new MembershipNFT(address(this));
        group = new MemberGroup(IMembershipNFT(address(nft)));
        verifier = new MockVerifier();
        voting = new AnonymousVoting(group, verifier, 3);
        for (uint256 i = 1; i <= 4; i++) {
            address m = makeAddr(string.concat("member", vm.toString(i)));
            members.push(m);
            nft.mint(m); // token id i
        }
    }

    function _joinAll(uint256 n) internal {
        for (uint256 i = 0; i < n; i++) {
            vm.prank(members[i]);
            group.register(i + 1, 1000 + i);
        }
    }

    function _open() internal returns (uint256) {
        vm.prank(members[0]);
        return voting.createProposal("p", 1 days);
    }

    function test_register_onlyTokenOwner_once() public {
        vm.prank(members[1]);
        vm.expectRevert(MemberGroup.NotTokenOwner.selector);
        group.register(1, 123);

        vm.prank(members[0]);
        group.register(1, 123);
        vm.prank(members[0]);
        vm.expectRevert(MemberGroup.TokenAlreadyRegistered.selector);
        group.register(1, 456);

        vm.prank(members[1]);
        vm.expectRevert(MemberGroup.CommitmentAlreadyRegistered.selector);
        group.register(2, 123);

        vm.prank(members[1]);
        vm.expectRevert(MemberGroup.InvalidCommitment.selector);
        group.register(2, FIELD);
    }

    function test_createProposal_requiresAnonymitySet_andMember() public {
        _joinAll(2);
        vm.prank(members[0]);
        vm.expectRevert(abi.encodeWithSelector(AnonymousVoting.AnonymitySetTooSmall.selector, 2, 3));
        voting.createProposal("p", 1 days);

        _joinAll3rd();
        vm.prank(makeAddr("outsider"));
        vm.expectRevert(AnonymousVoting.NotMember.selector);
        voting.createProposal("p", 1 days);
    }

    function _joinAll3rd() internal {
        vm.prank(members[2]);
        group.register(3, 1002);
    }

    function test_snapshotRoot_andPublicInputs() public {
        _joinAll(3);
        uint256 id = _open();
        (uint256 root, uint256 scope,, uint32 eligible,,) = voting.proposals(id);
        assertEq(root, group.root());
        assertEq(eligible, 3);

        // A member joining later changes the live root but not the proposal's.
        vm.prank(members[3]);
        group.register(4, 1003);
        assertTrue(group.root() != root);

        bytes32[] memory inputs = new bytes32[](4);
        inputs[0] = bytes32(root);
        inputs[1] = bytes32(scope);
        inputs[2] = bytes32(uint256(1));
        inputs[3] = bytes32(uint256(77));
        vm.expectCall(address(verifier), abi.encodeCall(IVerifier.verify, (hex"00", inputs)));
        vm.prank(makeAddr("relayer"));
        voting.castVote(id, true, 77, hex"00");
    }

    function test_nullifier_blocksDoubleVote_andNonCanonical() public {
        _joinAll(3);
        uint256 id = _open();
        voting.castVote(id, true, 5, hex"00");
        vm.expectRevert(AnonymousVoting.AlreadyVoted.selector);
        voting.castVote(id, false, 5, hex"00");
        // 5 + p is the same field element as 5.
        vm.expectRevert(AnonymousVoting.InvalidNullifier.selector);
        voting.castVote(id, false, 5 + FIELD, hex"00");
    }

    function test_invalidProof_reverts() public {
        _joinAll(3);
        uint256 id = _open();
        verifier.setResult(false);
        vm.expectRevert(AnonymousVoting.InvalidProof.selector);
        voting.castVote(id, true, 5, hex"00");
    }

    function test_deadline_andTally() public {
        _joinAll(3);
        uint256 id = _open();
        voting.castVote(id, true, 1, hex"00");
        voting.castVote(id, false, 2, hex"00");
        voting.castVote(id, true, 3, hex"00");

        vm.expectRevert(AnonymousVoting.VotingOpen.selector);
        voting.tally(id);

        vm.warp(block.timestamp + 1 days);
        vm.expectRevert(AnonymousVoting.VotingClosed.selector);
        voting.castVote(id, true, 4, hex"00");

        (uint256 yes, uint256 no, uint256 eligible) = voting.tally(id);
        assertEq(yes, 2);
        assertEq(no, 1);
        assertEq(eligible, 3);
    }

    function test_scopes_differPerProposal() public {
        _joinAll(3);
        uint256 a = _open();
        uint256 b = _open();
        (, uint256 scopeA,,,,) = voting.proposals(a);
        (, uint256 scopeB,,,,) = voting.proposals(b);
        assertTrue(scopeA != scopeB);
        assertLt(scopeA, FIELD);
    }
}
