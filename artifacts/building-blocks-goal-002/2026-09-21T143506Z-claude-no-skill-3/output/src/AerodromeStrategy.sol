// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAerodromeRouter, IAerodromePoolFactory, IAerodromePool, IAerodromeGauge} from "./interfaces/IAerodrome.sol";
import {IAggregatorV3} from "./interfaces/IChainlink.sol";
import {IStrategy} from "./interfaces/IStrategy.sol";

/// @title AerodromeStrategy
/// @notice Provides USDC/WETH liquidity to the Aerodrome volatile pool, stakes the LP in its gauge,
///         and compounds AERO emissions back into the position on harvest().
/// @dev Valuation never trusts pool spot reserves directly: LP is priced with the "fair reserves"
///      formula (2 * sqrt(k * P)) using Chainlink prices, and every swap has an oracle-derived minOut.
contract AerodromeStrategy is IStrategy, Ownable {
    using SafeERC20 for IERC20;

    struct Config {
        address vault;
        address usdc;
        address weth;
        address aero;
        address router;
        address gauge;
        address ethUsdFeed;
        address usdcUsdFeed;
        address aeroUsdFeed;
        address sequencerFeed;
        uint256 ethMaxAge;
        uint256 usdcMaxAge;
        uint256 aeroMaxAge;
    }

    uint256 private constant BPS = 10_000;
    /// Prices are USDC per whole token with 8 decimals; token amounts have 18 decimals, USDC 6.
    /// value(usdc units) = amount * price / 1e20
    uint256 private constant PRICE_SCALE = 1e20;
    uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
    uint256 public constant MAX_SLIPPAGE_BPS = 500;
    uint256 public constant MAX_UNLOCK_TIME = 7 days;

    address public immutable vault;
    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    IERC20 public immutable aero;
    IAerodromeRouter public immutable router;
    address public immutable factory;
    IAerodromePool public immutable pool;
    IAerodromeGauge public immutable gauge;
    bool private immutable wethIsToken0;

    IAggregatorV3 public immutable ethUsdFeed;
    IAggregatorV3 public immutable usdcUsdFeed;
    IAggregatorV3 public immutable aeroUsdFeed;
    IAggregatorV3 public immutable sequencerFeed;
    uint256 public immutable ethMaxAge;
    uint256 public immutable usdcMaxAge;
    uint256 public immutable aeroMaxAge;

    address public keeper;
    /// Max loss vs oracle price on any swap.
    uint256 public slippageBps = 100;
    /// Max pool-spot vs oracle deviation allowed before adding liquidity.
    uint256 public maxPriceDeviationBps = 100;
    /// Harvest profit is released linearly over this period so it can't be sniped by just-in-time deposits.
    uint256 public profitUnlockTime = 6 hours;
    /// USDC deployed per harvest; keeps each swap small vs pool depth so it fits within slippageBps.
    uint256 public maxInvestPerHarvest = 25_000e6;
    uint256 public lockedProfitAtHarvest;
    uint256 public lastHarvest;
    bool public shutdown;

    event Harvested(uint256 rewards, uint256 profit, uint256 totalAssets);
    event Invested(uint256 usdcAdded, uint256 wethAdded, uint256 lpStaked);
    event Unwound(uint256 lpRemoved, uint256 usdcBalance);
    event KeeperSet(address keeper);
    event ParamsSet(
        uint256 slippageBps, uint256 maxPriceDeviationBps, uint256 profitUnlockTime, uint256 maxInvestPerHarvest
    );
    event EmergencyExit();

    error NotVault();
    error NotKeeper();
    error InvalidConfig();
    error InvalidParam();
    error SequencerDown();
    error StaleOrBadPrice(address feed);
    error PoolPriceDeviation(uint256 spot, uint256 oracle);

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier onlyKeeper() {
        if (msg.sender != keeper && msg.sender != owner()) revert NotKeeper();
        _;
    }

    constructor(Config memory c, address owner_, address keeper_) Ownable(owner_) {
        vault = c.vault;
        usdc = IERC20(c.usdc);
        weth = IERC20(c.weth);
        aero = IERC20(c.aero);
        router = IAerodromeRouter(c.router);
        factory = router.defaultFactory();
        gauge = IAerodromeGauge(c.gauge);
        pool = IAerodromePool(gauge.stakingToken());

        // Gauge must belong to the canonical volatile USDC/WETH pool and pay AERO.
        if (IAerodromePoolFactory(factory).getPool(c.usdc, c.weth, false) != address(pool)) revert InvalidConfig();
        if (gauge.rewardToken() != c.aero) revert InvalidConfig();
        wethIsToken0 = pool.token0() == c.weth;

        ethUsdFeed = IAggregatorV3(c.ethUsdFeed);
        usdcUsdFeed = IAggregatorV3(c.usdcUsdFeed);
        aeroUsdFeed = IAggregatorV3(c.aeroUsdFeed);
        sequencerFeed = IAggregatorV3(c.sequencerFeed);
        if (ethUsdFeed.decimals() != 8 || usdcUsdFeed.decimals() != 8 || aeroUsdFeed.decimals() != 8) {
            revert InvalidConfig();
        }
        ethMaxAge = c.ethMaxAge;
        usdcMaxAge = c.usdcMaxAge;
        aeroMaxAge = c.aeroMaxAge;

        keeper = keeper_;
        lastHarvest = block.timestamp;

        // Approvals only to immutable, verified Aerodrome contracts.
        usdc.forceApprove(address(router), type(uint256).max);
        weth.forceApprove(address(router), type(uint256).max);
        aero.forceApprove(address(router), type(uint256).max);
        IERC20(address(pool)).forceApprove(address(router), type(uint256).max);
        IERC20(address(pool)).forceApprove(address(gauge), type(uint256).max);
    }

    // ---------------------------------------------------------------- views

    function totalAssets() external view returns (uint256) {
        uint256 gross = grossAssets();
        uint256 locked = lockedProfit();
        return gross > locked ? gross - locked : 0;
    }

    /// @notice Oracle-valued USDC worth of idle USDC + idle WETH + LP (staked and unstaked).
    function grossAssets() public view returns (uint256) {
        uint256 wethPrice = _wethPrice();
        uint256 lp = gauge.balanceOf(address(this)) + pool.balanceOf(address(this));
        return usdc.balanceOf(address(this)) + weth.balanceOf(address(this)) * wethPrice / PRICE_SCALE
            + _lpValue(lp, wethPrice);
    }

    function lockedProfit() public view returns (uint256) {
        uint256 end = lastHarvest + profitUnlockTime;
        if (block.timestamp >= end) return 0;
        return lockedProfitAtHarvest * (end - block.timestamp) / profitUnlockTime;
    }

    function stakedLp() external view returns (uint256) {
        return gauge.balanceOf(address(this));
    }

    // ---------------------------------------------------------------- vault

    function withdraw(uint256 amount) external onlyVault returns (uint256 sent) {
        uint256 bal = usdc.balanceOf(address(this));
        if (bal < amount) {
            _unwind(amount - bal);
            bal = usdc.balanceOf(address(this));
        }
        sent = Math.min(amount, bal);
        usdc.safeTransfer(vault, sent);
    }

    // ---------------------------------------------------------------- keeper

    /// @notice Claim AERO, sell it for USDC, and deploy all idle USDC/WETH into the staked LP position.
    function harvest() external onlyKeeper returns (uint256 profit) {
        uint256 wethPrice = _wethPrice();

        gauge.getReward(address(this));
        uint256 rewards = aero.balanceOf(address(this));
        if (rewards > 0) {
            uint256 aeroPrice = _price(aeroUsdFeed, aeroMaxAge) * 1e8 / _price(usdcUsdFeed, usdcMaxAge);
            uint256 minOut = _applySlippage(rewards * aeroPrice / PRICE_SCALE);
            if (minOut > 0) profit = _swap(address(aero), address(usdc), rewards, minOut);
        }

        lockedProfitAtHarvest = lockedProfit() + profit;
        lastHarvest = block.timestamp;

        if (!shutdown) _invest(wethPrice);

        emit Harvested(rewards, profit, this.totalAssets());
    }

    // ---------------------------------------------------------------- admin

    function setKeeper(address keeper_) external onlyOwner {
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    function setParams(
        uint256 slippageBps_,
        uint256 maxPriceDeviationBps_,
        uint256 profitUnlockTime_,
        uint256 maxInvestPerHarvest_
    ) external onlyOwner {
        if (
            slippageBps_ > MAX_SLIPPAGE_BPS || maxPriceDeviationBps_ > MAX_SLIPPAGE_BPS || profitUnlockTime_ == 0
                || profitUnlockTime_ > MAX_UNLOCK_TIME
        ) revert InvalidParam();
        // Settle the current unlock schedule before changing its length.
        lockedProfitAtHarvest = lockedProfit();
        lastHarvest = block.timestamp;
        slippageBps = slippageBps_;
        maxPriceDeviationBps = maxPriceDeviationBps_;
        profitUnlockTime = profitUnlockTime_;
        maxInvestPerHarvest = maxInvestPerHarvest_;
        emit ParamsSet(slippageBps_, maxPriceDeviationBps_, profitUnlockTime_, maxInvestPerHarvest_);
    }

    /// @notice Pull everything out of the gauge/pool into USDC and stop reinvesting.
    function emergencyExit() external onlyOwner {
        shutdown = true;
        _unwind(type(uint256).max);
        emit EmergencyExit();
    }

    // ---------------------------------------------------------------- internal

    function _invest(uint256 wethPrice) internal {
        _checkPoolPrice(wethPrice);

        // Anything above the budget stays idle USDC (still counted in totalAssets) until later harvests.
        uint256 budget = Math.min(usdc.balanceOf(address(this)), maxInvestPerHarvest);
        uint256 wethValue = weth.balanceOf(address(this)) * wethPrice / PRICE_SCALE;
        if (budget > wethValue) {
            uint256 toSwap = (budget - wethValue) / 2;
            uint256 minOut = _applySlippage(toSwap * PRICE_SCALE / wethPrice);
            if (minOut > 0) {
                _swap(address(usdc), address(weth), toSwap, minOut);
                budget -= toSwap;
            }
        }

        uint256 wethBal = weth.balanceOf(address(this));
        if (budget == 0 || wethBal == 0) return;

        // Mins are 0 because pool spot price was just checked against the oracle in this same tx.
        // Leftover dust of either token stays idle and is picked up next harvest.
        (uint256 usdcAdded, uint256 wethAdded,) = router.addLiquidity(
            address(usdc), address(weth), false, budget, wethBal, 0, 0, address(this), block.timestamp
        );
        uint256 lp = pool.balanceOf(address(this));
        if (lp > 0) gauge.deposit(lp);
        emit Invested(usdcAdded, wethAdded, lp);
    }

    /// @dev Frees roughly `usdcNeeded` of USDC by removing LP and selling the WETH leg.
    function _unwind(uint256 usdcNeeded) internal {
        uint256 wethPrice = _wethPrice();
        uint256 staked = gauge.balanceOf(address(this));
        uint256 lp;
        if (staked > 0) {
            uint256 value = _lpValue(staked, wethPrice);
            lp = value <= usdcNeeded ? staked : Math.mulDiv(usdcNeeded, staked, value, Math.Rounding.Ceil);
            gauge.withdraw(lp);
        }
        lp = pool.balanceOf(address(this));
        if (lp > 0) {
            // Removing at skewed reserves can't lose value at oracle price (x*y=k is minimised at the fair
            // point); the only exposed step is the WETH sale below, which is oracle-bounded.
            router.removeLiquidity(address(usdc), address(weth), false, lp, 0, 0, address(this), block.timestamp);
        }
        uint256 wethBal = weth.balanceOf(address(this));
        if (wethBal > 0) {
            uint256 minOut = _applySlippage(wethBal * wethPrice / PRICE_SCALE);
            if (minOut > 0) _swap(address(weth), address(usdc), wethBal, minOut);
        }
        emit Unwound(lp, usdc.balanceOf(address(this)));
    }

    function _swap(address from, address to, uint256 amountIn, uint256 minOut) internal returns (uint256) {
        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({from: from, to: to, stable: false, factory: factory});
        uint256[] memory amounts =
            router.swapExactTokensForTokens(amountIn, minOut, routes, address(this), block.timestamp);
        return amounts[amounts.length - 1];
    }

    /// @dev Fair LP value: for x*y=k, value = 2*sqrt(k*P) at oracle price P. Resistant to reserve manipulation.
    function _lpValue(uint256 lp, uint256 wethPrice) internal view returns (uint256) {
        if (lp == 0) return 0;
        (uint256 rWeth, uint256 rUsdc) = _reserves();
        uint256 poolValue = 2 * Math.sqrt(Math.mulDiv(rWeth * rUsdc, wethPrice, PRICE_SCALE));
        return Math.mulDiv(poolValue, lp, pool.totalSupply());
    }

    function _checkPoolPrice(uint256 wethPrice) internal view {
        (uint256 rWeth, uint256 rUsdc) = _reserves();
        uint256 spot = rUsdc * PRICE_SCALE / rWeth;
        uint256 diff = spot > wethPrice ? spot - wethPrice : wethPrice - spot;
        if (diff * BPS > wethPrice * maxPriceDeviationBps) revert PoolPriceDeviation(spot, wethPrice);
    }

    function _reserves() internal view returns (uint256 rWeth, uint256 rUsdc) {
        (uint256 r0, uint256 r1,) = pool.getReserves();
        (rWeth, rUsdc) = wethIsToken0 ? (r0, r1) : (r1, r0);
    }

    /// @dev WETH price in USDC, 8 decimals.
    function _wethPrice() internal view returns (uint256) {
        return _price(ethUsdFeed, ethMaxAge) * 1e8 / _price(usdcUsdFeed, usdcMaxAge);
    }

    function _price(IAggregatorV3 feed, uint256 maxAge) internal view returns (uint256) {
        _checkSequencer();
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        if (answer <= 0 || block.timestamp - updatedAt > maxAge) revert StaleOrBadPrice(address(feed));
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer); // answer > 0 checked above
    }

    function _checkSequencer() internal view {
        (, int256 answer, uint256 startedAt,,) = sequencerFeed.latestRoundData();
        // answer 0 = up; also wait out a grace period after it comes back up.
        if (answer != 0 || block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) revert SequencerDown();
    }

    function _applySlippage(uint256 amount) internal view returns (uint256) {
        return amount * (BPS - slippageBps) / BPS;
    }
}
