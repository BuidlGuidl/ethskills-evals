// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";

/// @notice The single most load-bearing assumption in this system: the Poseidon
///         used onchain is bit-identical to the one used in the circuit and in
///         the offchain mirror. If these drift, proofs silently stop verifying
///         (or worse, a wrong tree is accepted).
///
///         Expected values were printed by `nargo test --show-output` on
///         `poseidon::poseidon::bn254::hash_2` (circuits/vote, tests::probe).
///         scripts/check-hash-parity.mjs asserts the JS layer against the same
///         vectors.
contract HashParityTest is Test {
    function test_matchesNoirPoseidon() public pure {
        assertEq(
            PoseidonT3.hash([uint256(1), uint256(2)]),
            0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a,
            "H(1,2)"
        );
        assertEq(
            PoseidonT3.hash([uint256(0), uint256(0)]),
            0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864,
            "H(0,0) - the empty-leaf parent"
        );
        assertEq(
            PoseidonT3.hash(
                [
                    uint256(0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd),
                    uint256(0x0fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543)
                ]
            ),
            0x2df12316ba0807e2fdf76ce4247f9bc5e793ecdf49bbf9627609263695478249,
            "H(a,b)"
        );
    }
}
