// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LendingPool} from "../src/LendingPool.sol";
import {ChainlinkOracle} from "../src/oracle/ChainlinkOracle.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";

/// @notice Mainnet deployment script.
/// @dev Run against a fork first:
///      forge script script/Deploy.s.sol --rpc-url $MAINNET_RPC --sender $DEPLOYER
contract Deploy is Script {
    // --- Mainnet addresses -------------------------------------------------
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    /// @dev Chainlink ETH/USD, 8 decimals, 1-hour heartbeat / 0.5% deviation.
    address internal constant ETH_USD_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;

    // --- Oracle config -----------------------------------------------------
    /// @dev Heartbeat (3600s) plus margin. Tighter is safer but risks spurious freezes.
    uint256 internal constant MAX_PRICE_AGE = 1 hours + 15 minutes;
    uint256 internal constant MIN_ETH_PRICE = 100e18;
    uint256 internal constant MAX_ETH_PRICE = 100_000e18;

    // --- Market config -----------------------------------------------------
    uint256 internal constant LTV_BPS = 7_000; // 70%
    uint256 internal constant LIQUIDATION_THRESHOLD_BPS = 8_500; // 85%
    uint256 internal constant LIQUIDATION_BONUS_BPS = 500; // 5%
    uint256 internal constant CLOSE_FACTOR_BPS = 5_000; // 50% per liquidation
    uint256 internal constant BORROW_RATE_BPS = 500; // 5% APR, flat
    uint256 internal constant MIN_BORROW = 100e6; // 100 USDC

    function run() external returns (ChainlinkOracle oracle, LendingPool pool) {
        // The owner must be a multisig or timelock, never an EOA. See NOTES.md.
        address owner = vm.envAddress("POOL_OWNER");

        vm.startBroadcast();

        oracle = new ChainlinkOracle(owner, IAggregatorV3(ETH_USD_FEED), MAX_PRICE_AGE, MIN_ETH_PRICE, MAX_ETH_PRICE);

        pool = new LendingPool(
            owner,
            IERC20(WETH),
            IERC20(USDC),
            IPriceOracle(address(oracle)),
            LTV_BPS,
            LIQUIDATION_THRESHOLD_BPS,
            LIQUIDATION_BONUS_BPS,
            CLOSE_FACTOR_BPS,
            BORROW_RATE_BPS,
            MIN_BORROW
        );

        vm.stopBroadcast();

        console2.log("oracle", address(oracle));
        console2.log("pool  ", address(pool));
        console2.log("owner ", owner);
    }
}
