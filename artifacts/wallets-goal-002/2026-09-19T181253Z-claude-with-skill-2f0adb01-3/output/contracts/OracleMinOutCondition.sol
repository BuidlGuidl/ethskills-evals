// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IAggregatorV3 {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title OracleMinOutCondition
/// @notice Zodiac Roles v2 custom condition (ICustomCondition). Attached to the
///         `amountOutMinimum` field of SwapRouter02.exactInputSingle, it requires
///         the swap's minimum output to be within `maxBps` of the Chainlink
///         ETH/USD-implied output. A holder of the agent role therefore cannot
///         sign a swap with a lowball minOut and sandwich it.
/// @dev    Stateless, no owner, no storage. It can only make the role stricter:
///         if it reverts or returns false, the swap is rejected (fail closed).
///         `extra` (the 12 bytes after the address in the condition compValue)
///         carries maxBps as a uint96. USDC is treated as $1.
contract OracleMinOutCondition {
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    IAggregatorV3 public constant ETH_USD = IAggregatorV3(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);

    /// @notice Max Chainlink answer age. ETH/USD heartbeat is 3600s.
    uint256 public immutable maxOracleAge;

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    constructor(uint256 maxOracleAge_) {
        maxOracleAge = maxOracleAge_;
    }

    function check(
        address, /* to */
        uint256, /* value */
        bytes calldata data,
        uint8, /* operation */
        uint256, /* location */
        uint256, /* size */
        bytes12 extra
    ) external view returns (bool success, bytes32 reason) {
        uint256 maxBps = uint96(extra);
        if (maxBps >= 10_000) return (false, "bad maxBps");
        if (data.length < 4 + 7 * 32) return (false, "bad calldata");
        ExactInputSingleParams memory p = abi.decode(data[4:], (ExactInputSingleParams));

        (, int256 answer,, uint256 updatedAt,) = ETH_USD.latestRoundData();
        if (answer <= 0 || updatedAt > block.timestamp || block.timestamp - updatedAt > maxOracleAge) {
            return (false, "oracle stale");
        }
        uint256 price = uint256(answer); // 8 decimals

        uint256 expected;
        if (p.tokenIn == WETH && p.tokenOut == USDC) {
            expected = (p.amountIn * price) / 1e20; // 1e18 * 1e8 / 1e20 = 1e6
        } else if (p.tokenIn == USDC && p.tokenOut == WETH) {
            expected = (p.amountIn * 1e20) / price;
        } else {
            return (false, "pair");
        }

        if (p.amountOutMinimum * 10_000 < expected * (10_000 - maxBps)) return (false, "minOut below oracle floor");
        return (true, 0);
    }
}
