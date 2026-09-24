// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {BatchPay} from "../src/BatchPay.sol";

/**
 * Deploy BatchPay.
 *
 *   OWNER=0x..  RELAYER=0x..  BASE_RPC_URL=...  \
 *   forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
 *
 * OWNER should be a multisig, not the relayer: it can sweep the float and rotate
 * relayer keys, so it must not share a key with the hot signer.
 */
contract Deploy is Script {
    function run() external returns (BatchPay pay) {
        address owner = vm.envAddress("OWNER");
        address relayer = vm.envAddress("RELAYER");
        require(owner != relayer, "OWNER must not be the hot relayer key");

        vm.startBroadcast();
        pay = new BatchPay(owner, relayer);
        vm.stopBroadcast();

        console2.log("BatchPay deployed at:", address(pay));
        console2.log("  owner  :", owner);
        console2.log("  relayer:", relayer);
    }
}
