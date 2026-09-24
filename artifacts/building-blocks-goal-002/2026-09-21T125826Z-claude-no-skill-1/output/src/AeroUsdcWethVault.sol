// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IAeroRouter, IAeroPool, IAeroGauge} from "./interfaces/IAerodrome.sol";
import {AggregatorV3Interface} from "./interfaces/IChainlink.sol";

/// @title AeroUsdcWethVault
/// @notice USDC vault on Base. Idle USDC is paired with WETH in the Aerodrome vAMM USDC/WETH pool and the
///         LP is staked in the pool's gauge. A keeper calls `harvest()` to claim AERO emissions, sell them for
///         USDC and re-invest all idle funds.
/// @dev Pricing and safety model:
///      - Share price (deposits) uses `totalAssets()`, which values LP with the manipulation-resistant
///        "fair reserves" formula (2 * sqrt(k * P)) using Chainlink prices, never pool spot reserves.
///      - Redemptions are pro-rata: a redeemer gets its share of idle USDC, idle WETH and LP, so exits do not
///        depend on valuation at all. WETH is sold for USDC with an oracle-bounded minimum; `redeemInKind`
///        skips swaps and oracles entirely and is always available as an escape hatch.
///      - Every swap / liquidity add is bounded against Chainlink: pool spot must be within `maxSlippageBps`
///        of the oracle and swap outputs must be at least oracle value minus `maxSlippageBps`.
contract AeroUsdcWethVault is ERC20, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Config {
        address usdc;
        address weth;
        address aero;
        address router;
        address pool;
        address gauge;
        address ethUsdFeed;
        address usdcUsdFeed;
        address sequencerFeed;
        uint256 ethUsdHeartbeat;
        uint256 usdcUsdHeartbeat;
        address owner;
        address keeper;
        uint256 depositCap;
    }

    // --- constants ---
    uint256 public constant MAX_BPS = 10_000;
    uint256 public constant MAX_SLIPPAGE_CAP_BPS = 500; // owner can never set tolerance above 5%
    uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
    /// @dev Virtual shares/assets offset against first-depositor inflation attacks (shares have 18 decimals,
    ///      USDC has 6, so 1 USDC wei ~= 1e12 share wei).
    uint256 internal constant SHARE_OFFSET = 1e12;
    /// @dev Converts (WETH wei * USDC-per-ETH wad) to USDC wei: 1e18 (wad) * 1e12 (18 - 6 decimals).
    uint256 internal constant WETH_USDC_SCALE = 1e30;
    bool internal constant STABLE = false;

    // --- immutables ---
    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    IERC20 public immutable aero;
    IAeroRouter public immutable router;
    IAeroPool public immutable pool;
    IAeroGauge public immutable gauge;
    address public immutable factory;
    AggregatorV3Interface public immutable ethUsdFeed;
    AggregatorV3Interface public immutable usdcUsdFeed;
    AggregatorV3Interface public immutable sequencerFeed;
    uint256 public immutable ethUsdHeartbeat;
    uint256 public immutable usdcUsdHeartbeat;
    bool internal immutable usdcIsToken0;

    // --- config ---
    address public keeper;
    uint256 public depositCap;
    uint256 public maxSlippageBps = 100;
    uint256 public minInvestUsdc = 10e6;
    IAeroRouter.Route[] internal rewardRoutes;

    // --- events ---
    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event Redeem(address indexed caller, address indexed receiver, address indexed owner, uint256 shares, uint256 usdcOut);
    event RedeemInKind(
        address indexed caller, address indexed receiver, address indexed owner, uint256 shares, uint256 usdcOut, uint256 wethOut
    );
    event Harvest(uint256 aeroClaimed, uint256 usdcFromRewards, uint256 lpStaked, uint256 totalAssetsAfter);
    event EmergencyExit(uint256 lpUnstaked);
    event KeeperSet(address keeper);
    event DepositCapSet(uint256 cap);
    event MaxSlippageSet(uint256 bps);
    event MinInvestSet(uint256 amount);
    event RewardRoutesSet(uint256 hops);

    // --- errors ---
    error ZeroAmount();
    error ZeroAddress();
    error CapExceeded();
    error NotKeeper();
    error SlippageTooHigh();
    error InsufficientOutput(uint256 out, uint256 min);
    error PoolPriceDeviation(uint256 spot, uint256 oracle);
    error BadOraclePrice();
    error StaleOracle();
    error SequencerDown();
    error InvalidConfig();
    error InvalidRoute();
    error ProtectedToken();

    modifier onlyKeeper() {
        if (msg.sender != keeper && msg.sender != owner()) revert NotKeeper();
        _;
    }

    constructor(Config memory c) ERC20("Aerodrome USDC/WETH Vault", "aeroUSDC") Ownable(c.owner) {
        if (
            c.usdc == address(0) || c.weth == address(0) || c.aero == address(0) || c.router == address(0)
                || c.pool == address(0) || c.gauge == address(0) || c.ethUsdFeed == address(0)
                || c.usdcUsdFeed == address(0) || c.sequencerFeed == address(0) || c.keeper == address(0)
        ) revert ZeroAddress();
        if (IERC20Metadata(c.usdc).decimals() != 6 || IERC20Metadata(c.weth).decimals() != 18) revert InvalidConfig();

        address factory_ = IAeroRouter(c.router).defaultFactory();
        if (IAeroRouter(c.router).poolFor(c.usdc, c.weth, STABLE, factory_) != c.pool) revert InvalidConfig();
        if (IAeroPool(c.pool).stable()) revert InvalidConfig();
        if (IAeroGauge(c.gauge).stakingToken() != c.pool || IAeroGauge(c.gauge).rewardToken() != c.aero) {
            revert InvalidConfig();
        }

        usdc = IERC20(c.usdc);
        weth = IERC20(c.weth);
        aero = IERC20(c.aero);
        router = IAeroRouter(c.router);
        pool = IAeroPool(c.pool);
        gauge = IAeroGauge(c.gauge);
        factory = factory_;
        ethUsdFeed = AggregatorV3Interface(c.ethUsdFeed);
        usdcUsdFeed = AggregatorV3Interface(c.usdcUsdFeed);
        sequencerFeed = AggregatorV3Interface(c.sequencerFeed);
        ethUsdHeartbeat = c.ethUsdHeartbeat;
        usdcUsdHeartbeat = c.usdcUsdHeartbeat;
        usdcIsToken0 = IAeroPool(c.pool).token0() == c.usdc;

        keeper = c.keeper;
        depositCap = c.depositCap;

        // Default reward route: AERO -> USDC through the Aerodrome volatile pool.
        rewardRoutes.push(IAeroRouter.Route(c.aero, c.usdc, false, factory_));

        IERC20(c.usdc).forceApprove(c.router, type(uint256).max);
        IERC20(c.weth).forceApprove(c.router, type(uint256).max);
        IERC20(c.aero).forceApprove(c.router, type(uint256).max);
        IERC20(c.pool).forceApprove(c.router, type(uint256).max);
        IERC20(c.pool).forceApprove(c.gauge, type(uint256).max);
    }

    // =============================================================
    //                         USER ACTIONS
    // =============================================================

    /// @notice Deposit USDC and mint shares. Funds sit idle until the next `harvest()` invests them.
    function deposit(uint256 assets, address receiver) external nonReentrant whenNotPaused returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();
        uint256 total = totalAssets();
        if (total + assets > depositCap) revert CapExceeded();

        shares = Math.mulDiv(assets, totalSupply() + SHARE_OFFSET, total + 1);
        if (shares == 0) revert ZeroAmount();

        usdc.safeTransferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /// @notice Burn shares for USDC. Unwinds the pro-rata slice of the position and sells the WETH leg.
    /// @param minUsdcOut caller's own minimum, checked on top of the oracle-based bound.
    function redeem(uint256 shares, address receiver, address owner_, uint256 minUsdcOut)
        external
        nonReentrant
        returns (uint256 usdcOut)
    {
        if (receiver == address(0)) revert ZeroAddress();
        // Oracle value of the slice, computed before anything moves.
        uint256 fairValue = previewRedeem(shares);

        (uint256 usdcAmt, uint256 wethAmt) = _exitSlice(shares, owner_, 0, 0);
        if (wethAmt > 0) usdcAmt += _swap(address(weth), address(usdc), wethAmt, 0);

        uint256 minOut = Math.max(minUsdcOut, fairValue * (MAX_BPS - maxSlippageBps) / MAX_BPS);
        if (usdcAmt < minOut) revert InsufficientOutput(usdcAmt, minOut);

        usdcOut = usdcAmt;
        usdc.safeTransfer(receiver, usdcOut);
        emit Redeem(msg.sender, receiver, owner_, shares, usdcOut);
    }

    /// @notice Escape hatch: burn shares for the pro-rata USDC + WETH. Uses no oracle and no swaps, so it
    ///         works when feeds are stale, the sequencer flag is down or the vault is paused.
    function redeemInKind(uint256 shares, address receiver, address owner_, uint256 minUsdcOut, uint256 minWethOut)
        external
        nonReentrant
        returns (uint256 usdcOut, uint256 wethOut)
    {
        if (receiver == address(0)) revert ZeroAddress();
        (usdcOut, wethOut) = _exitSlice(shares, owner_, minUsdcOut, minWethOut);
        usdc.safeTransfer(receiver, usdcOut);
        weth.safeTransfer(receiver, wethOut);
        emit RedeemInKind(msg.sender, receiver, owner_, shares, usdcOut, wethOut);
    }

    // =============================================================
    //                            KEEPER
    // =============================================================

    /// @notice Claim AERO, sell it for USDC and invest all idle USDC/WETH into staked LP.
    /// @param minUsdcFromRewards minimum USDC for the AERO sale (keeper quotes it off-chain; there is no
    ///        AERO oracle in the vault). Ignored when there is no AERO to sell.
    /// @param maxInvestUsdc max idle USDC to put to work in this call. Lets the keeper chunk large idle
    ///        balances so each swap stays inside the slippage bound; the rest waits for the next call.
    function harvest(uint256 minUsdcFromRewards, uint256 maxInvestUsdc)
        external
        onlyKeeper
        nonReentrant
        whenNotPaused
        returns (uint256 usdcFromRewards, uint256 lpStaked)
    {
        uint256 aeroBefore = aero.balanceOf(address(this));
        gauge.getReward(address(this));
        uint256 aeroBal = aero.balanceOf(address(this));

        if (aeroBal > 0) {
            usdcFromRewards = _swapRewards(aeroBal, minUsdcFromRewards);
        }
        lpStaked = _invest(maxInvestUsdc);
        emit Harvest(aeroBal - aeroBefore, usdcFromRewards, lpStaked, totalAssets());
    }

    // =============================================================
    //                             VIEWS
    // =============================================================

    /// @notice Vault value in USDC: idle USDC + idle WETH + LP (staked and unstaked), priced by Chainlink.
    ///         Unclaimed AERO is not counted.
    function totalAssets() public view returns (uint256) {
        uint256 price = ethPriceInUsdc();
        return usdc.balanceOf(address(this)) + _wethToUsdc(weth.balanceOf(address(this)), price)
            + _lpToUsdc(lpBalance(), price);
    }

    function lpBalance() public view returns (uint256) {
        return gauge.balanceOf(address(this)) + pool.balanceOf(address(this));
    }

    /// @notice Shares minted for `assets` at the current price.
    function previewDeposit(uint256 assets) external view returns (uint256) {
        return Math.mulDiv(assets, totalSupply() + SHARE_OFFSET, totalAssets() + 1);
    }

    /// @notice Oracle value (USDC) of the pro-rata slice for `shares`, before swap costs.
    function previewRedeem(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        return Math.mulDiv(totalAssets(), shares, supply);
    }

    /// @notice USDC per 1 WETH, 18-decimal fixed point (ETH/USD divided by USDC/USD).
    function ethPriceInUsdc() public view returns (uint256) {
        _checkSequencer();
        uint256 ethUsd = _readFeed(ethUsdFeed, ethUsdHeartbeat);
        uint256 usdcUsd = _readFeed(usdcUsdFeed, usdcUsdHeartbeat);
        return Math.mulDiv(ethUsd, 1e18, usdcUsd);
    }

    function pendingRewards() external view returns (uint256) {
        return gauge.earned(address(this));
    }

    function getRewardRoutes() external view returns (IAeroRouter.Route[] memory) {
        return rewardRoutes;
    }

    // =============================================================
    //                             ADMIN
    // =============================================================

    function setKeeper(address keeper_) external onlyOwner {
        if (keeper_ == address(0)) revert ZeroAddress();
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    function setDepositCap(uint256 cap) external onlyOwner {
        depositCap = cap;
        emit DepositCapSet(cap);
    }

    function setMaxSlippageBps(uint256 bps) external onlyOwner {
        if (bps > MAX_SLIPPAGE_CAP_BPS) revert SlippageTooHigh();
        maxSlippageBps = bps;
        emit MaxSlippageSet(bps);
    }

    function setMinInvestUsdc(uint256 amount) external onlyOwner {
        minInvestUsdc = amount;
        emit MinInvestSet(amount);
    }

    /// @notice Replace the AERO -> USDC route. Must start at AERO, end at USDC, be contiguous and only use
    ///         Aerodrome's default factory (so a route cannot point at an attacker-deployed pool).
    function setRewardRoutes(IAeroRouter.Route[] calldata routes) external onlyOwner {
        uint256 n = routes.length;
        if (n == 0 || routes[0].from != address(aero) || routes[n - 1].to != address(usdc)) revert InvalidRoute();
        delete rewardRoutes;
        for (uint256 i; i < n; ++i) {
            if (routes[i].factory != factory) revert InvalidRoute();
            if (i > 0 && routes[i].from != routes[i - 1].to) revert InvalidRoute();
            rewardRoutes.push(routes[i]);
        }
        emit RewardRoutesSet(n);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Unstake and withdraw all liquidity to idle USDC/WETH and pause deposits/harvests.
    ///         Users keep exiting via `redeem` / `redeemInKind`.
    /// @param minUsdc minimum USDC from removing liquidity
    /// @param minWeth minimum WETH from removing liquidity
    function emergencyExit(uint256 minUsdc, uint256 minWeth) external onlyOwner nonReentrant {
        uint256 staked = gauge.balanceOf(address(this));
        if (staked > 0) gauge.withdraw(staked);
        uint256 lp = pool.balanceOf(address(this));
        if (lp > 0) _removeLiquidity(lp, minUsdc, minWeth);
        if (!paused()) _pause();
        emit EmergencyExit(staked);
    }

    /// @notice Recover tokens sent here by mistake. Vault tokens (USDC, WETH, AERO, LP, shares) are protected.
    function sweep(address token, address to) external onlyOwner {
        if (
            token == address(usdc) || token == address(weth) || token == address(aero) || token == address(pool)
                || token == address(this)
        ) revert ProtectedToken();
        IERC20(token).safeTransfer(to, IERC20(token).balanceOf(address(this)));
    }

    // =============================================================
    //                           INTERNALS
    // =============================================================

    /// @dev Burns `shares` and frees the pro-rata idle USDC/WETH plus pro-rata LP (unstaked and removed).
    function _exitSlice(uint256 shares, address owner_, uint256 minUsdc, uint256 minWeth)
        internal
        returns (uint256 usdcAmt, uint256 wethAmt)
    {
        if (shares == 0) revert ZeroAmount();
        if (msg.sender != owner_) _spendAllowance(owner_, msg.sender, shares);

        uint256 supply = totalSupply();
        usdcAmt = Math.mulDiv(usdc.balanceOf(address(this)), shares, supply);
        wethAmt = Math.mulDiv(weth.balanceOf(address(this)), shares, supply);
        uint256 lpIdle = pool.balanceOf(address(this));
        uint256 lpStaked = gauge.balanceOf(address(this));
        uint256 lpAmt = Math.mulDiv(lpIdle + lpStaked, shares, supply);

        _burn(owner_, shares);

        if (lpAmt > 0) {
            if (lpAmt > lpIdle) gauge.withdraw(lpAmt - lpIdle);
            (uint256 u, uint256 w) = _removeLiquidity(lpAmt, 0, 0);
            usdcAmt += u;
            wethAmt += w;
        }
        if (usdcAmt < minUsdc) revert InsufficientOutput(usdcAmt, minUsdc);
        if (wethAmt < minWeth) revert InsufficientOutput(wethAmt, minWeth);
    }

    /// @dev Balances up to `maxUsdc` idle USDC plus all idle WETH to ~50/50 by oracle value, adds liquidity
    ///      and stakes all LP.
    function _invest(uint256 maxUsdc) internal returns (uint256 lpStaked) {
        uint256 price = ethPriceInUsdc();
        uint256 u = Math.min(usdc.balanceOf(address(this)), maxUsdc);
        uint256 wethValue = _wethToUsdc(weth.balanceOf(address(this)), price);

        if (u + wethValue >= minInvestUsdc) {
            _checkPoolPrice(price);
            if (u > wethValue) {
                uint256 usdcIn = (u - wethValue) / 2;
                _swap(address(usdc), address(weth), usdcIn, _applySlippage(_usdcToWeth(usdcIn, price)));
                u -= usdcIn;
            } else if (wethValue > u) {
                uint256 wethIn = _usdcToWeth((wethValue - u) / 2, price);
                u += _swap(address(weth), address(usdc), wethIn, _applySlippage(_wethToUsdc(wethIn, price)));
            }
            // Re-check after our own swap moved the pool; the add is then executed at a near-oracle ratio.
            _checkPoolPrice(price);

            uint256 w = weth.balanceOf(address(this));
            // Spot is within tolerance of the oracle and the amounts are balanced at the oracle price, so
            // each side can be used at least (1 - 2 * tolerance) of the desired amount.
            uint256 minFactor = MAX_BPS - 2 * maxSlippageBps;
            router.addLiquidity(
                address(usdc),
                address(weth),
                STABLE,
                u,
                w,
                u * minFactor / MAX_BPS,
                w * minFactor / MAX_BPS,
                address(this),
                block.timestamp
            );
        }

        lpStaked = pool.balanceOf(address(this));
        if (lpStaked > 0) gauge.deposit(lpStaked);
    }

    function _swapRewards(uint256 amountIn, uint256 minOut) internal returns (uint256 out) {
        uint256 before = usdc.balanceOf(address(this));
        router.swapExactTokensForTokens(amountIn, minOut, rewardRoutes, address(this), block.timestamp);
        out = usdc.balanceOf(address(this)) - before;
    }

    function _swap(address from, address to, uint256 amountIn, uint256 minOut) internal returns (uint256 out) {
        if (amountIn == 0) return 0;
        IAeroRouter.Route[] memory route = new IAeroRouter.Route[](1);
        route[0] = IAeroRouter.Route(from, to, STABLE, factory);
        uint256 before = IERC20(to).balanceOf(address(this));
        router.swapExactTokensForTokens(amountIn, minOut, route, address(this), block.timestamp);
        out = IERC20(to).balanceOf(address(this)) - before;
    }

    function _removeLiquidity(uint256 lp, uint256 minUsdc, uint256 minWeth)
        internal
        returns (uint256 usdcAmt, uint256 wethAmt)
    {
        (usdcAmt, wethAmt) = router.removeLiquidity(
            address(usdc), address(weth), STABLE, lp, minUsdc, minWeth, address(this), block.timestamp
        );
    }

    /// @dev Reverts if pool spot price (USDC per WETH) deviates from the oracle by more than `maxSlippageBps`.
    function _checkPoolPrice(uint256 oraclePrice) internal view {
        (uint256 rUsdc, uint256 rWeth) = _reserves();
        if (rWeth == 0) revert PoolPriceDeviation(0, oraclePrice);
        uint256 spot = Math.mulDiv(rUsdc, WETH_USDC_SCALE, rWeth);
        uint256 diff = spot > oraclePrice ? spot - oraclePrice : oraclePrice - spot;
        if (diff * MAX_BPS > oraclePrice * maxSlippageBps) revert PoolPriceDeviation(spot, oraclePrice);
    }

    /// @dev Fair LP value: for x*y=k the arbitrage-free reserves at price P are x = sqrt(k*P), y = sqrt(k/P),
    ///      so pool value = 2 * sqrt(k * P). Depends only on k and the oracle, not on the (manipulable) ratio.
    function _lpToUsdc(uint256 lp, uint256 price) internal view returns (uint256) {
        if (lp == 0) return 0;
        (uint256 rUsdc, uint256 rWeth) = _reserves();
        uint256 fairUsdcReserve = Math.sqrt(Math.mulDiv(rUsdc * rWeth, price, WETH_USDC_SCALE));
        return Math.mulDiv(2 * fairUsdcReserve, lp, pool.totalSupply());
    }

    function _reserves() internal view returns (uint256 rUsdc, uint256 rWeth) {
        (uint256 r0, uint256 r1,) = pool.getReserves();
        (rUsdc, rWeth) = usdcIsToken0 ? (r0, r1) : (r1, r0);
    }

    function _wethToUsdc(uint256 amount, uint256 price) internal pure returns (uint256) {
        return Math.mulDiv(amount, price, WETH_USDC_SCALE);
    }

    function _usdcToWeth(uint256 amount, uint256 price) internal pure returns (uint256) {
        return Math.mulDiv(amount, WETH_USDC_SCALE, price);
    }

    function _applySlippage(uint256 amount) internal view returns (uint256) {
        return amount * (MAX_BPS - maxSlippageBps) / MAX_BPS;
    }

    /// @dev Returns the feed answer scaled to 18 decimals after sanity and staleness checks.
    function _readFeed(AggregatorV3Interface feed, uint256 heartbeat) internal view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        if (answer <= 0) revert BadOraclePrice();
        if (updatedAt == 0 || block.timestamp - updatedAt > heartbeat) revert StaleOracle();
        return uint256(answer) * 10 ** (18 - feed.decimals());
    }

    /// @dev Chainlink L2 sequencer uptime feed: answer 0 = up. After a restart, wait a grace period so
    ///      feeds can catch up before prices are trusted.
    function _checkSequencer() internal view {
        (, int256 answer, uint256 startedAt,,) = sequencerFeed.latestRoundData();
        if (answer != 0 || startedAt == 0 || block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
            revert SequencerDown();
        }
    }
}
