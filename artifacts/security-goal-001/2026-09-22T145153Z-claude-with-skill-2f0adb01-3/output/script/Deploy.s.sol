// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SavingsVaultFactory} from "../src/SavingsVaultFactory.sol";

/// @notice Deploys the factory. Vaults are then listed permissionlessly by anyone
///         calling `createVault(token, rewardsCycleLength)`.
contract Deploy is Script {
    function run() external returns (SavingsVaultFactory factory) {
        vm.startBroadcast();
        factory = new SavingsVaultFactory();
        vm.stopBroadcast();
        console.log("SavingsVaultFactory:", address(factory));
    }
}
