// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SavingsVaultFactory} from "../src/SavingsVaultFactory.sol";

/// @notice Deploys the factory. Vaults are then listed permissionlessly via
///         `factory.createVault(token)` — there is nothing else to deploy or configure.
contract Deploy is Script {
    function run() external returns (SavingsVaultFactory factory) {
        vm.startBroadcast();
        factory = new SavingsVaultFactory();
        vm.stopBroadcast();
        console2.log("SavingsVaultFactory:", address(factory));
    }
}
