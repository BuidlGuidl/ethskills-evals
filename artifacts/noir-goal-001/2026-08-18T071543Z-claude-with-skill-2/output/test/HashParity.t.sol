// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";

/// @notice The whole system rests on three independent Poseidon
/// implementations agreeing bit for bit:
///
///   circuit  poseidon::poseidon::bn254::hash_2   (circuits/vote)
///   client   poseidon2 from poseidon-lite        (client/lib)
///   onchain  PoseidonT3.hash                     (lib/poseidon-solidity)
///
/// If they diverge, member commitments computed by the client land in a tree
/// whose root the circuit can never reproduce. Each layer asserts the same
/// anchor value; this is the onchain third.
contract HashParityTest is Test {
    function test_poseidonT3_matches_circuit_and_client() public pure {
        assertEq(
            PoseidonT3.hash([uint256(1), uint256(2)]),
            0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a,
            "PoseidonT3 diverged from the circuit's hash_2"
        );
    }
}
