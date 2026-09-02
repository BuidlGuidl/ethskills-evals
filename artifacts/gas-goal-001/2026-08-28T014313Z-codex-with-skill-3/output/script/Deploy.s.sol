// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "../src/interfaces/IERC20.sol";
import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Deploy with: forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast
contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    // Base mainnet's native USDC (6 decimals). Override for a testnet/token deployment.
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    uint256 internal constant USDC_SCALE = 1e6;

    function run() external returns (FreelanceEscrowFactory factory) {
        address token = vmEnvOr("PAYMENT_TOKEN", BASE_USDC);
        address arbitrator = vmEnvAddress("ARBITRATOR");
        vm.startBroadcast();
        factory = new FreelanceEscrowFactory(IERC20(token), arbitrator, 2_000 * USDC_SCALE, 50_000 * USDC_SCALE);
        vm.stopBroadcast();
    }

    // Kept here to make the required environment variables explicit without importing forge-std.
    function vmEnvAddress(string memory name) private returns (address value) {
        (bool ok, bytes memory data) = address(vm).call(abi.encodeWithSignature("envAddress(string)", name));
        require(ok, "missing ARBITRATOR");
        value = abi.decode(data, (address));
    }

    function vmEnvOr(string memory name, address fallbackValue) private returns (address value) {
        (bool ok, bytes memory data) =
            address(vm).call(abi.encodeWithSignature("envOr(string,address)", name, fallbackValue));
        require(ok, "invalid PAYMENT_TOKEN");
        value = abi.decode(data, (address));
    }
}
