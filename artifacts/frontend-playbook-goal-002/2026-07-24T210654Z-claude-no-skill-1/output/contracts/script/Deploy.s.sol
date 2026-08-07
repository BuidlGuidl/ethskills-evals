// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TipJar} from "../src/TipJar.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice Deploys the tip jar for LOCAL development.
///
/// Because the local anvil chain has no real USDC, this script deploys a
/// MockUSDC and points the TipJar at it. It then writes the deployed addresses
/// to `frontend/lib/deployedContracts.json` so the web app can pick them up.
///
/// To deploy against real Base USDC (e.g. on a Base fork), set the env var
/// USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 and this script
/// will skip the mock and use it directly.
contract Deploy is Script {
    // Canonical USDC on Base mainnet.
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        vm.startBroadcast();

        address usdc = vm.envOr("USDC_ADDRESS", address(0));
        bool usingMock = usdc == address(0);
        if (usingMock) {
            MockUSDC mock = new MockUSDC();
            usdc = address(mock);
            console.log("Deployed MockUSDC at:", usdc);
        } else {
            console.log("Using existing USDC at:", usdc);
        }

        TipJar jar = new TipJar(usdc);
        console.log("Deployed TipJar at:", address(jar));

        vm.stopBroadcast();

        _writeFrontendConfig(block.chainid, address(jar), usdc, usingMock);
    }

    function _writeFrontendConfig(uint256 chainId, address jar, address usdc, bool usingMock) internal {
        string memory json = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(chainId),
            ",\n",
            '  "tipJar": "',
            vm.toString(jar),
            '",\n',
            '  "usdc": "',
            vm.toString(usdc),
            '",\n',
            '  "usdcIsMock": ',
            usingMock ? "true" : "false",
            "\n}\n"
        );
        string memory path = "../frontend/lib/deployedContracts.json";
        vm.writeFile(path, json);
        console.log("Wrote frontend config to", path);
    }
}
