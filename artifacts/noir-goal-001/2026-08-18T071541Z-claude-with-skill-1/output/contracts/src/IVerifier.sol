// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Mirrors the ABI of the generated `HonkVerifier` in `src/verifiers/HonkVerifier.sol`.
///         The generated contract is the source of truth: it reverts on a bad proof rather than
///         returning false, so callers must treat a successful call as "verified".
interface IVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}
