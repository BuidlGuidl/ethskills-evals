// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeERC20} from "./lib/SafeERC20.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IAerodromeGauge} from "./interfaces/IAerodromeGauge.sol";
import {IAerodromePool} from "./interfaces/IAerodromePool.sol";
import {IAerodromeRouter} from "./interfaces/IAerodromeRouter.sol";
import {IStrategy} from "./interfaces/IStrategy.sol";

contract BaseAerodromeStrategy is IStrategy {
    using SafeERC20 for IERC20;

    error NotVault();
    error NotOwner();
    error ZeroAddress();
    error Slippage();
    error Reentrancy();

    event OwnerUpdated(address indexed owner);
    event EmergencyWithdraw(address indexed to, uint256 lpAmount, uint256 assetAmount);

    address public owner;
    address public immutable vault;
    IERC20 public immutable assetToken;
    IERC20 public immutable weth;
    IERC20 public immutable reward;
    IAerodromeRouter public immutable router;
    IAerodromePool public immutable pool;
    IAerodromeGauge public immutable gauge;
    address public immutable factory;
    bool public immutable poolStable;
    bool public immutable rewardRouteStable;
    uint256 private locked = 1;

    constructor(
        address vault_,
        IERC20 asset_,
        IERC20 weth_,
        IERC20 reward_,
        IAerodromeRouter router_,
        IAerodromePool pool_,
        IAerodromeGauge gauge_,
        address factory_,
        bool poolStable_,
        bool rewardRouteStable_,
        address owner_
    ) {
        if (
            vault_ == address(0) || address(asset_) == address(0) || address(weth_) == address(0)
                || address(reward_) == address(0) || address(router_) == address(0) || address(pool_) == address(0)
                || address(gauge_) == address(0) || factory_ == address(0) || owner_ == address(0)
        ) revert ZeroAddress();

        vault = vault_;
        assetToken = asset_;
        weth = weth_;
        reward = reward_;
        router = router_;
        pool = pool_;
        gauge = gauge_;
        factory = factory_;
        poolStable = poolStable_;
        rewardRouteStable = rewardRouteStable_;
        owner = owner_;
        emit OwnerUpdated(owner_);
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert Reentrancy();
        locked = 2;
        _;
        locked = 1;
    }

    function asset() external view returns (address) {
        return address(assetToken);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
        emit OwnerUpdated(newOwner);
    }

    function totalAssets() public view returns (uint256) {
        uint256 assets_ = assetToken.balanceOf(address(this));
        assets_ += _valueLpInAssets(_totalLp());
        uint256 wethBalance = weth.balanceOf(address(this));
        if (wethBalance != 0) assets_ += _quote(address(weth), address(assetToken), poolStable, wethBalance);
        return assets_;
    }

    function deposit(uint256 assets_) external onlyVault nonReentrant {
        _compound(assets_, 0, 0);
    }

    function withdraw(uint256 assets_) external onlyVault nonReentrant returns (uint256 withdrawn) {
        uint256 available = assetToken.balanceOf(address(this));
        if (available < assets_) {
            _freeAssets(assets_ - available);
        }

        withdrawn = assetToken.balanceOf(address(this));
        if (withdrawn > assets_) withdrawn = assets_;
        if (withdrawn != 0) assetToken.safeTransfer(vault, withdrawn);
    }

    function harvest(uint256 minRewardAssets, uint256 minPairedWeth, uint256 minLiquidity)
        external
        onlyVault
        nonReentrant
        returns (uint256 compoundedAssets)
    {
        gauge.getReward(address(this));

        uint256 rewardBalance = reward.balanceOf(address(this));
        if (rewardBalance != 0 && address(reward) != address(assetToken)) {
            reward.forceApprove(address(router), rewardBalance);
            IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
            routes[0] = IAerodromeRouter.Route({
                from: address(reward),
                to: address(assetToken),
                stable: rewardRouteStable,
                factory: factory
            });
            router.swapExactTokensForTokens(rewardBalance, minRewardAssets, routes, address(this), block.timestamp);
        }

        compoundedAssets = assetToken.balanceOf(address(this));
        if (compoundedAssets != 0) {
            _compound(compoundedAssets, minPairedWeth, minLiquidity);
        }
    }

    function emergencyWithdraw(address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 staked = gauge.balanceOf(address(this));
        if (staked != 0) gauge.withdraw(staked);

        uint256 lpBalance = pool.balanceOf(address(this));
        uint256 assetBalance = assetToken.balanceOf(address(this));
        if (lpBalance != 0) IERC20(address(pool)).safeTransfer(to, lpBalance);
        if (assetBalance != 0) assetToken.safeTransfer(to, assetBalance);

        emit EmergencyWithdraw(to, lpBalance, assetBalance);
    }

    function _compound(uint256 assets_, uint256 minPairedWeth, uint256 minLiquidity) internal {
        if (assets_ == 0) return;

        uint256 half = assets_ / 2;
        uint256 otherHalf = assets_ - half;
        uint256 wethBefore = weth.balanceOf(address(this));

        if (half != 0) {
            assetToken.forceApprove(address(router), half);
            IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
            routes[0] =
                IAerodromeRouter.Route({from: address(assetToken), to: address(weth), stable: poolStable, factory: factory});
            router.swapExactTokensForTokens(half, minPairedWeth, routes, address(this), block.timestamp);
        }

        uint256 pairedWeth = weth.balanceOf(address(this)) - wethBefore;
        uint256 assetBalance = assetToken.balanceOf(address(this));
        uint256 assetToAdd = assetBalance < otherHalf ? assetBalance : otherHalf;

        if (assetToAdd == 0 || pairedWeth == 0) return;

        assetToken.forceApprove(address(router), assetToAdd);
        weth.forceApprove(address(router), pairedWeth);
        (, , uint256 liquidity) = router.addLiquidity(
            address(assetToken),
            address(weth),
            poolStable,
            assetToAdd,
            pairedWeth,
            0,
            0,
            address(this),
            block.timestamp
        );
        if (liquidity < minLiquidity) revert Slippage();
        IERC20(address(pool)).forceApprove(address(gauge), liquidity);
        gauge.deposit(liquidity);
    }

    function _freeAssets(uint256 missingAssets) internal {
        uint256 lpTotal = _totalLp();
        if (lpTotal == 0) return;

        uint256 totalBefore = totalAssets();
        uint256 lpNeeded = (lpTotal * missingAssets) / totalBefore + 1;
        if (lpNeeded > lpTotal) lpNeeded = lpTotal;

        uint256 staked = gauge.balanceOf(address(this));
        if (staked != 0) {
            uint256 toUnstake = lpNeeded < staked ? lpNeeded : staked;
            gauge.withdraw(toUnstake);
        }

        IERC20(address(pool)).forceApprove(address(router), lpNeeded);
        router.removeLiquidity(
            address(assetToken),
            address(weth),
            poolStable,
            lpNeeded,
            0,
            0,
            address(this),
            block.timestamp
        );

        uint256 wethBalance = weth.balanceOf(address(this));
        if (wethBalance != 0) {
            weth.forceApprove(address(router), wethBalance);
            IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
            routes[0] =
                IAerodromeRouter.Route({from: address(weth), to: address(assetToken), stable: poolStable, factory: factory});
            router.swapExactTokensForTokens(wethBalance, 0, routes, address(this), block.timestamp);
        }
    }

    function _totalLp() internal view returns (uint256) {
        return pool.balanceOf(address(this)) + gauge.balanceOf(address(this));
    }

    function _valueLpInAssets(uint256 lpAmount) internal view returns (uint256) {
        uint256 supply = pool.totalSupply();
        if (lpAmount == 0 || supply == 0) return 0;

        (uint112 reserve0, uint112 reserve1,) = pool.getReserves();
        address token0 = pool.token0();

        uint256 assetReserve = token0 == address(assetToken) ? uint256(reserve0) : uint256(reserve1);
        uint256 wethReserve = token0 == address(weth) ? uint256(reserve0) : uint256(reserve1);
        uint256 assetShare = (assetReserve * lpAmount) / supply;
        uint256 wethShare = (wethReserve * lpAmount) / supply;
        return assetShare + _quote(address(weth), address(assetToken), poolStable, wethShare);
    }

    function _quote(address from, address to, bool stable, uint256 amountIn) internal view returns (uint256) {
        if (amountIn == 0) return 0;
        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({from: from, to: to, stable: stable, factory: factory});
        uint256[] memory amounts = router.getAmountsOut(amountIn, routes);
        return amounts[amounts.length - 1];
    }
}
