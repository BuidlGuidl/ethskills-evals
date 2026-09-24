// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {IAerodromeGauge, IAerodromePair, IAerodromeRouter} from "./interfaces/IAerodrome.sol";

contract AerodromeUsdcWethStrategy {
    uint256 public constant BPS = 10_000;

    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    IERC20 public immutable reward;
    IAerodromeRouter public immutable router;
    IAerodromeGauge public immutable gauge;
    IAerodromePair public immutable pair;
    address public immutable vault;
    address public owner;
    address public keeper;

    bool public immutable poolStable;
    bool public immutable rewardRouteStable;
    uint256 public maxSlippageBps = 75;
    uint256 public minDeployUsdc = 10e6;
    bool public paused;

    event Harvest(uint256 rewardIn, uint256 usdcCompounded, uint256 liquidity);
    event KeeperSet(address indexed keeper);
    event MinDeploySet(uint256 minDeployUsdc);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PausedSet(bool paused);
    event SlippageSet(uint256 maxSlippageBps);

    error InvalidAddress();
    error InvalidSlippage();
    error NotVault();
    error Paused();
    error Unauthorized();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier onlyKeeperOrOwner() {
        if (msg.sender != keeper && msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(
        address vault_,
        IERC20 usdc_,
        IERC20 weth_,
        IERC20 reward_,
        IAerodromeRouter router_,
        IAerodromeGauge gauge_,
        IAerodromePair pair_,
        bool poolStable_,
        bool rewardRouteStable_,
        address owner_,
        address keeper_
    ) {
        if (
            vault_ == address(0) || address(usdc_) == address(0) || address(weth_) == address(0)
                || address(reward_) == address(0) || address(router_) == address(0) || address(gauge_) == address(0)
                || address(pair_) == address(0) || owner_ == address(0)
        ) revert InvalidAddress();

        vault = vault_;
        usdc = usdc_;
        weth = weth_;
        reward = reward_;
        router = router_;
        gauge = gauge_;
        pair = pair_;
        poolStable = poolStable_;
        rewardRouteStable = rewardRouteStable_;
        owner = owner_;
        keeper = keeper_;

        emit OwnershipTransferred(address(0), owner_);
        emit KeeperSet(keeper_);
    }

    function invest(uint256 assets) external onlyVault {
        if (paused) revert Paused();
        _safeTransferFrom(usdc, msg.sender, address(this), assets);
        _deployIdle();
    }

    function withdrawToVault(uint256 assets) external onlyVault returns (uint256 withdrawn) {
        uint256 idle = usdc.balanceOf(address(this));
        if (idle < assets) {
            _withdrawLiquidityFor(assets - idle);
        }

        withdrawn = usdc.balanceOf(address(this));
        if (withdrawn > assets) withdrawn = assets;
        if (withdrawn > 0) _safeTransfer(usdc, vault, withdrawn);
    }

    function harvest()
        external
        onlyKeeperOrOwner
        returns (uint256 rewardIn, uint256 usdcCompounded, uint256 liquidity)
    {
        gauge.getReward(address(this));

        rewardIn = reward.balanceOf(address(this));
        if (rewardIn > 0 && address(reward) != address(usdc)) {
            _swap(address(reward), address(usdc), rewardIn, rewardRouteStable);
        }

        usdcCompounded = usdc.balanceOf(address(this));
        liquidity = _deployIdle();
        emit Harvest(rewardIn, usdcCompounded, liquidity);
    }

    function setKeeper(address keeper_) external onlyOwner {
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedSet(paused_);
    }

    function setMaxSlippageBps(uint256 maxSlippageBps_) external onlyOwner {
        if (maxSlippageBps_ > 1_000) revert InvalidSlippage();
        maxSlippageBps = maxSlippageBps_;
        emit SlippageSet(maxSlippageBps_);
    }

    function setMinDeployUsdc(uint256 minDeployUsdc_) external onlyOwner {
        minDeployUsdc = minDeployUsdc_;
        emit MinDeploySet(minDeployUsdc_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function totalAssets() external view returns (uint256) {
        (uint256 reserveUsdc, uint256 reserveWeth) = _reserves();
        uint256 assets = usdc.balanceOf(address(this));

        uint256 wethBalance = weth.balanceOf(address(this));
        if (wethBalance > 0 && reserveWeth > 0) {
            assets += (wethBalance * reserveUsdc) / reserveWeth;
        }

        uint256 lp = pair.balanceOf(address(this)) + gauge.balanceOf(address(this));
        uint256 pairSupply = pair.totalSupply();
        if (lp > 0 && pairSupply > 0) {
            assets += (lp * reserveUsdc * 2) / pairSupply;
        }

        return assets;
    }

    function _deployIdle() internal returns (uint256 liquidity) {
        uint256 idle = usdc.balanceOf(address(this));
        if (idle < minDeployUsdc) return 0;

        uint256 swapAmount = idle / 2;
        _swap(address(usdc), address(weth), swapAmount, poolStable);

        uint256 usdcAmount = usdc.balanceOf(address(this));
        uint256 wethAmount = weth.balanceOf(address(this));
        if (usdcAmount == 0 || wethAmount == 0) return 0;

        _approveIfNeeded(usdc, address(router), usdcAmount);
        _approveIfNeeded(weth, address(router), wethAmount);

        (,, liquidity) = router.addLiquidity(
            address(usdc),
            address(weth),
            poolStable,
            usdcAmount,
            wethAmount,
            _withSlippage(usdcAmount),
            _withSlippage(wethAmount),
            address(this),
            block.timestamp
        );

        if (liquidity > 0) {
            _approveIfNeeded(IERC20(address(pair)), address(gauge), liquidity);
            gauge.deposit(liquidity);
        }
    }

    function _withdrawLiquidityFor(uint256 usdcShortfall) internal {
        uint256 staked = gauge.balanceOf(address(this));
        if (staked == 0) return;

        uint256 lpToWithdraw = _lpForUsdc(usdcShortfall);
        if (lpToWithdraw > staked) lpToWithdraw = staked;
        if (lpToWithdraw == 0) return;

        gauge.withdraw(lpToWithdraw);
        _approveIfNeeded(IERC20(address(pair)), address(router), lpToWithdraw);
        router.removeLiquidity(
            address(usdc), address(weth), poolStable, lpToWithdraw, 0, 0, address(this), block.timestamp
        );

        uint256 wethBalance = weth.balanceOf(address(this));
        if (wethBalance > 0) {
            _swap(address(weth), address(usdc), wethBalance, poolStable);
        }
    }

    function _lpForUsdc(uint256 assets) internal view returns (uint256) {
        (uint256 reserveUsdc,) = _reserves();
        uint256 pairSupply = pair.totalSupply();
        if (reserveUsdc == 0 || pairSupply == 0) return 0;
        uint256 lpValueInUsdc = reserveUsdc * 2;
        return (assets * pairSupply + lpValueInUsdc - 1) / lpValueInUsdc;
    }

    function _swap(address from, address to, uint256 amountIn, bool stable) internal returns (uint256 amountOut) {
        if (amountIn == 0 || from == to) return amountIn;

        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({from: from, to: to, stable: stable});
        uint256[] memory quoted = router.getAmountsOut(amountIn, routes);
        uint256 minOut = _withSlippage(quoted[quoted.length - 1]);

        _approveIfNeeded(IERC20(from), address(router), amountIn);
        uint256[] memory amounts =
            router.swapExactTokensForTokens(amountIn, minOut, routes, address(this), block.timestamp);
        amountOut = amounts[amounts.length - 1];
    }

    function _reserves() internal view returns (uint256 reserveUsdc, uint256 reserveWeth) {
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        if (pair.token0() == address(usdc)) {
            return (uint256(reserve0), uint256(reserve1));
        }
        return (uint256(reserve1), uint256(reserve0));
    }

    function _withSlippage(uint256 amount) internal view returns (uint256) {
        return (amount * (BPS - maxSlippageBps)) / BPS;
    }

    function _approveIfNeeded(IERC20 token, address spender, uint256 amount) internal {
        if (token.allowance(address(this), spender) >= amount) return;
        _safeApprove(token, spender, 0);
        _safeApprove(token, spender, type(uint256).max);
    }

    function _safeTransfer(IERC20 token, address to, uint256 value) internal {
        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, value)));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FROM_FAILED");
    }

    function _safeApprove(IERC20 token, address spender, uint256 value) internal {
        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.approve, (spender, value)));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "APPROVE_FAILED");
    }
}

