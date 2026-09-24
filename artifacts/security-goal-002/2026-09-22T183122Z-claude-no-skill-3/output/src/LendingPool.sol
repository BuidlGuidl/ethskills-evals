// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @title LendingPool
/// @notice A single-market over-collateralised borrowing pool: deposit WETH, borrow USDC.
///
/// @dev Design summary
///      - One collateral asset and one debt asset, both fixed at construction.
///      - Collateral is held per-account and is never rehypothecated.
///      - Debt is tracked in *shares* against a monotonically increasing `borrowIndex`, so interest
///        accrues to every borrower without touching per-account storage.
///      - Liquidity on the lending side is supplied by the operator via {fund}. This contract
///        deliberately has no depositor share accounting; see NOTES.md.
///
///      Rounding policy: every conversion rounds in the direction that favours the protocol.
///      Debt owed rounds up, collateral value rounds down, collateral seized by a liquidator
///      rounds down. The resulting dust is a few wei and always lands on the safe side.
contract LendingPool is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Basis-point denominator.
    uint256 public constant BPS = 10_000;

    /// @notice Fixed-point one, matching the oracle's 18-decimal price scale.
    uint256 internal constant WAD = 1e18;

    /// @notice Fixed-point one for the borrow index. 27 decimals keeps per-second interest
    ///         truncation far below one wei of debt.
    uint256 internal constant RAY = 1e27;

    /// @notice Interest is quoted as a flat annual rate over a 365-day year.
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    /// @notice Hard ceiling on the configurable annual borrow rate (100% APR).
    uint256 internal constant MAX_BORROW_RATE_BPS = 10_000;

    /*//////////////////////////////////////////////////////////////
                              IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Collateral token (mainnet WETH).
    IERC20 public immutable collateralToken;

    /// @notice Borrowable token (mainnet USDC).
    IERC20 public immutable debtToken;

    /// @notice 10 ** collateralToken.decimals()
    uint256 public immutable collateralScale;

    /// @notice 10 ** debtToken.decimals()
    uint256 public immutable debtScale;

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    struct Position {
        /// @dev Collateral balance in collateral-token units.
        uint256 collateral;
        /// @dev Debt expressed in index shares; multiply by `borrowIndex / RAY` for the amount owed.
        uint256 debtShares;
    }

    mapping(address account => Position) internal _positions;

    /// @notice Price source for the collateral token, quoted in USD with 18 decimals.
    IPriceOracle public oracle;

    /// @notice Maximum debt-to-collateral-value ratio a borrower may *open or maintain* through
    ///         their own actions (borrowing, withdrawing collateral).
    uint256 public ltvBps;

    /// @notice Debt-to-collateral-value ratio at or above which anyone may liquidate.
    uint256 public liquidationThresholdBps;

    /// @notice Extra collateral, in basis points, handed to a liquidator on top of the collateral
    ///         equal in value to the debt they repaid.
    uint256 public liquidationBonusBps;

    /// @notice Fraction of a position's debt that a single liquidation may repay while the
    ///         position still has collateral value covering its debt.
    uint256 public closeFactorBps;

    /// @notice Flat annual borrow rate, in basis points.
    uint256 public borrowRateBps;

    /// @notice Minimum size of a borrow, in debt-token units. Keeps positions large enough that
    ///         liquidating them is worth the gas.
    uint256 public minBorrow;

    /// @notice Accumulated interest multiplier, 27 decimals. Starts at 1 RAY and only increases.
    uint256 public borrowIndex;

    /// @notice Timestamp of the last {accrueInterest} call.
    uint256 public lastAccrualTimestamp;

    /// @notice Sum of all outstanding debt shares.
    uint256 public totalDebtShares;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event CollateralDeposited(address indexed caller, address indexed account, uint256 amount);
    event CollateralWithdrawn(address indexed account, address indexed to, uint256 amount);
    event Borrowed(address indexed account, address indexed to, uint256 amount, uint256 shares);
    event Repaid(address indexed caller, address indexed account, uint256 amount, uint256 shares);
    event Liquidated(
        address indexed liquidator, address indexed account, uint256 repaidAmount, uint256 seizedCollateral
    );
    event BadDebtWrittenOff(address indexed account, uint256 amount, uint256 shares);
    event InterestAccrued(uint256 borrowIndex, uint256 totalDebt);
    event Funded(address indexed from, uint256 amount);
    event LiquidityWithdrawn(address indexed to, uint256 amount);
    event OracleSet(address indexed oracle);
    event RiskParamsSet(uint256 ltvBps, uint256 liquidationThresholdBps, uint256 liquidationBonusBps, uint256 closeFactorBps);
    event BorrowRateSet(uint256 borrowRateBps);
    event MinBorrowSet(uint256 minBorrow);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAddress();
    error ZeroAmount();
    error InvalidConfig();
    error UnsupportedDecimals();
    error InsufficientCollateral();
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error PositionUnhealthy(uint256 debt, uint256 maxDebt);
    error BorrowTooSmall(uint256 debt, uint256 minBorrow);
    error NoDebt();
    error PositionHealthy();
    error RepayExceedsCloseFactor(uint256 requested, uint256 maxRepay);
    error CollateralOutBelowMin(uint256 actual, uint256 min);
    error CollateralRemaining();

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address owner_,
        IERC20 collateralToken_,
        IERC20 debtToken_,
        IPriceOracle oracle_,
        uint256 ltvBps_,
        uint256 liquidationThresholdBps_,
        uint256 liquidationBonusBps_,
        uint256 closeFactorBps_,
        uint256 borrowRateBps_,
        uint256 minBorrow_
    ) Ownable(owner_) {
        if (address(collateralToken_) == address(0) || address(debtToken_) == address(0)) revert ZeroAddress();
        if (address(collateralToken_) == address(debtToken_)) revert InvalidConfig();

        collateralToken = collateralToken_;
        debtToken = debtToken_;

        uint8 collateralDecimals = IERC20Metadata(address(collateralToken_)).decimals();
        uint8 debtDecimals = IERC20Metadata(address(debtToken_)).decimals();
        // Beyond 18 decimals the intermediate products below stop being comfortably bounded.
        if (collateralDecimals > 18 || debtDecimals > 18) revert UnsupportedDecimals();

        collateralScale = 10 ** collateralDecimals;
        debtScale = 10 ** debtDecimals;

        borrowIndex = RAY;
        lastAccrualTimestamp = block.timestamp;

        _setOracle(oracle_);
        _setRiskParams(ltvBps_, liquidationThresholdBps_, liquidationBonusBps_, closeFactorBps_);
        _setBorrowRate(borrowRateBps_);
        _setMinBorrow(minBorrow_);
    }

    /*//////////////////////////////////////////////////////////////
                             INTEREST ACCRUAL
    //////////////////////////////////////////////////////////////*/

    /// @notice Folds elapsed time into the borrow index. Safe and free to call by anyone.
    function accrueInterest() public {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0) return;

        lastAccrualTimestamp = block.timestamp;

        // No debt outstanding means no interest to distribute; do not inflate the index, otherwise
        // the next borrower would inherit interest for a period in which they held no debt.
        if (totalDebtShares == 0) return;

        uint256 newIndex = _indexAfter(borrowIndex, elapsed);
        borrowIndex = newIndex;

        emit InterestAccrued(newIndex, Math.mulDiv(totalDebtShares, newIndex, RAY));
    }

    /// @dev Simple interest over `elapsed`; compounding happens each time accrual runs.
    function _indexAfter(uint256 index, uint256 elapsed) internal view returns (uint256) {
        uint256 rate = borrowRateBps;
        if (rate == 0 || elapsed == 0) return index;
        return index + Math.mulDiv(index, rate * elapsed, BPS * SECONDS_PER_YEAR);
    }

    /// @dev Borrow index including interest that has accrued but not yet been written to storage.
    function _currentIndex() internal view returns (uint256) {
        if (totalDebtShares == 0) return borrowIndex;
        return _indexAfter(borrowIndex, block.timestamp - lastAccrualTimestamp);
    }

    /*//////////////////////////////////////////////////////////////
                           BORROWER ENTRYPOINTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Deposit collateral for `account`.
    /// @dev Depositing for someone else is permitted and can only improve their position.
    function depositCollateral(uint256 amount, address account) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (account == address(0)) revert ZeroAddress();

        _positions[account].collateral += amount;

        emit CollateralDeposited(msg.sender, account, amount);

        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Withdraw collateral, provided the position stays within the open LTV afterwards.
    function withdrawCollateral(uint256 amount, address to) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        accrueInterest();

        Position storage position = _positions[msg.sender];
        uint256 collateral = position.collateral;
        if (amount > collateral) revert InsufficientCollateral();

        uint256 remaining = collateral - amount;
        position.collateral = remaining;

        // Only price the position if it still owes something; a debt-free account may always exit,
        // even if the oracle is down.
        if (position.debtShares != 0) {
            _requireWithinLtv(msg.sender, remaining);
        }

        emit CollateralWithdrawn(msg.sender, to, amount);

        collateralToken.safeTransfer(to, amount);
    }

    /// @notice Borrow `amount` of the debt token against already-deposited collateral.
    function borrow(uint256 amount, address to) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        accrueInterest();

        uint256 available = debtToken.balanceOf(address(this));
        if (amount > available) revert InsufficientLiquidity(amount, available);

        // Round shares up so the borrower is never credited with less debt than they received.
        uint256 shares = Math.mulDiv(amount, RAY, borrowIndex, Math.Rounding.Ceil);
        if (shares == 0) revert ZeroAmount();

        Position storage position = _positions[msg.sender];
        position.debtShares += shares;
        totalDebtShares += shares;

        uint256 debt = _debtOf(position.debtShares, borrowIndex);
        if (debt < minBorrow) revert BorrowTooSmall(debt, minBorrow);

        _requireWithinLtv(msg.sender, position.collateral);

        emit Borrowed(msg.sender, to, amount, shares);

        debtToken.safeTransfer(to, amount);
    }

    /// @notice Repay debt on behalf of `account`.
    /// @param amount Debt-token amount to repay, or `type(uint256).max` to clear the position.
    /// @return repaid The amount actually pulled from the caller.
    function repay(uint256 amount, address account) external nonReentrant returns (uint256 repaid) {
        if (amount == 0) revert ZeroAmount();

        accrueInterest();

        Position storage position = _positions[account];
        uint256 shares = position.debtShares;
        if (shares == 0) revert NoDebt();

        uint256 debt = _debtOf(shares, borrowIndex);

        uint256 burnedShares;
        if (amount >= debt) {
            // Full repayment: burn every share so no dust debt survives.
            repaid = debt;
            burnedShares = shares;
        } else {
            repaid = amount;
            // Round burned shares down so a partial repayment never retires more debt than paid for.
            burnedShares = Math.mulDiv(amount, RAY, borrowIndex, Math.Rounding.Floor);
            if (burnedShares == 0) revert ZeroAmount();
        }

        position.debtShares = shares - burnedShares;
        totalDebtShares -= burnedShares;

        emit Repaid(msg.sender, account, repaid, burnedShares);

        debtToken.safeTransferFrom(msg.sender, address(this), repaid);
    }

    /*//////////////////////////////////////////////////////////////
                              LIQUIDATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Repay part of an unhealthy position's debt and seize the matching collateral plus
    ///         the liquidation bonus.
    /// @param account       Borrower being liquidated.
    /// @param repayAmount   Debt-token amount to repay; `type(uint256).max` asks for the maximum
    ///                      currently permitted.
    /// @param minCollateralOut Slippage guard — revert if fewer collateral tokens would be seized.
    /// @param to            Recipient of the seized collateral.
    /// @return repaid  Debt-token amount actually pulled from the liquidator.
    /// @return seized  Collateral tokens transferred to `to`.
    function liquidate(address account, uint256 repayAmount, uint256 minCollateralOut, address to)
        external
        nonReentrant
        returns (uint256 repaid, uint256 seized)
    {
        if (repayAmount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        accrueInterest();

        Position storage position = _positions[account];
        uint256 shares = position.debtShares;
        if (shares == 0) revert NoDebt();

        uint256 price = oracle.price();
        uint256 debt = _debtOf(shares, borrowIndex);
        uint256 collateral = position.collateral;
        uint256 collateralValue = _collateralToDebtValue(collateral, price);

        // Liquidatable strictly at or above the threshold ratio.
        if (debt * BPS < collateralValue * liquidationThresholdBps) revert PositionHealthy();

        // While the position is still solvent, cap a single liquidation at the close factor. Once
        // debt exceeds collateral value there is nothing left to protect the borrower from, and
        // capping would only slow down the race to clear bad debt.
        uint256 maxRepay = debt > collateralValue ? debt : Math.mulDiv(debt, closeFactorBps, BPS);
        if (repayAmount > maxRepay) {
            if (repayAmount != type(uint256).max) revert RepayExceedsCloseFactor(repayAmount, maxRepay);
            repayAmount = maxRepay;
        }
        if (repayAmount == 0) revert ZeroAmount();

        // Collateral worth the repaid debt, plus the bonus. Rounded down, in the pool's favour.
        seized = Math.mulDiv(
            _debtValueToCollateral(repayAmount, price), BPS + liquidationBonusBps, BPS, Math.Rounding.Floor
        );

        if (seized > collateral) {
            // Not enough collateral to pay the full bonus: take everything and scale the required
            // repayment back down so the liquidator is charged only for what they actually receive.
            seized = collateral;
            repayAmount = Math.mulDiv(
                _collateralToDebtValue(seized, price), BPS, BPS + liquidationBonusBps, Math.Rounding.Floor
            );
            if (repayAmount > debt) repayAmount = debt;
            if (repayAmount == 0) revert ZeroAmount();
        }

        // A repayment that buys zero collateral would be a pure donation to the pool.
        if (seized == 0) revert ZeroAmount();
        if (seized < minCollateralOut) revert CollateralOutBelowMin(seized, minCollateralOut);

        uint256 burnedShares;
        if (repayAmount >= debt) {
            repaid = debt;
            burnedShares = shares;
        } else {
            repaid = repayAmount;
            burnedShares = Math.mulDiv(repayAmount, RAY, borrowIndex, Math.Rounding.Floor);
            if (burnedShares == 0) revert ZeroAmount();
        }

        position.debtShares = shares - burnedShares;
        position.collateral = collateral - seized;
        totalDebtShares -= burnedShares;

        emit Liquidated(msg.sender, account, repaid, seized);

        debtToken.safeTransferFrom(msg.sender, address(this), repaid);
        collateralToken.safeTransfer(to, seized);
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    /// @notice Collateral balance and debt (including pending interest) of `account`.
    function positionOf(address account) external view returns (uint256 collateral, uint256 debt) {
        Position storage position = _positions[account];
        collateral = position.collateral;
        debt = _debtOf(position.debtShares, _currentIndex());
    }

    /// @notice Debt owed by `account`, including interest accrued since the last accrual.
    function debtOf(address account) public view returns (uint256) {
        return _debtOf(_positions[account].debtShares, _currentIndex());
    }

    /// @notice Total debt owed to the pool, including pending interest.
    function totalDebt() external view returns (uint256) {
        return _debtOf(totalDebtShares, _currentIndex());
    }

    /// @notice Debt-token value of `account`'s collateral at the current oracle price.
    function collateralValueOf(address account) external view returns (uint256) {
        return _collateralToDebtValue(_positions[account].collateral, oracle.price());
    }

    /// @notice True when `account` is at or above the liquidation threshold.
    function isLiquidatable(address account) external view returns (bool) {
        Position storage position = _positions[account];
        if (position.debtShares == 0) return false;
        uint256 debt = _debtOf(position.debtShares, _currentIndex());
        uint256 collateralValue = _collateralToDebtValue(position.collateral, oracle.price());
        return debt * BPS >= collateralValue * liquidationThresholdBps;
    }

    /// @notice Additional debt `account` could take on right now, ignoring pool liquidity.
    function maxBorrow(address account) external view returns (uint256) {
        Position storage position = _positions[account];
        uint256 collateralValue = _collateralToDebtValue(position.collateral, oracle.price());
        uint256 limit = Math.mulDiv(collateralValue, ltvBps, BPS);
        uint256 debt = _debtOf(position.debtShares, _currentIndex());
        return debt >= limit ? 0 : limit - debt;
    }

    /// @notice Debt tokens sitting idle in the pool and available to borrow.
    function availableLiquidity() external view returns (uint256) {
        return debtToken.balanceOf(address(this));
    }

    /*//////////////////////////////////////////////////////////////
                             INTERNAL MATH
    //////////////////////////////////////////////////////////////*/

    /// @dev Debt owed for `shares`, rounded up against the borrower.
    function _debtOf(uint256 shares, uint256 index) internal pure returns (uint256) {
        if (shares == 0) return 0;
        return Math.mulDiv(shares, index, RAY, Math.Rounding.Ceil);
    }

    /// @dev Value of `amount` collateral tokens expressed in debt-token units, rounded down.
    function _collateralToDebtValue(uint256 amount, uint256 price) internal view returns (uint256) {
        if (amount == 0) return 0;
        uint256 usd = Math.mulDiv(amount, price, WAD); // 18-decimal USD, scaled by collateral units
        return Math.mulDiv(usd, debtScale, collateralScale);
    }

    /// @dev Collateral tokens worth `value` debt tokens, rounded down.
    function _debtValueToCollateral(uint256 value, uint256 price) internal view returns (uint256) {
        if (value == 0) return 0;
        uint256 usd = Math.mulDiv(value, collateralScale, debtScale);
        return Math.mulDiv(usd, WAD, price);
    }

    /// @dev Reverts unless `account`'s debt is within the open LTV of `collateral`.
    function _requireWithinLtv(address account, uint256 collateral) internal view {
        uint256 debt = _debtOf(_positions[account].debtShares, borrowIndex);
        if (debt == 0) return;

        uint256 collateralValue = _collateralToDebtValue(collateral, oracle.price());
        uint256 maxDebt = Math.mulDiv(collateralValue, ltvBps, BPS);
        if (debt > maxDebt) revert PositionUnhealthy(debt, maxDebt);
    }

    /*//////////////////////////////////////////////////////////////
                             OPERATOR ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Supply debt tokens for borrowers to draw on.
    /// @dev Permissionless: anyone may donate liquidity. There is no share accounting, so a
    ///      depositor has no claim on what they send — only the owner can pull liquidity back out.
    function fund(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        emit Funded(msg.sender, amount);
        debtToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Withdraw idle debt-token liquidity (principal plus accrued interest).
    /// @dev Can only move tokens that are not lent out; outstanding loans are unaffected.
    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        uint256 available = debtToken.balanceOf(address(this));
        if (amount > available) revert InsufficientLiquidity(amount, available);

        emit LiquidityWithdrawn(to, amount);

        debtToken.safeTransfer(to, amount);
    }

    /// @notice Clear debt that can never be repaid because the collateral is gone.
    /// @dev Only callable once liquidators have taken every last collateral token. Writing the
    ///      debt off keeps `totalDebt` honest; the loss is the operator's.
    function writeOffBadDebt(address account) external onlyOwner {
        accrueInterest();

        Position storage position = _positions[account];
        uint256 shares = position.debtShares;
        if (shares == 0) revert NoDebt();
        if (position.collateral != 0) revert CollateralRemaining();

        uint256 amount = _debtOf(shares, borrowIndex);
        position.debtShares = 0;
        totalDebtShares -= shares;

        emit BadDebtWrittenOff(account, amount, shares);
    }

    /// @notice Halt new deposits and borrows. Repayment, withdrawal and liquidation stay open so
    ///         users can always exit and the book can always be cleaned up.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /*//////////////////////////////////////////////////////////////
                             CONFIGURATION
    //////////////////////////////////////////////////////////////*/

    function setOracle(IPriceOracle oracle_) external onlyOwner {
        _setOracle(oracle_);
    }

    function setRiskParams(
        uint256 ltvBps_,
        uint256 liquidationThresholdBps_,
        uint256 liquidationBonusBps_,
        uint256 closeFactorBps_
    ) external onlyOwner {
        accrueInterest();
        _setRiskParams(ltvBps_, liquidationThresholdBps_, liquidationBonusBps_, closeFactorBps_);
    }

    function setBorrowRate(uint256 borrowRateBps_) external onlyOwner {
        // Settle interest at the old rate before the new one takes effect.
        accrueInterest();
        _setBorrowRate(borrowRateBps_);
    }

    function setMinBorrow(uint256 minBorrow_) external onlyOwner {
        _setMinBorrow(minBorrow_);
    }

    function _setOracle(IPriceOracle oracle_) internal {
        if (address(oracle_) == address(0)) revert ZeroAddress();
        // Reject an oracle that cannot produce a usable price right now.
        if (oracle_.price() == 0) revert InvalidConfig();
        oracle = oracle_;
        emit OracleSet(address(oracle_));
    }

    function _setRiskParams(
        uint256 ltvBps_,
        uint256 liquidationThresholdBps_,
        uint256 liquidationBonusBps_,
        uint256 closeFactorBps_
    ) internal {
        // A borrower must have headroom between the limit they can reach and the point at which
        // they become liquidatable, otherwise every new loan is instantly liquidatable.
        if (ltvBps_ == 0 || ltvBps_ >= liquidationThresholdBps_) revert InvalidConfig();
        if (liquidationThresholdBps_ >= BPS) revert InvalidConfig();
        if (liquidationBonusBps_ == 0 || liquidationBonusBps_ > 2_000) revert InvalidConfig();
        if (closeFactorBps_ == 0 || closeFactorBps_ > BPS) revert InvalidConfig();
        // A position liquidated at the threshold must not be pushed underwater by the bonus:
        // threshold * (1 + bonus) must stay at or below 100%.
        if (liquidationThresholdBps_ * (BPS + liquidationBonusBps_) > BPS * BPS) revert InvalidConfig();

        ltvBps = ltvBps_;
        liquidationThresholdBps = liquidationThresholdBps_;
        liquidationBonusBps = liquidationBonusBps_;
        closeFactorBps = closeFactorBps_;

        emit RiskParamsSet(ltvBps_, liquidationThresholdBps_, liquidationBonusBps_, closeFactorBps_);
    }

    function _setBorrowRate(uint256 borrowRateBps_) internal {
        if (borrowRateBps_ > MAX_BORROW_RATE_BPS) revert InvalidConfig();
        borrowRateBps = borrowRateBps_;
        emit BorrowRateSet(borrowRateBps_);
    }

    function _setMinBorrow(uint256 minBorrow_) internal {
        if (minBorrow_ == 0) revert InvalidConfig();
        minBorrow = minBorrow_;
        emit MinBorrowSet(minBorrow_);
    }
}
