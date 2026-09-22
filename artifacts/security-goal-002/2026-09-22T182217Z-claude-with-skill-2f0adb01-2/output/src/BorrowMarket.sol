// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/// @title BorrowMarket
/// @notice Single-pair overcollateralised borrowing market: lock WETH collateral, borrow USDC.
/// @dev    Intended deployment is WETH (18 decimals) collateral / USDC (6 decimals) debt priced by the
///         Chainlink ETH/USD feed (8 decimals). Nothing below hardcodes those decimals: the unit scales are
///         read from the tokens and the feed at construction time.
///
///         Accounting model
///         ----------------
///         Debt is stored as a *scaled* balance against a monotonically increasing `borrowIndex` (RAY = 1e27).
///         `debt = ceil(scaledDebt * borrowIndex / RAY)`. Interest is simple over each elapsed interval and
///         compounds at whatever cadence `_accrue()` happens to run, which is before every state-touching
///         operation. Rounding is always resolved in the protocol's favour.
///
///         Liquidity model
///         ---------------
///         The USDC lent out is supplied by the owner (`fundLiquidity`), not by public depositors. Interest
///         accrues to the pool and is therefore claimable by the owner via `withdrawLiquidity`. WETH
///         collateral is never withdrawable by the owner under any code path.
contract BorrowMarket is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    // --------------------------------------------------------------------------------------------------
    // Constants
    // --------------------------------------------------------------------------------------------------

    uint256 public constant BPS = 10_000;
    uint256 internal constant RAY = 1e27;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    /// @notice Most a borrower may owe at the moment of borrowing / withdrawing, as a share of collateral value.
    uint256 public constant MAX_LTV_BPS = 7_000; // 70%

    /// @notice Debt-to-collateral ratio at which a position becomes liquidatable.
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500; // 85%

    /// @notice Extra collateral a liquidator receives on top of the value they repay.
    uint256 public constant LIQUIDATION_BONUS_BPS = 500; // 5%

    /// @notice Share of a liquidatable position's debt that may be repaid in one liquidation.
    uint256 public constant CLOSE_FACTOR_BPS = 5_000; // 50%

    /// @notice Hard ceiling on the configurable borrow rate, so the owner can never confiscate via interest.
    uint256 public constant MAX_INTEREST_RATE_BPS = 5_000; // 50% APR

    /// @notice Bounds on the configurable oracle staleness tolerance.
    uint256 public constant MIN_PRICE_STALENESS = 10 minutes;
    uint256 public constant MAX_PRICE_STALENESS = 1 days;

    /// @notice Ceiling on the configurable minimum debt size.
    uint256 public constant MAX_MIN_DEBT_USD = 100_000;

    // --------------------------------------------------------------------------------------------------
    // Immutables
    // --------------------------------------------------------------------------------------------------

    /// @notice Collateral token (WETH on mainnet).
    IERC20 public immutable collateralToken;
    /// @notice Borrowed token (USDC on mainnet).
    IERC20 public immutable debtToken;
    /// @notice Chainlink feed quoting `collateralToken` in `debtToken` terms (ETH/USD on mainnet).
    IAggregatorV3 public immutable priceFeed;

    uint256 internal immutable COLLATERAL_UNIT; // 10 ** collateral decimals
    uint256 internal immutable DEBT_UNIT; // 10 ** debt decimals
    uint256 internal immutable PRICE_UNIT; // 10 ** feed decimals

    // --------------------------------------------------------------------------------------------------
    // Storage
    // --------------------------------------------------------------------------------------------------

    struct Position {
        uint128 collateral; // raw collateral token amount
        uint128 scaledDebt; // debt normalised to borrowIndex == RAY
    }

    mapping(address borrower => Position) internal _positions;

    /// @notice Sum of all `Position.collateral`. Tracked so stray transfers can never be credited or swept.
    uint256 public totalCollateral;
    /// @notice Sum of all `Position.scaledDebt`.
    uint256 public totalScaledDebt;

    /// @notice Monotonically increasing debt index, RAY-scaled.
    uint256 public borrowIndex;
    /// @notice Timestamp `borrowIndex` was last brought up to date.
    uint64 public lastAccrualTimestamp;
    /// @notice Flat annual borrow rate in basis points.
    uint64 public interestRateBps;
    /// @notice Maximum age of a Chainlink answer before it is treated as unusable.
    uint64 public maxPriceStaleness;

    /// @notice Minimum debt a position may carry, in debt-token units. Keeps dust positions liquidatable.
    uint256 public minDebt;

    // --------------------------------------------------------------------------------------------------
    // Events
    // --------------------------------------------------------------------------------------------------

    event CollateralDeposited(address indexed borrower, address indexed payer, uint256 amount);
    event CollateralWithdrawn(address indexed borrower, address indexed to, uint256 amount);
    event Borrowed(address indexed borrower, address indexed to, uint256 amount, uint256 totalDebt);
    event Repaid(address indexed borrower, address indexed payer, uint256 amount, uint256 remainingDebt);
    event Liquidated(
        address indexed borrower,
        address indexed liquidator,
        uint256 repaid,
        uint256 collateralSeized,
        uint256 remainingDebt
    );
    event InterestAccrued(uint256 borrowIndex, uint256 elapsed);
    event LiquidityFunded(address indexed from, uint256 amount);
    event LiquidityWithdrawn(address indexed to, uint256 amount);
    event InterestRateSet(uint256 oldRateBps, uint256 newRateBps);
    event MaxPriceStalenessSet(uint256 oldStaleness, uint256 newStaleness);
    event MinDebtSet(uint256 oldMinDebt, uint256 newMinDebt);
    event TokenSwept(address indexed token, address indexed to, uint256 amount);

    // --------------------------------------------------------------------------------------------------
    // Errors
    // --------------------------------------------------------------------------------------------------

    error ZeroAddress();
    error ZeroAmount();
    error IdenticalTokens();
    error UnsupportedDecimals();
    error RateTooHigh();
    error StalenessOutOfBounds();
    error MinDebtTooHigh();
    error StalePrice(uint256 updatedAt);
    error InvalidPrice(int256 answer);
    error InsufficientCollateral();
    error PositionUnhealthy(uint256 debt, uint256 maxDebt);
    error PositionHealthy(uint256 debt, uint256 liquidationDebt);
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error NoDebt();
    error RepayExceedsCloseFactor(uint256 requested, uint256 maxRepay);
    error DebtBelowMinimum(uint256 debt, uint256 minDebt);
    error InsufficientCollateralSeized(uint256 seized, uint256 minSeized);
    error NothingToSeize();
    error CannotSweepMarketToken();

    // --------------------------------------------------------------------------------------------------
    // Construction
    // --------------------------------------------------------------------------------------------------

    /// @param collateral_       Collateral token, WETH on mainnet.
    /// @param debt_             Borrowed token, USDC on mainnet.
    /// @param priceFeed_        Chainlink feed quoting collateral in debt-token terms (ETH/USD).
    /// @param interestRateBps_  Flat annual borrow rate, basis points.
    /// @param maxPriceStaleness_ Oracle staleness tolerance; must exceed the feed's heartbeat.
    /// @param minDebt_          Minimum position debt, in debt-token units.
    /// @param owner_            Initial owner; should be a multisig or timelock.
    constructor(
        IERC20 collateral_,
        IERC20 debt_,
        IAggregatorV3 priceFeed_,
        uint64 interestRateBps_,
        uint64 maxPriceStaleness_,
        uint256 minDebt_,
        address owner_
    ) Ownable(owner_) {
        if (
            address(collateral_) == address(0) || address(debt_) == address(0)
                || address(priceFeed_) == address(0)
        ) revert ZeroAddress();
        if (address(collateral_) == address(debt_)) revert IdenticalTokens();

        collateralToken = collateral_;
        debtToken = debt_;
        priceFeed = priceFeed_;

        uint8 collateralDecimals = IERC20Metadata(address(collateral_)).decimals();
        uint8 debtDecimals = IERC20Metadata(address(debt_)).decimals();
        uint8 feedDecimals = priceFeed_.decimals();
        // Keeps every intermediate product in `_collateralValue` / `_seizeForRepay` far below 2**256.
        if (collateralDecimals > 18 || debtDecimals > 18 || feedDecimals == 0 || feedDecimals > 18) {
            revert UnsupportedDecimals();
        }

        COLLATERAL_UNIT = 10 ** collateralDecimals;
        DEBT_UNIT = 10 ** debtDecimals;
        PRICE_UNIT = 10 ** feedDecimals;

        borrowIndex = RAY;
        lastAccrualTimestamp = uint64(block.timestamp);

        _setInterestRate(interestRateBps_);
        _setMaxPriceStaleness(maxPriceStaleness_);
        _setMinDebt(minDebt_);

        // Fail the deployment outright if the feed address is wrong or already stale — much cheaper to
        // discover here than after the first borrow.
        _price();
    }

    // --------------------------------------------------------------------------------------------------
    // Borrower actions
    // --------------------------------------------------------------------------------------------------

    /// @notice Deposit collateral for `onBehalfOf`. Credits the amount actually received.
    function depositCollateral(address onBehalfOf, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 credited)
    {
        if (onBehalfOf == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        // Measure the delta rather than trusting `amount`, so a fee-on-transfer or otherwise lossy
        // collateral token can never credit more than the pool actually holds.
        uint256 balanceBefore = collateralToken.balanceOf(address(this));
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        credited = collateralToken.balanceOf(address(this)) - balanceBefore;
        if (credited == 0) revert ZeroAmount();

        Position storage position = _positions[onBehalfOf];
        position.collateral = (uint256(position.collateral) + credited).toUint128();
        totalCollateral += credited;

        emit CollateralDeposited(onBehalfOf, msg.sender, credited);
    }

    /// @notice Withdraw collateral, provided the caller's position stays within `MAX_LTV_BPS` afterwards.
    /// @dev    Deliberately callable while paused: pausing must never trap a solvent borrower's collateral.
    function withdrawCollateral(uint256 amount, address to) external nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        _accrue();

        Position storage position = _positions[msg.sender];
        if (amount > position.collateral) revert InsufficientCollateral();

        // Safe cast: `amount <= position.collateral`, which is a uint128.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint128 remainingCollateral = position.collateral - uint128(amount);
        position.collateral = remainingCollateral;
        totalCollateral -= amount;

        _requireWithinLtv(_debtOf(position), remainingCollateral);

        collateralToken.safeTransfer(to, amount);

        emit CollateralWithdrawn(msg.sender, to, amount);
    }

    /// @notice Borrow `amount` of the debt token against the caller's collateral.
    function borrow(uint256 amount, address to) external nonReentrant whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        _accrue();

        uint256 available = debtToken.balanceOf(address(this));
        if (amount > available) revert InsufficientLiquidity(amount, available);

        Position storage position = _positions[msg.sender];

        // Round the borrower's scaled debt up: they owe at least what they took.
        uint256 scaledDelta = Math.mulDiv(amount, RAY, borrowIndex, Math.Rounding.Ceil);
        uint256 newScaledDebt = uint256(position.scaledDebt) + scaledDelta;
        position.scaledDebt = newScaledDebt.toUint128();
        totalScaledDebt += scaledDelta;

        uint256 newDebt = _scaledToDebt(newScaledDebt);
        if (newDebt < minDebt) revert DebtBelowMinimum(newDebt, minDebt);
        _requireWithinLtv(newDebt, position.collateral);

        debtToken.safeTransfer(to, amount);

        emit Borrowed(msg.sender, to, amount, newDebt);
    }

    /// @notice Repay debt owed by `onBehalfOf`. Pass `type(uint256).max` to repay in full.
    /// @dev    Deliberately callable while paused: a borrower must always be able to reduce risk.
    function repay(address onBehalfOf, uint256 amount) external nonReentrant returns (uint256 repaid) {
        if (onBehalfOf == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        _accrue();

        Position storage position = _positions[onBehalfOf];
        uint256 debt = _debtOf(position);
        if (debt == 0) revert NoDebt();

        repaid = amount > debt ? debt : amount;

        uint256 remainingDebt = debt - repaid;
        // A partial repay must not leave an unliquidatably small position behind.
        if (remainingDebt != 0 && remainingDebt < minDebt) revert DebtBelowMinimum(remainingDebt, minDebt);

        _setRemainingDebt(position, remainingDebt);

        // Pull exactly the credited amount; guards against a lossy debt token shorting the pool.
        uint256 balanceBefore = debtToken.balanceOf(address(this));
        debtToken.safeTransferFrom(msg.sender, address(this), repaid);
        if (debtToken.balanceOf(address(this)) - balanceBefore < repaid) revert ZeroAmount();

        emit Repaid(onBehalfOf, msg.sender, repaid, remainingDebt);
    }

    // --------------------------------------------------------------------------------------------------
    // Liquidation
    // --------------------------------------------------------------------------------------------------

    /// @notice Repay part of an unhealthy position's debt and seize the matching collateral plus bonus.
    /// @param  borrower    Position to liquidate.
    /// @param  repayAmount Debt-token amount to repay; `type(uint256).max` repays the close-factor maximum.
    /// @param  minSeized   Slippage guard — revert if fewer collateral tokens than this would be seized.
    /// @dev    Deliberately callable while paused: solvency work must never be blocked by the pause switch.
    function liquidate(address borrower, uint256 repayAmount, uint256 minSeized)
        external
        nonReentrant
        returns (uint256 repaid, uint256 seized)
    {
        if (borrower == address(0)) revert ZeroAddress();
        if (repayAmount == 0) revert ZeroAmount();

        _accrue();

        Position storage position = _positions[borrower];
        uint256 debt = _debtOf(position);
        if (debt == 0) revert NoDebt();

        uint256 price = _price();
        uint256 collateralAmount = position.collateral;
        uint256 collateralValue = _collateralValue(collateralAmount, price);

        // Liquidatable iff debt / collateralValue > LIQUIDATION_THRESHOLD_BPS / BPS.
        uint256 liquidationDebt = Math.mulDiv(collateralValue, LIQUIDATION_THRESHOLD_BPS, BPS);
        if (debt <= liquidationDebt) revert PositionHealthy(debt, liquidationDebt);

        uint256 maxRepay = Math.mulDiv(debt, CLOSE_FACTOR_BPS, BPS);
        repaid = repayAmount == type(uint256).max ? maxRepay : repayAmount;
        if (repaid > maxRepay) revert RepayExceedsCloseFactor(repaid, maxRepay);

        seized = _seizeForRepay(repaid, price);

        if (seized > collateralAmount) {
            // Position is underwater past the bonus: the liquidator takes everything that is left and pays
            // only for what they take. Whatever debt survives is bad debt (see NOTES.md).
            seized = collateralAmount;
            repaid = _repayForSeize(seized, price);
            if (repaid > debt) repaid = debt;
        }
        if (seized == 0) revert NothingToSeize();
        if (seized < minSeized) revert InsufficientCollateralSeized(seized, minSeized);

        uint256 remainingDebt = debt - repaid;
        // Same dust rule as `repay`, waived when the position has been fully stripped of collateral: there
        // is nothing left to incentivise a follow-up liquidation, so refusing here would only strand debt.
        if (remainingDebt != 0 && remainingDebt < minDebt && seized != collateralAmount) {
            revert DebtBelowMinimum(remainingDebt, minDebt);
        }

        // Effects.
        _setRemainingDebt(position, remainingDebt);
        // Safe cast: `seized <= collateralAmount == position.collateral`, which is a uint128.
        // forge-lint: disable-next-line(unsafe-typecast)
        position.collateral = uint128(collateralAmount - seized);
        totalCollateral -= seized;

        // Interactions.
        uint256 balanceBefore = debtToken.balanceOf(address(this));
        debtToken.safeTransferFrom(msg.sender, address(this), repaid);
        if (debtToken.balanceOf(address(this)) - balanceBefore < repaid) revert ZeroAmount();
        collateralToken.safeTransfer(msg.sender, seized);

        emit Liquidated(borrower, msg.sender, repaid, seized, remainingDebt);
    }

    // --------------------------------------------------------------------------------------------------
    // Views
    // --------------------------------------------------------------------------------------------------

    /// @notice Current debt of `borrower`, including interest accrued but not yet written to storage.
    function debtOf(address borrower) public view returns (uint256) {
        return Math.mulDiv(_positions[borrower].scaledDebt, _currentBorrowIndex(), RAY, Math.Rounding.Ceil);
    }

    /// @notice Raw collateral balance of `borrower`.
    function collateralOf(address borrower) external view returns (uint256) {
        return _positions[borrower].collateral;
    }

    /// @notice Debt-token value of `borrower`'s collateral at the current oracle price.
    function collateralValueOf(address borrower) public view returns (uint256) {
        return _collateralValue(_positions[borrower].collateral, _price());
    }

    /// @notice Additional amount `borrower` could borrow right now, ignoring available liquidity.
    function maxBorrowable(address borrower) external view returns (uint256) {
        uint256 ceiling = Math.mulDiv(collateralValueOf(borrower), MAX_LTV_BPS, BPS);
        uint256 debt = debtOf(borrower);
        return debt >= ceiling ? 0 : ceiling - debt;
    }

    /// @notice Health factor, 1e18-scaled. Below 1e18 the position is liquidatable; `max` means no debt.
    function healthFactor(address borrower) public view returns (uint256) {
        uint256 debt = debtOf(borrower);
        if (debt == 0) return type(uint256).max;
        uint256 weighted = Math.mulDiv(collateralValueOf(borrower), LIQUIDATION_THRESHOLD_BPS, BPS);
        return Math.mulDiv(weighted, 1e18, debt);
    }

    /// @notice Whether `borrower` can be liquidated at the current oracle price.
    function isLiquidatable(address borrower) external view returns (bool) {
        uint256 debt = debtOf(borrower);
        if (debt == 0) return false;
        return debt > Math.mulDiv(collateralValueOf(borrower), LIQUIDATION_THRESHOLD_BPS, BPS);
    }

    /// @notice Debt token available to be borrowed.
    function availableLiquidity() public view returns (uint256) {
        return debtToken.balanceOf(address(this));
    }

    /// @notice Total outstanding debt across all positions, interest included.
    function totalDebt() public view returns (uint256) {
        return Math.mulDiv(totalScaledDebt, _currentBorrowIndex(), RAY, Math.Rounding.Ceil);
    }

    /// @notice Latest validated oracle price of one whole collateral token, in feed decimals.
    function collateralPrice() external view returns (uint256) {
        return _price();
    }

    /// @notice Collateral seized for a given repayment at the current price, bonus included.
    function previewSeize(uint256 repayAmount) external view returns (uint256) {
        return _seizeForRepay(repayAmount, _price());
    }

    // --------------------------------------------------------------------------------------------------
    // Liquidity management (owner)
    // --------------------------------------------------------------------------------------------------

    /// @notice Supply debt token for borrowers to draw on.
    /// @dev    Owner-only: this market has no lender share accounting, so a third party sending funds here
    ///         would have no claim on them. Anyone wanting to lend must do so through the owner.
    function fundLiquidity(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        debtToken.safeTransferFrom(msg.sender, address(this), amount);
        emit LiquidityFunded(msg.sender, amount);
    }

    /// @notice Withdraw idle debt token (principal plus accrued interest).
    /// @dev    Can only ever move the debt token. Collateral is unreachable from here.
    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 available = availableLiquidity();
        if (amount > available) revert InsufficientLiquidity(amount, available);
        debtToken.safeTransfer(to, amount);
        emit LiquidityWithdrawn(to, amount);
    }

    /// @notice Recover a token accidentally sent to this contract.
    /// @dev    Neither market token can be swept: collateral belongs to borrowers and the debt token is
    ///         withdrawable only through `withdrawLiquidity`.
    function sweep(IERC20 token, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (address(token) == address(collateralToken) || address(token) == address(debtToken)) {
            revert CannotSweepMarketToken();
        }
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();
        token.safeTransfer(to, balance);
        emit TokenSwept(address(token), to, balance);
    }

    // --------------------------------------------------------------------------------------------------
    // Parameters (owner)
    // --------------------------------------------------------------------------------------------------

    /// @notice Update the flat annual borrow rate. Accrues at the old rate first.
    function setInterestRate(uint64 newRateBps) external onlyOwner {
        _accrue();
        _setInterestRate(newRateBps);
    }

    /// @notice Update the oracle staleness tolerance.
    function setMaxPriceStaleness(uint64 newStaleness) external onlyOwner {
        _setMaxPriceStaleness(newStaleness);
    }

    /// @notice Update the minimum position debt.
    function setMinDebt(uint256 newMinDebt) external onlyOwner {
        _setMinDebt(newMinDebt);
    }

    /// @notice Stop new deposits and new borrows. Repay, withdraw and liquidate stay open.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume deposits and borrows.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Write the accrued index to storage. Permissionless; useful before offchain snapshots.
    function accrue() external {
        _accrue();
    }

    // --------------------------------------------------------------------------------------------------
    // Internals
    // --------------------------------------------------------------------------------------------------

    function _setInterestRate(uint64 newRateBps) internal {
        if (newRateBps > MAX_INTEREST_RATE_BPS) revert RateTooHigh();
        emit InterestRateSet(interestRateBps, newRateBps);
        interestRateBps = newRateBps;
    }

    function _setMaxPriceStaleness(uint64 newStaleness) internal {
        if (newStaleness < MIN_PRICE_STALENESS || newStaleness > MAX_PRICE_STALENESS) {
            revert StalenessOutOfBounds();
        }
        emit MaxPriceStalenessSet(maxPriceStaleness, newStaleness);
        maxPriceStaleness = newStaleness;
    }

    function _setMinDebt(uint256 newMinDebt) internal {
        if (newMinDebt > MAX_MIN_DEBT_USD * DEBT_UNIT) revert MinDebtTooHigh();
        emit MinDebtSet(minDebt, newMinDebt);
        minDebt = newMinDebt;
    }

    /// @dev Brings `borrowIndex` up to `block.timestamp`.
    function _accrue() internal {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0) return;

        // Read the new index BEFORE stamping the timestamp: `_currentBorrowIndex` derives `elapsed` from
        // `lastAccrualTimestamp`, so stamping first would make it compute zero elapsed time and silently
        // drop every interval's interest.
        uint256 updated = _currentBorrowIndex();
        lastAccrualTimestamp = uint64(block.timestamp);

        if (updated == borrowIndex) return;
        borrowIndex = updated;

        emit InterestAccrued(updated, elapsed);
    }

    /// @dev `borrowIndex` as of now, without writing to storage.
    function _currentBorrowIndex() internal view returns (uint256) {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        uint256 rate = interestRateBps;
        // No debt outstanding means no one to charge, so the index must not run forward.
        if (elapsed == 0 || rate == 0 || totalScaledDebt == 0) return borrowIndex;

        uint256 interestFactor = Math.mulDiv(rate * elapsed, RAY, BPS * SECONDS_PER_YEAR);
        return borrowIndex + Math.mulDiv(borrowIndex, interestFactor, RAY);
    }

    function _debtOf(Position storage position) internal view returns (uint256) {
        return _scaledToDebt(position.scaledDebt);
    }

    function _scaledToDebt(uint256 scaledDebt) internal view returns (uint256) {
        // Ceil: never round a borrower's obligation down.
        return Math.mulDiv(scaledDebt, borrowIndex, RAY, Math.Rounding.Ceil);
    }

    /// @dev Rewrites `position`'s scaled debt so that it now owes exactly `remainingDebt`.
    function _setRemainingDebt(Position storage position, uint256 remainingDebt) internal {
        uint256 scaledBefore = position.scaledDebt;
        uint256 scaledAfter = 0;
        if (remainingDebt != 0) {
            // Ceil the surviving scaled debt so rounding never erases value the borrower still owes.
            scaledAfter = Math.mulDiv(remainingDebt, RAY, borrowIndex, Math.Rounding.Ceil);
            if (scaledAfter > scaledBefore) scaledAfter = scaledBefore;
        }
        // Safe cast: `scaledAfter` is clamped above to `scaledBefore`, itself a uint128.
        // forge-lint: disable-next-line(unsafe-typecast)
        position.scaledDebt = uint128(scaledAfter);
        totalScaledDebt -= (scaledBefore - scaledAfter);
    }

    function _requireWithinLtv(uint256 debt, uint256 collateralAmount) internal view {
        if (debt == 0) return;
        uint256 maxDebt = Math.mulDiv(_collateralValue(collateralAmount, _price()), MAX_LTV_BPS, BPS);
        if (debt > maxDebt) revert PositionUnhealthy(debt, maxDebt);
    }

    /// @dev Value of `collateralAmount` expressed in debt-token units. Rounds down.
    function _collateralValue(uint256 collateralAmount, uint256 price) internal view returns (uint256) {
        if (collateralAmount == 0) return 0;
        return Math.mulDiv(collateralAmount * price, DEBT_UNIT, COLLATERAL_UNIT * PRICE_UNIT);
    }

    /// @dev Collateral owed to a liquidator repaying `repayAmount`, bonus included. Rounds down.
    function _seizeForRepay(uint256 repayAmount, uint256 price) internal view returns (uint256) {
        uint256 numerator = repayAmount * COLLATERAL_UNIT * PRICE_UNIT;
        return Math.mulDiv(numerator, BPS + LIQUIDATION_BONUS_BPS, price * DEBT_UNIT * BPS);
    }

    /// @dev Inverse of `_seizeForRepay`: what a liquidator must pay to take `seizeAmount`. Rounds up.
    function _repayForSeize(uint256 seizeAmount, uint256 price) internal view returns (uint256) {
        uint256 numerator = seizeAmount * price * DEBT_UNIT;
        return Math.mulDiv(numerator, BPS, COLLATERAL_UNIT * PRICE_UNIT * (BPS + LIQUIDATION_BONUS_BPS), Math.Rounding.Ceil);
    }

    /// @dev Validated Chainlink price of one whole collateral token, in feed decimals.
    function _price() internal view returns (uint256) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) =
            priceFeed.latestRoundData();

        if (answer <= 0) revert InvalidPrice(answer);
        // `updatedAt == 0` marks an incomplete round; a future timestamp means a broken feed.
        if (updatedAt == 0 || updatedAt > block.timestamp) revert StalePrice(updatedAt);
        if (block.timestamp - updatedAt > maxPriceStaleness) revert StalePrice(updatedAt);
        if (answeredInRound < roundId) revert StalePrice(updatedAt);

        // Safe cast: `answer > 0` is enforced above.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer);
    }
}
