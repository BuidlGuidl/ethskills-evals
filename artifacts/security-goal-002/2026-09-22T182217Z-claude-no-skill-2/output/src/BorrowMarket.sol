// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @title BorrowMarket
/// @notice Single-pair borrowing market: lock WETH collateral, borrow USDC against it.
///
/// Sides of the market:
///  - Lenders `deposit` USDC and receive shares in the pool; interest paid by borrowers accrues
///    to those shares.
///  - Borrowers `depositCollateral` WETH, `borrow` USDC up to `maxLtvBps` of collateral value,
///    and `repay` / `withdrawCollateral` freely while healthy.
///  - Anyone can `liquidate` a position whose debt exceeds `liquidationThresholdBps` of its
///    collateral value, repaying USDC for discounted WETH.
///
/// Accounting notes:
///  - Debt is tracked in shares against a monotonically increasing `borrowIndex`. Interest is
///    simple (linear) at a flat annual rate; see NOTES.md.
///  - Cash is tracked in storage (`usdcCash`), never read from `balanceOf`. Donating tokens to
///    this contract therefore cannot move share prices or the utilisation check.
contract BorrowMarket is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 1e4;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    /// @notice Upper bound on the configurable borrow rate: 100% APR.
    uint256 public constant MAX_RATE_PER_YEAR = 1e18;

    /// @dev Virtual shares/assets on the lender side. They make the initial share price
    ///      1e6 shares per unit and keep it bounded, which removes the classic
    ///      "first depositor donates to inflate the share price" rounding attack.
    uint256 internal constant VIRTUAL_SHARES = 1e6;
    uint256 internal constant VIRTUAL_ASSETS = 1;

    /*//////////////////////////////////////////////////////////////
                              IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Collateral token (WETH on mainnet).
    IERC20 public immutable collateralToken;
    /// @notice Borrowed token (USDC on mainnet).
    IERC20 public immutable borrowToken;

    /// @dev 10 ** (18 - collateralDecimals); normalises collateral amounts to 1e18.
    uint256 internal immutable collateralScale;
    /// @dev 10 ** (18 - borrowDecimals); normalises borrow amounts to 1e18.
    uint256 internal immutable borrowScale;

    /// @notice Max debt-to-collateral ratio a borrower may *create*, in bps (7000 = 70%).
    uint256 public immutable maxLtvBps;
    /// @notice Debt-to-collateral ratio at which a position becomes liquidatable (8500 = 85%).
    uint256 public immutable liquidationThresholdBps;
    /// @notice Extra collateral a liquidator receives, in bps (500 = 5%).
    uint256 public immutable liquidationBonusBps;

    /// @notice Minimum debt a position may carry, in borrow-token units. Positions must either
    ///         be fully repaid or stay above this floor, so a liquidation is always worth more
    ///         than its gas.
    uint256 public immutable minDebt;

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Price source for the collateral token.
    IPriceOracle public oracle;

    /// @notice Flat annual borrow rate, 1e18-scaled (0.05e18 = 5% APR).
    uint256 public ratePerYear;

    /// @notice When new borrowing and new deposits are disabled. Repay, liquidate and
    ///         collateral withdrawal are never pausable.
    bool public borrowingPaused;

    /// @notice Monotonically increasing debt index, 1e18-scaled. Starts at 1e18.
    uint256 public borrowIndex;
    /// @notice Timestamp `borrowIndex` was last advanced.
    uint256 public lastAccrualTimestamp;

    /// @notice Idle borrow-token balance owned by the market (internal accounting).
    uint256 public usdcCash;

    /// @notice Total debt shares outstanding.
    uint256 public totalDebtShares;
    /// @notice Total lender shares outstanding.
    uint256 public totalSupplyShares;
    /// @notice Total collateral held on behalf of borrowers (internal accounting).
    uint256 public totalCollateral;

    mapping(address => uint256) public supplyShares;
    mapping(address => uint256) public debtShares;
    mapping(address => uint256) public collateralOf;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event Deposit(address indexed caller, address indexed onBehalfOf, uint256 assets, uint256 shares);
    event Withdraw(address indexed owner, address indexed receiver, uint256 assets, uint256 shares);
    event CollateralDeposited(address indexed caller, address indexed onBehalfOf, uint256 amount);
    event CollateralWithdrawn(address indexed owner, address indexed receiver, uint256 amount);
    event Borrow(address indexed borrower, address indexed receiver, uint256 amount, uint256 shares);
    event Repay(address indexed caller, address indexed onBehalfOf, uint256 amount, uint256 shares);
    event Liquidate(
        address indexed liquidator,
        address indexed borrower,
        uint256 repaid,
        uint256 debtSharesRepaid,
        uint256 collateralSeized
    );
    event AccrueInterest(uint256 borrowIndex, uint256 interest);
    event OracleSet(address indexed oracle);
    event RateSet(uint256 ratePerYear);
    event BorrowingPausedSet(bool paused);
    event Skimmed(address indexed token, address indexed receiver, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAddress();
    error ZeroAmount();
    error InvalidParams();
    error UnsupportedDecimals();
    error RateTooHigh();
    error BorrowingIsPaused();
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error InsufficientCollateral(uint256 requested, uint256 available);
    error InsufficientShares(uint256 requested, uint256 available);
    error PositionUnhealthy(uint256 debtValue, uint256 maxDebtValue);
    error PositionHealthy(uint256 debtValue, uint256 liquidationDebtValue);
    error DebtBelowMinimum(uint256 debt, uint256 minDebt);
    error RepayExceedsDebt(uint256 amount, uint256 debt);
    error SlippageExceeded(uint256 got, uint256 min);
    error NoSeizableCollateral();
    error NothingToSkim();

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address owner_,
        address collateralToken_,
        address borrowToken_,
        address oracle_,
        uint256 ratePerYear_,
        uint256 maxLtvBps_,
        uint256 liquidationThresholdBps_,
        uint256 liquidationBonusBps_,
        uint256 minDebt_
    ) Ownable(owner_) {
        if (collateralToken_ == address(0) || borrowToken_ == address(0) || oracle_ == address(0)) {
            revert ZeroAddress();
        }
        if (collateralToken_ == borrowToken_) revert InvalidParams();
        if (ratePerYear_ > MAX_RATE_PER_YEAR) revert RateTooHigh();
        if (minDebt_ == 0) revert InvalidParams();

        // maxLtv < liquidationThreshold leaves a buffer between "can't borrow more" and
        // "can be liquidated", so a borrower is never liquidatable the instant they borrow.
        // The threshold plus the bonus must stay under 100%, otherwise liquidating a position
        // that is exactly at the threshold would already create bad debt.
        if (
            maxLtvBps_ == 0 || maxLtvBps_ >= liquidationThresholdBps_ || liquidationThresholdBps_ >= BPS
                || liquidationBonusBps_ == 0
                || liquidationThresholdBps_ * (BPS + liquidationBonusBps_) >= BPS * BPS
        ) {
            revert InvalidParams();
        }

        uint8 cDec = IERC20Metadata(collateralToken_).decimals();
        uint8 bDec = IERC20Metadata(borrowToken_).decimals();
        if (cDec > 18 || bDec > 18) revert UnsupportedDecimals();

        collateralToken = IERC20(collateralToken_);
        borrowToken = IERC20(borrowToken_);
        collateralScale = 10 ** (18 - cDec);
        borrowScale = 10 ** (18 - bDec);

        oracle = IPriceOracle(oracle_);
        ratePerYear = ratePerYear_;
        maxLtvBps = maxLtvBps_;
        liquidationThresholdBps = liquidationThresholdBps_;
        liquidationBonusBps = liquidationBonusBps_;
        minDebt = minDebt_;

        borrowIndex = WAD;
        lastAccrualTimestamp = block.timestamp;

        emit OracleSet(oracle_);
        emit RateSet(ratePerYear_);
    }

    /*//////////////////////////////////////////////////////////////
                           INTEREST ACCRUAL
    //////////////////////////////////////////////////////////////*/

    /// @notice Advance `borrowIndex` to the current timestamp. Called at the start of every
    ///         state-changing entry point, so every read of a debt is up to date.
    function accrueInterest() public {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0) return;

        lastAccrualTimestamp = block.timestamp;

        uint256 shares = totalDebtShares;
        // With no borrowers there is nothing to charge, and advancing the index would hand
        // interest to whoever borrows next.
        if (shares == 0) return;

        uint256 rate = ratePerYear;
        if (rate == 0) return;

        uint256 index = borrowIndex;
        uint256 before = Math.mulDiv(shares, index, WAD, Math.Rounding.Ceil);

        // Simple (non-compounding) interest over the elapsed window.
        uint256 growth = Math.mulDiv(rate, elapsed, SECONDS_PER_YEAR);
        index += Math.mulDiv(index, growth, WAD);
        borrowIndex = index;

        uint256 interest = Math.mulDiv(shares, index, WAD, Math.Rounding.Ceil) - before;
        emit AccrueInterest(index, interest);
    }

    /*//////////////////////////////////////////////////////////////
                              LENDER SIDE
    //////////////////////////////////////////////////////////////*/

    /// @notice Total borrow-token assets backing lender shares: idle cash plus outstanding debt.
    function totalAssets() public view returns (uint256) {
        return usdcCash + _totalBorrows(borrowIndex);
    }

    /// @notice Lend `assets` of borrow token, crediting shares to `onBehalfOf`.
    function deposit(uint256 assets, address onBehalfOf) external nonReentrant returns (uint256 shares) {
        if (borrowingPaused) revert BorrowingIsPaused();
        if (assets == 0) revert ZeroAmount();
        if (onBehalfOf == address(0)) revert ZeroAddress();

        accrueInterest();

        // Round shares down: never mint more claim than the assets deposited are worth.
        shares = Math.mulDiv(assets, totalSupplyShares + VIRTUAL_SHARES, totalAssets() + VIRTUAL_ASSETS);
        if (shares == 0) revert ZeroAmount();

        totalSupplyShares += shares;
        supplyShares[onBehalfOf] += shares;
        usdcCash += assets;

        emit Deposit(msg.sender, onBehalfOf, assets, shares);

        borrowToken.safeTransferFrom(msg.sender, address(this), assets);
    }

    /// @notice Burn `shares` of the caller's lender position and send the assets to `receiver`.
    /// @dev Pass `type(uint256).max` to withdraw the caller's full position.
    function withdraw(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
        if (receiver == address(0)) revert ZeroAddress();

        accrueInterest();

        uint256 owned = supplyShares[msg.sender];
        if (shares == type(uint256).max) shares = owned;
        if (shares == 0) revert ZeroAmount();
        if (shares > owned) revert InsufficientShares(shares, owned);

        // Round assets down: rounding dust stays with the pool, not the exiting lender.
        assets = Math.mulDiv(shares, totalAssets() + VIRTUAL_ASSETS, totalSupplyShares + VIRTUAL_SHARES);
        if (assets == 0) revert ZeroAmount();
        // Lenders can only exit against idle cash; at full utilisation they must wait for
        // repayments. This is the normal pool-lending liquidity constraint.
        if (assets > usdcCash) revert InsufficientLiquidity(assets, usdcCash);

        totalSupplyShares -= shares;
        supplyShares[msg.sender] = owned - shares;
        usdcCash -= assets;

        emit Withdraw(msg.sender, receiver, assets, shares);

        borrowToken.safeTransfer(receiver, assets);
    }

    /*//////////////////////////////////////////////////////////////
                             BORROWER SIDE
    //////////////////////////////////////////////////////////////*/

    /// @notice Lock collateral for `onBehalfOf`.
    /// @dev Crediting someone else can only ever improve their health, so it is safe to allow.
    function depositCollateral(uint256 amount, address onBehalfOf) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (onBehalfOf == address(0)) revert ZeroAddress();

        collateralOf[onBehalfOf] += amount;
        totalCollateral += amount;

        emit CollateralDeposited(msg.sender, onBehalfOf, amount);

        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Withdraw collateral, provided the caller's position stays within `maxLtvBps`.
    function withdrawCollateral(uint256 amount, address receiver) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        accrueInterest();

        uint256 balance = collateralOf[msg.sender];
        if (amount > balance) revert InsufficientCollateral(amount, balance);

        uint256 remaining = balance - amount;
        collateralOf[msg.sender] = remaining;
        totalCollateral -= amount;

        // Only consult the oracle when there is debt to secure, so a stale feed does not trap
        // the collateral of users who owe nothing.
        uint256 debt = debtOf(msg.sender);
        if (debt != 0) _requireWithinMaxLtv(debt, remaining);

        emit CollateralWithdrawn(msg.sender, receiver, amount);

        collateralToken.safeTransfer(receiver, amount);
    }

    /// @notice Borrow `amount` of borrow token against the caller's collateral.
    function borrow(uint256 amount, address receiver) external nonReentrant returns (uint256 shares) {
        if (borrowingPaused) revert BorrowingIsPaused();
        if (amount == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        accrueInterest();

        if (amount > usdcCash) revert InsufficientLiquidity(amount, usdcCash);

        // Round shares up: the borrower owes at least what they took.
        shares = Math.mulDiv(amount, WAD, borrowIndex, Math.Rounding.Ceil);
        if (shares == 0) revert ZeroAmount();

        debtShares[msg.sender] += shares;
        totalDebtShares += shares;
        usdcCash -= amount;

        uint256 debt = debtOf(msg.sender);
        if (debt < minDebt) revert DebtBelowMinimum(debt, minDebt);
        _requireWithinMaxLtv(debt, collateralOf[msg.sender]);

        emit Borrow(msg.sender, receiver, amount, shares);

        borrowToken.safeTransfer(receiver, amount);
    }

    /// @notice Repay debt owed by `onBehalfOf`, paying from the caller's balance.
    /// @dev Pass `type(uint256).max` to repay the position in full. Partial repayments must
    ///      leave the position at or above `minDebt`.
    function repay(uint256 amount, address onBehalfOf) external nonReentrant returns (uint256 shares) {
        accrueInterest();

        (amount, shares) = _repay(amount, onBehalfOf);

        emit Repay(msg.sender, onBehalfOf, amount, shares);

        borrowToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    /*//////////////////////////////////////////////////////////////
                              LIQUIDATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Repay part (or all) of an unhealthy position's debt and seize the matching
    ///         collateral plus `liquidationBonusBps`.
    /// @param borrower       Position to liquidate.
    /// @param repayAmount    Borrow-token amount to repay, or `type(uint256).max` for the full debt.
    /// @param minCollateralOut Liquidator's slippage floor on seized collateral. Protects against
    ///        the price moving, or against a position whose collateral cannot cover the bonus.
    /// @return repaid    Borrow token actually pulled from the liquidator.
    /// @return seized    Collateral sent to the liquidator.
    function liquidate(address borrower, uint256 repayAmount, uint256 minCollateralOut)
        external
        nonReentrant
        returns (uint256 repaid, uint256 seized)
    {
        accrueInterest();

        uint256 price = oracle.collateralPriceUsd();
        uint256 collateral = collateralOf[borrower];
        uint256 debt = debtOf(borrower);

        // Health check uses the pre-repayment state.
        uint256 debtValue = _borrowValue(debt);
        uint256 liquidationDebtValue =
            Math.mulDiv(_collateralValue(collateral, price), liquidationThresholdBps, BPS);
        if (debtValue <= liquidationDebtValue) revert PositionHealthy(debtValue, liquidationDebtValue);

        uint256 shares;
        (repaid, shares) = _repay(repayAmount, borrower);

        // Collateral worth the repayment, marked up by the bonus. Rounded down so rounding dust
        // stays with the borrower rather than the liquidator.
        seized = Math.mulDiv(
            _borrowValue(repaid) * (BPS + liquidationBonusBps), WAD, price * BPS, Math.Rounding.Floor
        ) / collateralScale;

        // A position deep enough underwater cannot pay the bonus. Cap at what it has; the
        // liquidator opted into that outcome via `minCollateralOut`.
        if (seized > collateral) seized = collateral;
        if (seized == 0) revert NoSeizableCollateral();
        if (seized < minCollateralOut) revert SlippageExceeded(seized, minCollateralOut);

        collateralOf[borrower] = collateral - seized;
        totalCollateral -= seized;

        emit Liquidate(msg.sender, borrower, repaid, shares, seized);

        borrowToken.safeTransferFrom(msg.sender, address(this), repaid);
        collateralToken.safeTransfer(msg.sender, seized);
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    /// @notice Current debt of `account` in borrow-token units, interest included.
    function debtOf(address account) public view returns (uint256) {
        return Math.mulDiv(debtShares[account], _currentIndex(), WAD, Math.Rounding.Ceil);
    }

    /// @notice Total outstanding debt in borrow-token units, interest included.
    function totalBorrows() external view returns (uint256) {
        return _totalBorrows(_currentIndex());
    }

    /// @notice True when `account` may be liquidated at the current price.
    function isLiquidatable(address account) external view returns (bool) {
        uint256 collateralValue = _collateralValue(collateralOf[account], oracle.collateralPriceUsd());
        return _borrowValue(debtOf(account)) > Math.mulDiv(collateralValue, liquidationThresholdBps, BPS);
    }

    /// @notice Additional borrow-token amount `account` could borrow right now, ignoring
    ///         available liquidity.
    function maxBorrowable(address account) external view returns (uint256) {
        uint256 collateralValue = _collateralValue(collateralOf[account], oracle.collateralPriceUsd());
        uint256 limit = Math.mulDiv(collateralValue, maxLtvBps, BPS) / borrowScale;
        uint256 debt = debtOf(account);
        return debt >= limit ? 0 : limit - debt;
    }

    /*//////////////////////////////////////////////////////////////
                              ADMIN
    //////////////////////////////////////////////////////////////*/

    /// @notice Point the market at a new price oracle.
    /// @dev The single most dangerous action in this system; put it behind a timelock.
    ///      See NOTES.md.
    function setOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert ZeroAddress();
        // Sanity-check the replacement before committing to it.
        if (IPriceOracle(newOracle).collateralPriceUsd() == 0) revert InvalidParams();
        oracle = IPriceOracle(newOracle);
        emit OracleSet(newOracle);
    }

    /// @notice Update the flat annual borrow rate.
    function setRatePerYear(uint256 newRate) external onlyOwner {
        if (newRate > MAX_RATE_PER_YEAR) revert RateTooHigh();
        // Accrue first so the new rate only applies going forward.
        accrueInterest();
        ratePerYear = newRate;
        emit RateSet(newRate);
    }

    /// @notice Disable new borrows and new deposits. Repay, liquidate and collateral
    ///         withdrawal stay open so users are never locked in.
    function setBorrowingPaused(bool paused) external onlyOwner {
        borrowingPaused = paused;
        emit BorrowingPausedSet(paused);
    }

    /// @notice Sweep tokens sent to the market outside of its accounting.
    /// @dev Bounded by internal accounting, so it can never touch lender cash or collateral.
    function skim(address token, address receiver) external onlyOwner returns (uint256 amount) {
        if (receiver == address(0)) revert ZeroAddress();

        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 reserved;
        if (token == address(borrowToken)) reserved = usdcCash;
        if (token == address(collateralToken)) reserved += totalCollateral;

        if (balance <= reserved) revert NothingToSkim();
        amount = balance - reserved;

        emit Skimmed(token, receiver, amount);
        IERC20(token).safeTransfer(receiver, amount);
    }

    /*//////////////////////////////////////////////////////////////
                              INTERNALS
    //////////////////////////////////////////////////////////////*/

    /// @dev Shared repayment bookkeeping. Does not move tokens.
    function _repay(uint256 amount, address onBehalfOf) internal returns (uint256 repaid, uint256 shares) {
        uint256 ownedShares = debtShares[onBehalfOf];
        uint256 debt = Math.mulDiv(ownedShares, borrowIndex, WAD, Math.Rounding.Ceil);
        if (debt == 0) revert ZeroAmount();

        if (amount == type(uint256).max || amount == debt) {
            // Full repayment: burn every share so no rounding dust is left behind.
            repaid = debt;
            shares = ownedShares;
        } else {
            if (amount == 0) revert ZeroAmount();
            if (amount > debt) revert RepayExceedsDebt(amount, debt);
            repaid = amount;
            // Round shares down: the repayer is credited no more than they paid for.
            shares = Math.mulDiv(amount, WAD, borrowIndex, Math.Rounding.Floor);
            uint256 left = debt - amount;
            // Keep positions either closed or economically liquidatable, never dust.
            if (left < minDebt) revert DebtBelowMinimum(left, minDebt);
        }

        debtShares[onBehalfOf] = ownedShares - shares;
        totalDebtShares -= shares;
        usdcCash += repaid;
    }

    function _currentIndex() internal view returns (uint256) {
        uint256 index = borrowIndex;
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0 || totalDebtShares == 0 || ratePerYear == 0) return index;
        return index + Math.mulDiv(index, Math.mulDiv(ratePerYear, elapsed, SECONDS_PER_YEAR), WAD);
    }

    function _totalBorrows(uint256 index) internal view returns (uint256) {
        return Math.mulDiv(totalDebtShares, index, WAD, Math.Rounding.Ceil);
    }

    /// @dev USD value of a collateral amount, 1e18-scaled.
    function _collateralValue(uint256 amount, uint256 price) internal view returns (uint256) {
        return Math.mulDiv(amount * collateralScale, price, WAD);
    }

    /// @dev USD value of a borrow-token amount, 1e18-scaled. USDC is treated as $1; see NOTES.md.
    function _borrowValue(uint256 amount) internal view returns (uint256) {
        return amount * borrowScale;
    }

    function _requireWithinMaxLtv(uint256 debt, uint256 collateral) internal view {
        uint256 collateralValue = _collateralValue(collateral, oracle.collateralPriceUsd());
        uint256 maxDebtValue = Math.mulDiv(collateralValue, maxLtvBps, BPS);
        uint256 debtValue = _borrowValue(debt);
        if (debtValue > maxDebtValue) revert PositionUnhealthy(debtValue, maxDebtValue);
    }
}
