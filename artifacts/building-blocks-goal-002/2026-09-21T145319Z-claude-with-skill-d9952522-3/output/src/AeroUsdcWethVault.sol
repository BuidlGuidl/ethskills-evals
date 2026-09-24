// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IAeroRouter, IAeroPool, IAeroPoolFactory, IAeroGauge, IChainlinkFeed} from "./interfaces/IAerodrome.sol";

/// @title AeroUsdcWethVault
/// @notice Users deposit USDC. The vault zaps it into the Aerodrome volatile WETH/USDC pool,
///         stakes the LP in the pool's gauge and a keeper periodically harvests AERO emissions,
///         sells them for USDC and re-adds liquidity (compounding).
/// @dev Shares are a pro-rata claim on the vault's LP (staked + idle). Staked LP does NOT earn
///      swap fees on Aerodrome: gauge-staked fees go to veAERO voters. The yield is AERO only.
contract AeroUsdcWethVault is ERC20, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- constants ---
    uint256 public constant MAX_BPS = 10_000;
    uint256 public constant MAX_PERFORMANCE_FEE_BPS = 2_000; // 20%
    uint256 public constant MAX_PRICE_DEVIATION_BPS = 500; // 5%
    uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
    uint256 public constant MIN_COMPOUND_USDC = 1e6; // 1 USDC, avoids zero-amount swaps on dust
    /// @dev virtual shares/LP (OZ ERC4626-style offset) against first-depositor donation attacks
    uint256 internal constant VIRTUAL_SHARES = 1e3;
    uint256 internal constant VIRTUAL_LP = 1;

    // --- external integrations ---
    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    IERC20 public immutable aero;
    IAeroRouter public immutable router;
    IAeroPoolFactory public immutable factory;
    IAeroPool public immutable pool;
    IAeroGauge public immutable gauge;
    IChainlinkFeed public immutable ethUsdFeed;
    IChainlinkFeed public immutable sequencerFeed;
    bool internal immutable usdcIsToken0;

    // --- config ---
    address public keeper;
    address public feeRecipient;
    uint256 public performanceFeeBps = 1_000; // 10% of harvested AERO (in USDC)
    uint256 public maxPriceDeviationBps = 100; // pool spot vs Chainlink, 1%
    uint256 public oracleMaxAge = 1 hours; // Base ETH/USD heartbeat is 20 min

    // --- events ---
    event Deposit(address indexed user, uint256 usdcIn, uint256 lpAdded, uint256 shares);
    event Withdraw(address indexed user, uint256 shares, uint256 lpRemoved, uint256 usdcOut);
    event Harvest(uint256 aeroSold, uint256 usdcFromAero, uint256 fee, uint256 lpAdded);
    event KeeperSet(address keeper);
    event FeeRecipientSet(address feeRecipient);
    event PerformanceFeeSet(uint256 bps);
    event OracleParamsSet(uint256 maxPriceDeviationBps, uint256 oracleMaxAge);
    event EmergencyUnstake(uint256 lp);

    // --- errors ---
    error ZeroAmount();
    error ZeroAddress();
    error NotKeeper();
    error BadPool();
    error Slippage();
    error SequencerDown();
    error StaleOracle();
    error PriceDeviation(uint256 spot, uint256 oracle);
    error InvalidParam();

    constructor(
        address _usdc,
        address _weth,
        address _router,
        address _gauge,
        address _ethUsdFeed,
        address _sequencerFeed,
        address _keeper,
        address _feeRecipient,
        address _owner
    ) ERC20("Aerodrome USDC-WETH Vault", "avUSDC-WETH") Ownable(_owner) {
        if (_keeper == address(0) || _feeRecipient == address(0)) revert ZeroAddress();

        usdc = IERC20(_usdc);
        weth = IERC20(_weth);
        router = IAeroRouter(_router);
        factory = IAeroPoolFactory(router.defaultFactory());
        gauge = IAeroGauge(_gauge);
        pool = IAeroPool(gauge.stakingToken());
        aero = IERC20(gauge.rewardToken());
        ethUsdFeed = IChainlinkFeed(_ethUsdFeed);
        sequencerFeed = IChainlinkFeed(_sequencerFeed);

        address t0 = pool.token0();
        address t1 = pool.token1();
        if (pool.stable()) revert BadPool();
        if (!((t0 == _usdc && t1 == _weth) || (t0 == _weth && t1 == _usdc))) revert BadPool();
        usdcIsToken0 = t0 == _usdc;

        keeper = _keeper;
        feeRecipient = _feeRecipient;

        usdc.forceApprove(_router, type(uint256).max);
        weth.forceApprove(_router, type(uint256).max);
        aero.forceApprove(_router, type(uint256).max);
        IERC20(address(pool)).forceApprove(_router, type(uint256).max);
        IERC20(address(pool)).forceApprove(_gauge, type(uint256).max);
    }

    // =============================================================
    //                          USER FLOW
    // =============================================================

    /// @notice Deposit USDC, receive vault shares.
    /// @param minShares slippage guard, computed offsite via previewDeposit-like simulation
    function deposit(uint256 usdcAmount, uint256 minShares)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 shares)
    {
        if (usdcAmount == 0) revert ZeroAmount();
        _checkPrice();

        uint256 lpBefore = totalLp();
        uint256 supply = totalSupply();

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        uint256 lp = _zap(usdcAmount, 0);
        gauge.deposit(lp);

        shares = Math.mulDiv(lp, supply + VIRTUAL_SHARES, lpBefore + VIRTUAL_LP);
        if (shares == 0 || shares < minShares) revert Slippage();
        _mint(msg.sender, shares);

        emit Deposit(msg.sender, usdcAmount, lp, shares);
    }

    /// @notice Burn shares, receive USDC. Works while paused so users can always exit.
    /// @dev No oracle check here on purpose (exit must not depend on the oracle); minUsdcOut is the guard.
    function withdraw(uint256 shares, uint256 minUsdcOut) external nonReentrant returns (uint256 usdcOut) {
        if (shares == 0) revert ZeroAmount();

        uint256 lp = Math.mulDiv(shares, totalLp() + VIRTUAL_LP, totalSupply() + VIRTUAL_SHARES);
        if (lp == 0) revert ZeroAmount();
        _burn(msg.sender, shares);

        uint256 idle = pool.balanceOf(address(this));
        if (idle < lp) gauge.withdraw(lp - idle);

        (uint256 usdcAmt, uint256 wethAmt) =
            router.removeLiquidity(address(usdc), address(weth), false, lp, 0, 0, address(this), block.timestamp);
        usdcOut = usdcAmt + (wethAmt > 0 ? _swap(address(weth), address(usdc), wethAmt, 0) : 0);
        if (usdcOut < minUsdcOut) revert Slippage();

        usdc.safeTransfer(msg.sender, usdcOut);
        emit Withdraw(msg.sender, shares, lp, usdcOut);
    }

    // =============================================================
    //                           KEEPER
    // =============================================================

    /// @notice Claim AERO, sell for USDC, take fee, zap the rest (plus idle dust) back into LP and stake.
    /// @param minUsdcFromAero min USDC for the AERO sale (keeper quotes offchain)
    /// @param minLpAdded min LP minted by the compound step
    function harvest(uint256 minUsdcFromAero, uint256 minLpAdded)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 lpAdded)
    {
        if (msg.sender != keeper && msg.sender != owner()) revert NotKeeper();
        _checkPrice();

        gauge.getReward(address(this));

        uint256 aeroBal = aero.balanceOf(address(this));
        uint256 usdcFromAero;
        uint256 fee;
        if (aeroBal > 0) {
            usdcFromAero = _swap(address(aero), address(usdc), aeroBal, minUsdcFromAero);
            fee = usdcFromAero * performanceFeeBps / MAX_BPS;
            if (fee > 0) usdc.safeTransfer(feeRecipient, fee);
        }

        // compounds AERO proceeds plus any USDC/WETH dust left by earlier deposits
        uint256 usdcBal = usdc.balanceOf(address(this));
        if (usdcBal >= MIN_COMPOUND_USDC) lpAdded = _zap(usdcBal, weth.balanceOf(address(this)));
        if (lpAdded < minLpAdded) revert Slippage();

        uint256 idleLp = pool.balanceOf(address(this));
        if (idleLp > 0) gauge.deposit(idleLp);

        emit Harvest(aeroBal, usdcFromAero, fee, lpAdded);
    }

    // =============================================================
    //                            VIEWS
    // =============================================================

    /// @notice LP owned by the vault (staked + idle)
    function totalLp() public view returns (uint256) {
        return gauge.balanceOf(address(this)) + pool.balanceOf(address(this));
    }

    /// @notice LP claim of `shares`
    function lpForShares(uint256 shares) external view returns (uint256) {
        return Math.mulDiv(shares, totalLp() + VIRTUAL_LP, totalSupply() + VIRTUAL_SHARES);
    }

    /// @notice AERO claimable by the vault (for keeper profitability checks)
    function pendingAero() external view returns (uint256) {
        return gauge.earned(address(this));
    }

    // =============================================================
    //                            ADMIN
    // =============================================================

    function setKeeper(address _keeper) external onlyOwner {
        if (_keeper == address(0)) revert ZeroAddress();
        keeper = _keeper;
        emit KeeperSet(_keeper);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        feeRecipient = _feeRecipient;
        emit FeeRecipientSet(_feeRecipient);
    }

    function setPerformanceFee(uint256 bps) external onlyOwner {
        if (bps > MAX_PERFORMANCE_FEE_BPS) revert InvalidParam();
        performanceFeeBps = bps;
        emit PerformanceFeeSet(bps);
    }

    function setOracleParams(uint256 _maxPriceDeviationBps, uint256 _oracleMaxAge) external onlyOwner {
        if (_maxPriceDeviationBps == 0 || _maxPriceDeviationBps > MAX_PRICE_DEVIATION_BPS) revert InvalidParam();
        if (_oracleMaxAge == 0 || _oracleMaxAge > 1 days) revert InvalidParam();
        maxPriceDeviationBps = _maxPriceDeviationBps;
        oracleMaxAge = _oracleMaxAge;
        emit OracleParamsSet(_maxPriceDeviationBps, _oracleMaxAge);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Pull all LP out of the gauge (e.g. gauge killed) and pause. Users can still withdraw.
    function emergencyUnstake() external onlyOwner {
        uint256 staked = gauge.balanceOf(address(this));
        if (staked > 0) gauge.withdraw(staked);
        if (!paused()) _pause();
        emit EmergencyUnstake(staked);
    }

    // =============================================================
    //                          INTERNALS
    // =============================================================

    /// @dev swap the optimal part of `usdcAmount` to WETH and add liquidity with `extraWeth` on top.
    ///      Returns LP minted. Leftover dust stays in the vault and is compounded at next harvest.
    function _zap(uint256 usdcAmount, uint256 extraWeth) internal returns (uint256 lp) {
        (uint256 r0, uint256 r1,) = pool.getReserves();
        uint256 reserveUsdc = usdcIsToken0 ? r0 : r1;
        uint256 swapIn = _optimalSwapIn(usdcAmount, reserveUsdc, factory.getFee(address(pool), false));

        uint256 wethOut = _swap(address(usdc), address(weth), swapIn, 0);
        (,, lp) = router.addLiquidity(
            address(usdc),
            address(weth),
            false,
            usdcAmount - swapIn,
            wethOut + extraWeth,
            0,
            0,
            address(this),
            block.timestamp
        );
    }

    /// @dev Amount of token A to sell into an x*y=k pool (fee on input) so the remainder
    ///      matches the new pool ratio. Same formula as Uniswap V2 zaps, fee in bps.
    function _optimalSwapIn(uint256 amount, uint256 reserveIn, uint256 feeBps) internal pure returns (uint256) {
        uint256 twoMinusF = 2 * MAX_BPS - feeBps;
        uint256 oneMinusF = MAX_BPS - feeBps;
        uint256 root = Math.sqrt(reserveIn * (reserveIn * twoMinusF * twoMinusF + 4 * amount * oneMinusF * MAX_BPS));
        return (root - reserveIn * twoMinusF) / (2 * oneMinusF);
    }

    function _swap(address from, address to, uint256 amountIn, uint256 minOut) internal returns (uint256) {
        IAeroRouter.Route[] memory routes = new IAeroRouter.Route[](1);
        routes[0] = IAeroRouter.Route({from: from, to: to, stable: false, factory: address(factory)});
        uint256[] memory amounts =
            router.swapExactTokensForTokens(amountIn, minOut, routes, address(this), block.timestamp);
        return amounts[amounts.length - 1];
    }

    /// @dev Reject if the L2 sequencer is down/just restarted, the feed is stale, or the pool
    ///      spot price is off the Chainlink ETH/USD price (sandwich / manipulation guard).
    ///      Assumes USDC == 1 USD.
    function _checkPrice() internal view {
        (, int256 seqAnswer, uint256 startedAt,,) = sequencerFeed.latestRoundData();
        if (seqAnswer != 0 || block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) revert SequencerDown();

        (, int256 answer,, uint256 updatedAt,) = ethUsdFeed.latestRoundData();
        if (answer <= 0 || block.timestamp - updatedAt > oracleMaxAge) revert StaleOracle();
        // forge-lint: disable-next-line(unsafe-typecast) answer > 0 checked above
        uint256 oraclePrice = uint256(answer) * 1e10; // 8 -> 18 decimals, USD per WETH

        (uint256 r0, uint256 r1,) = pool.getReserves();
        (uint256 rUsdc, uint256 rWeth) = usdcIsToken0 ? (r0, r1) : (r1, r0);
        uint256 spot = rUsdc * 1e30 / rWeth; // USDC(6) per WETH(18), scaled to 18 decimals

        uint256 diff = spot > oraclePrice ? spot - oraclePrice : oraclePrice - spot;
        if (diff * MAX_BPS > oraclePrice * maxPriceDeviationBps) revert PriceDeviation(spot, oraclePrice);
    }
}
