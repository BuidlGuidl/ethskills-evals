// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {INonfungiblePositionManager} from "./interfaces/INonfungiblePositionManager.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";
import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";

contract UniswapV3CompoundStrategy {
    using SafeTransferLib for address;

    struct StrategyParams {
        address vault;
        address asset;
        address weth;
        address swapRouter;
        address positionManager;
        uint24 poolFee;
        int24 tickLower;
        int24 tickUpper;
        address keeper;
    }

    event KeeperSet(address indexed keeper);
    event OwnerSet(address indexed owner);
    event Deposited(uint256 assets, uint128 liquidity);
    event Harvested(address indexed caller, uint256 fees0, uint256 fees1, uint128 liquidityAdded);
    event Withdrawn(uint128 liquidity, uint256 assetsOut);

    error ZeroAddress();
    error ZeroAmount();
    error NotOwner();
    error NotVault();
    error NotKeeper();
    error NoPosition();
    error Slippage();

    address public immutable vault;
    address public immutable asset;
    address public immutable weth;
    address public immutable swapRouter;
    address public immutable positionManager;
    address public immutable token0;
    address public immutable token1;
    uint24 public immutable poolFee;
    int24 public immutable tickLower;
    int24 public immutable tickUpper;

    address public owner;
    address public keeper;
    uint256 public tokenId;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier onlyKeeperOrOwner() {
        if (msg.sender != keeper && msg.sender != owner) revert NotKeeper();
        _;
    }

    constructor(StrategyParams memory params) {
        if (
            params.vault == address(0) || params.asset == address(0) || params.weth == address(0)
                || params.swapRouter == address(0) || params.positionManager == address(0)
                || params.keeper == address(0)
        ) revert ZeroAddress();

        vault = params.vault;
        asset = params.asset;
        weth = params.weth;
        swapRouter = params.swapRouter;
        positionManager = params.positionManager;
        poolFee = params.poolFee;
        tickLower = params.tickLower;
        tickUpper = params.tickUpper;
        owner = msg.sender;
        keeper = params.keeper;
        (token0, token1) = params.weth < params.asset ? (params.weth, params.asset) : (params.asset, params.weth);

        emit OwnerSet(msg.sender);
        emit KeeperSet(params.keeper);
    }

    function setKeeper(address keeper_) external onlyOwner {
        if (keeper_ == address(0)) revert ZeroAddress();
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    function deposit(uint256 assets, uint256 minWethOut, uint256 minLiquidity)
        external
        onlyVault
        returns (uint128 liquidity)
    {
        if (assets == 0) revert ZeroAmount();
        asset.safeTransferFrom(msg.sender, address(this), assets);

        uint256 swapAmount = assets / 2;
        if (swapAmount > 0) {
            asset.safeApprove(swapRouter, swapAmount);
            ISwapRouter(swapRouter).exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: asset,
                    tokenOut: weth,
                    fee: poolFee,
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: swapAmount,
                    amountOutMinimum: minWethOut,
                    sqrtPriceLimitX96: 0
                })
            );
        }

        liquidity = _addLiquidity(minLiquidity);
        emit Deposited(assets, liquidity);
    }

    function harvest(uint256 minLiquidity) external onlyKeeperOrOwner returns (uint128 liquidityAdded) {
        uint256 fees0;
        uint256 fees1;
        if (tokenId != 0) {
            (fees0, fees1) = INonfungiblePositionManager(positionManager).collect(
                INonfungiblePositionManager.CollectParams({
                    tokenId: tokenId,
                    recipient: address(this),
                    amount0Max: type(uint128).max,
                    amount1Max: type(uint128).max
                })
            );
        }

        liquidityAdded = _addLiquidity(minLiquidity);
        emit Harvested(msg.sender, fees0, fees1, liquidityAdded);
    }

    function withdrawLiquidity(uint128 liquidity, uint256 minAssetsOut)
        external
        onlyVault
        returns (uint256 assetsOut)
    {
        if (tokenId == 0) revert NoPosition();

        if (liquidity > 0) {
            uint128 currentLiquidity = positionLiquidity();
            if (liquidity > currentLiquidity) liquidity = currentLiquidity;
            INonfungiblePositionManager(positionManager).decreaseLiquidity(
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: tokenId,
                    liquidity: liquidity,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                })
            );
        }

        INonfungiblePositionManager(positionManager).collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        uint256 wethBalance = IERC20(weth).balanceOf(address(this));
        if (wethBalance > 0) {
            weth.safeApprove(swapRouter, wethBalance);
            ISwapRouter(swapRouter).exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: weth,
                    tokenOut: asset,
                    fee: poolFee,
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: wethBalance,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                })
            );
        }

        assetsOut = IERC20(asset).balanceOf(address(this));
        if (assetsOut < minAssetsOut) revert Slippage();
        asset.safeTransfer(vault, assetsOut);
        emit Withdrawn(liquidity, assetsOut);
    }

    function positionLiquidity() public view returns (uint128 liquidity) {
        if (tokenId == 0) return 0;
        (,,,,,,, liquidity,,,,) = INonfungiblePositionManager(positionManager).positions(tokenId);
    }

    function _addLiquidity(uint256 minLiquidity) internal returns (uint128 liquidity) {
        uint256 amount0Desired = IERC20(token0).balanceOf(address(this));
        uint256 amount1Desired = IERC20(token1).balanceOf(address(this));
        if (amount0Desired == 0 && amount1Desired == 0) return 0;

        token0.safeApprove(positionManager, amount0Desired);
        token1.safeApprove(positionManager, amount1Desired);

        if (tokenId == 0) {
            uint256 mintedTokenId;
            (mintedTokenId, liquidity,,) = INonfungiblePositionManager(positionManager).mint(
                INonfungiblePositionManager.MintParams({
                    token0: token0,
                    token1: token1,
                    fee: poolFee,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    amount0Desired: amount0Desired,
                    amount1Desired: amount1Desired,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: address(this),
                    deadline: block.timestamp
                })
            );
            tokenId = mintedTokenId;
        } else {
            (liquidity,,) = INonfungiblePositionManager(positionManager).increaseLiquidity(
                INonfungiblePositionManager.IncreaseLiquidityParams({
                    tokenId: tokenId,
                    amount0Desired: amount0Desired,
                    amount1Desired: amount1Desired,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                })
            );
        }

        if (liquidity < minLiquidity) revert Slippage();
    }
}

