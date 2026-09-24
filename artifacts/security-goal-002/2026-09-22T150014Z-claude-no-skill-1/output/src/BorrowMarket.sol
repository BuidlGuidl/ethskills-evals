// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @title BorrowMarket
/// @notice Single-pair overcollateralised borrowing market: lock WETH, borrow USDC.
///
/// Mechanics
/// ---------
/// * Collateral is held per-account and is never rehypothecated.
/// * Debt accrues at a flat annual rate, tracked by a monotonically increasing borrow index. A
///   position stores *scaled* debt (`debt / index`), so accrual is O(1) and touches no per-user state.
/// * A position may borrow up to `ltvBps` of its collateral value and becomes liquidatable above
///   `liquidationThresholdBps`. A liquidator repays USDC and seizes the matching WETH plus
///   `liquidationBonusBps`.
///
/// Scope
/// -----
/// The USDC lent out is supplied by a trusted `liquidityManager` (treasury / vault). There is no
/// public deposit side, so there are no lender shares and no share-inflation surface. Interest
/// accrues into the pool and is withdrawable by the manager as it is repaid.
contract BorrowMarket is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* --------------------------------------------------------------------- */
    /*                               Constants                               */
    /* --------------------------------------------------------------------- */

    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 1e4;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    /// @dev Hard ceilings enforced on every risk-parameter update. Governance can tune parameters but
    ///      cannot configure the market into a shape where a liquidation at the threshold leaves the
    ///      position insolvent, or where a borrow is immediately liquidatable.
    uint256 internal constant MAX_LIQUIDATION_THRESHOLD_BPS = 9500;
    uint256 internal constant MAX_LIQUIDATION_BONUS_BPS = 2000;
    /// @dev 100% APR. Above this the flat-rate index math stops being a sane product, not just a risk.
    uint256 internal constant MAX_RATE_PER_YEAR = 1e18;

    /* --------------------------------------------------------------------- */
    /*                              Immutables                               */
    /* --------------------------------------------------------------------- */

    /// @notice Collateral token (WETH on mainnet).
    IERC20 public immutable collateralToken;
    /// @notice Borrowed token (USDC on mainnet).
    IERC20 public immutable debtToken;
    /// @dev 10 ** collateralToken.decimals()
    uint256 public immutable collateralUnit;
    /// @dev 10 ** debtToken.decimals()
    uint256 public immutable debtUnit;

    /* --------------------------------------------------------------------- */
    /*                                 State                                 */
    /* --------------------------------------------------------------------- */

    struct Position {
        /// @dev Collateral balance in collateral-token units.
        uint128 collateral;
        /// @dev Debt expressed at index == WAD. Actual debt = scaledDebt * borrowIndex / WAD.
        uint128 scaledDebt;
    }

    mapping(address account => Position) internal _positions;

    IPriceOracle public oracle;
    address public liquidityManager;

    /// @notice Flat annual interest rate, WAD-scaled (0.05e18 == 5% / year).
    uint256 public ratePerYear;
    /// @notice Max borrow, as a fraction of collateral value.
    uint256 public ltvBps;
    /// @notice Debt/collateral ratio at which a position becomes liquidatable.
    uint256 public liquidationThresholdBps;
    /// @notice Extra collateral a liquidator receives on top of what they repaid.
    uint256 public liquidationBonusBps;
    /// @notice Max fraction of a position's debt repayable in a single liquidation while it is solvent.
    uint256 public closeFactorBps;
    /// @notice Minimum debt a non-empty position must carry, in debt-token units.
    uint256 public minDebt;

    /// @notice Cumulative interest index. Starts at WAD and only ever increases.
    uint256 public borrowIndex;
    /// @notice Timestamp the index was last brought up to date.
    uint256 public lastAccrualTimestamp;
    /// @notice Sum of every position's scaled debt.
    uint256 public totalScaledDebt;
    /// @notice Idle debt-token liquidity, tracked internally so that donations cannot distort accounting.
    uint256 public totalCash;
    /// @notice Sum of every position's collateral, tracked internally for the same reason.
    uint256 public totalCollateral;

    /* --------------------------------------------------------------------- */
    /*                                Events                                 */
    /* --------------------------------------------------------------------- */

    event Accrued(uint256 borrowIndex, uint256 interest);
    event CollateralDeposited(address indexed account, address indexed payer, uint256 amount);
    event CollateralWithdrawn(address indexed account, address indexed to, uint256 amount);
    event Borrowed(address indexed account, address indexed to, uint256 amount);
    event Repaid(address indexed account, address indexed payer, uint256 amount);
    event Liquidated(
        address indexed account, address indexed liquidator, uint256 repaid, uint256 collateralSeized
    );
    event LiquidityFunded(address indexed from, uint256 amount);
    event LiquidityWithdrawn(address indexed to, uint256 amount);
    event OracleSet(address indexed oracle);
    event LiquidityManagerSet(address indexed liquidityManager);
    event RiskParamsSet(
        uint256 ratePerYear,
        uint256 ltvBps,
        uint256 liquidationThresholdBps,
        uint256 liquidationBonusBps,
        uint256 closeFactorBps,
        uint256 minDebt
    );

    /* --------------------------------------------------------------------- */
    /*                                Errors                                 */
    /* --------------------------------------------------------------------- */

    error ZeroAddress();
    error ZeroAmount();
    error InvalidParams();
    error UnsupportedDecimals();
    error NotLiquidityManager();
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error InsufficientCollateral(uint256 requested, uint256 available);
    error PositionUnhealthy(uint256 debt, uint256 maxDebt);
    error PositionHealthy(uint256 debt, uint256 liquidationDebt);
    error NoDebt();
    error DebtBelowMinimum(uint256 debt, uint256 minDebt);
    error RepayExceedsCloseFactor(uint256 requested, uint256 maxRepay);
    error BalanceOverflow();

    /* --------------------------------------------------------------------- */
    /*                             Construction                              */
    /* --------------------------------------------------------------------- */

    constructor(
        address initialOwner,
        IERC20 collateralToken_,
        IERC20 debtToken_,
        IPriceOracle oracle_,
        address liquidityManager_,
        uint256 ratePerYear_,
        uint256 ltvBps_,
        uint256 liquidationThresholdBps_,
        uint256 liquidationBonusBps_,
        uint256 closeFactorBps_,
        uint256 minDebt_
    ) Ownable(initialOwner) {
        if (
            address(collateralToken_) == address(0) || address(debtToken_) == address(0)
                || address(collateralToken_) == address(debtToken_)
        ) revert ZeroAddress();

        uint8 collateralDecimals = IERC20Metadata(address(collateralToken_)).decimals();
        uint8 debtDecimals = IERC20Metadata(address(debtToken_)).decimals();
        // Keeps every `mulDiv` below comfortably inside 256 bits and rules out exotic tokens.
        if (collateralDecimals > 18 || debtDecimals > 18) revert UnsupportedDecimals();

        collateralToken = collateralToken_;
        debtToken = debtToken_;
        collateralUnit = 10 ** collateralDecimals;
        debtUnit = 10 ** debtDecimals;

        borrowIndex = WAD;
        lastAccrualTimestamp = block.timestamp;

        _setOracle(oracle_);
        _setLiquidityManager(liquidityManager_);
        _setRiskParams(
            ratePerYear_, ltvBps_, liquidationThresholdBps_, liquidationBonusBps_, closeFactorBps_, minDebt_
        );
    }

    /* --------------------------------------------------------------------- */
    /*                           Interest accrual                            */
    /* --------------------------------------------------------------------- */

    /// @notice Bring the borrow index up to the current timestamp. Implicit in every state-changing call.
    function accrue() public {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0) return;

        lastAccrualTimestamp = block.timestamp;

        uint256 scaled = totalScaledDebt;
        // With nothing borrowed there is no interest to charge; advancing the index anyway would
        // retroactively tax the next borrower for the idle period.
        if (scaled == 0) return;

        uint256 index = borrowIndex;
        uint256 debtBefore = Math.mulDiv(scaled, index, WAD, Math.Rounding.Ceil);

        // Flat rate, linearly applied over the elapsed period and compounded per accrual.
        uint256 growth = WAD + Math.mulDiv(ratePerYear, elapsed, SECONDS_PER_YEAR);
        index = Math.mulDiv(index, growth, WAD, Math.Rounding.Ceil);
        borrowIndex = index;

        uint256 debtAfter = Math.mulDiv(scaled, index, WAD, Math.Rounding.Ceil);
        emit Accrued(index, debtAfter - debtBefore);
    }

    /* --------------------------------------------------------------------- */
    /*                            Borrower actions                           */
    /* --------------------------------------------------------------------- */

    /// @notice Lock collateral for `onBehalfOf`. Tokens are pulled from `msg.sender`.
    /// @dev Deliberately allowed while paused: topping up collateral only ever makes a position safer,
    ///      and a borrower racing a liquidation should not be locked out by an unrelated incident.
    function depositCollateral(uint256 amount, address onBehalfOf) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (onBehalfOf == address(0)) revert ZeroAddress();

        // Credit the accounted amount, not `balanceOf`, so a fee-on-transfer or rebasing collateral
        // cannot credit more than actually arrived.
        uint256 balanceBefore = collateralToken.balanceOf(address(this));
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = collateralToken.balanceOf(address(this)) - balanceBefore;

        Position storage position = _positions[onBehalfOf];
        position.collateral = _toUint128(uint256(position.collateral) + received);
        totalCollateral += received;

        emit CollateralDeposited(onBehalfOf, msg.sender, received);
    }

    /// @notice Withdraw collateral, provided the position stays within `ltvBps` afterwards.
    function withdrawCollateral(uint256 amount, address to) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        accrue();

        Position storage position = _positions[msg.sender];
        uint256 collateral = position.collateral;
        if (amount > collateral) revert InsufficientCollateral(amount, collateral);

        uint256 remaining = collateral - amount;
        // safe: `remaining` <= the uint128 `collateral` it was derived from
        // forge-lint: disable-next-line(unsafe-typecast)
        position.collateral = uint128(remaining);
        totalCollateral -= amount;

        // A debt-free position needs no price to be judged solvent, so it can always be unwound even
        // while the oracle is unusable or the market is paused.
        uint256 debt = _debtOf(position);
        if (debt != 0) _requireHealthy(debt, remaining);

        collateralToken.safeTransfer(to, amount);

        emit CollateralWithdrawn(msg.sender, to, amount);
    }

    /// @notice Borrow `amount` of the debt token against the caller's collateral.
    function borrow(uint256 amount, address to) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        accrue();

        uint256 cash = totalCash;
        if (amount > cash) revert InsufficientLiquidity(amount, cash);

        Position storage position = _positions[msg.sender];

        // Round the debt the borrower takes on *up*: any dust from the index division is charged to
        // the borrower, never to the pool.
        uint256 scaledDelta = Math.mulDiv(amount, WAD, borrowIndex, Math.Rounding.Ceil);
        position.scaledDebt = _toUint128(uint256(position.scaledDebt) + scaledDelta);
        totalScaledDebt += scaledDelta;
        totalCash = cash - amount;

        uint256 debt = _debtOf(position);
        if (debt < minDebt) revert DebtBelowMinimum(debt, minDebt);
        _requireHealthy(debt, position.collateral);

        debtToken.safeTransfer(to, amount);

        emit Borrowed(msg.sender, to, amount);
    }

    /// @notice Repay debt for `onBehalfOf`. Pass `type(uint256).max` to clear the position exactly.
    /// @return repaid Amount of debt token actually pulled from `msg.sender`.
    function repay(uint256 amount, address onBehalfOf) external nonReentrant returns (uint256 repaid) {
        if (amount == 0) revert ZeroAmount();
        if (onBehalfOf == address(0)) revert ZeroAddress();

        accrue();

        Position storage position = _positions[onBehalfOf];
        uint256 debt = _debtOf(position);
        if (debt == 0) revert NoDebt();

        uint256 scaledDelta;
        if (amount >= debt) {
            repaid = debt;
            scaledDelta = position.scaledDebt;
        } else {
            repaid = amount;
            // Round the debt burned *down*: a partial repayment never retires more debt than it paid for.
            scaledDelta = Math.mulDiv(repaid, WAD, borrowIndex, Math.Rounding.Floor);
            if (scaledDelta == 0) revert ZeroAmount();
        }

        _burnDebt(position, scaledDelta);

        // Leaving a position with unliquidatably-small debt is worse than refusing the repayment:
        // the caller can always repay in full instead.
        uint256 remainingDebt = _debtOf(position);
        if (remainingDebt != 0 && remainingDebt < minDebt) revert DebtBelowMinimum(remainingDebt, minDebt);

        totalCash += repaid;
        debtToken.safeTransferFrom(msg.sender, address(this), repaid);

        emit Repaid(onBehalfOf, msg.sender, repaid);
    }

    /* --------------------------------------------------------------------- */
    /*                              Liquidation                              */
    /* --------------------------------------------------------------------- */

    /// @notice Repay part of an unhealthy position's debt and seize the matching collateral plus bonus.
    /// @param account   Borrower being liquidated.
    /// @param repayAmount Debt token to repay; capped at the close factor (or the whole debt if the
    ///                  position is already insolvent). Pass `type(uint256).max` to take the maximum.
    /// @param to        Recipient of the seized collateral.
    /// @return repaid   Debt token actually pulled from the liquidator.
    /// @return seized   Collateral transferred to `to`.
    function liquidate(address account, uint256 repayAmount, address to)
        external
        nonReentrant
        returns (uint256 repaid, uint256 seized)
    {
        if (repayAmount == 0) revert ZeroAmount();
        if (to == address(0) || account == address(0)) revert ZeroAddress();

        accrue();

        Position storage position = _positions[account];
        uint256 debt = _debtOf(position);
        if (debt == 0) revert NoDebt();

        uint256 collateral = position.collateral;
        uint256 collateralValue = _collateralValue(collateral);

        // Health is judged against the liquidation threshold, not the borrow LTV, so a position that
        // merely drifted past its opening LTV is not up for grabs.
        uint256 liquidationDebt = Math.mulDiv(collateralValue, liquidationThresholdBps, BPS);
        if (debt <= liquidationDebt) revert PositionHealthy(debt, liquidationDebt);

        uint256 maxRepay = _maxRepay(debt, collateralValue);
        repaid = repayAmount > maxRepay ? maxRepay : repayAmount;

        seized = _seizeAmount(repaid);
        if (seized > collateral) {
            // Underwater beyond the bonus: the liquidator takes everything that is left and pays only
            // what that collateral is actually worth. The shortfall stays on the books as bad debt.
            seized = collateral;
            repaid = _repayForSeizure(seized);
            if (repaid == 0) revert ZeroAmount();
            if (repaid > debt) repaid = debt;
        }

        uint256 scaledDelta = repaid == debt
            ? position.scaledDebt
            : Math.mulDiv(repaid, WAD, borrowIndex, Math.Rounding.Floor);
        if (scaledDelta == 0) revert ZeroAmount();

        _burnDebt(position, scaledDelta);
        // safe: `seized` is clamped to `collateral`, itself a uint128
        // forge-lint: disable-next-line(unsafe-typecast)
        position.collateral = uint128(collateral - seized);
        totalCollateral -= seized;
        totalCash += repaid;

        // Dust check is deliberately skipped when the position is fully cleared out of collateral:
        // forcing a minimum there would block the only liquidation that can happen.
        uint256 remainingDebt = _debtOf(position);
        if (remainingDebt != 0 && remainingDebt < minDebt && position.collateral != 0) {
            revert DebtBelowMinimum(remainingDebt, minDebt);
        }

        debtToken.safeTransferFrom(msg.sender, address(this), repaid);
        collateralToken.safeTransfer(to, seized);

        emit Liquidated(account, msg.sender, repaid, seized);
    }

    /* --------------------------------------------------------------------- */
    /*                             Liquidity side                            */
    /* --------------------------------------------------------------------- */

    /// @notice Supply lendable debt token to the market.
    function fund(uint256 amount) external nonReentrant {
        if (msg.sender != liquidityManager) revert NotLiquidityManager();
        if (amount == 0) revert ZeroAmount();

        uint256 balanceBefore = debtToken.balanceOf(address(this));
        debtToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = debtToken.balanceOf(address(this)) - balanceBefore;

        totalCash += received;
        emit LiquidityFunded(msg.sender, received);
    }

    /// @notice Withdraw idle liquidity (principal plus whatever interest has been repaid so far).
    function withdrawLiquidity(uint256 amount, address to) external nonReentrant {
        if (msg.sender != liquidityManager) revert NotLiquidityManager();
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        accrue();

        uint256 cash = totalCash;
        if (amount > cash) revert InsufficientLiquidity(amount, cash);
        totalCash = cash - amount;

        debtToken.safeTransfer(to, amount);
        emit LiquidityWithdrawn(to, amount);
    }

    /// @notice Sweep tokens that were sent here outside of the accounted balances.
    /// @dev Bounded by the internal accounting, so it can never touch borrower collateral or lendable cash.
    function skim(IERC20 token, address to) external nonReentrant onlyOwner returns (uint256 amount) {
        if (to == address(0)) revert ZeroAddress();

        uint256 balance = token.balanceOf(address(this));
        uint256 accounted;
        if (address(token) == address(collateralToken)) accounted = totalCollateral;
        if (address(token) == address(debtToken)) accounted += totalCash;

        amount = balance > accounted ? balance - accounted : 0;
        if (amount == 0) revert ZeroAmount();

        token.safeTransfer(to, amount);
    }

    /* --------------------------------------------------------------------- */
    /*                                 Views                                 */
    /* --------------------------------------------------------------------- */

    function positionOf(address account) external view returns (uint256 collateral, uint256 debt) {
        Position memory position = _positions[account];
        return (position.collateral, Math.mulDiv(position.scaledDebt, _currentIndex(), WAD, Math.Rounding.Ceil));
    }

    /// @notice Current debt including interest that has accrued but not yet been written to storage.
    function debtOf(address account) public view returns (uint256) {
        return Math.mulDiv(_positions[account].scaledDebt, _currentIndex(), WAD, Math.Rounding.Ceil);
    }

    function collateralOf(address account) external view returns (uint256) {
        return _positions[account].collateral;
    }

    /// @notice Value of `account`'s collateral denominated in the debt token.
    function collateralValueOf(address account) external view returns (uint256) {
        return _collateralValue(_positions[account].collateral);
    }

    /// @notice Additional debt token `account` could borrow right now, ignoring available liquidity.
    function availableToBorrow(address account) external view returns (uint256) {
        uint256 maxDebt = Math.mulDiv(_collateralValue(_positions[account].collateral), ltvBps, BPS);
        uint256 debt = debtOf(account);
        return debt >= maxDebt ? 0 : maxDebt - debt;
    }

    /// @notice Health factor, WAD-scaled. Below 1e18 the position is liquidatable; `type(uint256).max`
    ///         means no debt.
    function healthFactor(address account) external view returns (uint256) {
        uint256 debt = debtOf(account);
        if (debt == 0) return type(uint256).max;
        uint256 threshold =
            Math.mulDiv(_collateralValue(_positions[account].collateral), liquidationThresholdBps, BPS);
        return Math.mulDiv(threshold, WAD, debt);
    }

    function isLiquidatable(address account) external view returns (bool) {
        uint256 debt = debtOf(account);
        if (debt == 0) return false;
        return debt
            > Math.mulDiv(_collateralValue(_positions[account].collateral), liquidationThresholdBps, BPS);
    }

    /// @notice Total outstanding debt across the market, including pending interest.
    function totalDebt() external view returns (uint256) {
        return Math.mulDiv(totalScaledDebt, _currentIndex(), WAD, Math.Rounding.Ceil);
    }

    /* --------------------------------------------------------------------- */
    /*                             Administration                            */
    /* --------------------------------------------------------------------- */

    function setOracle(IPriceOracle oracle_) external onlyOwner {
        accrue();
        _setOracle(oracle_);
    }

    function setLiquidityManager(address liquidityManager_) external onlyOwner {
        _setLiquidityManager(liquidityManager_);
    }

    function setRiskParams(
        uint256 ratePerYear_,
        uint256 ltvBps_,
        uint256 liquidationThresholdBps_,
        uint256 liquidationBonusBps_,
        uint256 closeFactorBps_,
        uint256 minDebt_
    ) external onlyOwner {
        // Accrue under the old rate first, otherwise the new rate would be applied retroactively to
        // the whole elapsed period.
        accrue();
        _setRiskParams(
            ratePerYear_, ltvBps_, liquidationThresholdBps_, liquidationBonusBps_, closeFactorBps_, minDebt_
        );
    }

    /// @notice Stop new borrows. Deposit, repay, withdraw and liquidate stay open by design.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /* --------------------------------------------------------------------- */
    /*                               Internals                               */
    /* --------------------------------------------------------------------- */

    function _setOracle(IPriceOracle oracle_) internal {
        if (address(oracle_) == address(0)) revert ZeroAddress();
        // Reverts if either leg is unpriceable, so a broken oracle cannot be installed.
        oracle_.getAssetPrice(address(collateralToken));
        oracle_.getAssetPrice(address(debtToken));
        oracle = oracle_;
        emit OracleSet(address(oracle_));
    }

    function _setLiquidityManager(address liquidityManager_) internal {
        if (liquidityManager_ == address(0)) revert ZeroAddress();
        liquidityManager = liquidityManager_;
        emit LiquidityManagerSet(liquidityManager_);
    }

    function _setRiskParams(
        uint256 ratePerYear_,
        uint256 ltvBps_,
        uint256 liquidationThresholdBps_,
        uint256 liquidationBonusBps_,
        uint256 closeFactorBps_,
        uint256 minDebt_
    ) internal {
        if (ratePerYear_ > MAX_RATE_PER_YEAR) revert InvalidParams();
        if (ltvBps_ == 0 || ltvBps_ >= liquidationThresholdBps_) revert InvalidParams();
        if (liquidationThresholdBps_ > MAX_LIQUIDATION_THRESHOLD_BPS) revert InvalidParams();
        if (liquidationBonusBps_ == 0 || liquidationBonusBps_ > MAX_LIQUIDATION_BONUS_BPS) {
            revert InvalidParams();
        }
        if (closeFactorBps_ == 0 || closeFactorBps_ > BPS) revert InvalidParams();
        if (minDebt_ == 0) revert InvalidParams();

        // A liquidation triggered exactly at the threshold must not be able to consume more collateral
        // than the position holds, or liquidating a barely-unhealthy position would create bad debt.
        if (liquidationThresholdBps_ * (BPS + liquidationBonusBps_) > BPS * BPS) revert InvalidParams();

        ratePerYear = ratePerYear_;
        ltvBps = ltvBps_;
        liquidationThresholdBps = liquidationThresholdBps_;
        liquidationBonusBps = liquidationBonusBps_;
        closeFactorBps = closeFactorBps_;
        minDebt = minDebt_;

        emit RiskParamsSet(
            ratePerYear_, ltvBps_, liquidationThresholdBps_, liquidationBonusBps_, closeFactorBps_, minDebt_
        );
    }

    function _burnDebt(Position storage position, uint256 scaledDelta) internal {
        // safe: callers never burn more scaled debt than the position holds; underflow reverts first
        // forge-lint: disable-next-line(unsafe-typecast)
        position.scaledDebt = uint128(uint256(position.scaledDebt) - scaledDelta);
        totalScaledDebt -= scaledDelta;
    }

    function _debtOf(Position storage position) internal view returns (uint256) {
        return Math.mulDiv(position.scaledDebt, borrowIndex, WAD, Math.Rounding.Ceil);
    }

    /// @dev Index projected to `block.timestamp`, for views that are not preceded by `accrue()`.
    function _currentIndex() internal view returns (uint256) {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0 || totalScaledDebt == 0) return borrowIndex;
        uint256 growth = WAD + Math.mulDiv(ratePerYear, elapsed, SECONDS_PER_YEAR);
        return Math.mulDiv(borrowIndex, growth, WAD, Math.Rounding.Ceil);
    }

    function _requireHealthy(uint256 debt, uint256 collateral) internal view {
        uint256 maxDebt = Math.mulDiv(_collateralValue(collateral), ltvBps, BPS);
        if (debt > maxDebt) revert PositionUnhealthy(debt, maxDebt);
    }

    /// @dev Value of `amount` collateral tokens, denominated in debt-token units, rounded down.
    function _collateralValue(uint256 amount) internal view returns (uint256) {
        if (amount == 0) return 0;
        IPriceOracle oracle_ = oracle;
        uint256 collateralPrice = oracle_.getAssetPrice(address(collateralToken));
        uint256 debtPrice = oracle_.getAssetPrice(address(debtToken));
        // Pricing the debt leg too (rather than assuming USDC == $1) means a depeg moves borrowing
        // power in the right direction instead of being silently ignored.
        uint256 usdValue = Math.mulDiv(amount, collateralPrice, collateralUnit);
        return Math.mulDiv(usdValue, debtUnit, debtPrice);
    }

    /// @dev Collateral a liquidator receives for repaying `repaid`, including the bonus. Rounded down.
    function _seizeAmount(uint256 repaid) internal view returns (uint256) {
        IPriceOracle oracle_ = oracle;
        uint256 collateralPrice = oracle_.getAssetPrice(address(collateralToken));
        uint256 debtPrice = oracle_.getAssetPrice(address(debtToken));
        uint256 usdValue = Math.mulDiv(repaid, debtPrice, debtUnit);
        uint256 base = Math.mulDiv(usdValue, collateralUnit, collateralPrice);
        return Math.mulDiv(base, BPS + liquidationBonusBps, BPS);
    }

    /// @dev Inverse of `_seizeAmount`: what a liquidator must pay to receive exactly `seized`.
    ///      Rounded down so a clamped seizure can never overcharge relative to the bonus schedule.
    function _repayForSeizure(uint256 seized) internal view returns (uint256) {
        IPriceOracle oracle_ = oracle;
        uint256 collateralPrice = oracle_.getAssetPrice(address(collateralToken));
        uint256 debtPrice = oracle_.getAssetPrice(address(debtToken));
        uint256 base = Math.mulDiv(seized, BPS, BPS + liquidationBonusBps);
        uint256 usdValue = Math.mulDiv(base, collateralPrice, collateralUnit);
        return Math.mulDiv(usdValue, debtUnit, debtPrice);
    }

    /// @dev Close-factor cap. Lifted to the full debt once the position is genuinely insolvent, or when
    ///      a capped repayment would strand a sub-minimum remainder that nobody would come back for.
    function _maxRepay(uint256 debt, uint256 collateralValue) internal view returns (uint256) {
        if (debt >= collateralValue) return debt;
        uint256 capped = Math.mulDiv(debt, closeFactorBps, BPS);
        if (capped == 0 || debt - capped < minDebt) return debt;
        return capped;
    }

    function _toUint128(uint256 value) internal pure returns (uint128) {
        if (value > type(uint128).max) revert BalanceOverflow();
        // safe: bounds-checked on the line above
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint128(value);
    }
}
