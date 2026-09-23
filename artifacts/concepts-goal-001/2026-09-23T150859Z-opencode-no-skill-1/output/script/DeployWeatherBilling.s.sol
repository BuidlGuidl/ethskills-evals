// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {WeatherBilling} from "../src/WeatherBilling.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract DeployWeatherBilling is Script {
    uint256 constant DEFAULT_HOBBY_PRICE = 5_000_000;
    uint256 constant DEFAULT_PRO_PRICE = 20_000_000;

    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        vm.startBroadcast(privateKey);

        address owner = vm.envOr("OWNER_ADDRESS", deployer);
        uint128 hobbyPrice = uint128(vm.envOr("HOBBY_PRICE", DEFAULT_HOBBY_PRICE));
        uint128 proPrice = uint128(vm.envOr("PRO_PRICE", DEFAULT_PRO_PRICE));
        address usdc = vm.envOr("USDC_ADDRESS", address(0));

        if (usdc == address(0)) {
            MockUSDC mock = new MockUSDC();
            usdc = address(mock);
            console2.log("MockUSDC deployed (local/testnet only):", usdc);
        }

        WeatherBilling billing = new WeatherBilling(usdc, owner, hobbyPrice, proPrice);

        console2.log("WeatherBilling deployed:", address(billing));
        console2.log("USDC:", usdc);
        console2.log("Owner:", owner);
        console2.log("Hobby price (per 30d, 6 decimals):", uint256(hobbyPrice));
        console2.log("Pro price (per 30d, 6 decimals):", uint256(proPrice));

        vm.stopBroadcast();
    }
}
