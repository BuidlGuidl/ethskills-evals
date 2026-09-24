// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

/// @notice Finds a CREATE2 salt whose resulting address has exactly `flags` in its low 14 bits.
library HookMiner {
    uint256 constant MAX_LOOP = 500_000;

    function find(address deployer, uint160 flags, bytes memory creationCode, bytes memory constructorArgs)
        internal
        pure
        returns (address hookAddress, bytes32 salt)
    {
        flags &= Hooks.ALL_HOOK_MASK;
        bytes32 initCodeHash = keccak256(abi.encodePacked(creationCode, constructorArgs));
        for (uint256 i; i < MAX_LOOP; i++) {
            salt = bytes32(i);
            hookAddress = address(
                uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash))))
            );
            if (uint160(hookAddress) & Hooks.ALL_HOOK_MASK == flags) return (hookAddress, salt);
        }
        revert("HookMiner: no salt found");
    }
}
