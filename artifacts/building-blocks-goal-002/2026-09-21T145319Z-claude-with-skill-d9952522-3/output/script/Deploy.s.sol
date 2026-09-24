// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AeroUsdcWethVault} from "../src/AeroUsdcWethVault.sol";
import {BaseAddresses as B} from "./BaseAddresses.sol";

interface IVoter {
    function isAlive(address gauge) external view returns (bool);
}

/// forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
/// env: OWNER, KEEPER, FEE_RECIPIENT
contract Deploy is Script {
    function run() external returns (AeroUsdcWethVault vault) {
        require(block.chainid == 8453, "not Base");
        require(IVoter(B.AERO_VOTER).isAlive(B.WETH_USDC_VAMM_GAUGE), "gauge killed");
        address owner = vm.envAddress("OWNER");
        address keeper = vm.envAddress("KEEPER");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");

        vm.startBroadcast();
        vault = new AeroUsdcWethVault(
            B.USDC,
            B.WETH,
            B.AERO_ROUTER,
            B.WETH_USDC_VAMM_GAUGE,
            B.CL_ETH_USD,
            B.CL_SEQUENCER_UPTIME,
            keeper,
            feeRecipient,
            owner
        );
        vm.stopBroadcast();

        console.log("vault", address(vault));
        console.log("pool ", address(vault.pool()));
    }
}
