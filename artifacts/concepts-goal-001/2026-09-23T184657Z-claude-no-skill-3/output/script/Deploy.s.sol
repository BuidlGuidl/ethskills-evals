// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice Deploys SubscriptionBilling and records the address under deployments/.
///
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
///
/// Environment:
///   USDC              address of the billing token (defaults to the known USDC on 8453/84532)
///   BILLING_OWNER     merchant address; defaults to the broadcasting key
///   HOBBY_PRICE       hobby plan price in token units (default 5_000_000 = $5)
///   PRO_PRICE         pro plan price in token units  (default 20_000_000 = $20)
contract Deploy is Script {
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external returns (SubscriptionBilling billing) {
        address usdc = vm.envOr("USDC", _defaultUsdc());
        require(usdc != address(0), "set USDC for this chain");
        require(usdc.code.length > 0, "USDC address has no code on this chain");

        uint256 hobbyPrice = vm.envOr("HOBBY_PRICE", uint256(5_000_000));
        uint256 proPrice = vm.envOr("PRO_PRICE", uint256(20_000_000));

        vm.startBroadcast();
        address owner = vm.envOr("BILLING_OWNER", msg.sender);
        billing = new SubscriptionBilling(IERC20(usdc), owner, hobbyPrice, proPrice);
        vm.stopBroadcast();

        console2.log("SubscriptionBilling:", address(billing));
        console2.log("  token:", usdc);
        console2.log("  owner:", owner);
        console2.log("  hobby:", hobbyPrice);
        console2.log("  pro:  ", proPrice);

        _record(address(billing), usdc, owner, hobbyPrice, proPrice);
    }

    function _defaultUsdc() internal view returns (address) {
        if (block.chainid == 8453) return USDC_BASE;
        if (block.chainid == 84_532) return USDC_BASE_SEPOLIA;
        return address(0);
    }

    function _record(address billing, address usdc, address owner, uint256 hobby, uint256 pro) internal {
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        string memory json = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "billing": "',
            vm.toString(billing),
            '",\n',
            '  "token": "',
            vm.toString(usdc),
            '",\n',
            '  "owner": "',
            vm.toString(owner),
            '",\n',
            '  "hobbyPrice": ',
            vm.toString(hobby),
            ",\n",
            '  "proPrice": ',
            vm.toString(pro),
            ",\n",
            '  "deployedAtBlock": ',
            vm.toString(block.number),
            "\n",
            "}\n"
        );
        vm.writeFile(path, json);
        console2.log("wrote", path);
    }
}
