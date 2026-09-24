// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {ManualVolatilityOracle} from "../src/ManualVolatilityOracle.sol";
import {IVolatilityOracle} from "../src/interfaces/IVolatilityOracle.sol";

/// @notice Deploys oracle stub + hook (CREATE2, mined address) and initializes the pool.
/// Env: TOKEN, PAIR (0x0 = native ETH), OWNER, SQRT_PRICE_X96, optional TICK_SPACING (default 60).
contract Deploy is Script {
    /// Uniswap v4 PoolManager on Ethereum mainnet.
    IPoolManager constant POOL_MANAGER = IPoolManager(0x000000000004444c5dc75cB358380D2e3dE08A90);
    /// Deterministic CREATE2 proxy forge uses for `new X{salt: s}()` inside scripts.
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        address token = vm.envAddress("TOKEN");
        address pair = vm.envAddress("PAIR");
        address owner = vm.envAddress("OWNER");
        uint160 sqrtPriceX96 = uint160(vm.envUint("SQRT_PRICE_X96"));
        int24 tickSpacing = int24(int256(vm.envOr("TICK_SPACING", uint256(60))));

        // 0.05% calm .. 1% volatile, fall back to 0.3%. Vol in annualized bps.
        DynamicFeeHook.FeeConfig memory config = DynamicFeeHook.FeeConfig({
            minFee: 500,
            maxFee: 10_000,
            fallbackFee: 3000,
            lowVol: 3000, // 30%
            highVol: 15_000 // 150%
        });

        vm.startBroadcast();

        ManualVolatilityOracle oracle = new ManualVolatilityOracle(owner, 0);

        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        bytes memory args = abi.encode(POOL_MANAGER, token, owner, IVolatilityOracle(address(oracle)), config);
        (address expected, bytes32 salt) = mineSalt(flags, abi.encodePacked(type(DynamicFeeHook).creationCode, args));

        DynamicFeeHook hook =
            new DynamicFeeHook{salt: salt}(POOL_MANAGER, token, owner, IVolatilityOracle(address(oracle)), config);
        require(address(hook) == expected, "hook address mismatch");

        (address c0, address c1) = token < pair ? (token, pair) : (pair, token);
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(hook))
        });
        POOL_MANAGER.initialize(key, sqrtPriceX96);

        vm.stopBroadcast();

        console2.log("oracle", address(oracle));
        console2.log("hook  ", address(hook));
        console2.logBytes32(salt);
    }

    function mineSalt(uint160 flags, bytes memory initCode) internal view returns (address addr, bytes32 salt) {
        bytes32 initCodeHash = keccak256(initCode);
        for (uint256 i; i < 1_000_000; i++) {
            salt = bytes32(i);
            addr = vm.computeCreate2Address(salt, initCodeHash, CREATE2_DEPLOYER);
            if (uint160(addr) & Hooks.ALL_HOOK_MASK == flags && addr.code.length == 0) return (addr, salt);
        }
        revert("salt not found");
    }
}
