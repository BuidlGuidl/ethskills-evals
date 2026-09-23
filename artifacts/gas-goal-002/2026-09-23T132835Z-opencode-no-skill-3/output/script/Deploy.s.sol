// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {BatchSender} from "../contracts/BatchSender.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        new BatchSender();
        vm.stopBroadcast();
    }
}
