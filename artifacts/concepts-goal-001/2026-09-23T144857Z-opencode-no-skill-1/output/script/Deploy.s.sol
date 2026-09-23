// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Deploys SubscriptionBilling and configures the two launch plans.
///
/// Required env vars:
///   USDC_ADDRESS   - USDC token on the target chain (Base mainnet:
///                    0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
///   OWNER_ADDRESS  - operations multisig/EOA that can set plans and sweep fees
///   PRIVATE_KEY    - deployer key (or use --account / --ledger instead)
///
/// Run (dry run first without --broadcast):
///   forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
contract Deploy is Script {
    uint256 constant HOBBY_PLAN = 1;
    uint256 constant PRO_PLAN = 2;
    uint256 constant HOBBY_PRICE = 5e6; // $5 / 30 days, USDC has 6 decimals
    uint256 constant PRO_PRICE = 20e6; // $20 / 30 days

    function run() external {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address owner = vm.envAddress("OWNER_ADDRESS");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        SubscriptionBilling billing = new SubscriptionBilling(usdc, owner);
        billing.setPlan(HOBBY_PLAN, HOBBY_PRICE, true);
        billing.setPlan(PRO_PLAN, PRO_PRICE, true);
        vm.stopBroadcast();

        console2.log("SubscriptionBilling:", address(billing));
        console2.log("USDC:", usdc);
        console2.log("Owner:", owner);
    }
}
