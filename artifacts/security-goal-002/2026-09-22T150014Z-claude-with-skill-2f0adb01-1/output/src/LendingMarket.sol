// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @title LendingMarket
/// @notice Single-pair overcollateralised borrowing market: lock `collateralToken` (WETH),
///         borrow `debtToken` (USDC) against it. Lenders supply the borrowable asset and earn
///         the interest paid by borrowers.
///
/// @dev Accounting conventions, all of which matter for safety:
///      - Token amounts are always kept in the token's own decimals (USDC is 6, WETH is 18).
///        Values are only compared after both sides are converted to a common 18-decimal USD
///        scale via {IPriceOracle}. There is no hardcoded 1e18 anywhere in the pricing path.
///      - Debt is stored as a "scaled" principal against a monotonically increasing
///        {borrowIndex} (RAY = 1e27). Interest accrues to every borrower by moving one number.
///      - Rounding always favours the protocol: borrower debt rounds up, lender withdrawals and
///        liquidator seizures round down.
///      - Every externally callable state change follows checks -> effects -> interactions and
///        carries `nonReentrant` as a second line of defence.
contract LendingMarket is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --------------------------------------------------------------------------------------
    // Risk parameters (immutable by design: a position's risk cannot be changed underneath it)
    // --------------------------------------------------------------------------------------

    /// @notice Basis-point denominator.
    uint256 public constant BPS = 10_000;
    /// @notice Maximum loan-to-value a borrower may reach when borrowing or withdrawing: 70%.
    uint256 public constant MAX_LTV_BPS = 7_000;
    /// @notice LTV above which a position may be liquidated: 85%.
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
    /// @notice Extra collateral a liquidator receives on top of what it repays: 5%.
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    /// @notice Share of the debt that can be repaid in one liquidation of a solvent position: 50%.
    uint256 public constant CLOSE_FACTOR_BPS = 5_000;
    /// @notice Upper bound on the flat annual borrow rate an operator may set: 50%.
    uint256 public constant MAX_BORROW_RATE_BPS = 5_000;

    uint256 private constant RAY = 1e27;
    uint256 private constant WAD = 1e18;
    uint256 private constant SECONDS_PER_YEAR = 365 days;
    /// @dev Virtual shares/assets offset, the ERC4626 inflation-attack mitigation. It makes the
    ///      "donate to the empty vault and round the next depositor to zero shares" attack
    ///      economically pointless.
    uint256 private constant VIRTUAL_SHARES = 1e6;

    // --------------------------------------------------------------------------------------
    // Immutable configuration
    // --------------------------------------------------------------------------------------

    /// @notice Token posted as collateral (WETH on mainnet).
    IERC20 public immutable collateralToken;
    /// @notice Token that is lent and borrowed (USDC on mainnet).
    IERC20 public immutable debtToken;
    /// @notice 10 ** collateralToken.decimals().
    uint256 public immutable collateralUnit;
    /// @notice 10 ** debtToken.decimals().
    uint256 public immutable debtUnit;
    /// @notice Price source. Immutable so no key can repoint the market at a fake feed.
    IPriceOracle public immutable oracle;

    // --------------------------------------------------------------------------------------
    // State
    // --------------------------------------------------------------------------------------

    struct Position {
        /// @dev Collateral balance, in collateralToken decimals.
        uint256 collateral;
        /// @dev Debt principal scaled by the borrow index at the time it was taken (RAY).
        uint256 scaledDebt;
    }

    /// @notice Borrower positions.
    mapping(address => Position) public positions;
    /// @notice Lender shares of the supplied-asset pool.
    mapping(address => uint256) public supplyShares;
    /// @notice Total lender shares outstanding.
    uint256 public totalSupplyShares;
    /// @notice Total scaled debt principal outstanding.
    uint256 public totalScaledDebt;
    /// @notice Interest index, starts at RAY and only grows.
    uint256 public borrowIndex;
    /// @notice Timestamp the index was last brought up to date.
    uint256 public lastAccrualTime;
    /// @notice Flat annual borrow rate in basis points.
    uint256 public borrowRateBps;

    // --------------------------------------------------------------------------------------
    // Events
    // --------------------------------------------------------------------------------------

    event Accrued(uint256 borrowIndex, uint256 totalBorrows);
    event Supplied(address indexed lender, uint256 assets, uint256 shares);
    event Withdrawn(address indexed lender, address indexed to, uint256 assets, uint256 shares);
    event CollateralDeposited(address indexed borrower, uint256 amount);
    event CollateralWithdrawn(address indexed borrower, address indexed to, uint256 amount);
    event Borrowed(address indexed borrower, address indexed to, uint256 amount);
    event Repaid(address indexed payer, address indexed borrower, uint256 amount);
    event Liquidated(
        address indexed liquidator, address indexed borrower, uint256 repaid, uint256 collateralSeized
    );
    event BorrowRateSet(uint256 oldRateBps, uint256 newRateBps);

    // --------------------------------------------------------------------------------------
    // Errors
    // --------------------------------------------------------------------------------------

    error ZeroAddress();
    error ZeroAmount();
    error SameToken();
    error UnsupportedDecimals();
    error RateTooHigh(uint256 rateBps);
    error InsufficientCollateral();
    error InsufficientLiquidity();
    error InsufficientShares();
    error PositionUnhealthy();
    error PositionHealthy();
    error NoDebt();
    error NothingToLiquidate();
    error SlippageExceeded(uint256 seized, uint256 minSeized);

    constructor(
        IERC20 _collateralToken,
        IERC20 _debtToken,
        IPriceOracle _oracle,
        uint256 _borrowRateBps,
        address _owner
    ) Ownable(_owner) {
        if (
            address(_collateralToken) == address(0) || address(_debtToken) == address(0)
                || address(_oracle) == address(0)
        ) revert ZeroAddress();
        if (address(_collateralToken) == address(_debtToken)) revert SameToken();
        if (_borrowRateBps > MAX_BORROW_RATE_BPS) revert RateTooHigh(_borrowRateBps);

        uint8 cDecimals = IERC20Metadata(address(_collateralToken)).decimals();
        uint8 dDecimals = IERC20Metadata(address(_debtToken)).decimals();
        // Decimals are read from the tokens, never assumed. >18 would overflow the value math.
        if (cDecimals > 18 || dDecimals > 18) revert UnsupportedDecimals();

        collateralToken = _collateralToken;
        debtToken = _debtToken;
        collateralUnit = 10 ** cDecimals;
        debtUnit = 10 ** dDecimals;
        oracle = _oracle;

        borrowRateBps = _borrowRateBps;
        borrowIndex = RAY;
        lastAccrualTime = block.timestamp;

        emit BorrowRateSet(0, _borrowRateBps);
    }

    // --------------------------------------------------------------------------------------
    // Interest accrual
    // --------------------------------------------------------------------------------------

    /// @notice Bring the borrow index up to the current block. Callable by anyone; every
    ///         state-changing entry point does this first.
    function accrue() public {
        uint256 index = _currentBorrowIndex();
        if (index != borrowIndex) {
            borrowIndex = index;
        }
        if (lastAccrualTime != block.timestamp) {
            lastAccrualTime = block.timestamp;
        }
        emit Accrued(index, _totalBorrows(index));
    }

    /// @notice The borrow index including interest not yet written to storage.
    function currentBorrowIndex() external view returns (uint256) {
        return _currentBorrowIndex();
    }

    function _currentBorrowIndex() internal view returns (uint256 index) {
        index = borrowIndex;
        uint256 elapsed = block.timestamp - lastAccrualTime;
        if (elapsed == 0 || totalScaledDebt == 0 || borrowRateBps == 0) return index;
        // Flat (non-compounding between touches) annual rate. Deliberately simple.
        // Multiplication happens before division so no precision is thrown away.
        index += Math.mulDiv(index, borrowRateBps * elapsed, BPS * SECONDS_PER_YEAR);
    }

    // --------------------------------------------------------------------------------------
    // Lender side
    // --------------------------------------------------------------------------------------

    /// @notice Supply `assets` of the borrowable token and receive pool shares.
    /// @dev Shares are computed from the pool state *before* the transfer, and from the amount
    ///      actually received, so a fee-on-transfer token could not mint shares it did not pay for.
    function supply(uint256 assets) external nonReentrant whenNotPaused returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        accrue();

        uint256 assetsBefore = _totalAssets(borrowIndex);
        uint256 sharesBefore = totalSupplyShares;

        uint256 balanceBefore = debtToken.balanceOf(address(this));
        debtToken.safeTransferFrom(msg.sender, address(this), assets);
        uint256 received = debtToken.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        shares = Math.mulDiv(received, sharesBefore + VIRTUAL_SHARES, assetsBefore + 1, Math.Rounding.Floor);
        if (shares == 0) revert ZeroAmount();

        totalSupplyShares = sharesBefore + shares;
        supplyShares[msg.sender] += shares;

        emit Supplied(msg.sender, received, shares);
    }

    /// @notice Burn `shares` and withdraw the underlying assets to `to`.
    function withdraw(uint256 shares, address to) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        accrue();

        uint256 held = supplyShares[msg.sender];
        if (shares > held) revert InsufficientShares();

        assets = Math.mulDiv(
            shares, _totalAssets(borrowIndex) + 1, totalSupplyShares + VIRTUAL_SHARES, Math.Rounding.Floor
        );
        if (assets == 0) revert ZeroAmount();
        // Idle cash only: assets that are currently lent out cannot be withdrawn.
        if (assets > debtToken.balanceOf(address(this))) revert InsufficientLiquidity();

        supplyShares[msg.sender] = held - shares;
        totalSupplyShares -= shares;

        debtToken.safeTransfer(to, assets);
        emit Withdrawn(msg.sender, to, assets, shares);
    }

    // --------------------------------------------------------------------------------------
    // Borrower side
    // --------------------------------------------------------------------------------------

    /// @notice Lock collateral for `onBehalfOf`.
    function depositCollateral(uint256 amount, address onBehalfOf) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (onBehalfOf == address(0)) revert ZeroAddress();

        uint256 balanceBefore = collateralToken.balanceOf(address(this));
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = collateralToken.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        positions[onBehalfOf].collateral += received;
        emit CollateralDeposited(onBehalfOf, received);
    }

    /// @notice Withdraw collateral, provided the caller's position stays within the 70% LTV.
    function withdrawCollateral(uint256 amount, address to) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        accrue();

        Position storage position = positions[msg.sender];
        if (amount > position.collateral) revert InsufficientCollateral();

        uint256 remaining = position.collateral - amount;
        position.collateral = remaining;

        // No debt means nothing to check — and no oracle read, so collateral stays withdrawable
        // even if a feed is down.
        if (position.scaledDebt != 0) {
            _requireWithinLtv(remaining, _debtOf(position.scaledDebt, borrowIndex), MAX_LTV_BPS);
        }

        collateralToken.safeTransfer(to, amount);
        emit CollateralWithdrawn(msg.sender, to, amount);
    }

    /// @notice Borrow `amount` of the debt token against the caller's collateral.
    function borrow(uint256 amount, address to) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        accrue();

        if (amount > debtToken.balanceOf(address(this))) revert InsufficientLiquidity();

        Position storage position = positions[msg.sender];
        // Round the borrower's recorded principal up.
        uint256 scaledDelta = Math.mulDiv(amount, RAY, borrowIndex, Math.Rounding.Ceil);
        uint256 newScaled = position.scaledDebt + scaledDelta;

        position.scaledDebt = newScaled;
        totalScaledDebt += scaledDelta;

        _requireWithinLtv(position.collateral, _debtOf(newScaled, borrowIndex), MAX_LTV_BPS);

        debtToken.safeTransfer(to, amount);
        emit Borrowed(msg.sender, to, amount);
    }

    /// @notice Repay debt owed by `onBehalfOf`. Pass `type(uint256).max` to repay in full.
    /// @return repaid The amount actually pulled from the caller.
    function repay(uint256 amount, address onBehalfOf) external nonReentrant returns (uint256 repaid) {
        if (amount == 0) revert ZeroAmount();
        if (onBehalfOf == address(0)) revert ZeroAddress();
        accrue();

        repaid = _reduceDebt(onBehalfOf, amount);
        debtToken.safeTransferFrom(msg.sender, address(this), repaid);
        emit Repaid(msg.sender, onBehalfOf, repaid);
    }

    // --------------------------------------------------------------------------------------
    // Liquidation
    // --------------------------------------------------------------------------------------

    /// @notice Repay part of an unhealthy position's debt and seize the matching collateral plus
    ///         the 5% bonus. Open to anyone.
    /// @param borrower        Position to liquidate.
    /// @param repayAmount     Debt-token amount the caller is willing to repay; it is capped by the
    ///                        close factor and by the collateral actually available.
    /// @param minCollateralOut Minimum collateral the caller accepts — protects the liquidator from
    ///                        a price move (or a competing liquidation) between signing and mining.
    /// @param to              Recipient of the seized collateral.
    function liquidate(address borrower, uint256 repayAmount, uint256 minCollateralOut, address to)
        external
        nonReentrant
        returns (uint256 repaid, uint256 seized)
    {
        if (repayAmount == 0) revert ZeroAmount();
        if (borrower == address(0) || to == address(0)) revert ZeroAddress();
        accrue();

        Position storage position = positions[borrower];
        uint256 collateral = position.collateral;
        uint256 debt = _debtOf(position.scaledDebt, borrowIndex);
        if (debt == 0) revert NoDebt();

        uint256 collateralValue = _collateralValue(collateral);
        uint256 debtValue = _debtValue(debt);

        // Liquidatable exactly when debt value exceeds 85% of collateral value.
        if (debtValue * BPS <= collateralValue * LIQUIDATION_THRESHOLD_BPS) revert PositionHealthy();

        // Solvent positions can only be half-closed at a time; an underwater one may be closed
        // fully so the bad debt does not sit around growing.
        uint256 maxRepay = debtValue >= collateralValue
            ? debt
            : Math.mulDiv(debt, CLOSE_FACTOR_BPS, BPS, Math.Rounding.Floor);
        repaid = repayAmount > maxRepay ? maxRepay : repayAmount;
        if (repaid == 0) revert NothingToLiquidate();

        seized = _collateralForRepay(repaid);
        if (seized > collateral) {
            // Not enough collateral to pay the full bonus: give all of it and charge only what
            // that collateral is worth, rounded down in the borrower's favour.
            seized = collateral;
            repaid = _repayForCollateral(seized);
            if (repaid == 0) revert NothingToLiquidate();
        }
        if (seized == 0) revert NothingToLiquidate();
        if (seized < minCollateralOut) revert SlippageExceeded(seized, minCollateralOut);

        // Effects before interactions.
        uint256 actuallyRepaid = _reduceDebt(borrower, repaid);
        position.collateral = collateral - seized;

        debtToken.safeTransferFrom(msg.sender, address(this), actuallyRepaid);
        collateralToken.safeTransfer(to, seized);

        emit Liquidated(msg.sender, borrower, actuallyRepaid, seized);
        repaid = actuallyRepaid;
    }

    // --------------------------------------------------------------------------------------
    // Views
    // --------------------------------------------------------------------------------------

    /// @notice Current debt of `borrower`, interest included.
    function debtOf(address borrower) public view returns (uint256) {
        return _debtOf(positions[borrower].scaledDebt, _currentBorrowIndex());
    }

    /// @notice Collateral balance of `borrower`.
    function collateralOf(address borrower) external view returns (uint256) {
        return positions[borrower].collateral;
    }

    /// @notice Total debt outstanding across all borrowers, interest included.
    function totalBorrows() external view returns (uint256) {
        return _totalBorrows(_currentBorrowIndex());
    }

    /// @notice Cash held by the market plus debt outstanding: what the lender shares are worth.
    function totalAssets() external view returns (uint256) {
        return _totalAssets(_currentBorrowIndex());
    }

    /// @notice Debt-token balance available to borrow or to withdraw right now.
    function availableLiquidity() external view returns (uint256) {
        return debtToken.balanceOf(address(this));
    }

    /// @notice Health factor scaled by 1e18: `collateralValue * 85% / debtValue`.
    ///         Below 1e18 the position is liquidatable. No debt returns `type(uint256).max`.
    function healthFactor(address borrower) external view returns (uint256) {
        uint256 debt = debtOf(borrower);
        if (debt == 0) return type(uint256).max;
        uint256 debtValue = _debtValue(debt);
        if (debtValue == 0) return type(uint256).max;
        uint256 collateralValue = _collateralValue(positions[borrower].collateral);
        return Math.mulDiv(collateralValue * LIQUIDATION_THRESHOLD_BPS, WAD, debtValue * BPS);
    }

    /// @notice Additional debt `borrower` could take right now without exceeding the 70% LTV,
    ///         ignoring available liquidity.
    function maxBorrowable(address borrower) external view returns (uint256) {
        uint256 index = _currentBorrowIndex();
        Position storage position = positions[borrower];
        uint256 limitValue = Math.mulDiv(_collateralValue(position.collateral), MAX_LTV_BPS, BPS);
        uint256 debtValue = _debtValue(_debtOf(position.scaledDebt, index));
        if (debtValue >= limitValue) return 0;
        // Convert the remaining USD headroom back into debt-token units.
        return Math.mulDiv(limitValue - debtValue, debtUnit, oracle.debtPrice(), Math.Rounding.Floor);
    }

    /// @notice True when the position is above the liquidation threshold.
    function isLiquidatable(address borrower) external view returns (bool) {
        uint256 debt = debtOf(borrower);
        if (debt == 0) return false;
        return
            _debtValue(debt) * BPS
                > _collateralValue(positions[borrower].collateral) * LIQUIDATION_THRESHOLD_BPS;
    }

    // --------------------------------------------------------------------------------------
    // Operator controls
    // --------------------------------------------------------------------------------------

    /// @notice Update the flat annual borrow rate. Accrues first, so the change only ever applies
    ///         to future interest — it can never retroactively re-price existing debt.
    function setBorrowRate(uint256 newRateBps) external onlyOwner {
        if (newRateBps > MAX_BORROW_RATE_BPS) revert RateTooHigh(newRateBps);
        accrue();
        uint256 old = borrowRateBps;
        borrowRateBps = newRateBps;
        emit BorrowRateSet(old, newRateBps);
    }

    /// @notice Stop new supply, new collateral deposits and new borrows.
    /// @dev Repaying, withdrawing collateral, withdrawing supply and liquidating stay open while
    ///      paused: a pause must never trap user funds.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --------------------------------------------------------------------------------------
    // Internals
    // --------------------------------------------------------------------------------------

    /// @dev Reduce `borrower`'s debt by up to `amount`, returning the amount actually applied.
    ///      `type(uint256).max` means "everything owed".
    function _reduceDebt(address borrower, uint256 amount) private returns (uint256 applied) {
        Position storage position = positions[borrower];
        uint256 scaled = position.scaledDebt;
        if (scaled == 0) revert NoDebt();

        uint256 debt = _debtOf(scaled, borrowIndex);
        if (amount >= debt) {
            // Full repayment: clear the scaled principal outright so no dust is left behind.
            applied = debt;
            position.scaledDebt = 0;
            totalScaledDebt -= scaled;
        } else {
            applied = amount;
            // Round the reduction down so a repayment never removes more debt than it pays for.
            uint256 scaledDelta = Math.mulDiv(applied, RAY, borrowIndex, Math.Rounding.Floor);
            if (scaledDelta == 0) revert ZeroAmount();
            position.scaledDebt = scaled - scaledDelta;
            totalScaledDebt -= scaledDelta;
        }
    }

    /// @dev Debt owed for a scaled principal, rounded up.
    function _debtOf(uint256 scaled, uint256 index) private pure returns (uint256) {
        if (scaled == 0) return 0;
        return Math.mulDiv(scaled, index, RAY, Math.Rounding.Ceil);
    }

    function _totalBorrows(uint256 index) private view returns (uint256) {
        return _debtOf(totalScaledDebt, index);
    }

    function _totalAssets(uint256 index) private view returns (uint256) {
        return debtToken.balanceOf(address(this)) + _totalBorrows(index);
    }

    /// @dev USD value (18 decimals) of a collateral-token amount.
    function _collateralValue(uint256 amount) private view returns (uint256) {
        if (amount == 0) return 0;
        return Math.mulDiv(amount, oracle.collateralPrice(), collateralUnit, Math.Rounding.Floor);
    }

    /// @dev USD value (18 decimals) of a debt-token amount, rounded up.
    function _debtValue(uint256 amount) private view returns (uint256) {
        if (amount == 0) return 0;
        return Math.mulDiv(amount, oracle.debtPrice(), debtUnit, Math.Rounding.Ceil);
    }

    /// @dev Collateral a liquidator receives for repaying `repayAmount`, bonus included.
    function _collateralForRepay(uint256 repayAmount) private view returns (uint256) {
        uint256 value = Math.mulDiv(repayAmount, oracle.debtPrice(), debtUnit, Math.Rounding.Floor);
        uint256 valueWithBonus = Math.mulDiv(value, BPS + LIQUIDATION_BONUS_BPS, BPS, Math.Rounding.Floor);
        return Math.mulDiv(valueWithBonus, collateralUnit, oracle.collateralPrice(), Math.Rounding.Floor);
    }

    /// @dev Inverse of {_collateralForRepay}: what a seizure of `seizeAmount` must cost.
    function _repayForCollateral(uint256 seizeAmount) private view returns (uint256) {
        uint256 value =
            Math.mulDiv(seizeAmount, oracle.collateralPrice(), collateralUnit, Math.Rounding.Floor);
        uint256 valueWithoutBonus = Math.mulDiv(value, BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
        return Math.mulDiv(valueWithoutBonus, debtUnit, oracle.debtPrice(), Math.Rounding.Floor);
    }

    /// @dev Revert unless `debt` is within `ltvBps` of `collateral`'s value.
    function _requireWithinLtv(uint256 collateral, uint256 debt, uint256 ltvBps) private view {
        uint256 debtValue = _debtValue(debt);
        uint256 collateralValue = _collateralValue(collateral);
        if (debtValue * BPS > collateralValue * ltvBps) revert PositionUnhealthy();
    }
}
