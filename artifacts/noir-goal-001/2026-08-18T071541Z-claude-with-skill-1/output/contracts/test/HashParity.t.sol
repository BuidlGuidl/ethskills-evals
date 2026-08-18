// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";

/// @notice Three layers hash commitments and Merkle parents: the Noir circuit
/// (`poseidon::poseidon::bn254::hash_2`), the offchain tree mirror (`poseidon-lite`'s
/// `poseidon2`), and this contract (`PoseidonT3.hash`). If they ever diverge, every proof stops
/// verifying with no useful error. This pins the same vector all three are checked against —
/// see the matching assertions in `circuits/anon_vote/src/main.nr` and `scripts/hash-parity.mjs`.
contract HashParityTest is Test {
    uint256 constant EXPECTED_HASH_1_2 = 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a;

    function test_PoseidonT3MatchesCircuitAndTreeMirror() public pure {
        assertEq(PoseidonT3.hash([uint256(1), uint256(2)]), EXPECTED_HASH_1_2);
    }
}
