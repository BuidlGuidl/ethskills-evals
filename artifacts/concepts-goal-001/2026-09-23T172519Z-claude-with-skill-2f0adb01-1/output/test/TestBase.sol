// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Vm, VM_ADDRESS} from "../script/Vm.sol";

/// @notice Tiny assertion base. Assertions revert on failure, which is what
/// `forge test` reports as a failing test — no forge-std needed.
abstract contract TestBase {
    Vm internal constant vm = Vm(VM_ADDRESS);

    error AssertionFailed(string what, uint256 expected, uint256 actual);
    error AssertionFailedBool(string what);

    function assertEq(uint256 actual, uint256 expected, string memory what) internal pure {
        if (actual != expected) revert AssertionFailed(what, expected, actual);
    }

    function assertEq(address actual, address expected, string memory what) internal pure {
        if (actual != expected) {
            revert AssertionFailed(what, uint256(uint160(expected)), uint256(uint160(actual)));
        }
    }

    /// @notice Equality within `tolerance`, for figures subject to integer rounding.
    function assertApproxEq(uint256 actual, uint256 expected, uint256 tolerance, string memory what)
        internal
        pure
    {
        uint256 diff = actual > expected ? actual - expected : expected - actual;
        if (diff > tolerance) revert AssertionFailed(what, expected, actual);
    }

    function assertTrue(bool condition, string memory what) internal pure {
        if (!condition) revert AssertionFailedBool(what);
    }

    function assertFalse(bool condition, string memory what) internal pure {
        if (condition) revert AssertionFailedBool(what);
    }
}
