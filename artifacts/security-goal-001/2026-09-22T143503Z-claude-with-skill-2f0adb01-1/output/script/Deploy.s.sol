// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SaveVaultFactory} from "../src/SaveVaultFactory.sol";

/// @notice Deploys the registry. Vaults are listed afterwards by anyone, via
///         `SaveVaultFactory.createVault(token)` — there is nothing to configure here.
contract Deploy is Script {
    function run() external returns (SaveVaultFactory factory) {
        vm.startBroadcast();
        factory = new SaveVaultFactory();
        vm.stopBroadcast();
        console.log("SaveVaultFactory:", address(factory));
    }
}
