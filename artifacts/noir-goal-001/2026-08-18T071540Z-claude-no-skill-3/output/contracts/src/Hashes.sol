// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Hashes
/// @notice The single source of truth for the hash used by the member Merkle
///         tree. It must stay byte-for-byte identical to `hash_pair` /
///         `tagged_hash` in `circuits/vote/src/main.nr` and to `scripts/common/crypto.mjs`.
///
/// @dev Every digest is keccak256 shifted right by 8 bits. Dropping the low byte
///      leaves a 248-bit value, which is always below the BN254 scalar field
///      modulus used by Noir. That means a digest is a valid field element with
///      no modular reduction, so Solidity and Noir cannot disagree about it.
library Hashes {
    /// @notice Largest value + 1 that a truncated digest can take.
    uint256 internal constant DIGEST_BOUND = 1 << 248;

    /// @notice Merkle node hash of an ordered pair.
    function hashPair(uint256 left, uint256 right) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(bytes32(left), bytes32(right)))) >> 8;
    }

    /// @notice Domain-separated hash of two operands.
    /// @param tag Domain tag; 1 = commitment, 2 = nullifier. Distinct tags keep
    ///        commitments and nullifiers in disjoint spaces, so a nullifier can
    ///        never coincide with the (public) commitment that produced it.
    function tagged(uint256 tag, uint256 a, uint256 b) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(bytes32(tag), bytes32(a), bytes32(b)))) >> 8;
    }
}
