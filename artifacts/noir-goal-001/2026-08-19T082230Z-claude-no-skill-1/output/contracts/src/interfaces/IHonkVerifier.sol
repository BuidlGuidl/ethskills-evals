// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice The surface of a barretenberg-generated Honk verifier that this
///         system uses. Implemented by the generated contracts under
///         `src/verifiers/`.
/// @dev `verify` reverts (rather than returning false) on a malformed proof or
///      on a public input that is not a canonical BN254 field element, so
///      callers get range checking for free.
interface IHonkVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}
