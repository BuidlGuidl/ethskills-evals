// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Keccak248
/// @notice The one hash function shared by the Solidity contracts and the Noir
///         circuit: keccak256 truncated to its low 248 bits.
///
/// @dev Why truncate? A proof system field element must be < the BN254 modulus
///      p (~2^254). A full keccak digest is not, so it cannot be moved into the
///      circuit as a field element without a range check. Dropping the top byte
///      leaves a 248-bit value, always < p, and costs one AND.
///
///      Why keccak at all, rather than the usual Poseidon? Because the member
///      tree has to be built *on chain*. With keccak the contract rebuilds the
///      exact same tree the circuit walks, using the native opcode. Nobody has
///      to be trusted to compute the root off chain -- including us.
library Keccak248 {
    uint256 internal constant MASK = (1 << 248) - 1;

    /// @notice keccak248(a ++ b). Mirrors `hash2` in circuits/private_vote/src/hash.nr
    function hash2(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return bytes32(uint256(keccak256(abi.encodePacked(a, b))) & MASK);
    }

    /// @notice keccak248(a ++ b ++ c). Mirrors `hash3` in circuits/private_vote/src/hash.nr
    function hash3(bytes32 a, bytes32 b, bytes32 c) internal pure returns (bytes32) {
        return bytes32(uint256(keccak256(abi.encodePacked(a, b, c))) & MASK);
    }
}
