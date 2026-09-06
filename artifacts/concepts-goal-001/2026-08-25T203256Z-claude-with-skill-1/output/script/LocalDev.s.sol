// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {IERC20} from "../src/IERC20.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";

/// @notice Local-only: stands up a fake USDC and the billing contract on anvil, and mints to the
///         default anvil accounts so you can click through the whole flow. Never run this
///         against a real network — it deploys a USDC anyone can mint.
///
///   anvil &
///   forge script script/LocalDev.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
contract LocalDev is Script {
    function run() external {
        require(block.chainid == 31337, "LocalDev is for anvil only");

        uint256 pk = vm.envOr(
            "PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(pk);

        uint8[] memory ids = new uint8[](2);
        uint128[] memory prices = new uint128[](2);
        (ids[0], prices[0]) = (1, 5e6);
        (ids[1], prices[1]) = (2, 20e6);

        vm.startBroadcast(pk);
        MockUSDC usdc = new MockUSDC();
        SubscriptionBilling billing = new SubscriptionBilling(IERC20(address(usdc)), deployer, ids, prices);
        for (uint256 i; i < 10; ++i) {
            usdc.mint(vm.addr(_anvilKey(i)), 1_000_000e6);
        }
        vm.stopBroadcast();

        console2.log("token  ", address(usdc));
        console2.log("billing", address(billing));

        string memory k = "localdev";
        vm.serializeAddress(k, "token", address(usdc));
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeAddress(k, "owner", deployer);
        string memory json = vm.serializeAddress(k, "billing", address(billing));
        vm.writeJson(json, "./deployments/31337.json");
    }

    /// @dev anvil's deterministic mnemonic accounts.
    function _anvilKey(uint256 i) internal pure returns (uint256) {
        uint256[10] memory keys = [
            0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80,
            0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d,
            0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a,
            0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6,
            0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a,
            0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba,
            0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e,
            0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356,
            0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97,
            0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6
        ];
        return keys[i];
    }
}
