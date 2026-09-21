// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";

import {AeroUsdcWethVault} from "../src/AeroUsdcWethVault.sol";
import {IAeroRouter} from "../src/interfaces/IAerodrome.sol";
import {BaseAddresses as B} from "./BaseAddresses.sol";

/// Keeper harvest. Env: VAULT, AERO_USD_PRICE (USDC per AERO, 6 decimals, from an off-chain source),
/// optional MAX_SLIPPAGE_BPS (default 100).
/// minUsdcOut = min(off-chain value, on-chain quote) * (1 - slippage), so a manipulated pool can't
/// lower the floor below the off-chain price.
contract Harvest is Script {
    function run() external {
        AeroUsdcWethVault vault = AeroUsdcWethVault(vm.envAddress("VAULT"));
        uint256 slippageBps = vm.envOr("MAX_SLIPPAGE_BPS", uint256(100));
        uint256 aeroUsd = vm.envUint("AERO_USD_PRICE");

        uint256 pending = vault.gauge().earned(address(vault)) + vault.aero().balanceOf(address(vault));
        uint256 minOut;
        if (pending > 0) {
            IAeroRouter.Route[] memory r = new IAeroRouter.Route[](1);
            r[0] = IAeroRouter.Route(B.AERO, B.USDC, false, vault.factory());
            uint256 quote = vault.router().getAmountsOut(pending, r)[1];
            uint256 fair = pending * aeroUsd / 1e18;
            // Refuse to sell if the pool is far below the off-chain price (likely manipulated / illiquid).
            require(quote * 10_000 >= fair * (10_000 - 3 * slippageBps), "pool quote too low");
            minOut = (quote < fair ? quote : fair) * (10_000 - slippageBps) / 10_000;
        }
        console.log("pending AERO", pending);
        console.log("minUsdcOut", minOut);

        vm.startBroadcast();
        vault.harvest(minOut);
        vm.stopBroadcast();
    }
}
