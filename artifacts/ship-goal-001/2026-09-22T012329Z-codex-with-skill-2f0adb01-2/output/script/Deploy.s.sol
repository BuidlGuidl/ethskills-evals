// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";

contract DeployToolshed is Script {
    function run() external returns (ToolshedEscrow escrow) {
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast();
        escrow = new ToolshedEscrow(IERC20(usdc), msg.sender);
        vm.stopBroadcast();
    }
}
