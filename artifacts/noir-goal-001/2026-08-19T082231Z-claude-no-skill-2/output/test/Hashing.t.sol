// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TestBase} from "./TestBase.sol";
import {FieldHash} from "../src/FieldHash.sol";

/// The whole scheme rests on the circuit, this contract and the Node tooling agreeing
/// on one hash. These vectors are asserted in all three places - see
/// `matches_reference_vectors` in circuits/vote/src/hash.nr and `hashField` in
/// js/core/hash.js. If any of the three drifts, members stop being able to prove
/// membership in the tree this contract builds.
contract HashingTest is TestBase {
    bytes32 constant ONE = bytes32(uint256(1));
    bytes32 constant TWO = bytes32(uint256(2));

    function test_hash1MatchesCircuit() public pure {
        assertEq(
            FieldHash.hash1(ONE),
            bytes32(uint256(417480351180718020436416860597467469834589008187459973615800613778564492427)),
            "hash1(1) disagrees with the Noir circuit"
        );
    }

    function test_hash2MatchesCircuit() public pure {
        assertEq(
            FieldHash.hash2(ONE, TWO),
            bytes32(uint256(379392964215299100032849613015027094718736135941496643568999604296726406161)),
            "hash2(1,2) disagrees with the Noir circuit"
        );
    }

    function test_outputsAreValidFieldElements() public pure {
        assertTrue(FieldHash.inFieldRange(FieldHash.hash1(ONE)), "hash1 out of field range");
        assertTrue(FieldHash.inFieldRange(FieldHash.hash2(ONE, TWO)), "hash2 out of field range");
    }

    function testFuzz_outputsAreAlwaysInFieldRange(bytes32 a, bytes32 b) public pure {
        assertTrue(FieldHash.inFieldRange(FieldHash.hash2(a, b)), "hash2 escaped the field");
        assertTrue(FieldHash.inFieldRange(FieldHash.hash1(a)), "hash1 escaped the field");
    }

    /// Arity is the domain separator: SHA-256 pads by message length, so a one-input
    /// commitment can never collide with a two-input Merkle node or nullifier.
    function testFuzz_arityIsDomainSeparating(bytes32 a) public pure {
        assertTrue(FieldHash.hash1(a) != FieldHash.hash2(a, bytes32(0)), "arity collision");
    }
}
