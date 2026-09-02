// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title Hash
/// @notice The single hash function shared by the circuit and the chain.
/// @dev    Mirrors `hash_pair` in circuits/vote/src/hash.nr:
///
///           hash_pair(a, b) = keccak256(be32(a) || be32(b)) >> 8
///
///         The `>> 8` drops the top byte, so every output is < 2^248 and
///         therefore always a canonical bn254 field element - which is what
///         lets the same value be a Merkle node here and a `Field` in Noir.
///         Using keccak (rather than Poseidon or MiMC) is what makes the
///         membership tree cheap enough to maintain fully on-chain, so no one
///         has to be trusted to publish the root.
library Hash {
    /// @dev Anything a circuit-side hash can produce is strictly below this.
    uint256 internal constant FIELD_SAFE_BOUND = 1 << 248;

    function pair(uint256 left, uint256 right) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(left, right))) >> 8;
    }
}
