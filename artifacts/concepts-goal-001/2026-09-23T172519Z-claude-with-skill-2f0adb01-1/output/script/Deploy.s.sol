// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Vm, VM_ADDRESS} from "./Vm.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {IERC20} from "../src/IERC20.sol";

/// @notice Deploys SubscriptionBilling and creates the $5 hobby and $20 pro plans.
///
/// Usage (see NOTES.md for the full runbook):
///
///   export RPC_URL=https://mainnet.base.org
///   export USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   # Base mainnet USDC
///   export OWNER=0xYourSafeAddress
///   forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
///
/// Signing: pass `--ledger`, `--trezor`, or `--account <keystore-name>`. Do not put
/// a deployment private key in an environment variable.
contract Deploy {
    Vm internal constant vm = Vm(VM_ADDRESS);

    uint128 internal constant HOBBY_PRICE = 5_000_000; // $5.00 at 6 decimals
    uint128 internal constant PRO_PRICE = 20_000_000; // $20.00 at 6 decimals

    function run() external returns (SubscriptionBilling billing) {
        address usdc = vm.envAddress("USDC");
        address owner = vm.envAddress("OWNER");

        // Sanity-check the token before committing to it: `token` is immutable, so a
        // wrong address here means redeploying. USDC is 6 decimals everywhere it is
        // canonically issued; a different value means the plan prices below are wrong
        // by orders of magnitude.
        require(IERC20(usdc).decimals() == 6, "Deploy: token is not 6 decimals");

        vm.startBroadcast();

        billing = new SubscriptionBilling(IERC20(usdc), owner);

        // Plans must be created by the owner. If OWNER is a Safe (recommended), this
        // will revert — deploy with OWNER set to the deployer, create the plans, then
        // hand ownership to the Safe via transferOwnership/acceptOwnership.
        billing.createPlan(HOBBY_PRICE, "hobby");
        billing.createPlan(PRO_PRICE, "pro");

        vm.stopBroadcast();
    }
}
