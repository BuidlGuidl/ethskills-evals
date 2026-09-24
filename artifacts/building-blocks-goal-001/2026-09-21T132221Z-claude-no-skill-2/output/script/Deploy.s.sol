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
import {IVolatilityOracle} from "../src/interfaces/IVolatilityOracle.sol";
import {ManualVolatilityOracle} from "../src/oracles/ManualVolatilityOracle.sol";

/// @notice Deploys stub oracle + hook (at a mined CREATE2 address) and initializes the dynamic-fee pool.
/// Env: OWNER, TOKEN, PAIR_TOKEN (address(0) = ETH), SQRT_PRICE_X96, optional POOL_MANAGER, TICK_SPACING.
/// forge script script/Deploy.s.sol --rpc-url mainnet --broadcast --verify --account <deployer>
contract Deploy is Script {
    // Uniswap v4 PoolManager on Ethereum mainnet
    address constant MAINNET_POOL_MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;
    // Deterministic CREATE2 deployer used by forge for `new X{salt: s}` in scripts
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    uint24 constant MIN_FEE = 500; // 0.05% calm
    uint24 constant MAX_FEE = 10_000; // 1.00% volatile
    uint24 constant FALLBACK_FEE = 3_000; // 0.30% if oracle unset/broken

    function run() external {
        IPoolManager manager = IPoolManager(vm.envOr("POOL_MANAGER", MAINNET_POOL_MANAGER));
        address owner = vm.envAddress("OWNER");
        address token = vm.envAddress("TOKEN");
        address pair = vm.envOr("PAIR_TOKEN", address(0));
        uint160 sqrtPriceX96 = uint160(vm.envUint("SQRT_PRICE_X96"));
        int24 tickSpacing = int24(int256(vm.envOr("TICK_SPACING", uint256(60))));

        vm.startBroadcast();

        // 1. Stub signal (score 0 = calm => MIN_FEE). Updater = owner. Swap for a real oracle later via setOracle.
        ManualVolatilityOracle oracle = new ManualVolatilityOracle(owner, 0);

        // 2. Hook: its address must encode BEFORE_INITIALIZE | BEFORE_SWAP in the low 14 bits.
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        bytes memory args =
            abi.encode(manager, owner, IVolatilityOracle(address(oracle)), MIN_FEE, MAX_FEE, FALLBACK_FEE);
        (address expected, bytes32 salt) = mineSalt(flags, abi.encodePacked(type(DynamicFeeHook).creationCode, args));
        DynamicFeeHook hook =
            new DynamicFeeHook{salt: salt}(manager, owner, IVolatilityOracle(address(oracle)), MIN_FEE, MAX_FEE, FALLBACK_FEE);
        require(address(hook) == expected, "hook address mismatch");

        // 3. Pool: fee MUST be DYNAMIC_FEE_FLAG, otherwise the hook's fee is ignored (and beforeInitialize reverts).
        (address c0, address c1) = token < pair ? (token, pair) : (pair, token);
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(hook))
        });
        manager.initialize(key, sqrtPriceX96);

        vm.stopBroadcast();

        console2.log("oracle", address(oracle));
        console2.log("hook  ", address(hook));
        console2.log("salt");
        console2.logBytes32(salt);
    }

    function mineSalt(uint160 flags, bytes memory initCode) internal view returns (address addr, bytes32 salt) {
        bytes32 codeHash = keccak256(initCode);
        for (uint256 i; i < 1_000_000; i++) {
            addr = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), CREATE2_DEPLOYER, i, codeHash)))));
            if (uint160(addr) & Hooks.ALL_HOOK_MASK == flags && addr.code.length == 0) return (addr, bytes32(i));
        }
        revert("salt not found");
    }
}
