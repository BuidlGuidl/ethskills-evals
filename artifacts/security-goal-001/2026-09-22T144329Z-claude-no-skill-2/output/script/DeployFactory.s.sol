// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {SaveVaultFactory} from "../src/SaveVaultFactory.sol";

/// @notice Deploys the factory. Vaults are then listed permissionlessly by
///         anyone calling `createVault(token)`; there is nothing else to deploy.
contract DeployFactory is Script {
    function run() external returns (SaveVaultFactory factory) {
        vm.startBroadcast();
        factory = new SaveVaultFactory();
        vm.stopBroadcast();
        console.log("SaveVaultFactory:", address(factory));
    }
}
