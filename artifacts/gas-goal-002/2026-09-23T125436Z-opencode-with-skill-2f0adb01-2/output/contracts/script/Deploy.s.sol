// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {BatchRelayer} from "../src/BatchRelayer.sol";

contract Deploy is Script {
    function run() public returns (BatchRelayer relayer) {
        vm.startBroadcast();
        relayer = new BatchRelayer();
        vm.stopBroadcast();
    }
}