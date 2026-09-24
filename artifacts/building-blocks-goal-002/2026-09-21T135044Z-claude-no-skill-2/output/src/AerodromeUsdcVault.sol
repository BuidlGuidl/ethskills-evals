// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IAerodromeRouter, IAerodromePool, IAerodromePoolFactory, IAerodromeGauge} from "./interfaces/IAerodrome.sol";
import {IChainlinkFeed} from "./interfaces/IChainlink.sol";

/// @title AerodromeUsdcVault
/// @notice USDC vault on Base. Idle USDC is zapped into the Aerodrome vAMM-WETH/USDC pool by the keeper,
///         LP is staked in the pool's gauge, and AERO emissions are sold for USDC and compounded on harvest().
/// @dev Share price uses manipulation-resistant "fair LP" pricing (Chainlink prices + pool invariant k),
///      never pool spot price. Redeemers pay their own exit costs (swap fee / slippage).
contract AerodromeUsdcVault is ERC20, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Config {
        address usdc;
        address weth;
        address aero;
        address router;
        address pool; // vAMM WETH/USDC
        address gauge; // gauge of `pool`, rewards in AERO
        address ethUsdFeed;
        address usdcUsdFeed;
        address sequencerUptimeFeed;
        uint256 ethFeedMaxAge;
        uint256 usdcFeedMaxAge;
        address keeper;
        address feeRecipient;
    }

    // ---------------------------------------------------------------- constants

    uint256 public constant MAX_BPS = 10_000;
    uint256 public constant MAX_PERFORMANCE_FEE_BPS = 2_000;
    uint256 public constant MAX_SLIPPAGE_BPS = 500;
    uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
    uint256 public constant PROFIT_UNLOCK_TIME = 12 hours;
    uint256 public constant MIN_DEPLOY = 1e6; // 1 USDC
    uint8 private constant DECIMALS_OFFSET = 6; // virtual shares vs. inflation attack

    // ---------------------------------------------------------------- immutables

    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    IERC20 public immutable aero;
    IAerodromeRouter public immutable router;
    address public immutable factory;
    IAerodromePool public immutable pool;
    IAerodromeGauge public immutable gauge;
    bool private immutable wethIsToken0;

    IChainlinkFeed public immutable ethUsdFeed;
    IChainlinkFeed public immutable usdcUsdFeed;
    IChainlinkFeed public immutable sequencerUptimeFeed;
    uint256 public immutable ethFeedMaxAge;
    uint256 public immutable usdcFeedMaxAge;
    uint256 private immutable ethFeedScale;
    uint256 private immutable usdcFeedScale;

    // ---------------------------------------------------------------- storage

    address public keeper;
    address public feeRecipient;
    uint256 public performanceFeeBps = 1_000; // 10% of harvested rewards
    uint256 public maxSlippageBps = 100; // vs. Chainlink, includes 0.3% pool fee
    uint256 public depositCap;
    bool public depositsPaused;

    uint256 public lockedProfit; // harvested profit still unlocking (anti reward-sniping)
    uint256 public lastHarvest;

    // ---------------------------------------------------------------- events / errors

    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event Redeem(address indexed caller, address indexed receiver, uint256 assets, uint256 shares, bool oracleOk);
    event Harvest(uint256 aeroClaimed, uint256 profit, uint256 fee, uint256 deployed);
    event KeeperSet(address keeper);
    event FeeRecipientSet(address feeRecipient);
    event PerformanceFeeSet(uint256 bps);
    event MaxSlippageSet(uint256 bps);
    event DepositCapSet(uint256 cap);
    event DepositsPausedSet(bool paused);

    error ZeroAmount();
    error ZeroAddress();
    error NotKeeper();
    error DepositsPaused();
    error DepositCapExceeded();
    error OracleUnavailable();
    error MinOutRequired();
    error InsufficientOutput();
    error PoolPriceDeviation();
    error InvalidConfig();
    error ValueTooHigh();

    modifier onlyKeeper() {
        if (msg.sender != keeper && msg.sender != owner()) revert NotKeeper();
        _;
    }

    constructor(Config memory c, uint256 depositCap_, address owner_)
        ERC20("Aerodrome USDC-WETH Vault", "avUSDC")
        Ownable(owner_)
    {
        if (
            c.usdc == address(0) || c.weth == address(0) || c.aero == address(0) || c.router == address(0)
                || c.pool == address(0) || c.gauge == address(0) || c.ethUsdFeed == address(0)
                || c.usdcUsdFeed == address(0) || c.sequencerUptimeFeed == address(0) || c.keeper == address(0)
                || c.feeRecipient == address(0)
        ) revert ZeroAddress();

        IAerodromePool p = IAerodromePool(c.pool);
        address t0 = p.token0();
        address t1 = p.token1();
        bool ordered = t0 == c.weth && t1 == c.usdc;
        if (!(ordered || (t0 == c.usdc && t1 == c.weth)) || p.stable()) revert InvalidConfig();
        IAerodromeGauge g = IAerodromeGauge(c.gauge);
        if (g.stakingToken() != c.pool || g.rewardToken() != c.aero) revert InvalidConfig();

        usdc = IERC20(c.usdc);
        weth = IERC20(c.weth);
        aero = IERC20(c.aero);
        router = IAerodromeRouter(c.router);
        factory = IAerodromeRouter(c.router).defaultFactory();
        pool = p;
        gauge = g;
        wethIsToken0 = ordered;

        ethUsdFeed = IChainlinkFeed(c.ethUsdFeed);
        usdcUsdFeed = IChainlinkFeed(c.usdcUsdFeed);
        sequencerUptimeFeed = IChainlinkFeed(c.sequencerUptimeFeed);
        ethFeedMaxAge = c.ethFeedMaxAge;
        usdcFeedMaxAge = c.usdcFeedMaxAge;
        ethFeedScale = 10 ** IChainlinkFeed(c.ethUsdFeed).decimals();
        usdcFeedScale = 10 ** IChainlinkFeed(c.usdcUsdFeed).decimals();

        keeper = c.keeper;
        feeRecipient = c.feeRecipient;
        depositCap = depositCap_;
        lastHarvest = block.timestamp;

        usdc.forceApprove(c.router, type(uint256).max);
        weth.forceApprove(c.router, type(uint256).max);
        aero.forceApprove(c.router, type(uint256).max);
        IERC20(c.pool).forceApprove(c.router, type(uint256).max);
        IERC20(c.pool).forceApprove(c.gauge, type(uint256).max);
    }

    function decimals() public pure override returns (uint8) {
        return 6 + DECIMALS_OFFSET;
    }

    // ================================================================ user actions

    /// @notice Deposit USDC for shares. USDC sits idle until the next keeper harvest deploys it.
    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
        if (depositsPaused) revert DepositsPaused();
        if (assets == 0) revert ZeroAmount();
        uint256 total = _totalAssets(_requirePrice());
        if (total + assets > depositCap) revert DepositCapExceeded();

        shares = _toShares(assets, total, totalSupply());
        if (shares == 0) revert ZeroAmount();

        usdc.safeTransferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /// @notice Burn `shares` for USDC. Uses idle USDC first, then unwinds just enough LP.
    ///         If the oracle is down, falls back to a pro-rata exit and `minAssetsOut` must be non-zero.
    /// @param minAssetsOut Caller's slippage floor on the USDC received.
    function redeem(uint256 shares, address receiver, uint256 minAssetsOut)
        external
        nonReentrant
        returns (uint256 assets)
    {
        if (shares == 0) revert ZeroAmount();
        uint256 supply = totalSupply();
        uint256 idle = usdc.balanceOf(address(this));
        uint256 staked = gauge.balanceOf(address(this));
        (uint256 price, bool ok) = _oraclePrice();

        uint256 fromIdle;
        uint256 lpOut;
        if (ok) {
            // Fair-value exit: redeemer takes exactly their share of (unlocked) value, then bears the exit cost.
            uint256 value = Math.mulDiv(shares, _totalAssets(price) + 1, supply + 10 ** DECIMALS_OFFSET);
            if (value <= idle) {
                fromIdle = value;
            } else {
                fromIdle = idle;
                uint256 lpValue = _lpValue(staked, price);
                if (lpValue > 0) lpOut = Math.min(staked, Math.mulDiv(staked, value - idle, lpValue));
            }
        } else {
            // Emergency path: pro-rata slice of holdings, protected only by the caller's minAssetsOut.
            if (minAssetsOut == 0) revert MinOutRequired();
            fromIdle = Math.mulDiv(idle, shares, supply);
            lpOut = Math.mulDiv(staked, shares, supply);
        }

        _burn(msg.sender, shares);
        assets = fromIdle;
        if (lpOut > 0) assets += _exitLp(lpOut, price, ok);
        if (assets < minAssetsOut) revert InsufficientOutput();

        usdc.safeTransfer(receiver, assets);
        emit Redeem(msg.sender, receiver, assets, shares, ok);
    }

    // ================================================================ keeper

    /// @notice Claim AERO, sell it for USDC, take the performance fee, and deploy idle USDC into the LP.
    /// @param minRewardUsdcOut Floor for the AERO->USDC swap (keeper computes it off-chain from a quote).
    /// @param maxDeploy Max idle USDC to zap this call; keeps the zap swap within `maxSlippageBps`.
    function harvest(uint256 minRewardUsdcOut, uint256 maxDeploy)
        external
        onlyKeeper
        nonReentrant
        returns (uint256 profit)
    {
        uint256 price = _requirePrice();
        _checkPoolPrice(price);

        gauge.getReward(address(this));
        uint256 aeroBal = aero.balanceOf(address(this));
        if (aeroBal > 0) profit = _swap(address(aero), address(usdc), aeroBal, minRewardUsdcOut);

        uint256 fee = Math.mulDiv(profit, performanceFeeBps, MAX_BPS);
        if (fee > 0) usdc.safeTransfer(feeRecipient, fee);

        // Re-lock whatever is still locked plus the new net profit; it unlocks linearly.
        lockedProfit = lockedProfitNow() + profit - fee;
        lastHarvest = block.timestamp;

        uint256 deployed = _deployIdle(price, maxDeploy);
        emit Harvest(aeroBal, profit, fee, deployed);
    }

    // ================================================================ views

    /// @notice Vault value in USDC (fair LP value + idle), excluding still-locked profit.
    function totalAssets() external view returns (uint256) {
        return _totalAssets(_requirePrice());
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return _toShares(assets, _totalAssets(_requirePrice()), totalSupply());
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return Math.mulDiv(shares, _totalAssets(_requirePrice()) + 1, totalSupply() + 10 ** DECIMALS_OFFSET);
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    /// @notice Upper bound: fair value of `shares`. Actual output is lower by the LP exit cost.
    function previewRedeem(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }

    function stakedLp() external view returns (uint256) {
        return gauge.balanceOf(address(this));
    }

    function pendingRewards() external view returns (uint256) {
        return gauge.earned(address(this));
    }

    function lockedProfitNow() public view returns (uint256) {
        uint256 elapsed = block.timestamp - lastHarvest;
        if (elapsed >= PROFIT_UNLOCK_TIME) return 0;
        return lockedProfit * (PROFIT_UNLOCK_TIME - elapsed) / PROFIT_UNLOCK_TIME;
    }

    /// @notice Chainlink WETH price in USDC base units per 1e18 wei. `ok` is false if any feed is unusable.
    function oraclePrice() external view returns (uint256 price, bool ok) {
        return _oraclePrice();
    }

    // ================================================================ admin

    function setKeeper(address k) external onlyOwner {
        if (k == address(0)) revert ZeroAddress();
        keeper = k;
        emit KeeperSet(k);
    }

    function setFeeRecipient(address r) external onlyOwner {
        if (r == address(0)) revert ZeroAddress();
        feeRecipient = r;
        emit FeeRecipientSet(r);
    }

    function setPerformanceFee(uint256 bps) external onlyOwner {
        if (bps > MAX_PERFORMANCE_FEE_BPS) revert ValueTooHigh();
        performanceFeeBps = bps;
        emit PerformanceFeeSet(bps);
    }

    function setMaxSlippage(uint256 bps) external onlyOwner {
        if (bps > MAX_SLIPPAGE_BPS) revert ValueTooHigh();
        maxSlippageBps = bps;
        emit MaxSlippageSet(bps);
    }

    function setDepositCap(uint256 cap) external onlyOwner {
        depositCap = cap;
        emit DepositCapSet(cap);
    }

    function setDepositsPaused(bool paused) external onlyOwner {
        depositsPaused = paused;
        emit DepositsPausedSet(paused);
    }

    // ================================================================ internal: accounting

    function _toShares(uint256 assets, uint256 total, uint256 supply) internal pure returns (uint256) {
        return Math.mulDiv(assets, supply + 10 ** DECIMALS_OFFSET, total + 1);
    }

    function _totalAssets(uint256 price) internal view returns (uint256) {
        uint256 gross = usdc.balanceOf(address(this)) + Math.mulDiv(weth.balanceOf(address(this)), price, 1e18)
            + _lpValue(gauge.balanceOf(address(this)), price);
        uint256 locked = lockedProfitNow();
        return gross > locked ? gross - locked : 0;
    }

    /// @dev Fair LP value: for x*y=k the pool is worth 2*sqrt(k*P) at oracle price P, regardless of how
    ///      reserves are skewed. Flash-loan manipulation of reserves cannot inflate it.
    function _lpValue(uint256 lpAmount, uint256 price) internal view returns (uint256) {
        if (lpAmount == 0) return 0;
        (uint256 rWeth, uint256 rUsdc) = _reserves();
        uint256 poolValue = 2 * Math.sqrt(Math.mulDiv(rWeth * rUsdc, price, 1e18));
        return Math.mulDiv(poolValue, lpAmount, pool.totalSupply());
    }

    function _reserves() internal view returns (uint256 rWeth, uint256 rUsdc) {
        (uint256 r0, uint256 r1,) = pool.getReserves();
        (rWeth, rUsdc) = wethIsToken0 ? (r0, r1) : (r1, r0);
    }

    // ================================================================ internal: oracle

    function _requirePrice() internal view returns (uint256 price) {
        bool ok;
        (price, ok) = _oraclePrice();
        if (!ok) revert OracleUnavailable();
    }

    function _oraclePrice() internal view returns (uint256 price, bool ok) {
        if (!_sequencerUp()) return (0, false);
        (uint256 ethUsd, bool ok1) = _readFeed(ethUsdFeed, ethFeedMaxAge);
        (uint256 usdcUsd, bool ok2) = _readFeed(usdcUsdFeed, usdcFeedMaxAge);
        if (!ok1 || !ok2) return (0, false);
        // USDC base units (1e6) per 1 WETH
        price = Math.mulDiv(ethUsd * 1e6, usdcFeedScale, usdcUsd * ethFeedScale);
        ok = price > 0;
    }

    function _readFeed(IChainlinkFeed feed, uint256 maxAge) internal view returns (uint256, bool) {
        try feed.latestRoundData() returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80) {
            if (answer <= 0 || updatedAt == 0 || updatedAt > block.timestamp) return (0, false);
            if (block.timestamp - updatedAt > maxAge) return (0, false);
            return (uint256(answer), true);
        } catch {
            return (0, false);
        }
    }

    /// @dev Chainlink L2 sequencer feed: answer 0 = up. Wait a grace period after restart.
    function _sequencerUp() internal view returns (bool) {
        try sequencerUptimeFeed.latestRoundData() returns (uint80, int256 answer, uint256 startedAt, uint256, uint80) {
            return answer == 0 && startedAt != 0 && block.timestamp - startedAt > SEQUENCER_GRACE_PERIOD;
        } catch {
            return false;
        }
    }

    /// @dev Keeper actions add liquidity at the pool ratio, so the pool must not be skewed vs. the oracle.
    function _checkPoolPrice(uint256 price) internal view {
        (uint256 rWeth, uint256 rUsdc) = _reserves();
        if (rWeth == 0) revert PoolPriceDeviation();
        uint256 spot = Math.mulDiv(rUsdc, 1e18, rWeth);
        uint256 diff = spot > price ? spot - price : price - spot;
        if (diff * MAX_BPS > price * maxSlippageBps) revert PoolPriceDeviation();
    }

    // ================================================================ internal: DEX

    /// @dev Zap up to `maxDeploy` idle USDC (+ any WETH dust) into LP and stake it in the gauge.
    function _deployIdle(uint256 price, uint256 maxDeploy) internal returns (uint256 deployed) {
        uint256 amount = Math.min(usdc.balanceOf(address(this)), maxDeploy);
        if (amount < MIN_DEPLOY) return 0;

        (, uint256 rUsdc) = _reserves();
        uint256 swapIn = _optimalSwapIn(amount, rUsdc, IAerodromePoolFactory(factory).getFee(address(pool), false));
        uint256 minWeth = Math.mulDiv(swapIn, 1e18, price) * (MAX_BPS - maxSlippageBps) / MAX_BPS;
        _swap(address(usdc), address(weth), swapIn, minWeth);

        uint256 wethBal = weth.balanceOf(address(this));
        uint256 usdcLeft = amount - swapIn;
        (, uint256 usdcUsed,) = router.addLiquidity(
            address(weth),
            address(usdc),
            false,
            wethBal,
            usdcLeft,
            wethBal * (MAX_BPS - maxSlippageBps) / MAX_BPS,
            usdcLeft * (MAX_BPS - maxSlippageBps) / MAX_BPS,
            address(this),
            block.timestamp
        );
        gauge.deposit(pool.balanceOf(address(this)));
        deployed = swapIn + usdcUsed;
    }

    /// @dev Unstake + burn `lp`, sell the WETH leg. Oracle floor on the swap when the oracle is healthy.
    function _exitLp(uint256 lp, uint256 price, bool oracleOk) internal returns (uint256 usdcOut) {
        gauge.withdraw(lp);
        (uint256 wethOut, uint256 usdcFromLp) =
            router.removeLiquidity(address(weth), address(usdc), false, lp, 0, 0, address(this), block.timestamp);
        uint256 minOut = oracleOk ? Math.mulDiv(wethOut, price, 1e18) * (MAX_BPS - maxSlippageBps) / MAX_BPS : 0;
        usdcOut = usdcFromLp + (wethOut > 0 ? _swap(address(weth), address(usdc), wethOut, minOut) : 0);
    }

    function _swap(address from, address to, uint256 amountIn, uint256 minOut) internal returns (uint256) {
        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({from: from, to: to, stable: false, factory: factory});
        uint256[] memory amounts =
            router.swapExactTokensForTokens(amountIn, minOut, routes, address(this), block.timestamp);
        return amounts[amounts.length - 1];
    }

    /// @dev Amount of `a` to swap so the remainder matches the post-swap pool ratio. Aerodrome sends the
    ///      fee out of the pool, so reserveIn grows by s*(1-f): solves (F-f)^2 s^2 + (2F-f)F r s - F^2 a r = 0.
    function _optimalSwapIn(uint256 a, uint256 r, uint256 feeBps) internal pure returns (uint256) {
        uint256 F = MAX_BPS;
        uint256 g = F - feeBps;
        uint256 b = (2 * F - feeBps) * r;
        return F * (Math.sqrt(b * b + 4 * g * g * a * r) - b) / (2 * g * g);
    }
}
