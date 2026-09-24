// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {WethUsdcMarket} from "../src/WethUsdcMarket.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";

/// @notice Mainnet deployment of the WETH/USDC borrowing market.
contract Deploy is Script {
    // Ethereum mainnet addresses.
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    /// @dev Chainlink ETH/USD proxy: 8 decimals, 1h heartbeat / 0.5% deviation.
    address internal constant ETH_USD_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;

    /// @dev 1h heartbeat + 15m margin for congestion.
    uint256 internal constant PRICE_MAX_AGE = 75 minutes;

    function run() external returns (WethUsdcMarket market) {
        // Multisig or timelock that will hold pause / rate / staleness authority.
        address owner = vm.envAddress("MARKET_OWNER");
        uint256 borrowRateBps = vm.envUint("BORROW_RATE_BPS");

        vm.startBroadcast();
        market = new WethUsdcMarket(
            IERC20(USDC), IERC20(WETH), IAggregatorV3(ETH_USD_FEED), borrowRateBps, PRICE_MAX_AGE, owner
        );
        vm.stopBroadcast();

        console2.log("WethUsdcMarket", address(market));
        console2.log("owner", market.owner());
    }
}
