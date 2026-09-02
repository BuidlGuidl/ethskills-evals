// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";

interface Vm {
    function envAddress(string calldata name) external returns (address);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice `forge script` deployment entry point. All values come from environment variables.
contract DeployFreelanceEscrow {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (FreelanceEscrow escrow) {
        address token = vm.envAddress("PAYMENT_TOKEN");
        address client = vm.envAddress("CLIENT");
        address freelancer = vm.envAddress("FREELANCER");
        address arbitrator = vm.envAddress("ARBITRATOR");
        uint256 amount = vm.envUint("AMOUNT");

        vm.startBroadcast();
        escrow = new FreelanceEscrow(token, client, freelancer, arbitrator, amount);
        vm.stopBroadcast();
    }
}
