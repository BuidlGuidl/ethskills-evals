// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC4626, ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IAeroRouter, IAeroPool, IAeroGauge} from "./interfaces/IAerodrome.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

/// @title AeroUsdcWethVault
/// @notice ERC-4626 USDC vault. Idle USDC is paired with WETH in the Aerodrome vAMM-WETH/USDC pool on Base,
/// the LP is staked in the pool's gauge, and a keeper harvests AERO emissions, sells them for USDC and
/// re-invests.
/// @dev Security model:
///  - Positions are valued with a manipulation-resistant "fair LP" price (sqrt(k * P_oracle)), never with
///    pool spot reserves, so share price cannot be moved by swapping in the pool.
///  - Every swap has an oracle-derived minOut; invest/unwind also require pool spot to be within
///    `maxDeviationBps` of Chainlink and bound total value lost to `maxSlippageBps`.
///  - Exit fee stays in the vault: it covers unwind costs and makes just-in-time harvest sniping unprofitable.
///  - ERC-4626 virtual shares (decimals offset) mitigate first-depositor inflation attacks.
contract AeroUsdcWethVault is ERC4626, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    struct Config {
        IERC20 usdc;
        IERC20 weth;
        IERC20 aero;
        IAeroRouter router;
        IAeroPool pool; // volatile WETH/USDC pool
        IAeroGauge gauge; // gauge for `pool`
        AggregatorV3Interface ethUsdFeed;
        AggregatorV3Interface usdcUsdFeed;
        AggregatorV3Interface sequencerFeed; // address(0) on chains without a sequencer feed
        uint256 ethUsdMaxAge;
        uint256 usdcUsdMaxAge;
        address owner;
        address keeper;
        address treasury;
        uint256 depositCap;
    }

    uint256 internal constant BPS = 10_000;
    uint256 internal constant SEQUENCER_GRACE_PERIOD = 1 hours;
    uint256 internal constant MIN_INVEST = 10e6; // 10 USDC
    uint256 public constant MAX_PERFORMANCE_FEE_BPS = 2_000;
    uint256 public constant MAX_EXIT_FEE_BPS = 100;
    uint256 public constant MAX_SLIPPAGE_BPS = 500;
    uint256 public constant MAX_BUFFER_BPS = 5_000;

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
    uint256 public immutable ethUsdMaxAge;
    uint256 public immutable usdcUsdMaxAge;
    bool internal immutable wethIsToken0;

    address public keeper;
    address public treasury;
    uint256 public depositCap;
    uint256 public performanceFeeBps = 1_000; // 10% of harvested USDC
    uint256 public exitFeeBps = 30; // 0.30%, stays in the vault
    uint256 public maxSlippageBps = 100; // 1%
    uint256 public maxDeviationBps = 100; // 1% pool spot vs Chainlink
    uint256 public bufferBps = 500; // keep 5% of assets idle for cheap withdrawals
    uint256 public lastHarvest;

    event Harvested(uint256 aeroSold, uint256 usdcProfit, uint256 fee);
    event Invested(uint256 usdcIn, uint256 lpMinted);
    event Unwound(uint256 lpBurned, uint256 usdcOut);
    event EmergencyExit(uint256 lpBurned, uint256 usdcOut);
    event KeeperSet(address keeper);
    event TreasurySet(address treasury);
    event DepositCapSet(uint256 cap);
    event FeesSet(uint256 performanceFeeBps, uint256 exitFeeBps);
    event RiskParamsSet(uint256 maxSlippageBps, uint256 maxDeviationBps, uint256 bufferBps);

    error NotKeeper();
    error ZeroAddress();
    error InvalidParam();
    error StaleOracle(address feed);
    error SequencerDown();
    error PriceDeviation(uint256 spot, uint256 oracle);
    error SlippageExceeded(uint256 valueAfter, uint256 minValue);
    error InsufficientLiquidity(uint256 available, uint256 needed);

    constructor(Config memory c)
        ERC4626(c.usdc)
        ERC20("Aero USDC-WETH Vault", "avUSDC")
        Ownable(c.owner)
    {
        if (
            address(c.weth) == address(0) || address(c.aero) == address(0) || address(c.router) == address(0)
                || address(c.pool) == address(0) || address(c.gauge) == address(0)
                || address(c.ethUsdFeed) == address(0) || address(c.usdcUsdFeed) == address(0)
                || c.treasury == address(0) || c.keeper == address(0)
        ) revert ZeroAddress();
        if (IERC20Metadata(address(c.usdc)).decimals() != 6 || IERC20Metadata(address(c.weth)).decimals() != 18) {
            revert InvalidParam();
        }
        if (c.ethUsdFeed.decimals() != c.usdcUsdFeed.decimals()) revert InvalidParam();
        if (c.pool.stable() || c.gauge.stakingToken() != address(c.pool) || c.gauge.rewardToken() != address(c.aero))
        {
            revert InvalidParam();
        }

        address t0 = c.pool.token0();
        address t1 = c.pool.token1();
        if (!(t0 == address(c.weth) && t1 == address(c.usdc)) && !(t0 == address(c.usdc) && t1 == address(c.weth))) {
            revert InvalidParam();
        }
        wethIsToken0 = t0 == address(c.weth);

        // All swaps (USDC<->WETH, AERO->USDC) route through volatile pools of the router's default factory.
        factory = c.router.defaultFactory();

        usdc = c.usdc;
        weth = c.weth;
        aero = c.aero;
        router = c.router;
        pool = c.pool;
        gauge = c.gauge;
        ethUsdFeed = c.ethUsdFeed;
        usdcUsdFeed = c.usdcUsdFeed;
        sequencerFeed = c.sequencerFeed;
        ethUsdMaxAge = c.ethUsdMaxAge;
        usdcUsdMaxAge = c.usdcUsdMaxAge;
        keeper = c.keeper;
        treasury = c.treasury;
        depositCap = c.depositCap;

        // Router and gauge are immutable, audited Aerodrome contracts.
        c.usdc.forceApprove(address(c.router), type(uint256).max);
        c.weth.forceApprove(address(c.router), type(uint256).max);
        c.aero.forceApprove(address(c.router), type(uint256).max);
        IERC20(address(c.pool)).forceApprove(address(c.router), type(uint256).max);
        IERC20(address(c.pool)).forceApprove(address(c.gauge), type(uint256).max);
    }

    // ---------------------------------------------------------------------
    // ERC-4626 overrides
    // ---------------------------------------------------------------------

    /// @notice Idle USDC + idle WETH + staked/unstaked LP, all valued at Chainlink prices.
    /// Unharvested AERO is intentionally excluded (it is realised at harvest).
    function totalAssets() public view override returns (uint256) {
        uint256 idle = usdc.balanceOf(address(this));
        uint256 wethBal = weth.balanceOf(address(this));
        uint256 lp = _totalLp();
        if (wethBal == 0 && lp == 0) return idle; // no oracle dependency when fully in USDC
        uint256 price = ethPrice();
        return idle + _wethToUsdc(wethBal, price) + _lpToUsdc(lp, price);
    }

    function maxDeposit(address) public view override returns (uint256) {
        if (paused()) return 0;
        uint256 assets = totalAssets();
        return assets >= depositCap ? 0 : depositCap - assets;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return _convertToShares(maxDeposit(receiver), Math.Rounding.Floor);
    }

    /// @dev Account for exit fee so `withdraw(maxWithdraw(owner))` succeeds.
    function maxWithdraw(address owner_) public view override returns (uint256) {
        return previewRedeem(balanceOf(owner_));
    }

    function previewRedeem(uint256 shares) public view override returns (uint256) {
        uint256 assets = super.previewRedeem(shares);
        return assets - assets.mulDiv(exitFeeBps, BPS + exitFeeBps, Math.Rounding.Ceil);
    }

    function previewWithdraw(uint256 assets) public view override returns (uint256) {
        return super.previewWithdraw(assets + assets.mulDiv(exitFeeBps, BPS, Math.Rounding.Ceil));
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    /// @dev Pulls liquidity out of the pool when idle USDC is not enough to pay the withdrawal.
    function _withdraw(address caller, address receiver, address owner_, uint256 assets, uint256 shares)
        internal
        override
    {
        uint256 idle = usdc.balanceOf(address(this));
        if (idle < assets) {
            _freeUsdc(assets - idle);
            idle = usdc.balanceOf(address(this));
            if (idle < assets) revert InsufficientLiquidity(idle, assets);
        }
        super._withdraw(caller, receiver, owner_, assets, shares);
    }

    // ---------------------------------------------------------------------
    // Keeper
    // ---------------------------------------------------------------------

    /// @notice Claim AERO, sell it for USDC, take the performance fee, and invest idle USDC.
    /// @param minUsdcOut Minimum USDC for the whole AERO sale; keeper derives it from an off-chain price.
    function harvest(uint256 minUsdcOut) external nonReentrant returns (uint256 profit) {
        if (msg.sender != keeper && msg.sender != owner()) revert NotKeeper();

        if (gauge.balanceOf(address(this)) > 0) gauge.getReward(address(this));

        uint256 aeroBal = aero.balanceOf(address(this));
        uint256 fee;
        if (aeroBal > 0) {
            uint256 before = usdc.balanceOf(address(this));
            _swap(aero, usdc, aeroBal, minUsdcOut);
            profit = usdc.balanceOf(address(this)) - before;
            fee = profit * performanceFeeBps / BPS;
            if (fee > 0) usdc.safeTransfer(treasury, fee);
        }
        lastHarvest = block.timestamp;
        emit Harvested(aeroBal, profit, fee);

        if (!paused()) _invest();
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice USDC (6 dec) per 1 WETH, from Chainlink ETH/USD and USDC/USD with staleness + sequencer checks.
    function ethPrice() public view returns (uint256) {
        _checkSequencer();
        uint256 ethUsd = _readFeed(ethUsdFeed, ethUsdMaxAge);
        uint256 usdcUsd = _readFeed(usdcUsdFeed, usdcUsdMaxAge);
        return ethUsd * 1e6 / usdcUsd;
    }

    /// @notice Total LP owned by the vault (staked in gauge + held).
    function totalLp() external view returns (uint256) {
        return _totalLp();
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setKeeper(address k) external onlyOwner {
        if (k == address(0)) revert ZeroAddress();
        keeper = k;
        emit KeeperSet(k);
    }

    function setTreasury(address t) external onlyOwner {
        if (t == address(0)) revert ZeroAddress();
        treasury = t;
        emit TreasurySet(t);
    }

    function setDepositCap(uint256 cap) external onlyOwner {
        depositCap = cap;
        emit DepositCapSet(cap);
    }

    function setFees(uint256 perfBps, uint256 exitBps) external onlyOwner {
        if (perfBps > MAX_PERFORMANCE_FEE_BPS || exitBps > MAX_EXIT_FEE_BPS) revert InvalidParam();
        performanceFeeBps = perfBps;
        exitFeeBps = exitBps;
        emit FeesSet(perfBps, exitBps);
    }

    function setRiskParams(uint256 slippageBps, uint256 deviationBps, uint256 bufBps) external onlyOwner {
        if (slippageBps == 0 || slippageBps > MAX_SLIPPAGE_BPS) revert InvalidParam();
        if (deviationBps == 0 || deviationBps > MAX_SLIPPAGE_BPS || bufBps > MAX_BUFFER_BPS) revert InvalidParam();
        maxSlippageBps = slippageBps;
        maxDeviationBps = deviationBps;
        bufferBps = bufBps;
        emit RiskParamsSet(slippageBps, deviationBps, bufBps);
    }

    /// @notice Pause new deposits and investing. Withdrawals stay open.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Pull everything out of Aerodrome into USDC and pause. Uses no oracle, so it works even if
    /// Chainlink is stale; the owner supplies `minUsdcOut` computed off-chain.
    function emergencyExit(uint256 minUsdcOut) external onlyOwner nonReentrant {
        if (!paused()) _pause();
        uint256 before = usdc.balanceOf(address(this));
        uint256 lp = _totalLp();
        if (lp > 0) {
            _unstake(lp);
            router.removeLiquidity(
                address(weth), address(usdc), false, lp, 0, 0, address(this), block.timestamp
            );
        }
        uint256 wethBal = weth.balanceOf(address(this));
        if (wethBal > 0) _swap(weth, usdc, wethBal, 0);
        uint256 out = usdc.balanceOf(address(this)) - before;
        if (out < minUsdcOut) revert SlippageExceeded(out, minUsdcOut);
        emit EmergencyExit(lp, out);
    }

    // ---------------------------------------------------------------------
    // Strategy internals
    // ---------------------------------------------------------------------

    /// @dev Swap ~half of investable USDC to WETH, add liquidity, stake LP. Leftover dust stays idle.
    /// Invest size is capped by pool depth, so large idle balances are deployed over several harvests.
    function _invest() internal {
        uint256 idle = usdc.balanceOf(address(this));
        uint256 buffer = totalAssets() * bufferBps / BPS;
        if (idle <= buffer + MIN_INVEST) return;
        uint256 amount = idle - buffer;

        uint256 price = ethPrice();
        _checkSpot(price);
        uint256 valueBefore = totalAssets();

        // Cap the swap so its price impact stays well inside maxSlippageBps; the rest is invested next harvest.
        (, uint256 rUsdc) = _reserves();
        uint256 half = Math.min(amount / 2, rUsdc * maxSlippageBps / (4 * BPS));
        amount = 2 * half;
        uint256 minWeth = half.mulDiv(1e18, price) * (BPS - maxSlippageBps) / BPS;
        _swap(usdc, weth, half, minWeth);

        (,, uint256 lp) = router.addLiquidity(
            address(weth),
            address(usdc),
            false,
            weth.balanceOf(address(this)),
            amount - half,
            0,
            0,
            address(this),
            block.timestamp
        );
        gauge.deposit(pool.balanceOf(address(this)));

        _checkValueKept(valueBefore, amount);
        emit Invested(amount, lp);
    }

    /// @dev Unwind enough LP (plus a slippage margin) to raise `needed` USDC.
    function _freeUsdc(uint256 needed) internal {
        uint256 lpTotal = _totalLp();
        uint256 price = ethPrice();
        uint256 usdcBefore = usdc.balanceOf(address(this));

        uint256 lp;
        if (lpTotal > 0) {
            _checkSpot(price);
            uint256 lpValue = _lpToUsdc(lpTotal, price);
            lp = needed.mulDiv(lpTotal, lpValue, Math.Rounding.Ceil) * (BPS + maxSlippageBps) / BPS;
            if (lp > lpTotal) lp = lpTotal;
        }
        uint256 valueBefore = totalAssets();
        uint256 valueOut = _lpToUsdc(lp, price) + _wethToUsdc(weth.balanceOf(address(this)), price);

        if (lp > 0) {
            _unstake(lp);
            router.removeLiquidity(address(weth), address(usdc), false, lp, 0, 0, address(this), block.timestamp);
        }
        uint256 wethBal = weth.balanceOf(address(this));
        if (wethBal > 0) {
            _swap(weth, usdc, wethBal, _wethToUsdc(wethBal, price) * (BPS - maxSlippageBps) / BPS);
        }

        _checkValueKept(valueBefore, valueOut);
        emit Unwound(lp, usdc.balanceOf(address(this)) - usdcBefore);
    }

    function _unstake(uint256 lp) internal {
        uint256 held = pool.balanceOf(address(this));
        if (lp > held) gauge.withdraw(lp - held);
    }

    function _swap(IERC20 from, IERC20 to, uint256 amountIn, uint256 minOut) internal {
        IAeroRouter.Route[] memory routes = new IAeroRouter.Route[](1);
        routes[0] = IAeroRouter.Route(address(from), address(to), false, factory);
        router.swapExactTokensForTokens(amountIn, minOut, routes, address(this), block.timestamp);
    }

    /// @dev Total vault value may drop by at most `maxSlippageBps` of the amount moved.
    function _checkValueKept(uint256 valueBefore, uint256 amountMoved) internal view {
        uint256 minValue = valueBefore - amountMoved * maxSlippageBps / BPS;
        uint256 valueAfter = totalAssets();
        if (valueAfter < minValue) revert SlippageExceeded(valueAfter, minValue);
    }

    /// @dev Reject if pool spot price is too far from Chainlink (pool being manipulated or stale oracle).
    function _checkSpot(uint256 price) internal view {
        (uint256 rWeth, uint256 rUsdc) = _reserves();
        uint256 spot = rUsdc * 1e18 / rWeth;
        uint256 diff = spot > price ? spot - price : price - spot;
        if (diff * BPS > price * maxDeviationBps) revert PriceDeviation(spot, price);
    }

    /// @dev Fair LP value: value = 2 * sqrt(k * P) * lp / supply. Independent of the pool's spot ratio, so it
    /// cannot be pushed around with swaps or flash loans (Alpha Homora "fair LP pricing").
    function _lpToUsdc(uint256 lp, uint256 price) internal view returns (uint256) {
        if (lp == 0) return 0;
        (uint256 rWeth, uint256 rUsdc) = _reserves();
        uint256 fairUsdcReserve = Math.sqrt(rWeth.mulDiv(rUsdc * price, 1e18));
        return (2 * fairUsdcReserve).mulDiv(lp, pool.totalSupply());
    }

    function _wethToUsdc(uint256 amount, uint256 price) internal pure returns (uint256) {
        return amount.mulDiv(price, 1e18);
    }

    function _reserves() internal view returns (uint256 rWeth, uint256 rUsdc) {
        (uint256 r0, uint256 r1,) = pool.getReserves();
        (rWeth, rUsdc) = wethIsToken0 ? (r0, r1) : (r1, r0);
    }

    function _totalLp() internal view returns (uint256) {
        return pool.balanceOf(address(this)) + gauge.balanceOf(address(this));
    }

    function _readFeed(AggregatorV3Interface feed, uint256 maxAge) internal view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        if (answer <= 0 || updatedAt == 0 || block.timestamp - updatedAt > maxAge) revert StaleOracle(address(feed));
        // forge-lint: disable-next-line(unsafe-typecast) answer > 0 checked above
        return uint256(answer);
    }

    function _checkSequencer() internal view {
        if (address(sequencerFeed) == address(0)) return;
        (, int256 answer, uint256 startedAt,,) = sequencerFeed.latestRoundData();
        // answer 0 = up; also wait a grace period after it comes back so feeds can catch up.
        if (answer != 0 || startedAt == 0 || block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
            revert SequencerDown();
        }
    }
}
