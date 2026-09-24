// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IAeroRouter, IAeroPool, IAeroPoolFactory, IAeroGauge, IAeroVoter} from "./interfaces/IAerodrome.sol";
import {AggregatorV3Interface} from "./interfaces/IChainlink.sol";
import {IStrategy} from "./interfaces/IStrategy.sol";

/// @title AerodromeUsdcWethStrategy
/// @notice Holds USDC for a single vault. Zaps it into the Aerodrome volatile USDC/WETH pool,
///         stakes the LP in the pool's gauge, and on harvest sells AERO emissions for USDC.
/// @dev    All valuation and swap bounds use Chainlink, never pool spot. Pool spot is only
///         compared against Chainlink to refuse acting on a manipulated pool.
contract AerodromeUsdcWethStrategy is IStrategy, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Config {
        address vault;
        address usdc;
        address weth;
        address aero;
        address router;
        address factory;
        address voter;
        address pool; // vAMM USDC/WETH
        address gauge; // gauge of `pool`
        address aeroUsdcPool; // vAMM AERO/USDC, used to sell rewards
        address ethUsdFeed;
        address usdcUsdFeed;
        address aeroUsdFeed;
        address sequencerFeed; // L2 sequencer uptime feed
    }

    uint256 internal constant BPS = 10_000;
    uint256 internal constant MAX_BPS_SETTING = 500; // 5% hard cap on any tolerance
    uint256 internal constant SEQUENCER_GRACE = 1 hours;

    address public immutable vault;
    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    IERC20 public immutable aero;
    IAeroRouter public immutable router;
    address public immutable factory;
    IAeroVoter public immutable voter;
    IAeroPool public immutable pool;
    IAeroGauge public immutable gauge;
    AggregatorV3Interface public immutable ethUsdFeed;
    AggregatorV3Interface public immutable usdcUsdFeed;
    AggregatorV3Interface public immutable aeroUsdFeed;
    AggregatorV3Interface public immutable sequencerFeed;
    bool internal immutable wethIsToken0;

    /// Max loss vs Chainlink value on any swap / liquidity op (covers 0.3% pool fee + impact).
    uint256 public maxSlippageBps = 100;
    /// Max allowed gap between pool spot price and Chainlink before invest/withdraw refuse to run.
    uint256 public maxPriceDeviationBps = 100;
    uint256 public ethMaxAge = 1 hours; // Base ETH/USD heartbeat is 20 min
    uint256 public usdcMaxAge = 25 hours; // Base USDC/USD heartbeat is 24 h
    uint256 public aeroMaxAge = 25 hours; // Base AERO/USD heartbeat is 24 h
    /// Skip zapping amounts below this (USDC units) to avoid wasting gas on dust.
    uint256 public minInvest = 10e6;
    /// Max USDC zapped per invest(), as bps of the pool's USDC reserve. Keeps price impact of the
    /// zap swap well inside `maxSlippageBps`; the rest stays idle until the next harvest.
    uint256 public maxInvestBps = 100;
    bool public emergency;

    IAeroRouter.Route[] internal rewardRoute;

    event Invested(uint256 usdcIn, uint256 lpMinted, bool staked);
    event Freed(uint256 requested, uint256 sent);
    event Harvested(uint256 aeroSold, uint256 usdcOut);
    event EmergencyExit(uint256 lpRemoved);
    event ParamsUpdated(uint256 maxSlippageBps, uint256 maxPriceDeviationBps, uint256 minInvest);
    event MaxInvestBpsUpdated(uint256 maxInvestBps);
    event OracleAgesUpdated(uint256 ethMaxAge, uint256 usdcMaxAge, uint256 aeroMaxAge);

    error NotVault();
    error BadConfig();
    error BadParam();
    error Emergency();
    error PoolPriceDeviation(uint256 spot, uint256 oracle);
    error StaleOracle(address feed);
    error SequencerDown();

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    constructor(Config memory c, address owner_) Ownable(owner_) {
        IAeroPool p = IAeroPool(c.pool);
        bool w0 = p.token0() == c.weth;
        if (
            p.stable() || (w0 ? p.token1() : p.token0()) != c.usdc || (!w0 && p.token1() != c.weth)
                || IAeroGauge(c.gauge).stakingToken() != c.pool || IAeroGauge(c.gauge).rewardToken() != c.aero
        ) revert BadConfig();

        vault = c.vault;
        usdc = IERC20(c.usdc);
        weth = IERC20(c.weth);
        aero = IERC20(c.aero);
        router = IAeroRouter(c.router);
        factory = c.factory;
        voter = IAeroVoter(c.voter);
        pool = p;
        gauge = IAeroGauge(c.gauge);
        ethUsdFeed = AggregatorV3Interface(c.ethUsdFeed);
        usdcUsdFeed = AggregatorV3Interface(c.usdcUsdFeed);
        aeroUsdFeed = AggregatorV3Interface(c.aeroUsdFeed);
        sequencerFeed = AggregatorV3Interface(c.sequencerFeed);
        wethIsToken0 = w0;

        IAeroPool rp = IAeroPool(c.aeroUsdcPool);
        if (rp.stable() || !((rp.token0() == c.aero && rp.token1() == c.usdc) || (rp.token0() == c.usdc && rp.token1() == c.aero))) {
            revert BadConfig();
        }
        rewardRoute.push(IAeroRouter.Route({from: c.aero, to: c.usdc, stable: false, factory: c.factory}));

        // Router and gauge are fixed immutables, so standing approvals are acceptable.
        IERC20(c.usdc).forceApprove(c.router, type(uint256).max);
        IERC20(c.weth).forceApprove(c.router, type(uint256).max);
        IERC20(c.aero).forceApprove(c.router, type(uint256).max);
        IERC20(c.pool).forceApprove(c.router, type(uint256).max);
        IERC20(c.pool).forceApprove(c.gauge, type(uint256).max);
    }

    // ---------------------------------------------------------------------
    // Vault entry points
    // ---------------------------------------------------------------------

    function asset() external view returns (address) {
        return address(usdc);
    }

    /// @notice USDC value of everything the strategy holds. Unclaimed AERO is excluded on purpose.
    function totalAssets() public view returns (uint256) {
        return usdc.balanceOf(address(this)) + _wethToUsdc(weth.balanceOf(address(this))) + _lpToUsdc(lpBalance());
    }

    /// @notice Zap idle USDC (up to the per-call cap) into LP and stake it.
    function invest() external onlyVault nonReentrant {
        if (emergency) revert Emergency();
        uint256 bal = usdc.balanceOf(address(this));
        if (bal < minInvest) return;
        (, uint256 rUsdc) = _checkedReserves();
        bal = Math.min(bal, rUsdc * maxInvestBps / BPS);

        uint256 swapIn = _optimalSwapIn(bal, rUsdc);
        _swapUsdcForWeth(swapIn);

        uint256 wethIn = weth.balanceOf(address(this));
        uint256 usdcIn = bal - swapIn;
        (,, uint256 lp) = router.addLiquidity(
            address(weth),
            address(usdc),
            false,
            wethIn,
            usdcIn,
            _minusSlippage(wethIn),
            _minusSlippage(usdcIn),
            address(this),
            block.timestamp
        );

        // A killed gauge rejects deposits; keep LP unstaked so it still earns swap fees.
        bool staked = voter.isAlive(address(gauge));
        if (staked) gauge.deposit(IERC20(address(pool)).balanceOf(address(this)));
        emit Invested(bal, lp, staked);
    }

    /// @notice Free `amount` USDC and send it to the vault. May send slightly less: the exit
    ///         swap fee and slippage (bounded by `maxSlippageBps`) are borne by the caller's withdrawal.
    function withdraw(uint256 amount) external onlyVault nonReentrant returns (uint256 sent) {
        uint256 bal = usdc.balanceOf(address(this));
        if (bal < amount) {
            uint256 need = amount - bal;
            uint256 wethBal = weth.balanceOf(address(this));
            uint256 wethValue = _wethToUsdc(wethBal);
            uint256 lpTotal = lpBalance();
            if (need > wethValue && lpTotal > 0) {
                uint256 lpValue = _lpToUsdc(lpTotal);
                uint256 lpOut = Math.min(Math.mulDiv(need - wethValue, lpTotal, lpValue, Math.Rounding.Ceil), lpTotal);
                _removeLp(lpOut);
            }
            wethBal = weth.balanceOf(address(this));
            if (wethBal > 0) _swapWethForUsdc(wethBal);
            bal = usdc.balanceOf(address(this));
        }
        sent = Math.min(amount, bal);
        usdc.safeTransfer(vault, sent);
        emit Freed(amount, sent);
    }

    /// @notice Claim AERO and sell it for USDC. The USDC stays here for the vault to re-invest.
    function harvest() external onlyVault nonReentrant returns (uint256 profit) {
        if (gauge.balanceOf(address(this)) > 0) gauge.getReward(address(this));
        uint256 aeroBal = aero.balanceOf(address(this));
        if (aeroBal == 0) return 0;

        _checkSequencer();
        uint256 minOut = _minusSlippage(_aeroToUsdc(aeroBal));
        if (minOut == 0) return 0; // dust; keep it for next time
        uint256 before = usdc.balanceOf(address(this));
        router.swapExactTokensForTokens(aeroBal, minOut, rewardRoute, address(this), block.timestamp);
        profit = usdc.balanceOf(address(this)) - before;
        emit Harvested(aeroBal, profit);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function lpBalance() public view returns (uint256) {
        return gauge.balanceOf(address(this)) + IERC20(address(pool)).balanceOf(address(this));
    }

    function pendingRewards() external view returns (uint256) {
        return gauge.earned(address(this));
    }

    // ---------------------------------------------------------------------
    // Owner
    // ---------------------------------------------------------------------

    function setParams(uint256 slippageBps, uint256 deviationBps, uint256 minInvest_) external onlyOwner {
        if (slippageBps == 0 || slippageBps > MAX_BPS_SETTING || deviationBps == 0 || deviationBps > MAX_BPS_SETTING) {
            revert BadParam();
        }
        maxSlippageBps = slippageBps;
        maxPriceDeviationBps = deviationBps;
        minInvest = minInvest_;
        emit ParamsUpdated(slippageBps, deviationBps, minInvest_);
    }

    function setMaxInvestBps(uint256 bps) external onlyOwner {
        if (bps == 0 || bps > MAX_BPS_SETTING) revert BadParam();
        maxInvestBps = bps;
        emit MaxInvestBpsUpdated(bps);
    }

    function setOracleMaxAges(uint256 ethAge, uint256 usdcAge, uint256 aeroAge) external onlyOwner {
        if (ethAge == 0 || usdcAge == 0 || aeroAge == 0 || ethAge > 2 days || usdcAge > 2 days || aeroAge > 2 days) {
            revert BadParam();
        }
        (ethMaxAge, usdcMaxAge, aeroMaxAge) = (ethAge, usdcAge, aeroAge);
        emit OracleAgesUpdated(ethAge, usdcAge, aeroAge);
    }

    /// @notice Unstake and burn all LP, stop investing. Mins are owner-supplied so this works
    ///         even if oracles are down. Tokens stay here and are paid out through `withdraw`.
    function emergencyExit(uint256 minWeth, uint256 minUsdc) external onlyOwner nonReentrant {
        emergency = true;
        uint256 staked = gauge.balanceOf(address(this));
        if (staked > 0) gauge.withdraw(staked);
        uint256 lp = IERC20(address(pool)).balanceOf(address(this));
        if (lp > 0) {
            router.removeLiquidity(address(weth), address(usdc), false, lp, minWeth, minUsdc, address(this), block.timestamp);
        }
        emit EmergencyExit(lp);
    }

    /// @notice Emergency-only: sell WETH with an owner-supplied bound (oracle-independent).
    function emergencySwapWeth(uint256 amount, uint256 minOut) external onlyOwner nonReentrant {
        if (!emergency) revert BadParam();
        IAeroRouter.Route[] memory r = new IAeroRouter.Route[](1);
        r[0] = IAeroRouter.Route({from: address(weth), to: address(usdc), stable: false, factory: factory});
        router.swapExactTokensForTokens(amount, minOut, r, address(this), block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Internal: liquidity
    // ---------------------------------------------------------------------

    function _removeLp(uint256 lpOut) internal {
        (uint256 rWeth, uint256 rUsdc) = _checkedReserves();
        uint256 supply = pool.totalSupply();
        uint256 loose = IERC20(address(pool)).balanceOf(address(this));
        if (loose < lpOut) gauge.withdraw(lpOut - loose);
        router.removeLiquidity(
            address(weth),
            address(usdc),
            false,
            lpOut,
            _minusSlippage(rWeth * lpOut / supply),
            _minusSlippage(rUsdc * lpOut / supply),
            address(this),
            block.timestamp
        );
    }

    function _swapUsdcForWeth(uint256 amountIn) internal {
        if (amountIn == 0) return;
        IAeroRouter.Route[] memory r = new IAeroRouter.Route[](1);
        r[0] = IAeroRouter.Route({from: address(usdc), to: address(weth), stable: false, factory: factory});
        router.swapExactTokensForTokens(amountIn, _minusSlippage(_usdcToWeth(amountIn)), r, address(this), block.timestamp);
    }

    function _swapWethForUsdc(uint256 amountIn) internal {
        IAeroRouter.Route[] memory r = new IAeroRouter.Route[](1);
        r[0] = IAeroRouter.Route({from: address(weth), to: address(usdc), stable: false, factory: factory});
        router.swapExactTokensForTokens(amountIn, _minusSlippage(_wethToUsdc(amountIn)), r, address(this), block.timestamp);
    }

    /// @dev Amount of USDC to swap so the rest pairs 1:1 with the WETH received (x*y=k with fee).
    ///      s = (sqrt(r^2 (D+F)^2 + 4 F D a r) - r (D+F)) / (2F), D = 10000, F = D - feeBps.
    function _optimalSwapIn(uint256 amount, uint256 rUsdc) internal view returns (uint256) {
        uint256 f = BPS - IAeroPoolFactory(factory).getFee(address(pool), false);
        uint256 dPlusF = BPS + f;
        uint256 root = Math.sqrt(rUsdc * rUsdc * dPlusF * dPlusF + 4 * f * BPS * amount * rUsdc);
        return (root - rUsdc * dPlusF) / (2 * f);
    }

    /// @dev Reserves as (WETH, USDC), after checking pool spot is within tolerance of Chainlink.
    function _checkedReserves() internal view returns (uint256 rWeth, uint256 rUsdc) {
        (rWeth, rUsdc) = _reserves();
        uint256 spot = rUsdc * 1e18 / rWeth; // USDC units per 1 WETH
        uint256 oracle = _wethToUsdc(1e18);
        uint256 diff = spot > oracle ? spot - oracle : oracle - spot;
        if (diff * BPS > oracle * maxPriceDeviationBps) revert PoolPriceDeviation(spot, oracle);
    }

    function _reserves() internal view returns (uint256 rWeth, uint256 rUsdc) {
        (uint256 r0, uint256 r1,) = pool.getReserves();
        (rWeth, rUsdc) = wethIsToken0 ? (r0, r1) : (r1, r0);
    }

    // ---------------------------------------------------------------------
    // Internal: pricing (Chainlink only)
    // ---------------------------------------------------------------------

    /// @dev Manipulation-resistant LP value: 2 * sqrt(k * p) with p from Chainlink, so moving
    ///      pool reserves (which keeps k) does not change the reported value.
    function _lpToUsdc(uint256 lp) internal view returns (uint256) {
        if (lp == 0) return 0;
        (uint256 rWeth, uint256 rUsdc) = _reserves();
        uint256 poolValue = 2 * Math.sqrt(Math.mulDiv(rWeth * rUsdc, _price(ethUsdFeed, ethMaxAge), _price(usdcUsdFeed, usdcMaxAge) * 1e12));
        return Math.mulDiv(poolValue, lp, pool.totalSupply());
    }

    function _wethToUsdc(uint256 wad) internal view returns (uint256) {
        if (wad == 0) return 0;
        return Math.mulDiv(wad, _price(ethUsdFeed, ethMaxAge), _price(usdcUsdFeed, usdcMaxAge) * 1e12);
    }

    function _usdcToWeth(uint256 amount) internal view returns (uint256) {
        return Math.mulDiv(amount, _price(usdcUsdFeed, usdcMaxAge) * 1e12, _price(ethUsdFeed, ethMaxAge));
    }

    function _aeroToUsdc(uint256 wad) internal view returns (uint256) {
        return Math.mulDiv(wad, _price(aeroUsdFeed, aeroMaxAge), _price(usdcUsdFeed, usdcMaxAge) * 1e12);
    }

    /// @dev All three feeds used here have 8 decimals (checked in tests), so no rescaling.
    function _price(AggregatorV3Interface feed, uint256 maxAge) internal view returns (uint256) {
        _checkSequencer();
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        if (answer <= 0 || block.timestamp - updatedAt > maxAge) revert StaleOracle(address(feed));
        return uint256(answer);
    }

    function _checkSequencer() internal view {
        (, int256 answer, uint256 startedAt,,) = sequencerFeed.latestRoundData();
        if (answer != 0 || block.timestamp - startedAt <= SEQUENCER_GRACE) revert SequencerDown();
    }

    function _minusSlippage(uint256 x) internal view returns (uint256) {
        return x * (BPS - maxSlippageBps) / BPS;
    }
}
