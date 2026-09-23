// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BatchTransfer} from "../src/BatchTransfer.sol";

/// Deploy BatchTransfer to Base.
///
///   RELAYER=0x... forge script script/DeployBatchTransfer.s.sol \
///     --rpc-url $BASE_RPC_URL --broadcast --verify
///
/// Afterwards the relayer must approve the deployed address to spend the payout
/// token. Approve a bounded amount sized to a few days of volume and top it up,
/// rather than an unlimited allowance.
contract DeployBatchTransfer is Script {
    function run() external returns (BatchTransfer deployed) {
        address relayer = vm.envAddress("RELAYER");
        require(relayer != address(0), "RELAYER must be set");

        vm.startBroadcast();
        deployed = new BatchTransfer(relayer);
        vm.stopBroadcast();

        console.log("BatchTransfer deployed at:", address(deployed));
        console.log("Authorised relayer       :", relayer);
        console.log("Next: approve this address on the payout token from the relayer wallet.");
    }
}
