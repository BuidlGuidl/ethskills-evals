// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Barretenberg's generated Honk verifier (src/verifiers/HonkVerifier.sol).
/// @dev    `publicInputs` are the `pub` parameters of circuits/vote/src/main.nr,
///         in declaration order.
interface IVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}
