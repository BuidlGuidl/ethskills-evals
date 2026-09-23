// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ApiBilling, IERC20} from "../src/ApiBilling.sol";
import {MockUSDC} from "../test/MockUSDC.sol";

interface LocalVm {
    function envOr(string calldata, address) external returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

abstract contract Script {
    LocalVm internal constant vm = LocalVm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
}

contract Local is Script {
    function run() external returns (ApiBilling deployed, MockUSDC token) {
        vm.startBroadcast();
        token = new MockUSDC();
        deployed = new ApiBilling(msg.sender, IERC20(address(token)), 5e6, 20e6);
        token.mint(msg.sender, 1000e6);
        vm.stopBroadcast();
    }
}
