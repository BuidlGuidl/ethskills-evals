// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CheatsUser, console} from "../script/Cheats.sol";

/// @notice Minimal test scaffolding, so the Foundry project needs no `forge install`.
/// @dev A reverting test function is a failing test, which is all `require` needs to be.
abstract contract TestBase is CheatsUser {
    function assertTrue(bool condition, string memory reason) internal pure {
        require(condition, reason);
    }

    function assertEq(bytes32 a, bytes32 b, string memory reason) internal pure {
        require(a == b, reason);
    }

    function assertEq(uint256 a, uint256 b, string memory reason) internal pure {
        require(a == b, reason);
    }

    function assertEq(address a, address b, string memory reason) internal pure {
        require(a == b, reason);
    }

    /// @dev forge-std's `deployCodeTo`, inlined. Runs the constructor at `where`, so
    ///      immutables and constructor storage writes both land correctly. Used to pin
    ///      PrivateBallot at the address the proof fixtures were generated against.
    function deployTo(string memory artifact, bytes memory constructorArgs, address where) internal {
        bytes memory creationCode = vm.getCode(artifact);
        vm.etch(where, abi.encodePacked(creationCode, constructorArgs));
        (bool ok, bytes memory runtimeCode) = where.call("");
        require(ok, "constructor reverted");
        require(runtimeCode.length > 0, "no runtime code");
        vm.etch(where, runtimeCode);
    }
}
