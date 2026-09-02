// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice ABI of the generated HonkVerifier. `publicInputs` carries only the
///         circuit's `pub` parameters; the pairing points ride inside `proof`.
interface IVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs)
        external
        view
        returns (bool);
}
