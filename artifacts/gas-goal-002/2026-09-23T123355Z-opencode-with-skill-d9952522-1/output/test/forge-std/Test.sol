// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Minimal stand-in for forge-std/Test.sol (only what this repo's tests use),
/// so the test suite runs with no downloaded dependencies.
interface Vm {
    function prank(address) external;
}

abstract contract Test {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event log_named_uint(string key, uint256 val);

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "assertEq failed");
    }
}
