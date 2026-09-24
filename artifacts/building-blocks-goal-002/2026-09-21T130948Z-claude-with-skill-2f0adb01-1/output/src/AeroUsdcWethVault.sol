// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC4626, ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IAeroRouter, IAeroPool, IAeroGauge} from "./interfaces/IAerodrome.sol";
import {ISwapRouter02} from "./interfaces/IUniswapV3.sol";
import {AggregatorV3Interface} from "./interfaces/IChainlink.sol";

/// @title AeroUsdcWethVault
/// @notice ERC-4626 USDC vault. Idle USDC is zapped into the Aerodrome vAMM USDC/WETH pool,
///         LP is staked in the pool's gauge, and a keeper harvests AERO emissions -> USDC -> LP.
///         USDC<->WETH legs swap on Uniswap V3 (much deeper than the vAMM); AERO sells on Aerodrome.
/// @dev Accounting:
///      - LP is valued with the manipulation-resistant "fair reserves" formula
///        2 * sqrt(k * pUSDC * pWETH) using Chainlink ETH/USD (USDC treated as $1), never pool spot.
///      - Non-USDC value gets a haircut (`exitHaircutBps`) so book value <= realistic exit value;
///        exit costs are paid out of the haircut instead of being socialized to remaining holders.
///      - Harvested profit unlocks linearly over `profitUnlockPeriod` to stop deposit/harvest/withdraw sandwiches.
///      - Every pool interaction first checks pool spot price vs Chainlink (`maxDeviationBps`).
contract AeroUsdcWethVault is ERC4626, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;
    uint256 private constant SEQUENCER_GRACE_PERIOD = 1 hours;
    /// @dev Skip zaps smaller than this (1 USDC) to avoid wasting gas on dust.
    uint256 private constant MIN_INVEST = 1e6;

    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    IERC20 public immutable aero;
    IAeroRouter public immutable router;
    address public immutable factory;
    ISwapRouter02 public immutable uniRouter;
    uint24 public immutable uniFee;
    IAeroPool public immutable pool;
    IAeroGauge public immutable gauge;
    AggregatorV3Interface public immutable ethUsdFeed;
    /// @dev L2 sequencer uptime feed; address(0) disables the check (tests only).
    AggregatorV3Interface public immutable sequencerFeed;
    bool private immutable usdcIsToken0;
    uint256 private immutable priceScale; // 10 ** (feedDecimals + 12)

    address public keeper;
    uint256 public depositCap;
    uint256 public maxSlippageBps = 100; // 1% vs oracle on swaps
    uint256 public maxDeviationBps = 100; // 1% pool spot vs oracle
    uint256 public exitHaircutBps = 30; // 0.3% haircut on non-USDC value
    uint256 public oracleMaxAge = 25 minutes; // Base ETH/USD heartbeat is 20 min
    uint256 public profitUnlockPeriod = 6 hours;

    uint256 public lockedProfit;
    uint256 public lastHarvest;

    event Harvested(uint256 aeroSold, uint256 profit, uint256 invested);
    event Invested(uint256 usdcIn, uint256 wethIn, uint256 lpMinted);
    event Freed(uint256 requested, uint256 lpRemoved, uint256 usdcOut);
    event EmergencyExit(uint256 lpRemoved);
    event KeeperSet(address keeper);
    event ParamsSet(
        uint256 depositCap,
        uint256 maxSlippageBps,
        uint256 maxDeviationBps,
        uint256 exitHaircutBps,
        uint256 oracleMaxAge,
        uint256 profitUnlockPeriod
    );

    error NotKeeper();
    error BadParam();
    error StaleOracle();
    error SequencerDown();
    error PriceDeviation(uint256 spot, uint256 oracle);
    error InsufficientLiquidity(uint256 needed, uint256 available);

    modifier onlyKeeper() {
        if (msg.sender != keeper && msg.sender != owner()) revert NotKeeper();
        _;
    }

    struct Addresses {
        address usdc;
        address weth;
        address aero;
        address router;
        address factory;
        address uniRouter;
        uint24 uniFee;
        address pool;
        address gauge;
        address ethUsdFeed;
        address sequencerFeed;
        address owner;
        address keeper;
    }

    constructor(Addresses memory a, uint256 depositCap_)
        ERC4626(IERC20(a.usdc))
        ERC20("Aero USDC/WETH Vault", "avUSDC")
        Ownable(a.owner)
    {
        IAeroPool p = IAeroPool(a.pool);
        address t0 = p.token0();
        address t1 = p.token1();
        if (p.stable()) revert BadParam();
        if (!((t0 == a.usdc && t1 == a.weth) || (t0 == a.weth && t1 == a.usdc))) revert BadParam();
        if (IAeroGauge(a.gauge).stakingToken() != a.pool) revert BadParam();
        if (IAeroGauge(a.gauge).rewardToken() != a.aero) revert BadParam();

        usdc = IERC20(a.usdc);
        weth = IERC20(a.weth);
        aero = IERC20(a.aero);
        router = IAeroRouter(a.router);
        factory = a.factory;
        uniRouter = ISwapRouter02(a.uniRouter);
        uniFee = a.uniFee;
        pool = p;
        gauge = IAeroGauge(a.gauge);
        ethUsdFeed = AggregatorV3Interface(a.ethUsdFeed);
        sequencerFeed = AggregatorV3Interface(a.sequencerFeed);
        usdcIsToken0 = t0 == a.usdc;
        priceScale = 10 ** (uint256(AggregatorV3Interface(a.ethUsdFeed).decimals()) + 12);
        keeper = a.keeper;
        depositCap = depositCap_;
        lastHarvest = block.timestamp;
    }

    // ------------------------------------------------------------------
    // ERC-4626 overrides
    // ------------------------------------------------------------------

    /// @notice USDC-denominated vault value, excluding still-locked harvest profit.
    function totalAssets() public view override returns (uint256) {
        uint256 gross = _grossAssets(_ethPrice());
        uint256 locked = _lockedProfit();
        return gross > locked ? gross - locked : 0;
    }

    function maxDeposit(address) public view override returns (uint256) {
        if (paused()) return 0;
        uint256 assets = totalAssets();
        return assets >= depositCap ? 0 : depositCap - assets;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        uint256 assets = maxDeposit(receiver);
        return assets == 0 ? 0 : convertToShares(assets);
    }

    /// @dev Virtual shares offset (1e6) makes first-depositor inflation attacks unprofitable.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override nonReentrant {
        super._deposit(caller, receiver, assets, shares);
    }

    /// @dev Pays from idle USDC first; unwinds LP only for the shortfall.
    function _withdraw(address caller, address receiver, address owner_, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        uint256 idle = usdc.balanceOf(address(this));
        if (idle < assets) {
            _freeFunds(assets - idle);
            idle = usdc.balanceOf(address(this));
            if (idle < assets) revert InsufficientLiquidity(assets, idle);
        }
        super._withdraw(caller, receiver, owner_, assets, shares);
    }

    // ------------------------------------------------------------------
    // Keeper
    // ------------------------------------------------------------------

    /// @notice Claim AERO, sell to USDC, and compound all idle USDC into staked LP.
    /// @param minUsdcOut Min USDC for the AERO sale. Keeper computes it off-chain
    ///        (router.getAmountsOut minus tolerance); there is no AERO oracle check onchain.
    function harvest(uint256 minUsdcOut) external onlyKeeper nonReentrant whenNotPaused {
        gauge.getReward(address(this));
        uint256 aeroBal = aero.balanceOf(address(this));

        uint256 profit;
        if (aeroBal > 0) {
            uint256 before = usdc.balanceOf(address(this));
            _swapAero(aeroBal, minUsdcOut);
            profit = usdc.balanceOf(address(this)) - before;
        }

        lockedProfit = _lockedProfit() + profit;
        lastHarvest = block.timestamp;

        uint256 invested = _invest();
        emit Harvested(aeroBal, profit, invested);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    /// @notice LP held by the vault (staked + loose).
    function lpBalance() public view returns (uint256) {
        return gauge.balanceOf(address(this)) + IERC20(address(pool)).balanceOf(address(this));
    }

    /// @notice AERO claimable from the gauge (not counted in totalAssets until harvested).
    function pendingRewards() external view returns (uint256) {
        return gauge.earned(address(this));
    }

    /// @notice Harvested profit not yet reflected in totalAssets.
    function currentLockedProfit() external view returns (uint256) {
        return _lockedProfit();
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    function setKeeper(address keeper_) external onlyOwner {
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    function setParams(
        uint256 depositCap_,
        uint256 maxSlippageBps_,
        uint256 maxDeviationBps_,
        uint256 exitHaircutBps_,
        uint256 oracleMaxAge_,
        uint256 profitUnlockPeriod_
    ) external onlyOwner {
        if (
            maxSlippageBps_ > 500 || maxDeviationBps_ > 500 || exitHaircutBps_ > 500 || oracleMaxAge_ == 0
                || profitUnlockPeriod_ == 0 || profitUnlockPeriod_ > 7 days
        ) revert BadParam();
        // Settle the unlock schedule under the old period before switching.
        lockedProfit = _lockedProfit();
        lastHarvest = block.timestamp;

        depositCap = depositCap_;
        maxSlippageBps = maxSlippageBps_;
        maxDeviationBps = maxDeviationBps_;
        exitHaircutBps = exitHaircutBps_;
        oracleMaxAge = oracleMaxAge_;
        profitUnlockPeriod = profitUnlockPeriod_;
        emit ParamsSet(
            depositCap_, maxSlippageBps_, maxDeviationBps_, exitHaircutBps_, oracleMaxAge_, profitUnlockPeriod_
        );
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Pause deposits/harvests and pull all liquidity out of the pool.
    ///         Leaves USDC + WETH in the vault; withdrawals still work and sell WETH on demand.
    /// @dev Owner passes explicit mins so this works even if the oracle is broken.
    function emergencyExit(uint256 minUsdc, uint256 minWeth) external onlyOwner nonReentrant {
        if (!paused()) _pause();
        uint256 staked = gauge.balanceOf(address(this));
        if (staked > 0) gauge.withdraw(staked);
        uint256 lp = IERC20(address(pool)).balanceOf(address(this));
        if (lp > 0) {
            IERC20(address(pool)).forceApprove(address(router), lp);
            router.removeLiquidity(
                address(usdc), address(weth), false, lp, minUsdc, minWeth, address(this), block.timestamp
            );
        }
        emit EmergencyExit(lp);
    }

    // ------------------------------------------------------------------
    // Strategy internals
    // ------------------------------------------------------------------

    /// @dev Zap idle USDC (+ any loose WETH) into LP and stake it.
    function _invest() internal returns (uint256 usdcIn) {
        uint256 price = _checkedPrice();

        uint256 usdcBal = usdc.balanceOf(address(this));
        if (usdcBal < MIN_INVEST) return 0;

        // Swap enough USDC so both sides are ~equal in value (approximate; leftovers roll to next harvest).
        uint256 wethValue = _wethToUsdc(weth.balanceOf(address(this)), price);
        if (usdcBal > wethValue) {
            uint256 toSwap = (usdcBal - wethValue) / 2;
            uint256 minOut = _usdcToWeth(toSwap, price) * (BPS - maxSlippageBps) / BPS;
            _swap(usdc, weth, toSwap, minOut);
        }

        uint256 u = usdc.balanceOf(address(this));
        uint256 w = weth.balanceOf(address(this));
        usdc.forceApprove(address(router), u);
        weth.forceApprove(address(router), w);
        // Mins are 0: pool price was just checked against Chainlink in this same tx,
        // and the router adds at the pool ratio, so no further drift is possible.
        (uint256 usedU, uint256 usedW, uint256 lp) =
            router.addLiquidity(address(usdc), address(weth), false, u, w, 0, 0, address(this), block.timestamp);
        usdc.forceApprove(address(router), 0);
        weth.forceApprove(address(router), 0);

        IERC20(address(pool)).forceApprove(address(gauge), lp);
        gauge.deposit(lp);
        emit Invested(usedU, usedW, lp);
        return usedU;
    }

    /// @dev Unwind enough LP (at book value) to cover `amount` USDC, then sell all WETH.
    function _freeFunds(uint256 amount) internal {
        uint256 price = _checkedPrice();

        uint256 lpTotal = lpBalance();
        uint256 wethBook = _haircut(_wethToUsdc(weth.balanceOf(address(this)), price));
        uint256 lpToRemove;
        if (amount > wethBook && lpTotal > 0) {
            uint256 lpBook = _haircut(_poolFairValue(price));
            // lp = shortfall * poolSupply / poolBookValue, rounded up
            lpToRemove = Math.mulDiv(amount - wethBook, pool.totalSupply(), lpBook, Math.Rounding.Ceil);
            if (lpToRemove > lpTotal) lpToRemove = lpTotal;

            uint256 loose = IERC20(address(pool)).balanceOf(address(this));
            if (lpToRemove > loose) gauge.withdraw(lpToRemove - loose);

            IERC20(address(pool)).forceApprove(address(router), lpToRemove);
            // Mins are 0: spot price checked above in the same tx; final USDC amount is enforced by caller.
            router.removeLiquidity(
                address(usdc), address(weth), false, lpToRemove, 0, 0, address(this), block.timestamp
            );
        }

        uint256 wethBal = weth.balanceOf(address(this));
        if (wethBal > 0) {
            uint256 minOut = _wethToUsdc(wethBal, price) * (BPS - maxSlippageBps) / BPS;
            _swap(weth, usdc, wethBal, minOut);
        }
        emit Freed(amount, lpToRemove, usdc.balanceOf(address(this)));
    }

    /// @dev AERO -> USDC on Aerodrome's volatile AERO/USDC pool (deepest AERO market on Base).
    function _swapAero(uint256 amountIn, uint256 minOut) internal {
        IAeroRouter.Route[] memory routes = new IAeroRouter.Route[](1);
        routes[0] = IAeroRouter.Route({from: address(aero), to: address(usdc), stable: false, factory: factory});
        aero.forceApprove(address(router), amountIn);
        router.swapExactTokensForTokens(amountIn, minOut, routes, address(this), block.timestamp);
    }

    /// @dev USDC <-> WETH on Uniswap V3; minOut is always oracle-derived by the caller.
    function _swap(IERC20 from, IERC20 to, uint256 amountIn, uint256 minOut) internal {
        from.forceApprove(address(uniRouter), amountIn);
        uniRouter.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: address(from),
                tokenOut: address(to),
                fee: uniFee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );
    }

    // ------------------------------------------------------------------
    // Valuation
    // ------------------------------------------------------------------

    function _grossAssets(uint256 price) internal view returns (uint256) {
        uint256 nonUsdc = _wethToUsdc(weth.balanceOf(address(this)), price);
        uint256 lp = lpBalance();
        if (lp > 0) nonUsdc += Math.mulDiv(lp, _poolFairValue(price), pool.totalSupply());
        return usdc.balanceOf(address(this)) + _haircut(nonUsdc);
    }

    /// @dev Pool value in USDC from invariant + oracle: 2 * sqrt(rUsdc * rWeth * pWeth).
    ///      Moving the pool's spot price does not change k, so this can't be flash-manipulated.
    function _poolFairValue(uint256 price) internal view returns (uint256) {
        (uint256 rU, uint256 rW) = _reserves();
        return 2 * Math.sqrt(Math.mulDiv(rU * rW, price, priceScale));
    }

    function _reserves() internal view returns (uint256 rUsdc, uint256 rWeth) {
        (uint256 r0, uint256 r1,) = pool.getReserves();
        (rUsdc, rWeth) = usdcIsToken0 ? (r0, r1) : (r1, r0);
    }

    function _wethToUsdc(uint256 wethAmt, uint256 price) internal view returns (uint256) {
        return Math.mulDiv(wethAmt, price, priceScale);
    }

    function _usdcToWeth(uint256 usdcAmt, uint256 price) internal view returns (uint256) {
        return Math.mulDiv(usdcAmt, priceScale, price);
    }

    function _haircut(uint256 value) internal view returns (uint256) {
        return value * (BPS - exitHaircutBps) / BPS;
    }

    function _lockedProfit() internal view returns (uint256) {
        uint256 elapsed = block.timestamp - lastHarvest;
        if (elapsed >= profitUnlockPeriod) return 0;
        return lockedProfit * (profitUnlockPeriod - elapsed) / profitUnlockPeriod;
    }

    /// @dev Chainlink ETH/USD with staleness + L2 sequencer checks. Returns feed-decimals price.
    function _ethPrice() internal view returns (uint256) {
        if (address(sequencerFeed) != address(0)) {
            (, int256 status, uint256 startedAt,,) = sequencerFeed.latestRoundData();
            if (status != 0 || block.timestamp - startedAt < SEQUENCER_GRACE_PERIOD) revert SequencerDown();
        }
        (, int256 answer,, uint256 updatedAt,) = ethUsdFeed.latestRoundData();
        if (answer <= 0 || block.timestamp - updatedAt > oracleMaxAge) revert StaleOracle();
        return uint256(answer);
    }

    /// @dev Oracle price, after asserting pool spot price is within `maxDeviationBps` of it.
    function _checkedPrice() internal view returns (uint256 price) {
        price = _ethPrice();
        (uint256 rU, uint256 rW) = _reserves();
        uint256 spot = Math.mulDiv(rU, priceScale, rW);
        uint256 diff = spot > price ? spot - price : price - spot;
        if (diff * BPS > price * maxDeviationBps) revert PriceDeviation(spot, price);
    }
}
