// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {BatchTransfer} from "../contracts/BatchTransfer.sol";

/// Deploy BatchTransfer.
///
///   forge script script/Deploy.s.sol \
///     --rpc-url $BASE_RPC --broadcast --verify \
///     --private-key $DEPLOYER_KEY
///
/// OWNER should be a multisig, not the relayer. The relayer key is hot; it can
/// only move funds to the recipients in a batch, and only the owner can change
/// who the relayers are or sweep a float.
contract Deploy is Script {
    function run() external returns (BatchTransfer bt) {
        address owner = vm.envAddress("OWNER");
        address relayer = vm.envAddress("RELAYER");
        vm.startBroadcast();
        bt = new BatchTransfer(owner, relayer);
        vm.stopBroadcast();
    }
}
