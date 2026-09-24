// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "../../src/interfaces/IERC20.sol";
import { INonfungiblePositionManager } from "../../src/interfaces/INonfungiblePositionManager.sol";
import { SafeTransferLib } from "../../src/SafeTransferLib.sol";

interface IMintableToken {
    function mint(address to, uint256 amount) external;
}

contract MockNonfungiblePositionManager is INonfungiblePositionManager {
    using SafeTransferLib for IERC20;

    struct Position {
        address token0;
        address token1;
        uint128 liquidity;
        uint256 amount0;
        uint256 amount1;
        uint256 fees0;
        uint256 fees1;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 => Position) public positions;

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 addedLiquidity, uint256 amount0, uint256 amount1)
    {
        require(block.timestamp <= params.deadline, "DEADLINE");
        require(params.amount0Desired >= params.amount0Min, "AMOUNT0_MIN");
        require(params.amount1Desired >= params.amount1Min, "AMOUNT1_MIN");

        tokenId = nextTokenId++;
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        addedLiquidity = _liquidityFor(amount0, amount1);

        IERC20(params.token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(params.token1).safeTransferFrom(msg.sender, address(this), amount1);

        positions[tokenId] = Position({
            token0: params.token0,
            token1: params.token1,
            liquidity: addedLiquidity,
            amount0: amount0,
            amount1: amount1,
            fees0: 0,
            fees1: 0
        });
    }

    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        returns (uint128 addedLiquidity, uint256 amount0, uint256 amount1)
    {
        require(block.timestamp <= params.deadline, "DEADLINE");
        Position storage position = positions[params.tokenId];
        require(position.token0 != address(0), "POSITION");
        require(params.amount0Desired >= params.amount0Min, "AMOUNT0_MIN");
        require(params.amount1Desired >= params.amount1Min, "AMOUNT1_MIN");

        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        addedLiquidity = _liquidityFor(amount0, amount1);

        IERC20(position.token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(position.token1).safeTransferFrom(msg.sender, address(this), amount1);

        position.amount0 += amount0;
        position.amount1 += amount1;
        position.liquidity += addedLiquidity;
    }

    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        require(block.timestamp <= params.deadline, "DEADLINE");
        Position storage position = positions[params.tokenId];
        require(position.liquidity >= params.liquidity, "LIQUIDITY");

        amount0 = position.amount0 * params.liquidity / position.liquidity;
        amount1 = position.amount1 * params.liquidity / position.liquidity;
        require(amount0 >= params.amount0Min, "AMOUNT0_MIN");
        require(amount1 >= params.amount1Min, "AMOUNT1_MIN");

        position.liquidity -= params.liquidity;
        position.amount0 -= amount0;
        position.amount1 -= amount1;
        position.fees0 += amount0;
        position.fees1 += amount1;
    }

    function collect(CollectParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        Position storage position = positions[params.tokenId];
        amount0 = _min(position.fees0, uint256(params.amount0Max));
        amount1 = _min(position.fees1, uint256(params.amount1Max));

        position.fees0 -= amount0;
        position.fees1 -= amount1;

        if (amount0 != 0) IERC20(position.token0).safeTransfer(params.recipient, amount0);
        if (amount1 != 0) IERC20(position.token1).safeTransfer(params.recipient, amount1);
    }

    function accrueFees(uint256 tokenId, uint256 amount0, uint256 amount1) external {
        Position storage position = positions[tokenId];
        position.fees0 += amount0;
        position.fees1 += amount1;
        if (amount0 != 0) IMintableToken(position.token0).mint(address(this), amount0);
        if (amount1 != 0) IMintableToken(position.token1).mint(address(this), amount1);
    }

    function _liquidityFor(uint256 amount0, uint256 amount1) private pure returns (uint128) {
        return uint128(amount0 + amount1 / 1e12);
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}
