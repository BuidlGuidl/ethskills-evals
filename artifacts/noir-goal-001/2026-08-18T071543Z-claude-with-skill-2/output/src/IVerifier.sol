// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Subset of the ABI exposed by the bb-generated `HonkVerifier`
/// (src/verifiers/HonkVerifier.sol). Mirrored from the generated source — do
/// not change without re-reading that file.
///
/// `publicInputs.length` must be exactly the number of `pub` parameters in the
/// circuit (4). The 8 pairing-point inputs the verifier also checks are carried
/// inside `proof`, not in this array.
interface IVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}
