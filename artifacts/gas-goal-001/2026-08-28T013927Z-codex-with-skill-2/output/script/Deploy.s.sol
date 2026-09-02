// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EscrowFactory} from "../src/EscrowFactory.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
    function envAddress(string calldata name) external returns (address value);
}

/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (EscrowFactory factory) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        vm.startBroadcast();
        factory = new EscrowFactory(IERC20(usdc));
        vm.stopBroadcast();
    }
}
