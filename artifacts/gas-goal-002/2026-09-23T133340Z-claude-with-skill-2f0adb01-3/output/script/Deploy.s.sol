// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {BatchPay} from "../src/BatchPay.sol";

/// Deploys BatchPay for the payments relayer.
///
///   forge script script/Deploy.s.sol \
///     --rpc-url $BASE_RPC_URL --broadcast --verify
///
/// Required env:
///   TOKEN    ERC-20 being paid out (Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
///   FUNDER   account holding the float; must approve BatchPay afterwards
///   OWNER    admin key, should be a multisig rather than the relayer key
///   RELAYER  hot key that submits batches
contract Deploy is Script {
    function run() external {
        address token = vm.envAddress("TOKEN");
        address funder = vm.envAddress("FUNDER");
        address owner = vm.envAddress("OWNER");
        address relayer = vm.envAddress("RELAYER");

        vm.startBroadcast();
        BatchPay batcher = new BatchPay(token, funder, owner);
        // Only possible while the deployer is still owner; if OWNER is a
        // multisig, set it there instead and drop this line.
        if (owner == msg.sender) batcher.setRelayer(relayer, true);
        vm.stopBroadcast();

        console2.log("BatchPay deployed at", address(batcher));
        console2.log("token ", token);
        console2.log("funder", funder);
        console2.log("owner ", owner);
        console2.log("");
        console2.log("Next: FUNDER must approve BatchPay to spend the token.");
        console2.log("Approve only the float you are willing to expose, not uint256 max,");
        console2.log("unless FUNDER is a dedicated hot wallet topped up per run.");
    }
}
