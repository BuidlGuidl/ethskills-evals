// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TipJar} from "../src/TipJar.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice Deploys a MockUSDC + TipJar to a LOCAL chain (e.g. anvil), seeds the
///         deployer with test USDC, and writes the deployed addresses to
///         ../frontend/contracts/deployment.json so the web app can find them.
///
/// Usage:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url http://127.0.0.1:8545 --broadcast
contract Deploy is Script {
    // On a real deployment you would point TipJar at Base USDC:
    //   0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    // For local dev we deploy a mock instead.
    function run() external {
        uint256 deployerKey = vm.envOr(
            "PRIVATE_KEY",
            // Default: anvil account #0 (well-known local test key).
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        MockUSDC usdc = new MockUSDC();
        TipJar tipJar = new TipJar(address(usdc), deployer);

        // Seed the deployer with 10,000 test USDC so tips can be sent immediately.
        usdc.mint(deployer, 10_000 * 10 ** 6);

        vm.stopBroadcast();

        console.log("MockUSDC deployed at:", address(usdc));
        console.log("TipJar  deployed at:", address(tipJar));
        console.log("Owner / deployer     :", deployer);

        _writeFrontendConfig(address(usdc), address(tipJar));
    }

    function _writeFrontendConfig(address usdc, address tipJar) internal {
        string memory json = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "MockUSDC": "',
            vm.toString(usdc),
            '",\n',
            '  "TipJar": "',
            vm.toString(tipJar),
            '"\n',
            "}\n"
        );
        vm.writeFile("../frontend/contracts/deployment.json", json);
        console.log("Wrote ../frontend/contracts/deployment.json");
    }
}
