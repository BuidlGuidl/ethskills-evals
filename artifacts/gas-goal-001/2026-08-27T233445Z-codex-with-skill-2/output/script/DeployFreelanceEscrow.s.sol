// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

interface Vm {
    function envAddress(string calldata name) external returns (address value);
    function envUint(string calldata name) external returns (uint256 value);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Deploy one escrow. Provide all values through environment variables; no secrets are committed.
contract DeployFreelanceEscrow {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (FreelanceEscrow escrow) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        IERC20 token = IERC20(vm.envAddress("USDC_ADDRESS"));
        address client = vm.envAddress("CLIENT_ADDRESS");
        address contractor = vm.envAddress("CONTRACTOR_ADDRESS");
        address arbiter = vm.envAddress("ARBITER_ADDRESS");
        uint256 amount = vm.envUint("AMOUNT_USDC");

        vm.startBroadcast(deployerKey);
        escrow = new FreelanceEscrow(token, client, contractor, arbiter, amount);
        vm.stopBroadcast();
    }
}
