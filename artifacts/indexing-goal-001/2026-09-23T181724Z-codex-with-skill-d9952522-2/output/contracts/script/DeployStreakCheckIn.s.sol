// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script} from "forge-std/Script.sol";
import {StreakCheckIn} from "../StreakCheckIn.sol";

contract DeployStreakCheckIn is Script {
    function run() external returns (StreakCheckIn streak) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        streak = new StreakCheckIn();
        vm.stopBroadcast();
    }
}

