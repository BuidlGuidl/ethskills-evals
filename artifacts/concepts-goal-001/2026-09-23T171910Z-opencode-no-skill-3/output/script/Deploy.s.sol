// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ApiBilling, IERC20} from "../src/ApiBilling.sol";

interface DeployVm {
    function envAddress(string calldata) external returns (address);
    function envUint(string calldata) external returns (uint256);
    function startBroadcast() external;
    function stopBroadcast() external;
}

abstract contract Script {
    DeployVm internal constant vm = DeployVm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
}

contract Deploy is Script {
    function run() external returns (ApiBilling deployed) {
        address ownerAddress = vm.envAddress("OWNER_ADDRESS");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        uint256 hobbyFee = vm.envUint("HOBBY_FEE_USDC");
        uint256 proFee = vm.envUint("PRO_FEE_USDC");
        vm.startBroadcast();
        deployed = new ApiBilling(ownerAddress, IERC20(usdcAddress), hobbyFee, proFee);
        vm.stopBroadcast();
    }
}
