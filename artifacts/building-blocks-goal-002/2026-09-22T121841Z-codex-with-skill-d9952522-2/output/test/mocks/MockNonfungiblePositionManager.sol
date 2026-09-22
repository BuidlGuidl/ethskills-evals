// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {INonfungiblePositionManager} from "../../src/interfaces/INonfungiblePositionManager.sol";
import {SafeTransferLib} from "../../src/libraries/SafeTransferLib.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockNonfungiblePositionManager is INonfungiblePositionManager {
    using SafeTransferLib for address;

    struct PositionData {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 => PositionData) public positionData;

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        tokenId = nextTokenId++;
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        liquidity = _toUint128(amount0 + amount1);

        if (amount0 > 0) params.token0.safeTransferFrom(msg.sender, address(this), amount0);
        if (amount1 > 0) params.token1.safeTransferFrom(msg.sender, address(this), amount1);

        positionData[tokenId] = PositionData({
            token0: params.token0,
            token1: params.token1,
            fee: params.fee,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: liquidity,
            tokensOwed0: 0,
            tokensOwed1: 0
        });
    }

    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        returns (uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        PositionData storage position = positionData[params.tokenId];
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        liquidity = _toUint128(amount0 + amount1);

        if (amount0 > 0) position.token0.safeTransferFrom(msg.sender, address(this), amount0);
        if (amount1 > 0) position.token1.safeTransferFrom(msg.sender, address(this), amount1);
        position.liquidity += liquidity;
    }

    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        PositionData storage position = positionData[params.tokenId];
        require(position.liquidity >= params.liquidity, "LIQUIDITY");
        position.liquidity -= params.liquidity;

        amount0 = params.liquidity / 2;
        amount1 = params.liquidity - amount0;
        position.tokensOwed0 += _toUint128(amount0);
        position.tokensOwed1 += _toUint128(amount1);
    }

    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1) {
        PositionData storage position = positionData[params.tokenId];
        amount0 = _min(position.tokensOwed0, params.amount0Max);
        amount1 = _min(position.tokensOwed1, params.amount1Max);
        position.tokensOwed0 -= uint128(amount0);
        position.tokensOwed1 -= uint128(amount1);

        if (amount0 > 0) MockERC20(position.token0).mint(params.recipient, amount0);
        if (amount1 > 0) MockERC20(position.token1).mint(params.recipient, amount1);
    }

    function accrueFees(uint256 tokenId, uint128 amount0, uint128 amount1) external {
        PositionData storage position = positionData[tokenId];
        position.tokensOwed0 += amount0;
        position.tokensOwed1 += amount1;
    }

    function positions(uint256 tokenId)
        external
        view
        returns (uint96, address, address, address, uint24, int24, int24, uint128, uint256, uint256, uint128, uint128)
    {
        PositionData storage position = positionData[tokenId];
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
            position.tokensOwed0,
            position.tokensOwed1
        );
    }

    function _toUint128(uint256 value) internal pure returns (uint128) {
        require(value <= type(uint128).max, "UINT128");
        return uint128(value);
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
