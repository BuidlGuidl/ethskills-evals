// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "./Script.sol";
import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
import {IERC20} from "../contracts/IERC20.sol";

contract DeployToolshed is Script {
    function run() external returns (ToolshedEscrow escrow) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address associationOwner = vm.envAddress("ASSOCIATION_OWNER");

        vm.startBroadcast();
        escrow = new ToolshedEscrow(IERC20(usdc), associationOwner);
        vm.stopBroadcast();
    }
}
