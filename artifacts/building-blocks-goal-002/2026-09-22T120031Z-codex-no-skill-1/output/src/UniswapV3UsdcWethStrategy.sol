// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {IPositionValueOracle} from "./interfaces/IPositionValueOracle.sol";
import {IStrategy} from "./interfaces/IStrategy.sol";
import {ISwapRouterV3, INonfungiblePositionManager} from "./interfaces/IUniswapV3Periphery.sol";
import {SafeERC20} from "./libraries/SafeERC20.sol";
import {Ownable} from "./utils/Ownable.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";

contract UniswapV3UsdcWethStrategy is IStrategy, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct HarvestParams {
        uint256 minWethOut;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 minLiquidity;
        uint256 deadline;
    }

    event KeeperSet(address indexed keeper, bool allowed);
    event WithdrawalSlippageSet(uint256 bps);
    event DepositedFromVault(uint256 assets);
    event Harvested(
        address indexed keeper,
        uint256 collected0,
        uint256 collected1,
        uint256 swappedUsdc,
        uint256 wethReceived,
        uint128 liquidity
    );
    event WithdrawnToVault(uint256 requestedAssets, uint256 returnedAssets);

    uint256 private constant BPS = 10_000;

    address public immutable vault;
    IERC20 public immutable assetToken;
    IERC20 public immutable weth;
    IERC20 public immutable token0;
    IERC20 public immutable token1;
    ISwapRouterV3 public immutable swapRouter;
    INonfungiblePositionManager public immutable positionManager;
    IPositionValueOracle public immutable valueOracle;
    uint24 public immutable poolFee;
    int24 public immutable tickLower;
    int24 public immutable tickUpper;

    uint256 public tokenId;
    uint256 public withdrawalSlippageBps = 50;
    mapping(address => bool) public keepers;

    modifier onlyVault() {
        require(msg.sender == vault, "ONLY_VAULT");
        _;
    }

    modifier onlyKeeperOrOwner() {
        require(msg.sender == owner || keepers[msg.sender], "ONLY_KEEPER");
        _;
    }

    constructor(
        address vault_,
        IERC20 asset_,
        IERC20 weth_,
        ISwapRouterV3 swapRouter_,
        INonfungiblePositionManager positionManager_,
        IPositionValueOracle valueOracle_,
        uint24 poolFee_,
        int24 tickLower_,
        int24 tickUpper_,
        address owner_
    ) Ownable(owner_) {
        require(vault_ != address(0), "ZERO_VAULT");
        require(address(asset_) != address(0), "ZERO_ASSET");
        require(address(weth_) != address(0), "ZERO_WETH");
        require(address(swapRouter_) != address(0), "ZERO_ROUTER");
        require(address(positionManager_) != address(0), "ZERO_PM");
        require(address(valueOracle_) != address(0), "ZERO_ORACLE");
        require(tickLower_ < tickUpper_, "BAD_TICKS");

        vault = vault_;
        assetToken = asset_;
        weth = weth_;
        swapRouter = swapRouter_;
        positionManager = positionManager_;
        valueOracle = valueOracle_;
        poolFee = poolFee_;
        tickLower = tickLower_;
        tickUpper = tickUpper_;

        (token0, token1) = address(weth_) < address(asset_) ? (weth_, asset_) : (asset_, weth_);
    }

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        keepers[keeper] = allowed;
        emit KeeperSet(keeper, allowed);
    }

    function setWithdrawalSlippageBps(uint256 bps) external onlyOwner {
        require(bps <= 1_000, "SLIPPAGE_TOO_HIGH");
        withdrawalSlippageBps = bps;
        emit WithdrawalSlippageSet(bps);
    }

    function asset() external view returns (address) {
        return address(assetToken);
    }

    function deposit(uint256 assets) external onlyVault {
        emit DepositedFromVault(assets);
    }

    function harvest(HarvestParams calldata params)
        external
        nonReentrant
        onlyKeeperOrOwner
        returns (uint128 liquidity)
    {
        require(params.deadline >= block.timestamp, "DEADLINE");

        (uint256 collected0, uint256 collected1) = _collectIfPositionExists();
        (uint256 swappedUsdc, uint256 wethReceived, uint128 addedLiquidity) = _deployIdle(params);

        emit Harvested(msg.sender, collected0, collected1, swappedUsdc, wethReceived, addedLiquidity);
        return addedLiquidity;
    }

    function withdraw(uint256 assets, address receiver)
        external
        nonReentrant
        onlyVault
        returns (uint256 returnedAssets)
    {
        require(receiver != address(0), "ZERO_RECEIVER");

        uint256 assetBalance = assetToken.balanceOf(address(this));
        if (assetBalance < assets && tokenId != 0) {
            _withdrawFromPosition(assets - assetBalance);
            _swapAllWethToAsset(block.timestamp);
        }

        returnedAssets = assetToken.balanceOf(address(this));
        if (returnedAssets > assets) returnedAssets = assets;
        assetToken.safeTransfer(receiver, returnedAssets);

        emit WithdrawnToVault(assets, returnedAssets);
    }

    function totalAssets() external view returns (uint256) {
        uint256 total = assetToken.balanceOf(address(this));
        total += valueOracle.tokenValueInAsset(address(weth), weth.balanceOf(address(this)));
        if (tokenId != 0) total += valueOracle.positionValueInAsset(tokenId);
        return total;
    }

    function _deployIdle(HarvestParams calldata params)
        private
        returns (uint256 swappedUsdc, uint256 wethReceived, uint128 liquidity)
    {
        uint256 assetBalance = assetToken.balanceOf(address(this));
        uint256 wethBalance = weth.balanceOf(address(this));

        if (assetBalance > 1) {
            swappedUsdc = assetBalance / 2;
            assetToken.forceApprove(address(swapRouter), swappedUsdc);
            wethReceived = swapRouter.exactInputSingle(
                ISwapRouterV3.ExactInputSingleParams({
                    tokenIn: address(assetToken),
                    tokenOut: address(weth),
                    fee: poolFee,
                    recipient: address(this),
                    deadline: params.deadline,
                    amountIn: swappedUsdc,
                    amountOutMinimum: params.minWethOut,
                    sqrtPriceLimitX96: 0
                })
            );
            wethBalance += wethReceived;
            assetBalance -= swappedUsdc;
        }

        if (assetBalance == 0 || wethBalance == 0) return (0, 0, 0);

        assetToken.forceApprove(address(positionManager), assetBalance);
        weth.forceApprove(address(positionManager), wethBalance);

        uint256 amount0Desired = address(token0) == address(assetToken) ? assetBalance : wethBalance;
        uint256 amount1Desired = address(token1) == address(assetToken) ? assetBalance : wethBalance;

        if (tokenId == 0) {
            (uint256 mintedTokenId, uint128 mintedLiquidity,,) = positionManager.mint(
                INonfungiblePositionManager.MintParams({
                    token0: address(token0),
                    token1: address(token1),
                    fee: poolFee,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    amount0Desired: amount0Desired,
                    amount1Desired: amount1Desired,
                    amount0Min: params.amount0Min,
                    amount1Min: params.amount1Min,
                    recipient: address(this),
                    deadline: params.deadline
                })
            );
            tokenId = mintedTokenId;
            liquidity = mintedLiquidity;
        } else {
            (uint128 addedLiquidity,,) = positionManager.increaseLiquidity(
                INonfungiblePositionManager.IncreaseLiquidityParams({
                    tokenId: tokenId,
                    amount0Desired: amount0Desired,
                    amount1Desired: amount1Desired,
                    amount0Min: params.amount0Min,
                    amount1Min: params.amount1Min,
                    deadline: params.deadline
                })
            );
            liquidity = addedLiquidity;
        }

        require(uint256(liquidity) >= params.minLiquidity, "LOW_LIQUIDITY");
    }

    function _withdrawFromPosition(uint256 shortfall) private {
        uint128 currentLiquidity = _positionLiquidity();
        if (currentLiquidity == 0) return;

        uint256 positionValue = valueOracle.positionValueInAsset(tokenId);
        require(positionValue > 0, "NO_POSITION_VALUE");

        uint128 liquidityToBurn = uint128(_ceilDiv(uint256(currentLiquidity) * shortfall, positionValue));
        if (liquidityToBurn > currentLiquidity) liquidityToBurn = currentLiquidity;

        positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId, liquidity: liquidityToBurn, amount0Min: 0, amount1Min: 0, deadline: block.timestamp
            })
        );

        _collectIfPositionExists();
    }

    function _collectIfPositionExists() private returns (uint256 amount0, uint256 amount1) {
        if (tokenId == 0) return (0, 0);
        return positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId, recipient: address(this), amount0Max: type(uint128).max, amount1Max: type(uint128).max
            })
        );
    }

    function _swapAllWethToAsset(uint256 deadline) private {
        uint256 wethBalance = weth.balanceOf(address(this));
        if (wethBalance == 0) return;

        uint256 quoted = valueOracle.tokenValueInAsset(address(weth), wethBalance);
        uint256 minOut = (quoted * (BPS - withdrawalSlippageBps)) / BPS;

        weth.forceApprove(address(swapRouter), wethBalance);
        swapRouter.exactInputSingle(
            ISwapRouterV3.ExactInputSingleParams({
                tokenIn: address(weth),
                tokenOut: address(assetToken),
                fee: poolFee,
                recipient: address(this),
                deadline: deadline,
                amountIn: wethBalance,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );
    }

    function _positionLiquidity() private view returns (uint128 liquidity) {
        (,,,,,,, liquidity,,,,) = positionManager.positions(tokenId);
    }

    function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
        return a == 0 ? 0 : ((a - 1) / b) + 1;
    }
}
