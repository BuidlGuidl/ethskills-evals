// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IHonkVerifier} from "../../src/interfaces/IHonkVerifier.sol";

/// @notice Stand-in for a Honk verifier, so contract logic can be tested without
///         a 2M-gas proof in every case.
/// @dev `verify` is `view`, so it cannot record what it was called with. Instead
///      a test declares the public inputs it expects up front and the mock
///      rejects anything else - which is what lets these tests assert exactly
///      which values the contracts bind into a proof.
contract MockVerifier is IHonkVerifier {
    bool public accepts = true;
    bytes32 public expectedInputsHash;

    function setAccepts(bool accepts_) external {
        accepts = accepts_;
    }

    /// @param publicInputs the exact array the contract under test must pass.
    function expectPublicInputs(bytes32[] memory publicInputs) external {
        expectedInputsHash = keccak256(abi.encode(publicInputs));
    }

    function verify(bytes calldata, bytes32[] calldata publicInputs) external view returns (bool) {
        if (!accepts) return false;
        if (expectedInputsHash == bytes32(0)) return true;
        return keccak256(abi.encode(publicInputs)) == expectedInputsHash;
    }
}
