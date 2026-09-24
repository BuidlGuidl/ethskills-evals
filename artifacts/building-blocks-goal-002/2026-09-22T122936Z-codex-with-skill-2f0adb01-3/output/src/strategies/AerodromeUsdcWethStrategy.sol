// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "../interfaces/IERC20.sol";
import {IAerodromeGauge, IAerodromePool, IAerodromeRouter} from "../interfaces/IAerodrome.sol";
import {SafeTransferLib} from "../lib/SafeTransferLib.sol";

contract AerodromeUsdcWethStrategy {
    using SafeTransferLib for IERC20;

    error NotOwner();
    error NotVault();
    error NotKeeper();
    error ZeroAddress();
    error InvalidPool();
    error Slippage();

    event KeeperSet(address indexed keeper);
    event Deposited(uint256 usdcAmount, uint256 liquidity);
    event Withdrawn(uint256 requestedAssets, uint256 returnedAssets);
    event Harvest(address indexed caller, uint256 rewardClaimed, uint256 usdcCompounded, uint256 liquidity);

    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    IERC20 public immutable reward;
    IAerodromeRouter public immutable router;
    IAerodromeGauge public immutable gauge;
    IAerodromePool public immutable pool;
    address public immutable factory;
    address public immutable vault;
    bool public immutable stable;

    address public owner;
    address public keeper;

    constructor(
        address vault_,
        IERC20 usdc_,
        IERC20 weth_,
        IERC20 reward_,
        IAerodromeRouter router_,
        IAerodromeGauge gauge_,
        IAerodromePool pool_,
        address factory_,
        address owner_,
        address keeper_
    ) {
        if (
            vault_ == address(0) || address(usdc_) == address(0) || address(weth_) == address(0)
                || address(reward_) == address(0) || address(router_) == address(0)
                || address(gauge_) == address(0) || address(pool_) == address(0)
                || factory_ == address(0) || owner_ == address(0) || keeper_ == address(0)
        ) revert ZeroAddress();
        if (!_poolContains(pool_, address(usdc_), address(weth_))) revert InvalidPool();

        vault = vault_;
        usdc = usdc_;
        weth = weth_;
        reward = reward_;
        router = router_;
        gauge = gauge_;
        pool = pool_;
        factory = factory_;
        owner = owner_;
        keeper = keeper_;
        stable = false;

        usdc.safeApprove(address(router_), type(uint256).max);
        weth.safeApprove(address(router_), type(uint256).max);
        reward.safeApprove(address(router_), type(uint256).max);
        IERC20(address(pool_)).safeApprove(address(router_), type(uint256).max);
        IERC20(address(pool_)).safeApprove(address(gauge_), type(uint256).max);

        emit KeeperSet(keeper_);
    }

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

    function setKeeper(address keeper_) external onlyOwner {
        if (keeper_ == address(0)) revert ZeroAddress();
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    function deposit(uint256 amount) external onlyVault returns (uint256 liquidity) {
        liquidity = _compoundUsdc(amount, 0, 0);
        emit Deposited(amount, liquidity);
    }

    function withdraw(uint256 assets, address receiver) external onlyVault returns (uint256 returnedAssets) {
        uint256 currentUsdc = usdc.balanceOf(address(this));
        if (currentUsdc < assets) {
            _freeLiquidity(assets - currentUsdc);
            _swapAllWethToUsdc(0);
        }

        returnedAssets = _min(assets, usdc.balanceOf(address(this)));
        usdc.safeTransfer(receiver, returnedAssets);
        emit Withdrawn(assets, returnedAssets);
    }

    function harvest() external returns (uint256 liquidity) {
        liquidity = harvest(0, 0);
    }

    function harvest(uint256 minUsdcFromReward, uint256 minWethFromUsdc)
        public
        onlyKeeperOrOwner
        returns (uint256 liquidity)
    {
        uint256 rewardBefore = reward.balanceOf(address(this));
        gauge.getReward(address(this));
        uint256 rewardClaimed = reward.balanceOf(address(this)) - rewardBefore;

        uint256 usdcBefore = usdc.balanceOf(address(this));
        _swapRewardsToUsdc(minUsdcFromReward);
        uint256 usdcCompounded = usdc.balanceOf(address(this)) - usdcBefore;

        liquidity = _compoundUsdc(usdc.balanceOf(address(this)), minWethFromUsdc, 0);
        emit Harvest(msg.sender, rewardClaimed, usdcCompounded, liquidity);
    }

    function totalAssets() public view returns (uint256) {
        uint256 assets = usdc.balanceOf(address(this));
        assets += _wethToUsdc(weth.balanceOf(address(this)));
        assets += _lpValueUsdc(_lpBalance());
        return assets;
    }

    function lpBalance() external view returns (uint256) {
        return _lpBalance();
    }

    function _compoundUsdc(uint256 amount, uint256 minWethOut, uint256 minLiquidity)
        internal
        returns (uint256 liquidity)
    {
        if (amount < 2) return 0;

        uint256 swapAmount = amount / 2;
        uint256 usdcForLiquidity = amount - swapAmount;

        uint256 wethBefore = weth.balanceOf(address(this));
        _swapUsdcToWeth(swapAmount, minWethOut);
        uint256 wethForLiquidity = weth.balanceOf(address(this)) - wethBefore;
        if (wethForLiquidity == 0) revert Slippage();

        (uint256 usedUsdc, uint256 usedWeth, uint256 mintedLiquidity) = router.addLiquidity(
            address(usdc),
            address(weth),
            stable,
            usdcForLiquidity,
            wethForLiquidity,
            0,
            0,
            address(this),
            block.timestamp
        );
        if (mintedLiquidity < minLiquidity) revert Slippage();

        liquidity = mintedLiquidity;
        uint256 unusedUsdc = usdcForLiquidity - usedUsdc;
        uint256 unusedWeth = wethForLiquidity - usedWeth;
        if (unusedUsdc != 0 || unusedWeth != 0) {
            // Leave dust idle and included in totalAssets rather than forcing a bad route.
        }

        IERC20(address(pool)).safeApprove(address(gauge), mintedLiquidity);
        gauge.deposit(mintedLiquidity);
    }

    function _freeLiquidity(uint256 neededUsdc) internal {
        uint256 lp = _lpBalance();
        if (lp == 0) return;

        uint256 lpValue = _lpValueUsdc(lp);
        if (lpValue == 0) return;

        uint256 liquidityToRemove = _min(lp, _ceilDiv(neededUsdc * lp, lpValue));
        gauge.withdraw(liquidityToRemove);
        router.removeLiquidity(
            address(usdc),
            address(weth),
            stable,
            liquidityToRemove,
            0,
            0,
            address(this),
            block.timestamp
        );
    }

    function _swapRewardsToUsdc(uint256 minUsdcOut) internal {
        uint256 amount = reward.balanceOf(address(this));
        if (amount == 0) return;
        if (address(reward) == address(usdc)) return;
        if (address(reward) == address(weth)) {
            _swapAllWethToUsdc(minUsdcOut);
            return;
        }

        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](2);
        routes[0] = IAerodromeRouter.Route(address(reward), address(weth), false, factory);
        routes[1] = IAerodromeRouter.Route(address(weth), address(usdc), false, factory);
        router.swapExactTokensForTokens(amount, minUsdcOut, routes, address(this), block.timestamp);
    }

    function _swapUsdcToWeth(uint256 amount, uint256 minWethOut) internal {
        if (amount == 0) return;
        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route(address(usdc), address(weth), false, factory);
        router.swapExactTokensForTokens(amount, minWethOut, routes, address(this), block.timestamp);
    }

    function _swapAllWethToUsdc(uint256 minUsdcOut) internal {
        uint256 amount = weth.balanceOf(address(this));
        if (amount == 0) return;
        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route(address(weth), address(usdc), false, factory);
        router.swapExactTokensForTokens(amount, minUsdcOut, routes, address(this), block.timestamp);
    }

    function _lpBalance() internal view returns (uint256) {
        return gauge.balanceOf(address(this)) + pool.balanceOf(address(this));
    }

    function _lpValueUsdc(uint256 lpAmount) internal view returns (uint256) {
        uint256 supply = pool.totalSupply();
        if (lpAmount == 0 || supply == 0) return 0;

        (uint256 reserve0, uint256 reserve1,) = pool.getReserves();
        (uint256 usdcReserve, uint256 wethReserve) = pool.token0() == address(usdc)
            ? (reserve0, reserve1)
            : (reserve1, reserve0);

        uint256 usdcShare = usdcReserve * lpAmount / supply;
        uint256 wethShare = wethReserve * lpAmount / supply;
        return usdcShare + _wethToUsdc(wethShare);
    }

    function _wethToUsdc(uint256 amount) internal view returns (uint256) {
        if (amount == 0) return 0;
        return pool.getAmountOut(amount, address(weth));
    }

    function _poolContains(IAerodromePool pool_, address tokenA, address tokenB)
        internal
        view
        returns (bool)
    {
        address token0 = pool_.token0();
        address token1 = pool_.token1();
        return (token0 == tokenA && token1 == tokenB) || (token0 == tokenB && token1 == tokenA);
    }

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
