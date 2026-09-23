// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Deploys SubscriptionBilling.
///
/// Required env vars:
///   USDC_ADDRESS   - canonical USDC on the target chain
///   OWNER_ADDRESS  - operator address (receives revenue, manages plans)
/// Optional env vars (defaults shown, 6-decimal USDC base units):
///   HOBBY_PRICE    - default 5000000  ($5 / 30 days)
///   PRO_PRICE      - default 20000000 ($20 / 30 days)
///
/// Run:
///   forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify \
///       --account deployer   # or: --private-key $PRIVATE_KEY
contract Deploy is Script {
    function run() external returns (SubscriptionBilling billing) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address owner = vm.envAddress("OWNER_ADDRESS");
        uint256 hobbyPrice = vm.envOr("HOBBY_PRICE", uint256(5_000_000));
        uint256 proPrice = vm.envOr("PRO_PRICE", uint256(20_000_000));

        vm.startBroadcast();
        billing = new SubscriptionBilling(usdc, owner, hobbyPrice, proPrice);
        vm.stopBroadcast();

        console2.log("SubscriptionBilling:", address(billing));
        console2.log("  USDC:        ", usdc);
        console2.log("  owner:       ", owner);
        console2.log("  hobby price: ", hobbyPrice);
        console2.log("  pro price:   ", proPrice);
    }
}
