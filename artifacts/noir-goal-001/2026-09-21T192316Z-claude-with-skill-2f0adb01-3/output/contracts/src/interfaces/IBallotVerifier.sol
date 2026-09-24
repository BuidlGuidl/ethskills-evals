// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// Mirrors the ABI of the generated `HonkVerifier` (contracts/src/verifiers/HonkVerifier.sol,
/// produced by `bb write_solidity_verifier -t evm`). `publicInputs` are the circuit's
/// `pub` parameters in declaration order: [merkle_root, scope, vote, nullifier_hash].
interface IBallotVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}
