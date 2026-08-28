// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/Toolshed.sol";
import "../src/MockUSDC.sol";

interface Vm { function envUint(string calldata) external returns (uint256); function envOr(string calldata, address) external returns (address); function startBroadcast(uint256) external; function stopBroadcast() external; }

contract DeployToolshed {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function run() external returns (Toolshed toolshed) {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address usdcAddress = vm.envOr("USDC_ADDRESS", address(0));
        vm.startBroadcast(key);
        if (usdcAddress == address(0)) usdcAddress = address(new MockUSDC());
        toolshed = new Toolshed(usdcAddress);
        vm.stopBroadcast();
    }
}
