// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice Deploys SubscriptionBilling.
///
/// Environment variables:
///   PRIVATE_KEY   deployer key (becomes the contract owner)
///   USDC_ADDRESS  (optional) existing USDC token. If unset, a MockUSDC is
///                 deployed alongside — fine for testnets, never for mainnet.
///
/// Example (Base Sepolia, real testnet USDC at 0x036CbD...):
///   forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast \
///       --sig "run()" # with USDC_ADDRESS and PRIVATE_KEY in the env
contract Deploy is Script {
    uint256 constant HOBBY_MONTHLY = 5e6; // $5.00  (USDC = 6 decimals)
    uint256 constant PRO_MONTHLY = 20e6; // $20.00

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envOr("USDC_ADDRESS", address(0));

        vm.startBroadcast(deployerKey);

        if (usdc == address(0)) {
            usdc = address(new MockUSDC());
            console.log("MockUSDC (TESTNET ONLY):", usdc);
        }

        SubscriptionBilling billing = new SubscriptionBilling(usdc, HOBBY_MONTHLY, PRO_MONTHLY);

        vm.stopBroadcast();

        console.log("SubscriptionBilling:", address(billing));
        console.log("  owner:            ", billing.owner());
        console.log("  usdc:             ", usdc);
        console.log("  hobby monthly:    ", HOBBY_MONTHLY);
        console.log("  pro monthly:      ", PRO_MONTHLY);
    }
}
