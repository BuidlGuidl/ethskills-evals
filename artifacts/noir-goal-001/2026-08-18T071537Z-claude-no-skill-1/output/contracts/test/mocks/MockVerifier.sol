// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IHonkVerifier} from "../../src/PrivateBallot.sol";

/// @notice Stand-in for HonkVerifier in logic tests.
///
/// @dev A "proof" here is the keccak of the public inputs its author intended.
///      That makes it behave like the real thing in the way that matters: it
///      accepts only when PrivateBallot passes exactly the public inputs the
///      prover committed to, so these tests still catch the contract mixing up
///      root / tag / nullifier / choice.
contract MockVerifier is IHonkVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external pure returns (bool) {
        if (proof.length != 32) return false;
        return bytes32(proof) == keccak256(abi.encode(publicInputs));
    }

    function proofFor(bytes32[] memory publicInputs) external pure returns (bytes memory) {
        return abi.encodePacked(keccak256(abi.encode(publicInputs)));
    }
}
