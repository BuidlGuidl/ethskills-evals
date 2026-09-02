// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Hashes} from "../src/Hashes.sol";

/// @notice Cross-implementation vectors.
/// @dev These constants were produced by scripts/common/crypto.mjs. The same values
///      are asserted in circuits/vote/src/main.nr (`nargo test`). If any of the
///      three implementations of the hash drifts, one of these breaks -- which is
///      the point, because a mismatch would silently make every proof unverifiable.
contract HashesTest is Test {
    function test_hashPairMatchesReferenceVector() public pure {
        assertEq(
            Hashes.hashPair(1, 2),
            uint256(0x00e90b7bceb6e7df5418fb78d8ee546e97c83a08bbccc01a0644d599ccd2a7c2),
            "hashPair(1,2)"
        );
    }

    function test_commitmentMatchesReferenceVector() public pure {
        assertEq(
            Hashes.tagged(1, 123, 0),
            uint256(0x00744ed4ac598dcd81b2fcd63d97a372ea02960ead3e516cc577bec497f7bac8),
            "commitment(secret=123)"
        );
    }

    function test_nullifierMatchesReferenceVector() public pure {
        assertEq(
            Hashes.tagged(2, 123, 1),
            uint256(0x00338bdef32ebeccb1e0b56404b21374626328f1064eaff8e590f1f35fbdc341),
            "nullifier(secret=123, proposal=1)"
        );
    }

    /// @dev The whole point of the domain tags: the nullifier a member publishes
    ///      when voting must never equal the commitment they published when
    ///      registering, or the vote would be trivially attributable.
    function testFuzz_commitmentNeverEqualsNullifier(uint256 secret, uint256 proposalId) public pure {
        assertTrue(Hashes.tagged(1, secret, 0) != Hashes.tagged(2, secret, proposalId));
    }

    /// @dev Every digest must fit in 248 bits so it is always a valid BN254
    ///      field element -- no modular reduction, so Noir and Solidity cannot
    ///      disagree about what the value is.
    function testFuzz_digestsAreAlwaysInField(uint256 a, uint256 b) public pure {
        assertLt(Hashes.hashPair(a, b), Hashes.DIGEST_BOUND);
        assertLt(Hashes.tagged(1, a, b), Hashes.DIGEST_BOUND);
    }
}
