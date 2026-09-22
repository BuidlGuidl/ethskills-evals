// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";

import {SaveVaultFactory} from "../src/SaveVaultFactory.sol";

/// @notice Deploys the factory. Vaults are listed afterwards by calling `createVault(token)`.
contract Deploy is Script {
    function run() external returns (SaveVaultFactory factory) {
        vm.startBroadcast();
        factory = new SaveVaultFactory();
        vm.stopBroadcast();
        console.log("SaveVaultFactory:", address(factory));
    }
}
