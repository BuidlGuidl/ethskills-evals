// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @title LendingPool
/// @notice Single-pair borrowing market: lock WETH collateral, borrow USDC against it.
///
/// @dev Design notes that matter for safety:
///      - All value comparisons happen in a single unit: USD with 18 decimals ("value"). Token
///        amounts are in their own native decimals and are never compared directly.
///      - Debt is stored as index-normalised shares. `borrowIndex` grows with a flat annual rate;
///        a position's USDC debt is always `shares * borrowIndex`, rounded up.
///      - Every rounding decision is made in the pool's favour: debt rounds up, seized collateral
///        rounds down, credited deposits round down.
///      - USDC liquidity is supplied by the operator, not by third-party lenders. There is no
///        deposit/share token on the debt side, so there is no first-depositor or donation surface.
contract LendingPool is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --------------------------------------------------------------------- //
    //                                Errors                                  //
    // --------------------------------------------------------------------- //

    error InvalidConfig();
    error ZeroAmount();
    error InexactTransfer(uint256 expected, uint256 received);
    error InsufficientCollateral(uint256 available, uint256 requested);
    error InsufficientLiquidity(uint256 available, uint256 requested);
    error PositionUnhealthy(uint256 debtValue, uint256 maxDebtValue);
    error PositionHealthy(uint256 debtValue, uint256 liquidationValue);
    error DebtBelowMinimum(uint256 debt, uint256 minimum);
    error NoDebt();
    error NothingToSeize();
    error SlippageExceeded(uint256 seized, uint256 minSeized);

    // --------------------------------------------------------------------- //
    //                                Events                                  //
    // --------------------------------------------------------------------- //

    event CollateralDeposited(address indexed account, address indexed payer, uint256 amount);
    event CollateralWithdrawn(address indexed account, address indexed to, uint256 amount);
    event Borrowed(address indexed account, address indexed to, uint256 amount, uint256 shares);
    event Repaid(address indexed account, address indexed payer, uint256 amount, uint256 shares);
    event Liquidated(
        address indexed account,
        address indexed liquidator,
        uint256 repaidAmount,
        uint256 repaidShares,
        uint256 seizedCollateral
    );
    event InterestAccrued(uint256 borrowIndex, uint256 totalDebt);
    event LiquiditySupplied(address indexed from, uint256 amount);
    event LiquidityWithdrawn(address indexed to, uint256 amount);

    // --------------------------------------------------------------------- //
    //                              Constants                                 //
    // --------------------------------------------------------------------- //

    /// @notice Basis-point denominator.
    uint256 public constant BPS = 1e4;
    /// @notice Fixed-point scale of the borrow index.
    uint256 public constant RAY = 1e27;
    /// @notice Scale of every USD "value" in this contract.
    uint256 public constant VALUE_SCALE = 1e18;

    uint256 private constant SECONDS_PER_YEAR = 365 days;

    // --------------------------------------------------------------------- //
    //                          Immutable parameters                          //
    // --------------------------------------------------------------------- //

    /// @notice Collateral token (WETH on mainnet).
    IERC20 public immutable collateralToken;
    /// @notice Borrowable token (USDC on mainnet).
    IERC20 public immutable debtToken;

    /// @notice USD price source for the collateral token (ETH/USD).
    IPriceOracle public immutable collateralOracle;
    /// @notice USD price source for the debt token (USDC/USD). Not assumed to be exactly $1.
    IPriceOracle public immutable debtOracle;

    /// @notice Maximum debt value as a fraction of collateral value at borrow/withdraw time, in bps.
    uint256 public immutable maxLtvBps;
    /// @notice Debt-to-collateral value above which a position may be liquidated, in bps.
    uint256 public immutable liquidationThresholdBps;
    /// @notice Extra collateral a liquidator receives on top of the value repaid, in bps.
    uint256 public immutable liquidationBonusBps;
    /// @notice Fraction of a position's debt a single liquidation may repay while it is still solvent, in bps.
    uint256 public immutable closeFactorBps;
    /// @notice Flat annual interest rate, 1e18 = 100%/year.
    uint256 public immutable annualRateWad;
    /// @notice Minimum debt a position may carry; keeps liquidations worth their gas.
    uint256 public immutable minDebt;

    /// @dev 10 ** collateralToken.decimals()
    uint256 private immutable _collateralUnit;
    /// @dev 10 ** debtToken.decimals()
    uint256 private immutable _debtUnit;

    // --------------------------------------------------------------------- //
    //                                Storage                                 //
    // --------------------------------------------------------------------- //

    struct Position {
        /// @dev Collateral held for this account, in collateral-token decimals.
        uint256 collateral;
        /// @dev Index-normalised debt. Actual debt = shares * borrowIndex / RAY, rounded up.
        uint256 debtShares;
    }

    mapping(address account => Position) private _positions;

    /// @notice Sum of all `debtShares`.
    uint256 public totalDebtShares;
    /// @notice Sum of all collateral held for borrowers. Excludes donated collateral.
    uint256 public totalCollateral;
    /// @notice Growth factor applied to debt shares, RAY-scaled.
    uint256 public borrowIndex = RAY;
    /// @notice Timestamp `borrowIndex` was last brought up to date.
    uint256 public lastAccrualTimestamp;

    // --------------------------------------------------------------------- //
    //                             Construction                               //
    // --------------------------------------------------------------------- //

    struct Params {
        IERC20 collateralToken;
        IERC20 debtToken;
        IPriceOracle collateralOracle;
        IPriceOracle debtOracle;
        uint256 maxLtvBps;
        uint256 liquidationThresholdBps;
        uint256 liquidationBonusBps;
        uint256 closeFactorBps;
        uint256 annualRateWad;
        uint256 minDebt;
        address owner;
    }

    constructor(Params memory p) Ownable(p.owner) {
        if (
            address(p.collateralToken) == address(0) || address(p.debtToken) == address(0)
                || address(p.collateralToken) == address(p.debtToken) || address(p.collateralOracle) == address(0)
                || address(p.debtOracle) == address(0)
        ) revert InvalidConfig();

        // Ordering that keeps the market solvable:
        //   maxLtv < liquidationThreshold  -> a fresh borrow is not instantly liquidatable
        //   threshold * (1 + bonus) <= 1   -> a liquidation at the threshold cannot seize more
        //                                     value than the position holds, so the bonus is paid
        //                                     out of the borrower's buffer, never out of principal.
        if (p.maxLtvBps == 0 || p.maxLtvBps >= p.liquidationThresholdBps || p.liquidationThresholdBps >= BPS) {
            revert InvalidConfig();
        }
        if (p.liquidationBonusBps == 0 || p.liquidationBonusBps > 2_000) revert InvalidConfig();
        if (p.liquidationThresholdBps * (BPS + p.liquidationBonusBps) > BPS * BPS) revert InvalidConfig();
        if (p.closeFactorBps == 0 || p.closeFactorBps > BPS) revert InvalidConfig();
        // Sanity cap on the rate: 100%/year. A flat rate this contract cannot change must be sane.
        if (p.annualRateWad > 1e18) revert InvalidConfig();
        if (p.minDebt == 0) revert InvalidConfig();

        collateralToken = p.collateralToken;
        debtToken = p.debtToken;
        collateralOracle = p.collateralOracle;
        debtOracle = p.debtOracle;
        maxLtvBps = p.maxLtvBps;
        liquidationThresholdBps = p.liquidationThresholdBps;
        liquidationBonusBps = p.liquidationBonusBps;
        closeFactorBps = p.closeFactorBps;
        annualRateWad = p.annualRateWad;
        minDebt = p.minDebt;

        uint8 collateralDecimals = IERC20Metadata(address(p.collateralToken)).decimals();
        uint8 debtDecimals = IERC20Metadata(address(p.debtToken)).decimals();
        if (collateralDecimals > 18 || debtDecimals > 18) revert InvalidConfig();
        _collateralUnit = 10 ** collateralDecimals;
        _debtUnit = 10 ** debtDecimals;

        lastAccrualTimestamp = block.timestamp;
    }

    // --------------------------------------------------------------------- //
    //                            Interest accrual                            //
    // --------------------------------------------------------------------- //

    /// @notice Brings `borrowIndex` up to the current block.
    function accrueInterest() public {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0) return;
        lastAccrualTimestamp = block.timestamp;

        uint256 shares = totalDebtShares;
        uint256 rate = annualRateWad;
        if (shares == 0 || rate == 0) return;

        // Simple interest over the elapsed window, applied to the running index. Because the index
        // is only ever multiplied forward, interest compounds at whatever cadence the pool is
        // touched. That is an upper-bounded deviation from continuous compounding and is deliberate:
        // the rate model is fixed and intentionally boring.
        uint256 index = borrowIndex;
        uint256 growth = Math.mulDiv(index, rate * elapsed, SECONDS_PER_YEAR * 1e18);
        borrowIndex = index + growth;

        emit InterestAccrued(borrowIndex, _toDebtAmount(shares));
    }

    // --------------------------------------------------------------------- //
    //                          Borrower entry points                         //
    // --------------------------------------------------------------------- //

    /// @notice Locks collateral for `onBehalfOf`.
    /// @dev Anyone may top up anyone's position; that can only improve the recipient's health.
    function depositCollateral(uint256 amount, address onBehalfOf) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (onBehalfOf == address(0)) revert InvalidConfig();

        _positions[onBehalfOf].collateral += amount;
        totalCollateral += amount;

        _pullExact(collateralToken, msg.sender, amount);

        emit CollateralDeposited(onBehalfOf, msg.sender, amount);
    }

    /// @notice Withdraws collateral to `to`, leaving the caller's position within `maxLtvBps`.
    function withdrawCollateral(uint256 amount, address to) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert InvalidConfig();
        accrueInterest();

        Position storage position = _positions[msg.sender];
        uint256 collateral = position.collateral;
        if (amount > collateral) revert InsufficientCollateral(collateral, amount);

        unchecked {
            position.collateral = collateral - amount;
        }
        totalCollateral -= amount;

        _requireWithinLtv(position);

        collateralToken.safeTransfer(to, amount);

        emit CollateralWithdrawn(msg.sender, to, amount);
    }

    /// @notice Borrows `amount` of the debt token against the caller's collateral.
    function borrow(uint256 amount, address to) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert InvalidConfig();
        accrueInterest();

        Position storage position = _positions[msg.sender];

        // Round shares up so the borrower never gains from truncation.
        uint256 shares = Math.mulDiv(amount, RAY, borrowIndex, Math.Rounding.Ceil);
        position.debtShares += shares;
        totalDebtShares += shares;

        uint256 debt = _toDebtAmount(position.debtShares);
        if (debt < minDebt) revert DebtBelowMinimum(debt, minDebt);

        _requireWithinLtv(position);

        uint256 available = debtToken.balanceOf(address(this));
        if (amount > available) revert InsufficientLiquidity(available, amount);

        debtToken.safeTransfer(to, amount);

        emit Borrowed(msg.sender, to, amount, shares);
    }

    /// @notice Repays debt owed by `onBehalfOf`. Pass `type(uint256).max` to repay in full.
    /// @return repaid The debt-token amount actually pulled from the caller.
    function repay(uint256 amount, address onBehalfOf) external nonReentrant returns (uint256 repaid) {
        accrueInterest();

        Position storage position = _positions[onBehalfOf];
        uint256 shares = position.debtShares;
        if (shares == 0) revert NoDebt();

        uint256 debt = _toDebtAmount(shares);
        uint256 burnedShares;
        if (amount >= debt) {
            repaid = debt;
            burnedShares = shares;
        } else {
            if (amount == 0) revert ZeroAmount();
            repaid = amount;
            // Round burned shares down: a partial repayment never retires more debt than it pays for.
            burnedShares = Math.mulDiv(amount, RAY, borrowIndex, Math.Rounding.Floor);
        }

        uint256 remainingShares = shares - burnedShares;
        position.debtShares = remainingShares;
        totalDebtShares -= burnedShares;

        // Leaving unliquidatable dust behind is worse than forcing a full repayment.
        uint256 remainingDebt = _toDebtAmount(remainingShares);
        if (remainingDebt != 0 && remainingDebt < minDebt) revert DebtBelowMinimum(remainingDebt, minDebt);

        _pullExact(debtToken, msg.sender, repaid);

        emit Repaid(onBehalfOf, msg.sender, repaid, burnedShares);
    }

    // --------------------------------------------------------------------- //
    //                              Liquidation                               //
    // --------------------------------------------------------------------- //

    /// @notice Repays part of an unhealthy position's debt and seizes the matching collateral plus bonus.
    /// @param account       Borrower being liquidated.
    /// @param repayAmount   Debt-token amount the liquidator offers. Capped by the close factor and
    ///                      by the collateral actually available; pass `type(uint256).max` for the max.
    /// @param minSeized     Minimum collateral the liquidator will accept, as slippage protection
    ///                      against a price move between simulation and inclusion.
    /// @param to            Recipient of the seized collateral.
    /// @return repaid       Debt-token amount actually pulled from the liquidator.
    /// @return seized       Collateral transferred to `to`.
    function liquidate(address account, uint256 repayAmount, uint256 minSeized, address to)
        external
        nonReentrant
        returns (uint256 repaid, uint256 seized)
    {
        if (to == address(0)) revert InvalidConfig();
        accrueInterest();

        Position storage position = _positions[account];
        uint256 shares = position.debtShares;
        if (shares == 0) revert NoDebt();

        uint256 debt = _toDebtAmount(shares);
        uint256 collateral = position.collateral;
        uint256 collateralPrice = collateralOracle.price();
        uint256 debtPrice = debtOracle.price();

        {
            uint256 collateralValue = _collateralValue(collateral, collateralPrice);
            uint256 debtValue = _debtValue(debt, debtPrice);
            uint256 liquidationValue = Math.mulDiv(collateralValue, liquidationThresholdBps, BPS);
            if (debtValue <= liquidationValue) revert PositionHealthy(debtValue, liquidationValue);

            // While the position is still solvent the close factor limits how much of it can be
            // taken in one go. Once it is underwater the cap is lifted so the debt can be cleared.
            uint256 maxRepay = debtValue >= collateralValue ? debt : Math.mulDiv(debt, closeFactorBps, BPS);
            repaid = repayAmount > maxRepay ? maxRepay : repayAmount;
        }
        if (repaid == 0) revert ZeroAmount();

        (repaid, seized) = _settleSeizure(repaid, collateral, collateralPrice, debtPrice);
        if (seized == 0) revert NothingToSeize();
        if (seized < minSeized) revert SlippageExceeded(seized, minSeized);

        // Round burned shares down, as in `repay`.
        uint256 burnedShares =
            repaid >= debt ? shares : Math.mulDiv(repaid, RAY, borrowIndex, Math.Rounding.Floor);

        // Effects before interactions.
        position.debtShares = shares - burnedShares;
        totalDebtShares -= burnedShares;
        position.collateral = collateral - seized;
        totalCollateral -= seized;

        _pullExact(debtToken, msg.sender, repaid);
        collateralToken.safeTransfer(to, seized);

        emit Liquidated(account, msg.sender, repaid, burnedShares, seized);
    }

    // --------------------------------------------------------------------- //
    //                                 Views                                  //
    // --------------------------------------------------------------------- //

    /// @notice Collateral and current (interest-inclusive) debt of `account`.
    function positionOf(address account) external view returns (uint256 collateral, uint256 debt) {
        Position storage position = _positions[account];
        collateral = position.collateral;
        debt = Math.mulDiv(position.debtShares, _simulatedIndex(), RAY, Math.Rounding.Ceil);
    }

    /// @notice Current debt of `account` in debt-token units, including interest up to this block.
    function debtOf(address account) public view returns (uint256) {
        return Math.mulDiv(_positions[account].debtShares, _simulatedIndex(), RAY, Math.Rounding.Ceil);
    }

    /// @notice Total outstanding debt across all positions, including interest up to this block.
    function totalDebt() external view returns (uint256) {
        return Math.mulDiv(totalDebtShares, _simulatedIndex(), RAY, Math.Rounding.Ceil);
    }

    /// @notice USD values (18 decimals) backing every health decision for `account`.
    /// @return collateralValue Value of the locked collateral.
    /// @return debtValue       Value of the outstanding debt.
    /// @return maxDebtValue    Debt value ceiling for borrowing/withdrawing (`maxLtvBps`).
    /// @return liquidationValue Debt value above which the position is liquidatable.
    function accountValues(address account)
        external
        view
        returns (uint256 collateralValue, uint256 debtValue, uint256 maxDebtValue, uint256 liquidationValue)
    {
        Position storage position = _positions[account];
        collateralValue = _collateralValue(position.collateral, collateralOracle.price());
        debtValue = _debtValue(debtOf(account), debtOracle.price());
        maxDebtValue = Math.mulDiv(collateralValue, maxLtvBps, BPS);
        liquidationValue = Math.mulDiv(collateralValue, liquidationThresholdBps, BPS);
    }

    /// @notice True if `account` can be liquidated at the current price and accrued debt.
    function isLiquidatable(address account) external view returns (bool) {
        Position storage position = _positions[account];
        if (position.debtShares == 0) return false;
        uint256 collateralValue = _collateralValue(position.collateral, collateralOracle.price());
        uint256 debtValue = _debtValue(debtOf(account), debtOracle.price());
        return debtValue > Math.mulDiv(collateralValue, liquidationThresholdBps, BPS);
    }

    /// @notice Additional debt `account` could take right now, bounded by LTV and by idle liquidity.
    function availableToBorrow(address account) external view returns (uint256) {
        Position storage position = _positions[account];
        uint256 collateralValue = _collateralValue(position.collateral, collateralOracle.price());
        uint256 maxDebtValue = Math.mulDiv(collateralValue, maxLtvBps, BPS);
        uint256 debtPrice = debtOracle.price();
        uint256 debtValue = _debtValue(debtOf(account), debtPrice);
        if (debtValue >= maxDebtValue) return 0;
        uint256 headroom = _debtAmountForValue(maxDebtValue - debtValue, debtPrice);
        uint256 liquidity = debtToken.balanceOf(address(this));
        return headroom > liquidity ? liquidity : headroom;
    }

    // --------------------------------------------------------------------- //
    //                            Operator surface                            //
    // --------------------------------------------------------------------- //

    /// @notice Adds borrowable liquidity. Open to anyone; funds added here are not withdrawable
    ///         by the sender, only by the owner.
    function supplyLiquidity(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _pullExact(debtToken, msg.sender, amount);
        emit LiquiditySupplied(msg.sender, amount);
    }

    /// @notice Withdraws idle debt-token liquidity (principal plus accrued interest).
    /// @dev Cannot touch collateral. Withdrawing here only shrinks what new borrowers can draw;
    ///      it cannot seize an existing position. Owner must be a multisig or timelock.
    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert InvalidConfig();
        uint256 available = debtToken.balanceOf(address(this));
        if (amount > available) revert InsufficientLiquidity(available, amount);
        debtToken.safeTransfer(to, amount);
        emit LiquidityWithdrawn(to, amount);
    }

    /// @notice Halts new deposits and borrows. Repay, withdraw and liquidate stay open by design,
    ///         so a paused market cannot trap a borrower or block a liquidator.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --------------------------------------------------------------------- //
    //                               Internals                                //
    // --------------------------------------------------------------------- //

    /// @dev Reverts unless the position's debt value sits at or below `maxLtvBps` of its collateral value.
    function _requireWithinLtv(Position storage position) private view {
        uint256 shares = position.debtShares;
        if (shares == 0) return;

        uint256 collateralValue = _collateralValue(position.collateral, collateralOracle.price());
        uint256 debtValue = _debtValue(_toDebtAmount(shares), debtOracle.price());
        uint256 maxDebtValue = Math.mulDiv(collateralValue, maxLtvBps, BPS);
        if (debtValue > maxDebtValue) revert PositionUnhealthy(debtValue, maxDebtValue);
    }

    /// @dev Debt shares -> debt-token amount at the stored index, rounded up.
    function _toDebtAmount(uint256 shares) private view returns (uint256) {
        return Math.mulDiv(shares, borrowIndex, RAY, Math.Rounding.Ceil);
    }

    /// @dev `borrowIndex` as it would be after accrual, for view functions that must not mutate.
    function _simulatedIndex() private view returns (uint256) {
        uint256 index = borrowIndex;
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0 || totalDebtShares == 0 || annualRateWad == 0) return index;
        return index + Math.mulDiv(index, annualRateWad * elapsed, SECONDS_PER_YEAR * 1e18);
    }

    function _collateralValue(uint256 amount, uint256 price) private view returns (uint256) {
        return Math.mulDiv(amount, price, _collateralUnit);
    }

    function _debtValue(uint256 amount, uint256 price) private view returns (uint256) {
        return Math.mulDiv(amount, price, _debtUnit, Math.Rounding.Ceil);
    }

    function _debtAmountForValue(uint256 value, uint256 price) private view returns (uint256) {
        return Math.mulDiv(value, _debtUnit, price);
    }

    function _collateralForDebtValue(uint256 value, uint256 price) private view returns (uint256) {
        return Math.mulDiv(value, _collateralUnit, price);
    }

    /// @dev Given a candidate repayment, returns the collateral to seize (repaid value plus bonus,
    ///      rounded down) and the repayment adjusted down if the position cannot cover it.
    function _settleSeizure(uint256 repaid, uint256 collateral, uint256 collateralPrice, uint256 debtPrice)
        private
        view
        returns (uint256, uint256)
    {
        uint256 seized = _collateralForDebtValue(_debtValue(repaid, debtPrice), collateralPrice);
        seized = Math.mulDiv(seized, BPS + liquidationBonusBps, BPS);
        if (seized <= collateral) return (repaid, seized);

        // Position cannot cover the bonus: hand over everything left and scale the repayment down
        // to match, so the liquidator is never charged for collateral that is not there.
        seized = collateral;
        uint256 seizedValue = Math.mulDiv(_collateralValue(seized, collateralPrice), BPS, BPS + liquidationBonusBps);
        uint256 affordable = _debtAmountForValue(seizedValue, debtPrice);
        return (affordable > repaid ? repaid : affordable, seized);
    }

    /// @dev Pulls exactly `amount` and reverts if the balance delta differs. This market is only
    ///      safe with plain, non-rebasing, non-fee-on-transfer ERC-20s; rather than silently
    ///      mis-accounting for one, it refuses the transfer.
    function _pullExact(IERC20 token, address from, uint256 amount) private {
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert InexactTransfer(amount, received);
    }
}
