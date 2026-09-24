// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAeroPool, IAeroPoolFactory, IAeroRouter, IAeroVoter, IAeroGauge} from "./interfaces/IAerodrome.sol";

/// @title AerodromeUsdcWethStrategy
/// @notice Zaps vault USDC into the Aerodrome volatile USDC/WETH pool, stakes the LP in the
///         pool's gauge and compounds AERO emissions back into the position.
/// @dev Staked LP earns AERO only; swap fees of staked LP go to veAERO voters (Aerodrome design).
///      Only the vault can move funds. Valuation uses pool TWAP + fair-reserve LP pricing so
///      spot-price manipulation cannot inflate or deflate share price.
contract AerodromeUsdcWethStrategy is Ownable2Step {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;
    /// @dev 2 observations x 30 min ≈ 1h TWAP window.
    uint256 private constant TWAP_GRANULARITY = 2;
    uint256 private constant PRICE_PROBE = 1e16; // 0.01 WETH, negligible price impact
    uint256 private constant MIN_INVEST = 1e6; // 1 USDC
    uint256 private constant MAX_BPS_SETTING = 500; // 5%

    address public immutable vault;
    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    IERC20 public immutable aero;
    IAeroRouter public immutable router;
    address public immutable factory;
    IAeroPool public immutable pool; // USDC/WETH volatile
    IAeroPool public immutable rewardPool; // AERO/USDC volatile, used to sell rewards
    IAeroGauge public immutable gauge;
    bool private immutable wethIsToken0;

    /// @notice Max shortfall vs TWAP quote accepted on keeper-driven swaps / liquidity adds.
    uint256 public maxSlippageBps = 100;
    /// @notice Max spot-vs-TWAP WETH price gap allowed for deposits and harvests.
    uint256 public maxDeviationBps = 100;
    /// @notice Minimum AERO balance before rewards are sold (avoids dust swaps).
    uint256 public minAeroToSell = 1e18;
    /// @notice Set by `panic()`: LP unstaked, no new investing. Withdrawals keep working.
    bool public emergency;

    event Harvested(uint256 aeroSold, uint256 usdcFromRewards, uint256 lpStaked);
    event Withdrawn(address indexed to, uint256 fraction, uint256 usdcOut);
    event Panic(uint256 lpUnstaked);
    event ParamsSet(uint256 maxSlippageBps, uint256 maxDeviationBps, uint256 minAeroToSell);

    error OnlyVault();
    error PriceDeviation(uint256 spot, uint256 twap);
    error Emergency();
    error BadParam();
    error BadConfig();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor(
        address vault_,
        address owner_,
        IAeroRouter router_,
        IAeroVoter voter_,
        IERC20 usdc_,
        IERC20 weth_,
        IERC20 aero_
    ) Ownable(owner_) {
        vault = vault_;
        usdc = usdc_;
        weth = weth_;
        aero = aero_;
        router = router_;
        factory = router_.defaultFactory();

        // Derive pools/gauge from the canonical factory + voter instead of trusting inputs.
        pool = IAeroPool(IAeroPoolFactory(factory).getPool(address(usdc_), address(weth_), false));
        rewardPool = IAeroPool(IAeroPoolFactory(factory).getPool(address(aero_), address(usdc_), false));
        gauge = IAeroGauge(voter_.gauges(address(pool)));
        if (
            address(pool) == address(0) || address(rewardPool) == address(0) || address(gauge) == address(0)
                || !voter_.isAlive(address(gauge)) || gauge.stakingToken() != address(pool)
                || gauge.rewardToken() != address(aero_)
        ) revert BadConfig();
        wethIsToken0 = pool.token0() == address(weth_);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Total strategy value in USDC (6 decimals), manipulation-resistant.
    function totalValue() public view returns (uint256) {
        uint256 price = twapPrice();
        uint256 lp = IERC20(address(pool)).balanceOf(address(this)) + gauge.balanceOf(address(this));
        return usdc.balanceOf(address(this)) + weth.balanceOf(address(this)) * price / 1e18 + _lpValue(lp, price);
    }

    /// @notice TWAP price: USDC (6 dec) per 1 WETH, pool fee removed.
    function twapPrice() public view returns (uint256) {
        uint256 out = pool.quote(address(weth), PRICE_PROBE, TWAP_GRANULARITY);
        return out * (1e18 / PRICE_PROBE) * BPS / (BPS - _poolFee());
    }

    /// @notice Spot price: USDC (6 dec) per 1 WETH from current reserves.
    function spotPrice() public view returns (uint256) {
        (uint256 wethRes, uint256 usdcRes) = _reserves();
        return usdcRes * 1e18 / wethRes;
    }

    /// @notice Reverts if spot price diverges from TWAP beyond `maxDeviationBps`.
    function checkPrice() public view {
        uint256 spot = spotPrice();
        uint256 twap = twapPrice();
        uint256 diff = spot > twap ? spot - twap : twap - spot;
        if (diff * BPS > twap * maxDeviationBps) revert PriceDeviation(spot, twap);
    }

    function pendingRewards() external view returns (uint256) {
        return gauge.earned(address(this));
    }

    // ---------------------------------------------------------------------
    // Vault hooks
    // ---------------------------------------------------------------------

    /// @notice Zap `amount` idle USDC (just sent by the vault on deposit) into staked LP.
    function invest(uint256 amount) external onlyVault returns (uint256 lp) {
        if (emergency) revert Emergency();
        checkPrice();
        lp = _invest(amount);
    }

    /// @notice Claim AERO, sell it for USDC, zap the proceeds into staked LP.
    function harvest() external onlyVault {
        if (emergency) revert Emergency();
        checkPrice();

        gauge.getReward(address(this));
        uint256 aeroBal = aero.balanceOf(address(this));
        if (aeroBal < minAeroToSell) return;

        uint256 usdcFromRewards = _swap(aero, usdc, aeroBal, rewardPool);
        uint256 lp = _invest(usdcFromRewards);
        emit Harvested(aeroBal, usdcFromRewards, lp);
    }

    /// @notice Send `fraction` (1e18 = 100%) of every holding to `to`, converted to USDC.
    /// @dev Pro-rata exit needs no price oracle; the vault enforces the user's min-out.
    function withdraw(uint256 fraction, address to) external onlyVault returns (uint256 usdcOut) {
        uint256 usdcPart = usdc.balanceOf(address(this)) * fraction / 1e18;
        uint256 wethPart = weth.balanceOf(address(this)) * fraction / 1e18;

        uint256 lpIdle = IERC20(address(pool)).balanceOf(address(this));
        uint256 lpPart = (lpIdle + gauge.balanceOf(address(this))) * fraction / 1e18;
        if (lpPart > lpIdle) gauge.withdraw(lpPart - lpIdle);

        if (lpPart > 0) {
            IERC20(address(pool)).forceApprove(address(router), lpPart);
            (uint256 u, uint256 w) = router.removeLiquidity(
                address(usdc), address(weth), false, lpPart, 0, 0, address(this), block.timestamp
            );
            usdcPart += u;
            wethPart += w;
        }
        if (wethPart > 0) usdcPart += _swapUnchecked(weth, usdc, wethPart);

        usdcOut = usdcPart;
        usdc.safeTransfer(to, usdcOut);
        emit Withdrawn(to, fraction, usdcOut);
    }

    // ---------------------------------------------------------------------
    // Owner
    // ---------------------------------------------------------------------

    /// @notice Unstake everything and stop investing. Funds stay withdrawable pro-rata.
    function panic() external onlyOwner {
        emergency = true;
        uint256 staked = gauge.balanceOf(address(this));
        if (staked > 0) gauge.withdraw(staked);
        emit Panic(staked);
    }

    function setParams(uint256 maxSlippageBps_, uint256 maxDeviationBps_, uint256 minAeroToSell_) external onlyOwner {
        if (maxSlippageBps_ > MAX_BPS_SETTING || maxDeviationBps_ > MAX_BPS_SETTING) revert BadParam();
        maxSlippageBps = maxSlippageBps_;
        maxDeviationBps = maxDeviationBps_;
        minAeroToSell = minAeroToSell_;
        emit ParamsSet(maxSlippageBps_, maxDeviationBps_, minAeroToSell_);
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    /// @dev Only touches `amount` (not the whole balance) so donated USDC cannot grief deposits.
    ///      Leftover dust from addLiquidity stays idle and is still counted in `totalValue()`.
    function _invest(uint256 amount) internal returns (uint256 lp) {
        if (amount < MIN_INVEST) return 0;

        (, uint256 usdcRes) = _reserves();
        uint256 usdcToSwap = _optimalSwapIn(usdcRes, amount);
        uint256 usdcIn = amount - usdcToSwap;
        uint256 wethIn = _swap(usdc, weth, usdcToSwap, pool);

        usdc.forceApprove(address(router), usdcIn);
        weth.forceApprove(address(router), wethIn);
        uint256 minKeep = BPS - maxSlippageBps;
        (,, lp) = router.addLiquidity(
            address(usdc),
            address(weth),
            false,
            usdcIn,
            wethIn,
            usdcIn * minKeep / BPS,
            wethIn * minKeep / BPS,
            address(this),
            block.timestamp
        );
        usdc.forceApprove(address(router), 0);
        weth.forceApprove(address(router), 0);

        IERC20(address(pool)).forceApprove(address(gauge), lp);
        gauge.deposit(lp);
    }

    /// @dev Swap with min-out = TWAP quote (fee + impact included) minus `maxSlippageBps`.
    function _swap(IERC20 tokenIn, IERC20 tokenOut, uint256 amountIn, IAeroPool quotePool) internal returns (uint256) {
        uint256 minOut = quotePool.quote(address(tokenIn), amountIn, TWAP_GRANULARITY) * (BPS - maxSlippageBps) / BPS;
        return _swapMin(tokenIn, tokenOut, amountIn, minOut);
    }

    /// @dev Used on withdraw only; the vault checks the user's total min-out instead.
    function _swapUnchecked(IERC20 tokenIn, IERC20 tokenOut, uint256 amountIn) internal returns (uint256) {
        return _swapMin(tokenIn, tokenOut, amountIn, 0);
    }

    function _swapMin(IERC20 tokenIn, IERC20 tokenOut, uint256 amountIn, uint256 minOut) internal returns (uint256) {
        IAeroRouter.Route[] memory routes = new IAeroRouter.Route[](1);
        routes[0] = IAeroRouter.Route(address(tokenIn), address(tokenOut), false, factory);
        tokenIn.forceApprove(address(router), amountIn);
        uint256[] memory amounts =
            router.swapExactTokensForTokens(amountIn, minOut, routes, address(this), block.timestamp);
        return amounts[amounts.length - 1];
    }

    /// @dev USDC to sell so the remainder matches the pool ratio after the swap (x*y=k, fee on input).
    ///      s = (sqrt(((2F-f)r)^2 + 4F(F-f)ra) - (2F-f)r) / (2(F-f))
    function _optimalSwapIn(uint256 r, uint256 a) internal view returns (uint256) {
        uint256 f = _poolFee();
        uint256 b = (2 * BPS - f) * r;
        return (Math.sqrt(b * b + 4 * BPS * (BPS - f) * r * a) - b) / (2 * (BPS - f));
    }

    /// @dev Fair LP value: 2*sqrt(k*p) per pool, immune to reserve skew from swaps.
    function _lpValue(uint256 lp, uint256 price) internal view returns (uint256) {
        if (lp == 0) return 0;
        (uint256 wethRes, uint256 usdcRes) = _reserves();
        uint256 poolValue = 2 * Math.sqrt(Math.mulDiv(wethRes * usdcRes, price, 1e18));
        return Math.mulDiv(poolValue, lp, pool.totalSupply());
    }

    function _reserves() internal view returns (uint256 wethRes, uint256 usdcRes) {
        (uint256 r0, uint256 r1,) = pool.getReserves();
        (wethRes, usdcRes) = wethIsToken0 ? (r0, r1) : (r1, r0);
    }

    function _poolFee() internal view returns (uint256) {
        return IAeroPoolFactory(factory).getFee(address(pool), false);
    }
}
