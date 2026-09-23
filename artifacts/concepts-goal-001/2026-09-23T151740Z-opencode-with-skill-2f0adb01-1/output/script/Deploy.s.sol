// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {WeatherBilling} from "../src/WeatherBilling.sol";

/// @notice Deploys WeatherBilling and seeds the two plans.
///         Env: PRIVATE_KEY, RPC_URL (via --rpc-url), USDC_ADDRESS, OWNER_ADDRESS.
contract Deploy is Script {
    uint96 constant HOBBY_PRICE = 5e6;  // $5 / 30 days (USDC = 6 decimals)
    uint96 constant PRO_PRICE = 20e6;   // $20 / 30 days
    uint32 constant PERIOD = 30 days;   // onchain "months" are exactly 30 days

    function run() external returns (WeatherBilling billing) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        // Optional: hand ownership to a Safe after setup. If unset, the
        // deployer key stays owner (transferOwnership can be called later).
        address targetOwner = vm.envOr("OWNER_ADDRESS", address(0));
        uint256 key = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(key);
        address deployer = vm.addr(key); // address of PRIVATE_KEY

        billing = new WeatherBilling(usdc, deployer); // deployer owns it during setup
        billing.addPlan(HOBBY_PRICE, PERIOD);
        billing.addPlan(PRO_PRICE, PERIOD);
        if (targetOwner != address(0) && targetOwner != deployer) {
            billing.transferOwnership(targetOwner);
        }

        vm.stopBroadcast();

        console2.log("WeatherBilling:", address(billing));
        console2.log("USDC:", usdc);
        console2.log("Owner:", billing.owner());
        console2.log("Plan 1: hobby  $5 / 30 days");
        console2.log("Plan 2: pro   $20 / 30 days");
    }
}
