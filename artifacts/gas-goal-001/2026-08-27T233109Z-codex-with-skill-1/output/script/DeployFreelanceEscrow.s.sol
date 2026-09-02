// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
    function envOr(string calldata name, address defaultValue) external returns (address value);
    function envOr(string calldata name, uint256 defaultValue) external returns (uint256 value);
}

contract DeployFreelanceEscrow {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    // Base mainnet's native USDC. Override PAYMENT_TOKEN for a different network/token.
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    uint256 internal constant MIN_USDC = 2_000e6;
    uint256 internal constant MAX_USDC = 50_000e6;

    function run() external returns (FreelanceEscrow escrow) {
        address token = vm.envOr("PAYMENT_TOKEN", BASE_USDC);
        uint256 minAmount = vm.envOr("MIN_AMOUNT", MIN_USDC);
        uint256 maxAmount = vm.envOr("MAX_AMOUNT", MAX_USDC);
        vm.startBroadcast();
        escrow = new FreelanceEscrow(token, minAmount, maxAmount);
        vm.stopBroadcast();
    }
}
