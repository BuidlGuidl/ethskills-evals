// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {FreelanceEscrow, IERC20Metadata} from "../src/FreelanceEscrow.sol";

interface Vm {
    function envAddress(string calldata name) external returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Run with: forge script script/DeployFreelanceEscrow.s.sol --rpc-url $RPC_URL --broadcast
contract DeployFreelanceEscrow {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (FreelanceEscrow escrow) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address arbitrator = vm.envAddress("ARBITRATOR");
        vm.startBroadcast();
        escrow = new FreelanceEscrow(IERC20Metadata(usdc), arbitrator);
        vm.stopBroadcast();
    }
}
