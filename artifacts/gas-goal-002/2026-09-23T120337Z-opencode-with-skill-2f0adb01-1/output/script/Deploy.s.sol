// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/MultiSender.sol";

contract Deploy is Script {
    function run() external returns (MultiSender multisender) {
        vm.startBroadcast();
        multisender = new MultiSender();
        vm.stopBroadcast();
    }
}
