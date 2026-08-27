// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {HonkVerifier} from "../src/verifier/HonkVerifier.sol";
import {IHonkVerifier} from "../src/PrivateBallot.sol";

/// @notice The real verifier against a real proof.
///
/// @dev The fixture is produced by `node scripts/make-fixture.js`, which runs
///      the same prover the voting client runs. This test is the seam where the
///      Noir circuit and the Solidity contracts have to agree; regenerate the
///      fixture whenever the circuit changes (`./scripts/build-circuit.sh` then
///      `node scripts/make-fixture.js`).
contract HonkVerifierTest is Test {
    IHonkVerifier verifier;

    bytes proof;
    bytes32[] publicInputs;

    function setUp() public {
        verifier = IHonkVerifier(address(new HonkVerifier()));

        string memory json = vm.readFile("test/fixtures/ballot-proof.json");
        proof = vm.parseJsonBytes(json, ".proof");
        publicInputs = vm.parseJsonBytes32Array(json, ".publicInputs");
    }

    function test_AcceptsARealBallotProof() public view {
        assertEq(publicInputs.length, 4, "public input count drifted from the circuit");
        assertTrue(verifier.verify(proof, publicInputs));
    }

    /// Each public input is bound: changing any of them invalidates the proof.
    /// Index 3 is the yes/no choice, which is the one that would matter most.
    function test_RejectsAnyTamperedPublicInput() public view {
        for (uint256 i = 0; i < publicInputs.length; i++) {
            bytes32[] memory tampered = publicInputs;
            bytes32 original = tampered[i];
            tampered[i] = bytes32(uint256(original) ^ 1);

            (bool ok, bytes memory ret) =
                address(verifier).staticcall(abi.encodeCall(IHonkVerifier.verify, (proof, tampered)));
            // The verifier either reverts or returns false; neither must pass.
            assertTrue(!ok || !abi.decode(ret, (bool)), "tampered public input verified");

            tampered[i] = original;
        }
    }

    function test_RejectsATamperedProof() public {
        bytes memory broken = proof;
        broken[100] = bytes1(uint8(broken[100]) ^ 0xff);
        (bool ok, bytes memory ret) =
            address(verifier).staticcall(abi.encodeCall(IHonkVerifier.verify, (broken, publicInputs)));
        assertTrue(!ok || !abi.decode(ret, (bool)), "tampered proof verified");
    }
}
