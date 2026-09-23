// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Deploys SubscriptionBilling.
///
/// Required env:
///   PRIVATE_KEY    deployer key (becomes the contract owner / fee recipient)
///   USDC_ADDRESS   USDC token address on the target chain
///
/// Optional env (defaults shown):
///   HOBBY_PRICE    5000000   ($5,  USDC has 6 decimals)
///   PRO_PRICE      20000000  ($20)
///
/// Run:
///   source .env
///   forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
contract Deploy is Script {
    function run() external returns (SubscriptionBilling billing) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        uint128 hobby = uint128(vm.envOr("HOBBY_PRICE", uint256(5e6)));
        uint128 pro = uint128(vm.envOr("PRO_PRICE", uint256(20e6)));

        vm.startBroadcast();
        billing = new SubscriptionBilling(usdc, hobby, pro);
        vm.stopBroadcast();

        console2.log("SubscriptionBilling deployed at:", address(billing));
        console2.log("Owner:", billing.owner());
        console2.log("USDC:", address(billing.usdc()));
    }
}
