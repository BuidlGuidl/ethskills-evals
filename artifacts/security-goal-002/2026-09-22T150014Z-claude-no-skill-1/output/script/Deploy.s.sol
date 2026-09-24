// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BorrowMarket} from "../src/BorrowMarket.sol";
import {ChainlinkOracle} from "../src/ChainlinkOracle.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";

/// @notice Mainnet deployment of the WETH-collateral / USDC-debt market.
/// @dev Run against a fork first: `forge script script/Deploy.s.sol --fork-url $ETH_RPC_URL`.
///      Every address below is mainnet-specific; see NOTES.md before touching them.
contract Deploy is Script {
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    /// @dev Chainlink ETH/USD, 8 decimals, 1h heartbeat, 0.5% deviation.
    address internal constant ETH_USD_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    /// @dev Chainlink USDC/USD, 8 decimals, 24h heartbeat, 0.25% deviation.
    address internal constant USDC_USD_FEED = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;

    /// @dev Heartbeat plus slack. Too tight bricks the market on a slow block; too loose lets a stale
    ///      price price a liquidation.
    uint32 internal constant ETH_USD_HEARTBEAT = 1 hours + 15 minutes;
    uint32 internal constant USDC_USD_HEARTBEAT = 24 hours + 1 hours;

    // Sanity bands in feed-native (8 dp) units. Widen only with a deliberate governance decision.
    uint128 internal constant ETH_USD_MIN = 100e8;
    uint128 internal constant ETH_USD_MAX = 100_000e8;
    uint128 internal constant USDC_USD_MIN = 0.90e8;
    uint128 internal constant USDC_USD_MAX = 1.10e8;

    uint256 internal constant RATE_PER_YEAR = 0.05e18; // 5% flat APR
    uint256 internal constant LTV_BPS = 7000; // 70% max borrow
    uint256 internal constant LIQUIDATION_THRESHOLD_BPS = 8500; // 85% liquidatable
    uint256 internal constant LIQUIDATION_BONUS_BPS = 500; // 5% bonus
    uint256 internal constant CLOSE_FACTOR_BPS = 5000; // 50% per liquidation
    uint256 internal constant MIN_DEBT = 1_000e6; // 1,000 USDC dust floor

    function run() external returns (ChainlinkOracle oracle, BorrowMarket market) {
        // Both of these must be multisigs/timelocks, never EOAs. See NOTES.md.
        address owner = vm.envAddress("OWNER");
        address liquidityManager = vm.envAddress("LIQUIDITY_MANAGER");

        vm.startBroadcast();

        // Deployer owns the oracle only long enough to install the feeds, then hands it over.
        oracle = new ChainlinkOracle(msg.sender);
        oracle.setFeed(WETH, IAggregatorV3(ETH_USD_FEED), ETH_USD_HEARTBEAT, ETH_USD_MIN, ETH_USD_MAX);
        oracle.setFeed(USDC, IAggregatorV3(USDC_USD_FEED), USDC_USD_HEARTBEAT, USDC_USD_MIN, USDC_USD_MAX);
        oracle.transferOwnership(owner);

        market = new BorrowMarket(
            owner,
            IERC20(WETH),
            IERC20(USDC),
            oracle,
            liquidityManager,
            RATE_PER_YEAR,
            LTV_BPS,
            LIQUIDATION_THRESHOLD_BPS,
            LIQUIDATION_BONUS_BPS,
            CLOSE_FACTOR_BPS,
            MIN_DEBT
        );

        vm.stopBroadcast();

        console.log("ChainlinkOracle:", address(oracle));
        console.log("BorrowMarket:   ", address(market));
        console.log("Oracle ownership transfer to owner is PENDING - accept it from", owner);
    }
}
