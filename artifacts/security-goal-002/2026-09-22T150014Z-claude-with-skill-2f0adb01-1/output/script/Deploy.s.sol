// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";
import {ChainlinkOracle} from "../src/ChainlinkOracle.sol";
import {LendingMarket} from "../src/LendingMarket.sol";

/// @notice Deploys the WETH/USDC market to Ethereum mainnet.
///
/// Required env vars:
///   MARKET_OWNER      address that owns the market — MUST be a multisig or timelock, not an EOA
/// Optional:
///   BORROW_RATE_BPS   flat annual rate in bps (default 500 = 5%)
///
/// Usage:
///   forge script script/Deploy.s.sol:Deploy --rpc-url $MAINNET_RPC --broadcast --verify
contract Deploy is Script {
    // Canonical Ethereum mainnet addresses. Verify each one against the block explorer before
    // broadcasting — a wrong token or feed address here is unrecoverable.
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    /// @dev Chainlink ETH/USD, 8 decimals, 1h heartbeat + 0.5% deviation.
    address internal constant ETH_USD_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    /// @dev Chainlink USDC/USD, 8 decimals, 24h heartbeat + 0.25% deviation.
    address internal constant USDC_USD_FEED = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;

    /// @dev Heartbeat plus a grace margin, so an on-time-but-late update does not brick the market.
    uint256 internal constant ETH_USD_MAX_AGE = 1 hours + 15 minutes;
    uint256 internal constant USDC_USD_MAX_AGE = 24 hours + 1 hours;

    function run() external returns (ChainlinkOracle oracle, LendingMarket market) {
        address owner = vm.envAddress("MARKET_OWNER");
        uint256 rateBps = vm.envOr("BORROW_RATE_BPS", uint256(500));
        require(owner != address(0), "MARKET_OWNER unset");

        vm.startBroadcast();

        oracle = new ChainlinkOracle(
            AggregatorV3Interface(ETH_USD_FEED),
            ETH_USD_MAX_AGE,
            AggregatorV3Interface(USDC_USD_FEED),
            USDC_USD_MAX_AGE
        );

        market = new LendingMarket(IERC20(WETH), IERC20(USDC), oracle, rateBps, owner);

        vm.stopBroadcast();

        console2.log("ChainlinkOracle:", address(oracle));
        console2.log("LendingMarket:  ", address(market));
        console2.log("owner:          ", owner);
    }
}
