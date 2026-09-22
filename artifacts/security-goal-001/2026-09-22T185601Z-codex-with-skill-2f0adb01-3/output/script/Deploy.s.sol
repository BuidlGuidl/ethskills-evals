// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

import {TokenSavingsVaultFactory} from "../src/TokenSavingsVaultFactory.sol";

contract Deploy is Script {
    function run() external returns (TokenSavingsVaultFactory factory) {
        vm.startBroadcast();
        factory = new TokenSavingsVaultFactory();
        vm.stopBroadcast();
    }
}
