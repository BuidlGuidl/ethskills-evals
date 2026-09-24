// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {YieldVault, IStrategy} from "../src/YieldVault.sol";
import {AerodromeUsdcWethStrategy} from "../src/AerodromeUsdcWethStrategy.sol";
import {IAeroRouter, IAeroVoter} from "../src/interfaces/IAerodrome.sol";

/// @notice Base mainnet deploy. Env: OWNER, KEEPER, DEPOSIT_CAP (USDC, 6 dec).
contract Deploy is Script {
    // Base mainnet (verified onchain 2026-09-21, block ~51.6M)
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant AERO = 0x940181a94A35A4569E4529A3CDfB74e38FD98631;
    address constant AERO_ROUTER = 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43;
    address constant AERO_VOTER = 0x16613524e02ad97eDfeF371bC883F2F5d6C480A5;

    function run() external returns (YieldVault vault, AerodromeUsdcWethStrategy strategy) {
        require(block.chainid == 8453, "not Base");
        address owner = vm.envAddress("OWNER");
        address keeper = vm.envAddress("KEEPER");
        uint256 cap = vm.envOr("DEPOSIT_CAP", uint256(100_000e6));

        vm.startBroadcast();
        // Deployer is temporary owner so it can wire the strategy, then hands over.
        vault = new YieldVault(IERC20(USDC), msg.sender, keeper, cap);
        strategy = new AerodromeUsdcWethStrategy(
            address(vault),
            owner,
            IAeroRouter(AERO_ROUTER),
            IAeroVoter(AERO_VOTER),
            IERC20(USDC),
            IERC20(WETH),
            IERC20(AERO)
        );
        vault.setStrategy(IStrategy(address(strategy)));
        if (owner != msg.sender) vault.transferOwnership(owner); // owner must call acceptOwnership()
        vm.stopBroadcast();

        console.log("vault   ", address(vault));
        console.log("strategy", address(strategy));
        console.log("pool    ", address(strategy.pool()));
        console.log("gauge   ", address(strategy.gauge()));
    }
}
