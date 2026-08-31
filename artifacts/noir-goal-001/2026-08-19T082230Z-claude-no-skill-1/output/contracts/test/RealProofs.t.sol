// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {DevMembershipNFT} from "../src/dev/DevMembershipNFT.sol";
import {IHonkVerifier} from "../src/interfaces/IHonkVerifier.sol";
import {IMembershipNFT} from "../src/interfaces/IMembershipNFT.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {JoinVerifierHonk} from "../src/verifiers/JoinVerifier.sol";
import {VoteVerifierHonk} from "../src/verifiers/VoteVerifier.sol";

/// @notice Runs real Honk proofs through the real verifiers.
///
/// The mock-verifier suites cover contract logic; this one covers the seam
/// between the Noir circuits and the generated Solidity - the place where a
/// changed circuit, a stale verifier or a mismatched public-input order shows
/// up. Fixtures come from `node scripts/generate-fixtures.mjs`.
contract RealProofsTest is Test {
    using stdJson for string;

    JoinVerifierHonk joinVerifier;
    VoteVerifierHonk voteVerifier;

    struct JoinFixture {
        bytes32 oldRoot;
        bytes32 newRoot;
        bytes32 commitment;
        uint256 leafIndex;
        bytes proof;
    }

    struct VoteFixture {
        bytes32 root;
        bytes32 externalNullifier;
        bytes32 nullifier;
        uint256 vote;
        bytes proof;
    }

    JoinFixture joinFixture;
    VoteFixture voteFixture;

    function setUp() public {
        joinVerifier = new JoinVerifierHonk();
        voteVerifier = new VoteVerifierHonk();

        string memory joinJson = vm.readFile("test/fixtures/join.json");
        joinFixture = JoinFixture({
            oldRoot: joinJson.readBytes32(".oldRoot"),
            newRoot: joinJson.readBytes32(".newRoot"),
            commitment: joinJson.readBytes32(".commitment"),
            leafIndex: joinJson.readUint(".leafIndex"),
            proof: joinJson.readBytes(".proof")
        });

        string memory voteJson = vm.readFile("test/fixtures/vote.json");
        voteFixture = VoteFixture({
            root: voteJson.readBytes32(".root"),
            externalNullifier: voteJson.readBytes32(".externalNullifier"),
            nullifier: voteJson.readBytes32(".nullifier"),
            vote: voteJson.readUint(".vote"),
            proof: voteJson.readBytes(".proof")
        });
    }

    // ------------------------------------------------------------- join

    /// The empty root is hardcoded in the registry. If Poseidon2 or the tree
    /// depth ever changes, this is what catches it.
    function test_hardcodedEmptyRootMatchesTheCircuit() public {
        MemberRegistry registry = new MemberRegistry(IMembershipNFT(address(0)), IHonkVerifier(address(0)));
        assertEq(registry.EMPTY_ROOT(), joinFixture.oldRoot);
    }

    function test_joinProofVerifies() public view {
        assertTrue(joinVerifier.verify(joinFixture.proof, _joinInputs(joinFixture.newRoot)));
    }

    /// A different claimed new root is the attack that would let someone rewrite
    /// the membership set.
    function test_joinProofRejectsAForgedNewRoot() public view {
        assertFalse(_tryJoin(_joinInputs(keccak256("some other root"))));
    }

    function test_realJoinProofIsAcceptedByTheRegistry() public {
        DevMembershipNFT nft = new DevMembershipNFT(address(this));
        address member = makeAddr("member");
        nft.mint(member);

        MemberRegistry registry =
            new MemberRegistry(IMembershipNFT(address(nft)), IHonkVerifier(address(joinVerifier)));

        vm.prank(member);
        registry.join(0, joinFixture.commitment, joinFixture.oldRoot, joinFixture.newRoot, joinFixture.proof);

        assertEq(registry.root(), joinFixture.newRoot);
        assertEq(registry.memberCount(), 1);
    }

    // ------------------------------------------------------------- vote

    function test_voteProofVerifies() public view {
        assertTrue(voteVerifier.verify(voteFixture.proof, _voteInputs(voteFixture.nullifier, voteFixture.vote)));
    }

    /// The direction is a public input, so a relayer holding a valid "yes" proof
    /// cannot resubmit it as a "no".
    function test_voteProofRejectsAFlippedDirection() public view {
        assertFalse(_tryVote(_voteInputs(voteFixture.nullifier, 0)));
    }

    /// A ballot cannot be re-tagged to dodge the one-vote-per-member check.
    function test_voteProofRejectsASwappedNullifier() public view {
        assertFalse(_tryVote(_voteInputs(keccak256("a different nullifier"), voteFixture.vote)));
    }

    function test_voteProofRejectsAnotherMembershipRoot() public view {
        bytes32[] memory inputs = _voteInputs(voteFixture.nullifier, voteFixture.vote);
        inputs[0] = keccak256("a tree this member is not in");
        assertFalse(_tryVote(inputs));
    }

    /// Proposal binding: the same ballot replayed under a different proposal's
    /// external nullifier must not verify.
    function test_voteProofRejectsAnotherProposal() public view {
        bytes32[] memory inputs = _voteInputs(voteFixture.nullifier, voteFixture.vote);
        inputs[1] = bytes32(uint256(0xdeadbeef));
        assertFalse(_tryVote(inputs));
    }

    function test_voteProofRejectsATamperedProof() public view {
        bytes memory tampered = voteFixture.proof;
        tampered[64] = bytes1(uint8(tampered[64]) ^ 0xff);
        (bool ok, bytes memory ret) = address(voteVerifier).staticcall(
            abi.encodeCall(
                IHonkVerifier.verify, (tampered, _voteInputs(voteFixture.nullifier, voteFixture.vote))
            )
        );
        assertFalse(ok && abi.decode(ret, (bool)));
    }

    // ---------------------------------------------------------- helpers

    function _joinInputs(bytes32 newRoot) internal view returns (bytes32[] memory inputs) {
        inputs = new bytes32[](4);
        inputs[0] = joinFixture.oldRoot;
        inputs[1] = newRoot;
        inputs[2] = joinFixture.commitment;
        inputs[3] = bytes32(joinFixture.leafIndex);
    }

    function _voteInputs(bytes32 nullifier, uint256 vote) internal view returns (bytes32[] memory inputs) {
        inputs = new bytes32[](4);
        inputs[0] = voteFixture.root;
        inputs[1] = voteFixture.externalNullifier;
        inputs[2] = nullifier;
        inputs[3] = bytes32(vote);
    }

    /// The verifier reverts on some bad inputs and returns false on others; for
    /// these tests both mean "did not verify".
    function _tryJoin(bytes32[] memory inputs) internal view returns (bool) {
        try joinVerifier.verify(joinFixture.proof, inputs) returns (bool ok) {
            return ok;
        } catch {
            return false;
        }
    }

    function _tryVote(bytes32[] memory inputs) internal view returns (bool) {
        try voteVerifier.verify(voteFixture.proof, inputs) returns (bool ok) {
            return ok;
        } catch {
            return false;
        }
    }
}
