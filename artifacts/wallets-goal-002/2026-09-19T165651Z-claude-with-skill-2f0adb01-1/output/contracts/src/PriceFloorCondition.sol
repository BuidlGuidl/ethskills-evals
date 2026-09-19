// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title PriceFloorCondition
/// @notice Zodiac Roles v2 custom condition (Operator.Custom) that rejects any
///         Uniswap V3 SwapRouter.exactInputSingle WETH<->USDC swap whose
///         amountOutMinimum is worse than the Chainlink ETH/USD price minus a
///         tolerance. It is what stops a stolen agent key from selling the
///         treasury at a garbage price into its own sandwich.
/// @dev    Stateless and immutable. The tolerance (bps) is passed per-scope via
///         the 12-byte `extra` field of the condition's compValue, so the Safe
///         owners can tighten/loosen it with a Roles re-scope, no redeploy.
///         Assumes 1 USDC == 1 USD (see DEPLOY.md, "USDC depeg").
contract PriceFloorCondition {
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    /// Chainlink ETH/USD, 8 decimals, 3600s heartbeat / 0.5% deviation.
    AggregatorV3Interface public constant ETH_USD =
        AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    uint256 public constant MAX_ORACLE_AGE = 3600 + 600;
    uint256 public constant MAX_TOLERANCE_BPS = 500;

    /// SwapRouter (v1, 0xE592...1564) exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))
    bytes4 public constant EXACT_INPUT_SINGLE = 0x414bf389;

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    /// @dev Signature must match ICustomCondition in zodiac-modifier-roles v2
    ///      (Enum.Operation is ABI-encoded as uint8).
    function check(
        address,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256,
        uint256,
        bytes12 extra
    ) external view returns (bool, bytes32) {
        if (value != 0 || operation != 0) return (false, "call-only");
        if (data.length != 4 + 8 * 32 || bytes4(data[:4]) != EXACT_INPUT_SINGLE) {
            return (false, "not-exactInputSingle");
        }
        ExactInputSingleParams memory p = abi.decode(data[4:], (ExactInputSingleParams));

        uint256 toleranceBps = uint96(extra);
        if (toleranceBps > MAX_TOLERANCE_BPS) return (false, "bad-tolerance");

        (, int256 answer,, uint256 updatedAt,) = ETH_USD.latestRoundData();
        if (answer <= 0) return (false, "oracle-bad-answer");
        if (block.timestamp - updatedAt > MAX_ORACLE_AGE) return (false, "oracle-stale");
        uint256 price = uint256(answer); // USD per ETH, 1e8

        uint256 fairOut;
        if (p.tokenIn == WETH && p.tokenOut == USDC) {
            // wei(1e18) -> USDC(1e6) at price(1e8): amountIn * price / 1e20
            fairOut = (p.amountIn * price) / 1e20;
        } else if (p.tokenIn == USDC && p.tokenOut == WETH) {
            // USDC(1e6) -> wei(1e18) at price(1e8): amountIn * 1e20 / price
            fairOut = (p.amountIn * 1e20) / price;
        } else {
            return (false, "pair-not-allowed");
        }

        if (p.amountOutMinimum * 10_000 < fairOut * (10_000 - toleranceBps)) {
            return (false, "min-out-below-floor");
        }
        return (true, 0);
    }
}

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
