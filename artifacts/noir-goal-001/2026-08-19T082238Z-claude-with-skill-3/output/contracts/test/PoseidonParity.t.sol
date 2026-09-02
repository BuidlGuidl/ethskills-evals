// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PoseidonT3Hasher} from "../src/PoseidonT3Hasher.sol";

/// @notice Pins the Solidity hash to the exact vectors produced by
///         `poseidon::poseidon::bn254::hash_2` in circuits/vote (see the `poseidon_vectors`
///         test there) and by `poseidon([a,b])` from circomlibjs in client/src/poseidon.js.
///         If any layer is ever swapped for Poseidon2 or a different parameter set, one of
///         these three copies of the vectors starts failing instead of silently producing a
///         tree the circuit cannot prove against.
contract PoseidonParityTest is Test {
    PoseidonT3Hasher hasher;

    function setUp() public {
        hasher = new PoseidonT3Hasher();
    }

    function test_leafHashMatchesNoirAndJs() public view {
        assertEq(
            hasher.hash([uint256(1), uint256(2)]),
            0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a
        );
        assertEq(
            hasher.hash([uint256(111), uint256(222)]),
            0x2d888d8cb35bbb41d435db55d46e55a6996049e2b4a44ce1483101b572c6bd83
        );
    }

    function test_parentHashOfEmptyLeavesMatches() public view {
        assertEq(
            hasher.hash([uint256(0), uint256(0)]),
            0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864
        );
    }

    function test_emptyDepth10RootMatches() public view {
        uint256 node = 0;
        for (uint256 i = 0; i < 10; i++) {
            node = hasher.hash([node, node]);
        }
        assertEq(node, 0x1b7201da72494f1e28717ad1a52eb469f95892f957713533de6175e5da190af2);
    }

    function test_hashIsOrderSensitive() public view {
        assertTrue(hasher.hash([uint256(1), uint256(2)]) != hasher.hash([uint256(2), uint256(1)]));
    }
}
