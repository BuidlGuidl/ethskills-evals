// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {INonfungiblePositionManager} from "../../src/interfaces/IUniswapV3Periphery.sol";
import {IERC20} from "../../src/interfaces/IERC20.sol";
import {SafeERC20} from "../../src/libraries/SafeERC20.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockNonfungiblePositionManager is INonfungiblePositionManager {
    using SafeERC20 for IERC20;

    struct Position {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 amount0;
        uint256 amount1;
        uint128 owed0;
        uint128 owed1;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 => Position) public storedPositions;

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        require(params.deadline >= block.timestamp, "EXPIRED");
        require(params.amount0Desired >= params.amount0Min, "LOW_AMOUNT0");
        require(params.amount1Desired >= params.amount1Min, "LOW_AMOUNT1");

        IERC20(params.token0).safeTransferFrom(msg.sender, address(this), params.amount0Desired);
        IERC20(params.token1).safeTransferFrom(msg.sender, address(this), params.amount1Desired);

        tokenId = nextTokenId++;
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        liquidity = uint128(amount0 + amount1);
        storedPositions[tokenId] = Position({
            token0: params.token0,
            token1: params.token1,
            fee: params.fee,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: liquidity,
            amount0: amount0,
            amount1: amount1,
            owed0: 0,
            owed1: 0
        });
    }

    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        returns (uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        require(params.deadline >= block.timestamp, "EXPIRED");
        Position storage position = storedPositions[params.tokenId];
        require(position.token0 != address(0), "NO_POSITION");
        require(params.amount0Desired >= params.amount0Min, "LOW_AMOUNT0");
        require(params.amount1Desired >= params.amount1Min, "LOW_AMOUNT1");

        IERC20(position.token0).safeTransferFrom(msg.sender, address(this), params.amount0Desired);
        IERC20(position.token1).safeTransferFrom(msg.sender, address(this), params.amount1Desired);

        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        liquidity = uint128(amount0 + amount1);
        position.amount0 += amount0;
        position.amount1 += amount1;
        position.liquidity += liquidity;
    }

    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        require(params.deadline >= block.timestamp, "EXPIRED");
        Position storage position = storedPositions[params.tokenId];
        require(params.liquidity <= position.liquidity, "TOO_MUCH_LIQUIDITY");

        amount0 = (position.amount0 * params.liquidity) / position.liquidity;
        amount1 = (position.amount1 * params.liquidity) / position.liquidity;
        require(amount0 >= params.amount0Min, "LOW_AMOUNT0");
        require(amount1 >= params.amount1Min, "LOW_AMOUNT1");

        position.amount0 -= amount0;
        position.amount1 -= amount1;
        position.liquidity -= params.liquidity;
        position.owed0 += uint128(amount0);
        position.owed1 += uint128(amount1);
    }

    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1) {
        Position storage position = storedPositions[params.tokenId];
        amount0 = params.amount0Max < position.owed0 ? params.amount0Max : position.owed0;
        amount1 = params.amount1Max < position.owed1 ? params.amount1Max : position.owed1;

        position.owed0 -= uint128(amount0);
        position.owed1 -= uint128(amount1);

        if (amount0 > 0) IERC20(position.token0).safeTransfer(params.recipient, amount0);
        if (amount1 > 0) IERC20(position.token1).safeTransfer(params.recipient, amount1);
    }

    function positions(uint256 tokenId)
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        Position storage position = storedPositions[tokenId];
        return (
            0,
            address(0),
            position.token0,
            position.token1,
            position.fee,
            position.tickLower,
            position.tickUpper,
            position.liquidity,
            0,
            0,
            position.owed0,
            position.owed1
        );
    }

    function addFees(uint256 tokenId, uint128 amount0, uint128 amount1) external {
        Position storage position = storedPositions[tokenId];
        require(position.token0 != address(0), "NO_POSITION");
        position.owed0 += amount0;
        position.owed1 += amount1;
        if (amount0 > 0) MockERC20(position.token0).mint(address(this), amount0);
        if (amount1 > 0) MockERC20(position.token1).mint(address(this), amount1);
    }

    function positionValue(uint256 tokenId) external view returns (uint256) {
        Position storage position = storedPositions[tokenId];
        return position.amount0 + position.amount1 + position.owed0 + position.owed1;
    }
}

