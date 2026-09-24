// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/// @notice Spins up the whole system on a local anvil node with a mock USDC and one subscriber,
/// so the backend gate can be exercised against a real chain. Local development only.
contract LocalDemo is Script {
    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        MockUSDC usdc = new MockUSDC();
        uint128[] memory prices = new uint128[](2);
        prices[0] = 5e6;
        prices[1] = 20e6;
        SubscriptionBilling billing =
            new SubscriptionBilling(IERC20(address(usdc)), deployer, deployer, prices);

        usdc.mint(deployer, 100e6);
        usdc.approve(address(billing), type(uint256).max);
        billing.deposit(10e6);
        billing.subscribe(1);
        vm.stopBroadcast();

        console2.log("USDC:", address(usdc));
        console2.log("BILLING:", address(billing));
        console2.log("SUBSCRIBER:", deployer);
    }
}
