// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TipJar} from "../src/TipJar.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice Local deployment script.
///
/// Deploys a MockUSDC and a TipJar pointing at it, then seeds a couple of
/// example tips so the feed is not empty on first load. Intended to be run
/// against a local anvil node.
///
/// The real Base USDC address is 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
/// on a fork or mainnet you would pass that to the TipJar constructor instead of
/// deploying MockUSDC.
contract Deploy is Script {
    // anvil's default account #0 and #1 (well-known test keys).
    uint256 constant DEPLOYER_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 constant TIPPER_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;

    function run() external {
        address deployer = vm.addr(DEPLOYER_PK);
        address tipper = vm.addr(TIPPER_PK);

        vm.startBroadcast(DEPLOYER_PK);

        MockUSDC usdc = new MockUSDC();
        TipJar jar = new TipJar(address(usdc));

        // Give the deployer and a second account some test USDC.
        usdc.mint(deployer, 10_000 * 10 ** 6);
        usdc.mint(tipper, 10_000 * 10 ** 6);

        // Seed one tip from the deployer so the feed shows something.
        usdc.approve(address(jar), type(uint256).max);
        jar.tip(5 * 10 ** 6, "gm! love this project");

        vm.stopBroadcast();

        // Seed a second tip from the other account.
        vm.startBroadcast(TIPPER_PK);
        usdc.approve(address(jar), type(uint256).max);
        jar.tip(25 * 10 ** 6, "keep shipping");
        vm.stopBroadcast();

        console.log("MockUSDC deployed at:", address(usdc));
        console.log("TipJar  deployed at:", address(jar));
        console.log("Deployer / owner:    ", deployer);
        console.log("Second tipper:       ", tipper);
    }
}
