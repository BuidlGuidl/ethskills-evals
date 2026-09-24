// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IStrategy} from "./interfaces/IStrategy.sol";
import {IChainlinkAggregator} from "./interfaces/IChainlinkAggregator.sol";
import {IAerodromeRouter, IAerodromePool, IAerodromeGauge} from "./interfaces/IAerodrome.sol";

/// @title AerodromeUsdcWethStrategy
/// @notice Holds USDC for a single vault, pairs it with WETH in the Aerodrome volatile WETH/USDC pool,
///         stakes the LP in the pool's gauge and compounds AERO emissions on harvest.
/// @dev Valuation never uses pool spot reserves directly: LP is priced with the "fair reserves" formula
///      (2 * sqrt(k * p)) using Chainlink ETH/USD, so pool manipulation cannot move the vault share price.
///      Assumes 1 USDC == 1 USD (ETH/USD feed is used as the ETH/USDC price).
contract AerodromeUsdcWethStrategy is IStrategy, Ownable2Step {
    using SafeERC20 for IERC20;

    struct Config {
        address vault;
        address usdc;
        address weth;
        address aero;
        address router;
        address poolFactory;
        address pool;
        address gauge;
        address ethUsdFeed;
        address sequencerFeed; // address(0) disables the L2 sequencer check (tests / L1)
    }

    uint256 internal constant BPS = 10_000;
    uint256 internal constant MAX_SLIPPAGE_BPS = 500;
    /// @dev Below this USDC value, loose funds are left for the next harvest (not worth the swap).
    uint256 internal constant MIN_INVEST = 1e6;

    address public immutable override vault;
    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    IERC20 public immutable aero;
    IAerodromeRouter public immutable router;
    address public immutable poolFactory;
    IAerodromePool public immutable pool;
    IAerodromeGauge public immutable gauge;
    IChainlinkAggregator public immutable ethUsdFeed;
    IChainlinkAggregator public immutable sequencerFeed;
    bool internal immutable wethIsToken0;

    /// @notice Max loss vs oracle value on swaps / LP mint.
    uint256 public maxSlippageBps = 100;
    /// @notice Max pool spot price deviation from oracle before adding liquidity.
    uint256 public maxPriceDeviationBps = 100;
    uint256 public oracleMaxAge = 1 hours;
    uint256 public sequencerGracePeriod = 1 hours;
    /// @notice Max USDC value deployed per harvest, keeps swap price impact small vs pool depth.
    uint256 public maxInvestPerHarvest = 20_000e6;

    event Harvested(uint256 aeroClaimed, uint256 usdcFromRewards);
    event Invested(uint256 usdcIn, uint256 wethIn, uint256 liquidity);
    event Withdrawn(uint256 liquidity, uint256 usdcOut);
    event MaxInvestUpdated(uint256 maxInvestPerHarvest);
    event ParamsUpdated(uint256 maxSlippageBps, uint256 maxPriceDeviationBps, uint256 oracleMaxAge, uint256 gracePeriod);

    error OnlyVault();
    error BadConfig();
    error BadParam();
    error SequencerDown();
    error StaleOracle();
    error PriceDeviation();
    error Slippage();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor(Config memory c, address owner_) Ownable(owner_) {
        address t0 = IAerodromePool(c.pool).token0();
        address t1 = IAerodromePool(c.pool).token1();
        bool pairOk = (t0 == c.weth && t1 == c.usdc) || (t0 == c.usdc && t1 == c.weth);
        if (
            !pairOk || IAerodromePool(c.pool).stable() || IAerodromeGauge(c.gauge).stakingToken() != c.pool
                || IAerodromeGauge(c.gauge).rewardToken() != c.aero || IChainlinkAggregator(c.ethUsdFeed).decimals() != 8
                || c.vault == address(0)
        ) revert BadConfig();

        vault = c.vault;
        usdc = IERC20(c.usdc);
        weth = IERC20(c.weth);
        aero = IERC20(c.aero);
        router = IAerodromeRouter(c.router);
        poolFactory = c.poolFactory;
        pool = IAerodromePool(c.pool);
        gauge = IAerodromeGauge(c.gauge);
        ethUsdFeed = IChainlinkAggregator(c.ethUsdFeed);
        sequencerFeed = IChainlinkAggregator(c.sequencerFeed);
        wethIsToken0 = t0 == c.weth;

        IERC20(c.usdc).forceApprove(c.router, type(uint256).max);
        IERC20(c.weth).forceApprove(c.router, type(uint256).max);
        IERC20(c.aero).forceApprove(c.router, type(uint256).max);
        IERC20(c.pool).forceApprove(c.router, type(uint256).max);
        IERC20(c.pool).forceApprove(c.gauge, type(uint256).max);
    }

    // ---------------------------------------------------------------- views

    function asset() external view returns (address) {
        return address(usdc);
    }

    /// @notice USDC value of everything the strategy holds. Unclaimed AERO is ignored until harvested.
    function totalAssets() public view returns (uint256) {
        uint256 total = usdc.balanceOf(address(this));
        uint256 wethBal = weth.balanceOf(address(this));
        uint256 lp = stakedLiquidity() + IERC20(address(pool)).balanceOf(address(this));
        // No oracle needed when only USDC is held (e.g. after exitAll) — keeps withdrawals open if the feed breaks.
        if (wethBal == 0 && lp == 0) return total;

        uint256 price = ethPrice();
        return total + _wethToUsdc(wethBal, price) + _lpValue(lp, price);
    }

    function stakedLiquidity() public view returns (uint256) {
        return gauge.balanceOf(address(this));
    }

    function pendingRewards() external view returns (uint256) {
        return gauge.earned(address(this));
    }

    /// @notice Chainlink ETH/USD (8 decimals) with L2 sequencer + staleness checks.
    function ethPrice() public view returns (uint256) {
        if (address(sequencerFeed) != address(0)) {
            (, int256 status, uint256 startedAt,,) = sequencerFeed.latestRoundData();
            if (status != 0) revert SequencerDown();
            if (block.timestamp - startedAt <= sequencerGracePeriod) revert SequencerDown();
        }
        (, int256 answer,, uint256 updatedAt,) = ethUsdFeed.latestRoundData();
        if (answer <= 0 || block.timestamp - updatedAt > oracleMaxAge) revert StaleOracle();
        // casting to 'uint256' is safe because answer > 0 was checked above
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer);
    }

    // ------------------------------------------------------------ vault ops

    /// @notice Claim AERO, sell it for USDC, then invest all loose USDC/WETH into staked LP.
    /// @param minUsdcFromRewards keeper-computed floor for the AERO -> USDC swap (no AERO oracle onchain).
    /// @return profit USDC realised from rewards.
    function harvest(uint256 minUsdcFromRewards) external onlyVault returns (uint256 profit) {
        gauge.getReward(address(this));
        uint256 aeroBal = aero.balanceOf(address(this));
        if (aeroBal > 0) {
            profit = _swap(address(aero), address(usdc), aeroBal, minUsdcFromRewards);
        }
        emit Harvested(aeroBal, profit);
        _invest();
    }

    /// @notice Unwind `num/den` of every position and send the resulting USDC to the vault.
    function withdraw(uint256 num, uint256 den) external onlyVault returns (uint256 assetsOut) {
        if (num == 0) return 0;
        if (num > den) revert BadParam();

        uint256 usdcPart = Math.mulDiv(usdc.balanceOf(address(this)), num, den);
        uint256 wethPart = Math.mulDiv(weth.balanceOf(address(this)), num, den);
        uint256 lp = Math.mulDiv(stakedLiquidity(), num, den);

        uint256 usdcBefore = usdc.balanceOf(address(this));
        uint256 wethBefore = weth.balanceOf(address(this));
        if (lp > 0) _removeLiquidity(lp);
        uint256 wethToSell = wethPart + (weth.balanceOf(address(this)) - wethBefore);
        if (wethToSell > 0) {
            uint256 minOut = _applySlippage(_wethToUsdc(wethToSell, ethPrice()));
            _swap(address(weth), address(usdc), wethToSell, minOut);
        }

        // Caller gets its share of loose USDC plus everything this unwind produced.
        // Sale-price risk is bounded by minOut above and by the vault's end-to-end check.
        assetsOut = usdcPart + (usdc.balanceOf(address(this)) - usdcBefore);
        usdc.safeTransfer(vault, assetsOut);
        emit Withdrawn(lp, assetsOut);
    }

    /// @notice Emergency: unwind everything to USDC and send it to the vault. Oracle-free so it works
    ///         even if the price feed is down; caller supplies the minimum acceptable output.
    function exitAll(uint256 minAssetsOut) external onlyVault returns (uint256 assetsOut) {
        uint256 lp = stakedLiquidity();
        if (lp > 0) _removeLiquidity(lp);
        uint256 wethBal = weth.balanceOf(address(this));
        if (wethBal > 0) _swap(address(weth), address(usdc), wethBal, 0);
        assetsOut = usdc.balanceOf(address(this));
        if (assetsOut < minAssetsOut) revert Slippage();
        usdc.safeTransfer(vault, assetsOut);
        emit Withdrawn(lp, assetsOut);
    }

    // ---------------------------------------------------------------- admin

    function setParams(uint256 slippageBps, uint256 deviationBps, uint256 maxAge, uint256 gracePeriod)
        external
        onlyOwner
    {
        if (slippageBps > MAX_SLIPPAGE_BPS || deviationBps > MAX_SLIPPAGE_BPS || maxAge == 0 || maxAge > 1 days) {
            revert BadParam();
        }
        maxSlippageBps = slippageBps;
        maxPriceDeviationBps = deviationBps;
        oracleMaxAge = maxAge;
        sequencerGracePeriod = gracePeriod;
        emit ParamsUpdated(slippageBps, deviationBps, maxAge, gracePeriod);
    }

    function setMaxInvestPerHarvest(uint256 amount) external onlyOwner {
        if (amount < MIN_INVEST) revert BadParam();
        maxInvestPerHarvest = amount;
        emit MaxInvestUpdated(amount);
    }

    // ------------------------------------------------------------- internal

    function _invest() internal {
        uint256 price = ethPrice();
        uint256 usdcBal = usdc.balanceOf(address(this));
        uint256 wethValue = _wethToUsdc(weth.balanceOf(address(this)), price);
        uint256 budget = Math.min(usdcBal + wethValue, maxInvestPerHarvest);
        if (budget < MIN_INVEST) return;
        // Adding liquidity at a skewed ratio would gift value to whoever skewed it; check before and after our swap.
        _checkSpotPrice(price);

        // Rebalance so each side holds budget/2 by value. The rest stays loose for the next harvest.
        uint256 half = budget / 2;
        if (wethValue < half) {
            uint256 usdcIn = half - wethValue;
            _swap(address(usdc), address(weth), usdcIn, _applySlippage(_usdcToWeth(usdcIn, price)));
        } else if (usdcBal < half) {
            uint256 wethIn = _usdcToWeth(half - usdcBal, price);
            _swap(address(weth), address(usdc), wethIn, _applySlippage(_wethToUsdc(wethIn, price)));
        }

        _checkSpotPrice(price);

        uint256 usdcAmt = Math.min(usdc.balanceOf(address(this)), half);
        uint256 wethAmt = Math.min(weth.balanceOf(address(this)), _usdcToWeth(half, price));
        (uint256 wethUsed, uint256 usdcUsed, uint256 liquidity) = router.addLiquidity(
            address(weth), address(usdc), false, wethAmt, usdcAmt, 0, 0, address(this), block.timestamp
        );
        uint256 valueIn = usdcUsed + _wethToUsdc(wethUsed, price);
        if (_lpValue(liquidity, price) < _applySlippage(valueIn)) revert Slippage();

        gauge.deposit(IERC20(address(pool)).balanceOf(address(this)));
        emit Invested(usdcUsed, wethUsed, liquidity);
    }

    function _removeLiquidity(uint256 lp) internal {
        gauge.withdraw(lp);
        // Min amounts are 0 on purpose: a proportional burn can't lose value by itself; the token mix is
        // re-priced against the oracle when WETH is sold, and the vault checks the final USDC amount.
        router.removeLiquidity(address(weth), address(usdc), false, lp, 0, 0, address(this), block.timestamp);
    }

    function _swap(address from, address to, uint256 amountIn, uint256 minOut) internal returns (uint256) {
        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({from: from, to: to, stable: false, factory: poolFactory});
        uint256[] memory amounts = router.swapExactTokensForTokens(amountIn, minOut, routes, address(this), block.timestamp);
        return amounts[amounts.length - 1];
    }

    function _checkSpotPrice(uint256 price) internal view {
        (uint256 rWeth, uint256 rUsdc) = _reserves();
        // spot and oracle both expressed as USDC(6 dec) per 1 WETH
        uint256 spot = Math.mulDiv(rUsdc, 1e18, rWeth);
        uint256 oracle = price / 100;
        uint256 diff = spot > oracle ? spot - oracle : oracle - spot;
        if (diff * BPS > oracle * maxPriceDeviationBps) revert PriceDeviation();
    }

    /// @dev Fair LP value: for x*y=k at the oracle price p, reserves would be x=sqrt(k/p), y=sqrt(k*p),
    ///      so pool value = 2*sqrt(k*p) in USDC — independent of the (manipulable) reserve ratio.
    function _lpValue(uint256 lp, uint256 price) internal view returns (uint256) {
        if (lp == 0) return 0;
        (uint256 rWeth, uint256 rUsdc) = _reserves();
        // k*p with p in USDC units per wei = price(8 dec) / 1e20
        uint256 poolValue = 2 * Math.sqrt(Math.mulDiv(rWeth * rUsdc, price, 1e20));
        return Math.mulDiv(poolValue, lp, pool.totalSupply());
    }

    function _reserves() internal view returns (uint256 rWeth, uint256 rUsdc) {
        (uint256 r0, uint256 r1,) = pool.getReserves();
        (rWeth, rUsdc) = wethIsToken0 ? (r0, r1) : (r1, r0);
    }

    function _wethToUsdc(uint256 amount, uint256 price) internal pure returns (uint256) {
        return Math.mulDiv(amount, price, 1e20); // 1e18 wei * 1e8 price -> 1e6 USDC
    }

    function _usdcToWeth(uint256 amount, uint256 price) internal pure returns (uint256) {
        return Math.mulDiv(amount, 1e20, price);
    }

    function _applySlippage(uint256 amount) internal view returns (uint256) {
        return amount * (BPS - maxSlippageBps) / BPS;
    }
}
