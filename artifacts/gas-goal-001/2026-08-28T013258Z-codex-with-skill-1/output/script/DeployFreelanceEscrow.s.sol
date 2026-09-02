// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";

contract DeployFreelanceEscrow is Script {
    function run() external returns (FreelanceEscrow escrow) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address guardian = vm.envAddress("PAUSE_GUARDIAN");
        vm.startBroadcast();
        escrow = new FreelanceEscrow(IERC20(usdc), guardian);
        vm.stopBroadcast();
    }
}
