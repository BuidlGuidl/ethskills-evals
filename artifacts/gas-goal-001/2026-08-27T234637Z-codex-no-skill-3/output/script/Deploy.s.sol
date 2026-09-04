// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EscrowFactory} from "../src/EscrowFactory.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Deploys the factory. Individual clients fund escrows through `createEscrow`.
contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (EscrowFactory factory) {
        vm.startBroadcast();
        factory = new EscrowFactory();
        vm.stopBroadcast();
    }
}
