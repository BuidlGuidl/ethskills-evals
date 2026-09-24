// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {PayoutBatcher} from "../src/PayoutBatcher.sol";

/// forge script script/Deploy.s.sol --rpc-url base --broadcast
///
/// Env:
///   TOKEN   ERC-20 being paid out (Base USDC: 0x8335...2913)
///   OWNER   holds the float, can sweep and manage relayers (use a multisig)
///   RELAYER hot wallet allowed to submit batches
contract Deploy is Script {
    function run() external {
        address token = vm.envAddress("TOKEN");
        address owner = vm.envAddress("OWNER");
        address relayer = vm.envAddress("RELAYER");

        vm.startBroadcast();
        PayoutBatcher batcher = new PayoutBatcher(token, owner);
        // Safe only because the deployer is the owner in the intended setup;
        // otherwise the owner must call setRelayer themselves.
        if (owner == msg.sender) batcher.setRelayer(relayer, true);
        vm.stopBroadcast();

        console2.log("PayoutBatcher:", address(batcher));
        console2.log("token:", token);
        console2.log("owner:", owner);
        console2.log("relayer:", relayer);
        if (owner != msg.sender) {
            console2.log("NOTE: owner must call setRelayer(%s, true)", relayer);
        }
    }
}
