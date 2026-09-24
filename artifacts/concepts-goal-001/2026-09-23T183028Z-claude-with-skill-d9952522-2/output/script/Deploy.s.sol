// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Deploys SubscriptionBilling and opens the two plans in one transaction batch.
///
/// Base mainnet:
///   forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
/// Base Sepolia:
///   forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
///
/// Required env: BILLING_TOKEN, BILLING_OWNER, and a signer (--account / --ledger /
/// PRIVATE_KEY). Optional: HOBBY_PRICE, PRO_PRICE (token units; default $5 / $20 at 6dp).
contract Deploy is Script {
    function run() external returns (SubscriptionBilling billing) {
        address billingToken = vm.envAddress("BILLING_TOKEN");
        address owner = vm.envAddress("BILLING_OWNER");
        uint128 hobbyPrice = uint128(vm.envOr("HOBBY_PRICE", uint256(5_000_000)));
        uint128 proPrice = uint128(vm.envOr("PRO_PRICE", uint256(20_000_000)));

        require(billingToken.code.length > 0, "BILLING_TOKEN is not a contract on this chain");

        vm.startBroadcast();

        // Deployed with the broadcaster as owner so plans can be set in the same run,
        // then handed to the real owner. Ownable2Step means BILLING_OWNER must accept.
        billing = new SubscriptionBilling(IERC20(billingToken), msg.sender);
        billing.setPlan(1, hobbyPrice, true);
        billing.setPlan(2, proPrice, true);
        if (owner != msg.sender) billing.transferOwnership(owner);

        vm.stopBroadcast();

        console2.log("SubscriptionBilling:", address(billing));
        console2.log("billing token:      ", billingToken);
        console2.log("hobby $/month (raw):", hobbyPrice);
        console2.log("pro   $/month (raw):", proPrice);
        console2.log("current owner:      ", billing.owner());
        console2.log("pending owner:      ", billing.pendingOwner());
        if (owner != msg.sender) {
            console2.log(">> BILLING_OWNER must now call acceptOwnership() to finish the handover.");
        }
    }
}
