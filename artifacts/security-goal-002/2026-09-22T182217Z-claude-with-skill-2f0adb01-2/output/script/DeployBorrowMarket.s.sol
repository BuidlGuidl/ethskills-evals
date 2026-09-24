// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BorrowMarket} from "../src/BorrowMarket.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";

/// @notice Mainnet deployment for the WETH/USDC borrow market.
/// @dev    Addresses are compile-time constants rather than env vars on purpose: a typo'd feed address is
///         the single easiest way to lose the whole pool, and constants are reviewable in the diff.
///         The owner IS taken from the environment and must be a multisig or timelock.
contract DeployBorrowMarket is Script {
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    /// @dev Chainlink ETH/USD on mainnet. 8 decimals, 1 hour heartbeat, 0.5% deviation threshold.
    address internal constant ETH_USD_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;

    uint64 internal constant INTEREST_RATE_BPS = 500; // 5% APR
    /// @dev Feed heartbeat (1h) plus headroom for a late update. Must exceed the heartbeat or the market
    ///      will brick itself every time Chainlink publishes slightly behind schedule.
    uint64 internal constant MAX_PRICE_STALENESS = 90 minutes;
    uint256 internal constant MIN_DEBT = 1_000e6; // 1,000 USDC

    function run() external returns (BorrowMarket market) {
        require(block.chainid == 1, "DeployBorrowMarket: mainnet only");

        address owner = vm.envAddress("MARKET_OWNER");
        require(owner != address(0), "DeployBorrowMarket: owner unset");
        require(owner.code.length > 0, "DeployBorrowMarket: owner must be a multisig/timelock, not an EOA");

        vm.startBroadcast();
        market = new BorrowMarket(
            IERC20(WETH),
            IERC20(USDC),
            IAggregatorV3(ETH_USD_FEED),
            INTEREST_RATE_BPS,
            MAX_PRICE_STALENESS,
            MIN_DEBT,
            owner
        );
        vm.stopBroadcast();

        console2.log("BorrowMarket:", address(market));
        console2.log("owner:       ", owner);
        console2.log("ETH price:   ", market.collateralPrice());
        console2.log("REMINDER: fundLiquidity() with USDC from the owner before announcing the market.");
    }
}
