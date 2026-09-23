// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";

/// @notice Deploys SubscriptionManager against the USDC address in env.
///
///   USDC_ADDRESS=<token> forge script script/Deploy.s.sol \
///       --rpc-url $RPC_URL --broadcast --verify
///
/// If USDC_ADDRESS is unset or zero (local Anvil dev only), a MockUSDC is
/// deployed first and used instead. Never rely on that path on a real network.
contract Deploy is Script {
    function run() external returns (SubscriptionManager sm, address usdc) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        usdc = vm.envOr("USDC_ADDRESS", address(0));

        vm.startBroadcast(deployerKey);

        if (usdc == address(0)) {
            usdc = address(new MockUSDC());
            console2.log("No USDC_ADDRESS set - deployed MockUSDC at:", usdc);
        }

        sm = new SubscriptionManager(usdc);
        console2.log("SubscriptionManager deployed at:", address(sm));
        console2.log("Owner:", sm.owner());
        console2.log("USDC:", usdc);

        vm.stopBroadcast();
    }
}
