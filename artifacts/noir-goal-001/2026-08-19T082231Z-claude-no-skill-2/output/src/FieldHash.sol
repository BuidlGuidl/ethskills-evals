// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title FieldHash
/// @notice The one hash function shared by the Noir circuit, this contract and the
///         members' Node tooling: SHA-256 truncated to its top 31 bytes.
///
/// @dev Truncation is what makes the digest usable as a BN254 field element - 248
///      bits always fits under the ~254-bit modulus, with no modular reduction and
///      therefore no bias, and it stays byte aligned so every implementation can
///      produce it the same way. 124-bit collision resistance is plenty for a
///      1024-leaf membership tree.
///
///      SHA-256 (rather than Poseidon) because this hash has to be evaluated
///      identically in three places. Here it is the `sha256` precompile; in Noir it
///      is `std::hash::sha256_compression`; in Node it is `crypto`. No round
///      constants get hand-copied between them, so they cannot silently diverge.
library FieldHash {
    /// @notice hash of a single field element - used for member commitments.
    function hash1(bytes32 x) internal pure returns (bytes32) {
        return bytes32(uint256(sha256(abi.encodePacked(x))) >> 8);
    }

    /// @notice hash of a pair - used for Merkle nodes and for nullifiers.
    function hash2(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return bytes32(uint256(sha256(abi.encodePacked(a, b))) >> 8);
    }

    /// @notice Everything this library produces is below 2^248; membership
    ///         commitments supplied by users must be too, or they cannot be a leaf.
    function inFieldRange(bytes32 x) internal pure returns (bool) {
        return uint256(x) >> 248 == 0;
    }
}
