// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {WeatherBilling} from "../src/WeatherBilling.sol";

contract Deploy is Script {
    /// Deploys WeatherBilling. Everything set here is immutable after deploy -
    /// double-check USDC_ADDRESS and TREASURY_ADDRESS, they cannot be fixed later.
    ///
    /// Required env:
    ///   USDC_ADDRESS      USDC token contract on the target chain
    ///   TREASURY_ADDRESS  where collected revenue is sent (use a multisig)
    /// Optional env (USDC 6-decimal units):
    ///   HOBBY_PRICE_USDC  default 5000000  ($5/month)
    ///   PRO_PRICE_USDC    default 20000000 ($20/month)
    ///
    /// Run:
    ///   USDC_ADDRESS=0x... TREASURY_ADDRESS=0x... \
    ///   forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
    function run() external returns (WeatherBilling billing) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        uint256 hobbyPrice = vm.envOr("HOBBY_PRICE_USDC", uint256(5e6));
        uint256 proPrice = vm.envOr("PRO_PRICE_USDC", uint256(20e6));

        if (usdc == address(0) || treasury == address(0)) {
            revert("USDC_ADDRESS and TREASURY_ADDRESS must be set");
        }

        vm.startBroadcast();
        billing = new WeatherBilling(usdc, treasury, hobbyPrice, proPrice);
        vm.stopBroadcast();

        console2.log("WeatherBilling deployed:", address(billing));
        console2.log("USDC:", usdc);
        console2.log("Treasury:", treasury);
        console2.log("Hobby price (USDC units):", hobbyPrice);
        console2.log("Pro price (USDC units):", proPrice);
    }
}
