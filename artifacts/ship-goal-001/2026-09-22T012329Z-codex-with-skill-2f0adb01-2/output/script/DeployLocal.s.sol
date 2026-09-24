// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
import {MockUSDC} from "../contracts/mocks/MockUSDC.sol";

contract DeployLocal is Script {
    function run() external returns (MockUSDC usdc, ToolshedEscrow escrow) {
        vm.startBroadcast();
        usdc = new MockUSDC();
        escrow = new ToolshedEscrow(usdc, msg.sender);
        vm.stopBroadcast();
    }
}
