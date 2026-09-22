// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {WethUsdcMarket} from "../src/WethUsdcMarket.sol";

/**
 * @notice Mainnet deployment. Addresses below are Ethereum mainnet; verify each one before running.
 *
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url $MAINNET_RPC_URL --broadcast --verify \
 *     --sig "run(address)" $OWNER_MULTISIG
 */
contract Deploy is Script {
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    /// @dev Chainlink ETH/USD, 8 decimals, 3600s heartbeat, 0.5% deviation threshold.
    address constant ETH_USD_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;

    uint256 constant BORROW_RATE_BPS = 500; // 5% flat annual

    /// @dev Feed heartbeat is 3600s; allow a small buffer for a late-but-valid update.
    uint256 constant MAX_PRICE_STALENESS = 3900;

    /// @dev Sanity band on ETH/USD in feed (8) decimals. Tighten/loosen deliberately, not by habit.
    uint256 constant MIN_PRICE = 100e8; //    $100
    uint256 constant MAX_PRICE = 100_000e8; // $100,000

    /// @dev Dust floor: positions smaller than this are not worth a liquidator's gas.
    uint256 constant MIN_DEBT = 500e6; // 500 USDC (6 decimals)

    function run(address owner) external returns (WethUsdcMarket market) {
        require(owner != address(0), "owner unset");

        vm.startBroadcast();
        market = new WethUsdcMarket(
            owner, WETH, USDC, ETH_USD_FEED, BORROW_RATE_BPS, MAX_PRICE_STALENESS, MIN_PRICE, MAX_PRICE, MIN_DEBT
        );
        vm.stopBroadcast();

        console2.log("WethUsdcMarket:", address(market));
        console2.log("owner (must be a multisig/timelock):", owner);
    }
}
