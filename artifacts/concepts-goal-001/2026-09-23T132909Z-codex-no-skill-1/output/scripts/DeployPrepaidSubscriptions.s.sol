// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PrepaidSubscriptions} from "../contracts/PrepaidSubscriptions.sol";

interface Vm {
    function envAddress(string calldata name) external returns (address);
    function envOr(string calldata name, address defaultValue) external returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployPrepaidSubscriptions {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (PrepaidSubscriptions subscriptionBilling) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address owner = vm.envOr("OWNER_ADDRESS", msg.sender);

        vm.startBroadcast();
        subscriptionBilling = new PrepaidSubscriptions(usdc, owner);
        vm.stopBroadcast();
    }
}

