// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Deploys the billing contract and seeds the two plans.
///
/// Usage (Base Sepolia dry run):
///   forge script script/Deploy.s.sol --rpc-url base_sepolia
///
/// Usage (broadcast + verify):
///   forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
///
/// Required env: BILLING_TOKEN, BILLING_OWNER, BILLING_RECIPIENT, plus a signer
/// (--ledger, --account <keystore>, or PRIVATE_KEY).
contract Deploy is Script {
    // Circle-issued native USDC. Not bridged USDC.e — check this against
    // https://developers.circle.com/stablecoins/usdc-contract-addresses before you broadcast.
    address internal constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    uint64 internal constant HOBBY_PRICE = 5_000_000; // $5.00 / 30 days, 6 decimals
    uint64 internal constant PRO_PRICE = 20_000_000; // $20.00 / 30 days

    function run() external returns (SubscriptionBilling billing) {
        address token = vm.envOr("BILLING_TOKEN", _defaultToken());
        address owner = vm.envAddress("BILLING_OWNER");
        address recipient = vm.envOr("BILLING_RECIPIENT", owner);

        require(token != address(0), "no USDC address for this chain; set BILLING_TOKEN");
        require(token.code.length > 0, "BILLING_TOKEN has no code on this chain");

        vm.startBroadcast();

        billing = new SubscriptionBilling(IERC20(token), msg.sender, recipient);
        billing.setPlan(1, HOBBY_PRICE, true, "hobby");
        billing.setPlan(2, PRO_PRICE, true, "pro");

        // Hand over last, so the plans are already in place. `owner` must call
        // `acceptOwnership()` before it controls anything — that second transaction is the point:
        // a typo'd owner address is recoverable right up until it is accepted.
        if (owner != msg.sender) billing.transferOwnership(owner);

        vm.stopBroadcast();

        console2.log("SubscriptionBilling:", address(billing));
        console2.log("  token            :", token);
        console2.log("  owner (pending)  :", owner);
        console2.log("  revenueRecipient :", recipient);
        console2.log("");
        console2.log("Next: have the owner call acceptOwnership(), then record the address in");
        console2.log("backend/.env as BILLING_ADDRESS and the deploy block as BILLING_START_BLOCK.");
    }

    function _defaultToken() internal view returns (address) {
        if (block.chainid == 8453) return USDC_BASE;
        if (block.chainid == 84532) return USDC_BASE_SEPOLIA;
        return address(0);
    }
}
