// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "./interfaces/IERC20.sol";
import { INonfungiblePositionManager } from "./interfaces/INonfungiblePositionManager.sol";
import { ISwapRouter } from "./interfaces/ISwapRouter.sol";
import { Ownable } from "./Ownable.sol";
import { ReentrancyGuard } from "./ReentrancyGuard.sol";
import { SafeTransferLib } from "./SafeTransferLib.sol";

contract UniswapV3UsdcWethStrategy is Ownable, ReentrancyGuard {
    using SafeTransferLib for IERC20;

    error NotVault();
    error NotKeeperOrOwner();
    error DeadlineExpired();
    error InvalidTicks();
    error Slippage();
    error InsufficientAssets();

    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    ISwapRouter public immutable swapRouter;
    INonfungiblePositionManager public immutable positionManager;
    address public immutable vault;

    address public keeper;
    uint24 public immutable poolFee;
    int24 public immutable tickLower;
    int24 public immutable tickUpper;

    uint256 public tokenId;
    uint128 public liquidity;
    uint256 private accountedAssetsUsdc;

    event KeeperSet(address indexed keeper);
    event DepositRecorded(uint256 assets);
    event Harvest(
        address indexed caller,
        uint256 realizedUsdc,
        uint256 usdcInvested,
        uint256 wethInvested,
        uint128 liquidityAdded
    );
    event Withdrawn(address indexed receiver, uint256 assets);

    constructor(
        IERC20 usdc_,
        IERC20 weth_,
        ISwapRouter swapRouter_,
        INonfungiblePositionManager positionManager_,
        address vault_,
        address keeper_,
        address owner_,
        uint24 poolFee_,
        int24 tickLower_,
        int24 tickUpper_
    ) Ownable(owner_) {
        if (tickLower_ >= tickUpper_) revert InvalidTicks();
        usdc = usdc_;
        weth = weth_;
        swapRouter = swapRouter_;
        positionManager = positionManager_;
        vault = vault_;
        keeper = keeper_;
        poolFee = poolFee_;
        tickLower = tickLower_;
        tickUpper = tickUpper_;

        usdc.safeApprove(address(swapRouter_), type(uint256).max);
        usdc.safeApprove(address(positionManager_), type(uint256).max);
        weth.safeApprove(address(swapRouter_), type(uint256).max);
        weth.safeApprove(address(positionManager_), type(uint256).max);
        emit KeeperSet(keeper_);
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier onlyKeeperOrOwner() {
        if (msg.sender != keeper && msg.sender != owner) revert NotKeeperOrOwner();
        _;
    }

    function setKeeper(address newKeeper) external onlyOwner {
        keeper = newKeeper;
        emit KeeperSet(newKeeper);
    }

    function totalAssets() external view returns (uint256) {
        return accountedAssetsUsdc;
    }

    function recordDeposit(uint256 assets) external onlyVault {
        accountedAssetsUsdc += assets;
        emit DepositRecorded(assets);
    }

    function harvest(
        uint256 minWethFromUsdc,
        uint256 minUsdcFromWeth,
        uint256 minLiquidityUsdc,
        uint256 minLiquidityWeth,
        uint256 deadline
    ) external nonReentrant onlyKeeperOrOwner returns (uint128 liquidityAdded) {
        if (block.timestamp > deadline) revert DeadlineExpired();

        uint256 usdcBefore = usdc.balanceOf(address(this));

        if (tokenId != 0) {
            positionManager.collect(
                INonfungiblePositionManager.CollectParams({
                    tokenId: tokenId,
                    recipient: address(this),
                    amount0Max: type(uint128).max,
                    amount1Max: type(uint128).max
                })
            );
        }

        uint256 wethFees = weth.balanceOf(address(this));
        if (wethFees != 0) {
            _swap(address(weth), address(usdc), wethFees, minUsdcFromWeth, deadline);
        }

        uint256 usdcAfterFees = usdc.balanceOf(address(this));
        uint256 realizedUsdc = usdcAfterFees > usdcBefore ? usdcAfterFees - usdcBefore : 0;
        accountedAssetsUsdc += realizedUsdc;

        (uint256 usdcInvested, uint256 wethInvested, uint128 added) = _compoundUsdc(
            usdcAfterFees, minWethFromUsdc, minLiquidityUsdc, minLiquidityWeth, deadline
        );

        emit Harvest(msg.sender, realizedUsdc, usdcInvested, wethInvested, added);
        return added;
    }

    function withdraw(uint256 assets, address receiver, uint256 minUsdcFromWeth, uint256 deadline)
        external
        nonReentrant
        onlyVault
        returns (uint256 amountOut)
    {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (assets > accountedAssetsUsdc) revert InsufficientAssets();

        if (usdc.balanceOf(address(this)) < assets) {
            _freeLiquidity(assets - usdc.balanceOf(address(this)), minUsdcFromWeth, deadline);
        }

        uint256 usdcBalance = usdc.balanceOf(address(this));
        if (usdcBalance < assets) revert InsufficientAssets();

        accountedAssetsUsdc -= assets;
        usdc.safeTransfer(receiver, assets);
        emit Withdrawn(receiver, assets);
        return assets;
    }

    function _compoundUsdc(
        uint256 usdcAvailable,
        uint256 minWethFromUsdc,
        uint256 minLiquidityUsdc,
        uint256 minLiquidityWeth,
        uint256 deadline
    ) private returns (uint256 usdcInvested, uint256 wethInvested, uint128 liquidityAdded) {
        if (usdcAvailable < 2) return (0, 0, 0);

        uint256 usdcToSwap = usdcAvailable / 2;
        uint256 wethReceived =
            _swap(address(usdc), address(weth), usdcToSwap, minWethFromUsdc, deadline);

        uint256 usdcForLiquidity = usdc.balanceOf(address(this));
        uint256 wethForLiquidity = weth.balanceOf(address(this));
        if (usdcForLiquidity < minLiquidityUsdc || wethForLiquidity < minLiquidityWeth) {
            revert Slippage();
        }

        if (tokenId == 0) {
            (uint256 newTokenId, uint128 added, uint256 amount0, uint256 amount1) = positionManager.mint(
                INonfungiblePositionManager.MintParams({
                    token0: address(usdc),
                    token1: address(weth),
                    fee: poolFee,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    amount0Desired: usdcForLiquidity,
                    amount1Desired: wethForLiquidity,
                    amount0Min: minLiquidityUsdc,
                    amount1Min: minLiquidityWeth,
                    recipient: address(this),
                    deadline: deadline
                })
            );
            tokenId = newTokenId;
            liquidity = added;
            return (amount0, amount1, added);
        }

        (uint128 addedLiquidity, uint256 amount0Used, uint256 amount1Used) = positionManager.increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: usdcForLiquidity,
                amount1Desired: wethForLiquidity,
                amount0Min: minLiquidityUsdc,
                amount1Min: minLiquidityWeth,
                deadline: deadline
            })
        );
        liquidity += addedLiquidity;
        wethReceived;
        return (amount0Used, amount1Used, addedLiquidity);
    }

    function _freeLiquidity(uint256 shortfall, uint256 minUsdcFromWeth, uint256 deadline) private {
        if (liquidity == 0) revert InsufficientAssets();

        uint128 liquidityToRemove = uint128(
            (uint256(liquidity) * shortfall + accountedAssetsUsdc - 1) / accountedAssetsUsdc
        );
        if (liquidityToRemove > liquidity) liquidityToRemove = liquidity;

        liquidity -= liquidityToRemove;
        positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidityToRemove,
                amount0Min: 0,
                amount1Min: 0,
                deadline: deadline
            })
        );
        positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        uint256 wethBalance = weth.balanceOf(address(this));
        if (wethBalance != 0) {
            _swap(address(weth), address(usdc), wethBalance, minUsdcFromWeth, deadline);
        }
    }

    function _swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint256 deadline
    ) private returns (uint256 amountOut) {
        return swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: poolFee,
                recipient: address(this),
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            })
        );
    }
}
