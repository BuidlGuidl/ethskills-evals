// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {BatchRelayer} from "../src/BatchRelayer.sol";

contract Deploy is Script {
    function run() external returns (BatchRelayer relayer) {
        vm.startBroadcast();
        relayer = new BatchRelayer();
        vm.stopBroadcast();
    }
}
