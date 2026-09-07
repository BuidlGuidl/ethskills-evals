// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TipJar} from "../src/TipJar.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice Deploys TipJar and writes the addresses to deployments/<chainId>.json
///         so the front end can pick them up.
///
/// Env:
///   PRIVATE_KEY   - deployer key (required)
///   USDC_ADDRESS  - token to collect tips in. Defaults to Base USDC. If nothing
///                   is deployed at that address (a bare, non-forked Anvil), a
///                   MockUSDC is deployed instead.
///   OWNER_ADDRESS - jar owner. Defaults to the deployer.
contract Deploy is Script {
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external returns (TipJar jar, address usdc) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address owner = vm.envOr("OWNER_ADDRESS", deployer);
        usdc = vm.envOr("USDC_ADDRESS", BASE_USDC);

        vm.startBroadcast(deployerKey);

        if (usdc.code.length == 0) {
            // Bare local chain: no USDC to point at, so ship a stand-in.
            usdc = address(new MockUSDC());
            console2.log("No token at the configured address; deployed MockUSDC at", usdc);
        }

        jar = new TipJar(IERC20(usdc), owner);

        vm.stopBroadcast();

        console2.log("chainId  ", block.chainid);
        console2.log("TipJar   ", address(jar));
        console2.log("USDC     ", usdc);
        console2.log("owner    ", owner);

        _writeDeployment(address(jar), usdc, owner);
    }

    function _writeDeployment(address jar, address usdc, address owner) internal {
        string memory json = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "tipJar": "',
            vm.toString(jar),
            '",\n',
            '  "usdc": "',
            vm.toString(usdc),
            '",\n',
            '  "owner": "',
            vm.toString(owner),
            '",\n',
            '  "blockNumber": ',
            vm.toString(block.number),
            "\n}\n"
        );

        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeFile(path, json);
        console2.log("wrote", path);
    }
}
