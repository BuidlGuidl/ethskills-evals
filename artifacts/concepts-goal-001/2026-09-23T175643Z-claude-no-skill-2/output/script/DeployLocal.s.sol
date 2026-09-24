// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";

/// @notice Stands up a mock USDC plus the billing contract on a local anvil node, and funds the
///         default anvil accounts so the backend can be pointed at it straight away.
contract DeployLocal is Script {
    function run() external returns (SubscriptionBilling billing, MockUSDC usdc) {
        address owner = msg.sender;

        uint128[] memory prices = new uint128[](2);
        prices[0] = 5e6;
        prices[1] = 20e6;

        vm.startBroadcast();
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(IERC20(address(usdc)), owner, prices);
        for (uint256 i; i < 5; ++i) {
            usdc.mint(vm.addr(_anvilKey(i)), 10_000e6);
        }
        vm.stopBroadcast();

        console2.log("MockUSDC:           ", address(usdc));
        console2.log("SubscriptionBilling:", address(billing));

        string memory json = string.concat(
            '{\n  "chainId": ',
            vm.toString(block.chainid),
            ',\n  "subscriptionBilling": "',
            vm.toString(address(billing)),
            '",\n  "usdc": "',
            vm.toString(address(usdc)),
            '",\n  "owner": "',
            vm.toString(owner),
            '",\n  "deployedAtBlock": ',
            vm.toString(block.number),
            "\n}\n"
        );
        vm.createDir("deployments", true);
        vm.writeFile(string.concat("deployments/", vm.toString(block.chainid), ".json"), json);
    }

    /// @dev anvil's default mnemonic ("test test ... junk") derivation, accounts 0-4.
    function _anvilKey(uint256 i) internal pure returns (uint256) {
        uint256[5] memory keys = [
            0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80,
            0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d,
            0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a,
            0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6,
            0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
        ];
        return keys[i];
    }
}
