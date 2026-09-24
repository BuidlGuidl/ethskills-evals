// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AerodromeUsdcWethStrategy} from "../src/AerodromeUsdcWethStrategy.sol";
import {IYieldStrategy, YieldVault} from "../src/YieldVault.sol";
import {IERC20, IERC20Metadata} from "../src/interfaces/IERC20.sol";
import {IAerodromeGauge, IAerodromePair, IAerodromeRouter} from "../src/interfaces/IAerodrome.sol";

interface Vm {
    function envAddress(string calldata key) external view returns (address);
    function envBool(string calldata key) external view returns (bool);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (YieldVault vault, AerodromeUsdcWethStrategy strategy) {
        address deployer = vm.envAddress("OWNER");
        address keeper = vm.envAddress("KEEPER");
        IERC20Metadata usdc = IERC20Metadata(vm.envAddress("USDC"));
        IERC20 weth = IERC20(vm.envAddress("WETH"));
        IERC20 reward = IERC20(vm.envAddress("REWARD"));
        IAerodromeRouter router = IAerodromeRouter(vm.envAddress("AERODROME_ROUTER"));
        IAerodromeGauge gauge = IAerodromeGauge(vm.envAddress("AERODROME_GAUGE"));
        IAerodromePair pair = IAerodromePair(vm.envAddress("AERODROME_PAIR"));
        bool poolStable = vm.envBool("POOL_STABLE");
        bool rewardRouteStable = vm.envBool("REWARD_ROUTE_STABLE");

        vm.startBroadcast();
        vault = new YieldVault(usdc, "Base USDC-WETH Yield Vault", "byvUSDC", deployer);
        strategy = new AerodromeUsdcWethStrategy(
            address(vault), usdc, weth, reward, router, gauge, pair, poolStable, rewardRouteStable, deployer, keeper
        );
        vault.setStrategy(IYieldStrategy(address(strategy)));
        vm.stopBroadcast();
    }
}
