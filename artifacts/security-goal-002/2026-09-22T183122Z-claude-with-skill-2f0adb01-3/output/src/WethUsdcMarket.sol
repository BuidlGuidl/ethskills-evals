// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/**
 * @title WethUsdcMarket
 * @notice Single-pair overcollateralised borrowing market: lock WETH, borrow USDC.
 *
 *  - Max LTV ...................... 70%  (enforced on borrow and on collateral withdrawal)
 *  - Liquidation threshold ........ 85%  (debt above this share of collateral value is liquidatable)
 *  - Liquidation bonus ............  5%  (liquidator seizes collateral worth 105% of what it repays)
 *  - Interest ..................... flat annual rate, accrued linearly per second into a global index
 *
 * @dev Liquidity on the USDC side is supplied by the owner (a single-lender market). There is no
 *      lender share token, so there is no share-price / inflation surface. See NOTES.md.
 *
 *      Pricing comes exclusively from a Chainlink ETH/USD feed with staleness and sanity bounds.
 *      No DEX spot price is ever read, so a flash loan cannot move the numbers this contract uses.
 */
contract WethUsdcMarket is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Basis point denominator. 10_000 bps == 100%.
    uint256 public constant BPS = 10_000;

    /// @notice Ray precision used by the borrow index.
    uint256 internal constant RAY = 1e27;

    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    /// @notice Borrowing power: a position may borrow up to 70% of collateral value.
    uint256 public constant MAX_LTV_BPS = 7_000;

    /// @notice Above 85% debt-to-collateral a position may be liquidated.
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;

    /// @notice Liquidators seize collateral worth 105% of the debt they repay.
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    /// @notice A single liquidation may repay at most 50% of a position's debt.
    uint256 public constant CLOSE_FACTOR_BPS = 5_000;

    /// @notice Upper bound on the annual borrow rate that can ever be configured (50%).
    uint256 public constant MAX_BORROW_RATE_BPS = 5_000;

    /// @notice Upper bound on the configurable oracle staleness window.
    uint256 public constant MAX_PRICE_STALENESS = 24 hours;

    /*//////////////////////////////////////////////////////////////
                               IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Collateral token (WETH on mainnet).
    IERC20 public immutable COLLATERAL;

    /// @notice Debt token (USDC on mainnet).
    IERC20 public immutable DEBT;

    /// @notice Chainlink ETH/USD price feed.
    IAggregatorV3 public immutable PRICE_FEED;

    /// @dev 10 ** collateral.decimals(), read from the token at deploy time. Never hardcoded 1e18.
    uint256 internal immutable COLLATERAL_UNIT;

    /// @dev 10 ** debt.decimals(). USDC is 6 decimals, not 18.
    uint256 internal immutable DEBT_UNIT;

    /// @dev 10 ** priceFeed.decimals(). Chainlink USD feeds are 8 decimals.
    uint256 internal immutable FEED_UNIT;

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    struct Position {
        /// @dev Collateral token amount held for this account.
        uint256 collateral;
        /// @dev Debt expressed at borrowIndex == RAY. Actual debt = scaledDebt * borrowIndex / RAY.
        uint256 scaledDebt;
    }

    mapping(address account => Position) internal _positions;

    /// @notice Sum of all `scaledDebt`. Total debt = totalScaledDebt * borrowIndex / RAY.
    uint256 public totalScaledDebt;

    /// @notice Monotonically increasing interest index, starts at RAY.
    uint256 public borrowIndex;

    /// @notice Timestamp the index was last brought up to date.
    uint256 public lastAccrualTimestamp;

    /// @notice Flat annual borrow rate in bps (e.g. 500 == 5% per year, accrued linearly per second).
    uint256 public borrowRateBps;

    /// @notice Maximum age of a Chainlink answer before this contract refuses to price anything.
    uint256 public maxPriceStaleness;

    /// @notice Hard sanity floor for the oracle answer, in feed decimals.
    uint256 public minPrice;

    /// @notice Hard sanity ceiling for the oracle answer, in feed decimals.
    uint256 public maxPrice;

    /// @notice Smallest debt a position may carry. Prevents dust positions nobody will liquidate.
    uint256 public minDebt;

    /// @notice When true, new borrows and new collateral deposits are blocked.
    /// @dev Repay, withdraw-while-healthy and liquidate are deliberately NEVER pausable.
    bool public borrowPaused;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, address indexed to, uint256 amount);
    event Borrowed(address indexed account, address indexed to, uint256 amount);
    event Repaid(address indexed payer, address indexed account, uint256 amount);
    event Liquidated(
        address indexed liquidator,
        address indexed account,
        uint256 repaidDebt,
        uint256 seizedCollateral,
        bool collateralExhausted
    );
    event Accrued(uint256 borrowIndex, uint256 totalDebt);
    event LiquidityAdded(address indexed from, uint256 amount);
    event LiquidityRemoved(address indexed to, uint256 amount);
    event BorrowRateSet(uint256 oldRateBps, uint256 newRateBps);
    event OracleConfigSet(uint256 maxStaleness, uint256 minPrice, uint256 maxPrice);
    event MinDebtSet(uint256 oldMinDebt, uint256 newMinDebt);
    event BorrowPausedSet(bool paused);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAddress();
    error ZeroAmount();
    error InvalidParameter();
    error BorrowsPaused();
    error StalePrice(uint256 updatedAt, uint256 nowTs);
    error PriceOutOfBounds(uint256 price);
    error InsufficientCollateral();
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error PositionUnhealthy();
    error PositionHealthy();
    error DebtBelowMinimum(uint256 debt, uint256 minDebt);
    error NoDebt();
    error RepayExceedsCloseFactor(uint256 requested, uint256 maxRepay);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @param owner_             Initial owner. MUST be a multisig or timelock, never an EOA.
     * @param collateral_        WETH.
     * @param debt_              USDC.
     * @param priceFeed_         Chainlink ETH/USD aggregator.
     * @param borrowRateBps_     Flat annual borrow rate in bps.
     * @param maxPriceStaleness_ Max age of a Chainlink answer (must match the feed's heartbeat).
     * @param minPrice_          Sanity floor on the ETH/USD answer, in feed decimals.
     * @param maxPrice_          Sanity ceiling on the ETH/USD answer, in feed decimals.
     * @param minDebt_           Dust floor for a position's debt, in debt-token units.
     */
    constructor(
        address owner_,
        address collateral_,
        address debt_,
        address priceFeed_,
        uint256 borrowRateBps_,
        uint256 maxPriceStaleness_,
        uint256 minPrice_,
        uint256 maxPrice_,
        uint256 minDebt_
    ) Ownable(owner_) {
        if (collateral_ == address(0) || debt_ == address(0) || priceFeed_ == address(0)) revert ZeroAddress();
        if (collateral_ == debt_) revert InvalidParameter();

        COLLATERAL = IERC20(collateral_);
        DEBT = IERC20(debt_);
        PRICE_FEED = IAggregatorV3(priceFeed_);

        // Read decimals from the tokens rather than assuming 18 everywhere.
        COLLATERAL_UNIT = 10 ** IERC20Metadata(collateral_).decimals();
        DEBT_UNIT = 10 ** IERC20Metadata(debt_).decimals();
        FEED_UNIT = 10 ** IAggregatorV3(priceFeed_).decimals();

        borrowIndex = RAY;
        lastAccrualTimestamp = block.timestamp;

        _setBorrowRate(borrowRateBps_);
        _setOracleConfig(maxPriceStaleness_, minPrice_, maxPrice_);
        _setMinDebt(minDebt_);
    }

    /*//////////////////////////////////////////////////////////////
                           INTEREST ACCRUAL
    //////////////////////////////////////////////////////////////*/

    /// @notice Bring the borrow index up to the current timestamp. Safe to call by anyone.
    function accrue() public {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0) return;

        lastAccrualTimestamp = block.timestamp;

        uint256 scaled = totalScaledDebt;
        if (scaled == 0 || borrowRateBps == 0) return;

        // Linear (non-compounding) accrual between updates: index *= (1 + rate * dt / year).
        uint256 growth = Math.mulDiv(borrowIndex, borrowRateBps * elapsed, BPS * SECONDS_PER_YEAR);
        uint256 newIndex = borrowIndex + growth;
        borrowIndex = newIndex;

        emit Accrued(newIndex, Math.mulDiv(scaled, newIndex, RAY, Math.Rounding.Ceil));
    }

    /*//////////////////////////////////////////////////////////////
                             USER ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Lock collateral for `onBehalfOf`.
    /// @dev The credited amount is the balance actually received, so a fee-on-transfer or
    ///      deflationary token can never credit more than the pool holds.
    function deposit(uint256 amount, address onBehalfOf) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (onBehalfOf == address(0)) revert ZeroAddress();
        if (borrowPaused) revert BorrowsPaused();

        uint256 balanceBefore = COLLATERAL.balanceOf(address(this));
        COLLATERAL.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = COLLATERAL.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        _positions[onBehalfOf].collateral += received;

        emit Deposited(onBehalfOf, received);
    }

    /// @notice Withdraw collateral. Always allowed as long as the position stays within max LTV.
    function withdraw(uint256 amount, address to) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        accrue();

        Position storage p = _positions[msg.sender];
        if (p.collateral < amount) revert InsufficientCollateral();

        // Effects before the external transfer (CEI).
        uint256 remaining = p.collateral - amount;
        p.collateral = remaining;

        // Withdrawals are checked against max LTV (70%), not the liquidation threshold, so a
        // withdrawal can never leave the caller one wei away from being liquidatable.
        _requireWithinMaxLtv(remaining, _debtOf(p));

        COLLATERAL.safeTransfer(to, amount);

        emit Withdrawn(msg.sender, to, amount);
    }

    /// @notice Borrow USDC against previously locked collateral.
    function borrow(uint256 amount, address to) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (borrowPaused) revert BorrowsPaused();

        accrue();

        uint256 available = DEBT.balanceOf(address(this));
        if (amount > available) revert InsufficientLiquidity(amount, available);

        Position storage p = _positions[msg.sender];

        // Round the scaled increment UP so rounding can never mint free debt relief.
        uint256 scaledDelta = Math.mulDiv(amount, RAY, borrowIndex, Math.Rounding.Ceil);
        p.scaledDebt += scaledDelta;
        totalScaledDebt += scaledDelta;

        uint256 newDebt = _debtOf(p);
        if (newDebt < minDebt) revert DebtBelowMinimum(newDebt, minDebt);

        _requireWithinMaxLtv(p.collateral, newDebt);

        DEBT.safeTransfer(to, amount);

        emit Borrowed(msg.sender, to, amount);
    }

    /**
     * @notice Repay USDC debt for `onBehalfOf`. Anyone may repay anyone's debt.
     * @param amount Amount to repay; pass type(uint256).max to repay the position in full.
     * @return repaid The amount actually pulled from the caller.
     */
    function repay(uint256 amount, address onBehalfOf) external nonReentrant returns (uint256 repaid) {
        if (amount == 0) revert ZeroAmount();
        if (onBehalfOf == address(0)) revert ZeroAddress();

        accrue();

        Position storage p = _positions[onBehalfOf];
        uint256 debt = _debtOf(p);
        if (debt == 0) revert NoDebt();

        repaid = amount > debt ? debt : amount;

        uint256 scaledDelta;
        if (repaid == debt) {
            // Full repayment: clear the scaled balance exactly, leaving no rounding dust behind.
            scaledDelta = p.scaledDebt;
            p.scaledDebt = 0;
        } else {
            // Partial: round the credit DOWN so a repayer can never retire more debt than they pay for.
            scaledDelta = Math.mulDiv(repaid, RAY, borrowIndex, Math.Rounding.Floor);
            if (scaledDelta > p.scaledDebt) scaledDelta = p.scaledDebt;
            p.scaledDebt -= scaledDelta;

            uint256 remainingDebt = _debtOf(p);
            if (remainingDebt != 0 && remainingDebt < minDebt) revert DebtBelowMinimum(remainingDebt, minDebt);
        }
        totalScaledDebt -= scaledDelta;

        DEBT.safeTransferFrom(msg.sender, address(this), repaid);

        emit Repaid(msg.sender, onBehalfOf, repaid);
    }

    /**
     * @notice Liquidate an unhealthy position: repay USDC, seize WETH worth 105% of the repayment.
     * @param account     Position to liquidate.
     * @param repayAmount USDC to repay, capped by the 50% close factor and by available collateral.
     * @return repaid  USDC actually taken from the liquidator.
     * @return seized  Collateral actually sent to the liquidator.
     */
    function liquidate(address account, uint256 repayAmount, address to)
        external
        nonReentrant
        returns (uint256 repaid, uint256 seized)
    {
        if (repayAmount == 0) revert ZeroAmount();
        if (account == address(0) || to == address(0)) revert ZeroAddress();

        accrue();

        Position storage p = _positions[account];
        uint256 debt = _debtOf(p);
        if (debt == 0) revert NoDebt();

        uint256 px = _price();
        uint256 collateralValue = _collateralValue(p.collateral, px);

        // Liquidatable only once debt passes 85% of collateral value.
        if (debt * BPS <= collateralValue * LIQUIDATION_THRESHOLD_BPS) revert PositionHealthy();

        uint256 maxRepay = Math.mulDiv(debt, CLOSE_FACTOR_BPS, BPS);
        if (repayAmount > maxRepay) revert RepayExceedsCloseFactor(repayAmount, maxRepay);

        repaid = repayAmount;
        seized = _collateralForRepay(repaid, px);

        // If the position is underwater the bonus may exceed what is actually there. Cap the seizure
        // at the real balance and charge the liquidator only for what they receive; the shortfall
        // stays on the books as bad debt rather than letting the liquidator overpay.
        bool exhausted = seized >= p.collateral;
        if (exhausted) {
            seized = p.collateral;
            repaid = _repayForCollateral(seized, px);
            if (repaid > repayAmount) repaid = repayAmount;
            if (repaid == 0) revert ZeroAmount();
        }

        uint256 scaledDelta = Math.mulDiv(repaid, RAY, borrowIndex, Math.Rounding.Floor);
        if (scaledDelta > p.scaledDebt) scaledDelta = p.scaledDebt;

        // Effects.
        p.scaledDebt -= scaledDelta;
        p.collateral -= seized;
        totalScaledDebt -= scaledDelta;

        // Interactions: pull the repayment in before paying the collateral out.
        DEBT.safeTransferFrom(msg.sender, address(this), repaid);
        COLLATERAL.safeTransfer(to, seized);

        emit Liquidated(msg.sender, account, repaid, seized, exhausted);
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    /// @notice Collateral and debt for an account, with interest accrued to the current block.
    function positionOf(address account) external view returns (uint256 collateral, uint256 debt) {
        Position storage p = _positions[account];
        collateral = p.collateral;
        debt = Math.mulDiv(p.scaledDebt, _previewIndex(), RAY, Math.Rounding.Ceil);
    }

    /// @notice Current debt of `account`, interest included.
    function debtOf(address account) public view returns (uint256) {
        return Math.mulDiv(_positions[account].scaledDebt, _previewIndex(), RAY, Math.Rounding.Ceil);
    }

    /// @notice Sum of all outstanding debt, interest included.
    function totalDebt() external view returns (uint256) {
        return Math.mulDiv(totalScaledDebt, _previewIndex(), RAY, Math.Rounding.Ceil);
    }

    /// @notice USDC currently available to borrow.
    function availableLiquidity() external view returns (uint256) {
        return DEBT.balanceOf(address(this));
    }

    /// @notice Value of `account`'s collateral denominated in the debt token.
    function collateralValueOf(address account) external view returns (uint256) {
        return _collateralValue(_positions[account].collateral, _price());
    }

    /// @notice Additional debt `account` could take on right now.
    function maxBorrowable(address account) external view returns (uint256) {
        Position storage p = _positions[account];
        uint256 limit = Math.mulDiv(_collateralValue(p.collateral, _price()), MAX_LTV_BPS, BPS);
        uint256 debt = debtOf(account);
        return debt >= limit ? 0 : limit - debt;
    }

    /// @notice True when `account` may be liquidated at the current oracle price.
    function isLiquidatable(address account) external view returns (bool) {
        Position storage p = _positions[account];
        uint256 debt = debtOf(account);
        if (debt == 0) return false;
        uint256 value = _collateralValue(p.collateral, _price());
        return debt * BPS > value * LIQUIDATION_THRESHOLD_BPS;
    }

    /**
     * @notice Health factor scaled by 1e18. Below 1e18 the position is liquidatable.
     * @dev healthFactor = collateralValue * 85% / debt. Returns type(uint256).max when debt is zero.
     */
    function healthFactor(address account) external view returns (uint256) {
        uint256 debt = debtOf(account);
        if (debt == 0) return type(uint256).max;
        uint256 value = _collateralValue(_positions[account].collateral, _price());
        return Math.mulDiv(value * LIQUIDATION_THRESHOLD_BPS, 1e18, debt * BPS);
    }

    /// @notice Collateral a liquidator receives for repaying `repayAmount` right now.
    function previewSeize(uint256 repayAmount) external view returns (uint256) {
        return _collateralForRepay(repayAmount, _price());
    }

    /// @notice Latest validated ETH price in feed decimals. Reverts if the feed is stale or insane.
    function price() external view returns (uint256) {
        return _price();
    }

    /*//////////////////////////////////////////////////////////////
                             OWNER ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Supply USDC for borrowers to draw on.
    function addLiquidity(uint256 amount) external nonReentrant onlyOwner {
        if (amount == 0) revert ZeroAmount();
        uint256 balanceBefore = DEBT.balanceOf(address(this));
        DEBT.safeTransferFrom(msg.sender, address(this), amount);
        emit LiquidityAdded(msg.sender, DEBT.balanceOf(address(this)) - balanceBefore);
    }

    /// @notice Withdraw idle USDC. Cannot touch collateral, and cannot take more than is unborrowed.
    function removeLiquidity(uint256 amount, address to) external nonReentrant onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        uint256 available = DEBT.balanceOf(address(this));
        if (amount > available) revert InsufficientLiquidity(amount, available);
        DEBT.safeTransfer(to, amount);
        emit LiquidityRemoved(to, amount);
    }

    /// @notice Update the flat annual borrow rate. Accrues first so the change is not retroactive.
    function setBorrowRate(uint256 newRateBps) external onlyOwner {
        accrue();
        _setBorrowRate(newRateBps);
    }

    /// @notice Update oracle staleness window and sanity bounds.
    function setOracleConfig(uint256 maxStaleness_, uint256 minPrice_, uint256 maxPrice_) external onlyOwner {
        _setOracleConfig(maxStaleness_, minPrice_, maxPrice_);
    }

    /// @notice Update the dust floor for new/remaining debt.
    function setMinDebt(uint256 newMinDebt) external onlyOwner {
        _setMinDebt(newMinDebt);
    }

    /**
     * @notice Halt new borrows and new deposits.
     * @dev Deliberately scoped: repay, withdraw and liquidate stay open while paused, so this
     *      switch can stop the bleeding without ever trapping user funds.
     */
    function setBorrowPaused(bool paused) external onlyOwner {
        borrowPaused = paused;
        emit BorrowPausedSet(paused);
    }

    /// @notice Sweep a token that is neither the collateral nor the debt asset.
    function sweep(address token, address to) external onlyOwner {
        if (token == address(COLLATERAL) || token == address(DEBT)) revert InvalidParameter();
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, IERC20(token).balanceOf(address(this)));
    }

    /*//////////////////////////////////////////////////////////////
                               INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _setBorrowRate(uint256 newRateBps) internal {
        if (newRateBps > MAX_BORROW_RATE_BPS) revert InvalidParameter();
        emit BorrowRateSet(borrowRateBps, newRateBps);
        borrowRateBps = newRateBps;
    }

    function _setOracleConfig(uint256 maxStaleness_, uint256 minPrice_, uint256 maxPrice_) internal {
        if (maxStaleness_ == 0 || maxStaleness_ > MAX_PRICE_STALENESS) revert InvalidParameter();
        if (minPrice_ == 0 || minPrice_ >= maxPrice_) revert InvalidParameter();
        maxPriceStaleness = maxStaleness_;
        minPrice = minPrice_;
        maxPrice = maxPrice_;
        emit OracleConfigSet(maxStaleness_, minPrice_, maxPrice_);
    }

    function _setMinDebt(uint256 newMinDebt) internal {
        emit MinDebtSet(minDebt, newMinDebt);
        minDebt = newMinDebt;
    }

    /// @dev Current debt of a position using the stored index. Rounded UP, in the pool's favour.
    function _debtOf(Position storage p) internal view returns (uint256) {
        return Math.mulDiv(p.scaledDebt, borrowIndex, RAY, Math.Rounding.Ceil);
    }

    /// @dev Index the next `accrue()` would produce, so views agree with state-changing calls.
    function _previewIndex() internal view returns (uint256) {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0 || totalScaledDebt == 0 || borrowRateBps == 0) return borrowIndex;
        return borrowIndex + Math.mulDiv(borrowIndex, borrowRateBps * elapsed, BPS * SECONDS_PER_YEAR);
    }

    /// @dev Reverts unless debt is at most 70% of collateral value at the current price.
    function _requireWithinMaxLtv(uint256 collateral, uint256 debt) internal view {
        if (debt == 0) return;
        uint256 value = _collateralValue(collateral, _price());
        if (debt * BPS > value * MAX_LTV_BPS) revert PositionUnhealthy();
    }

    /**
     * @dev Value of `amount` collateral in debt-token units.
     *      value = amount * price * DEBT_UNIT / (COLLATERAL_UNIT * FEED_UNIT)
     *      Single mulDiv keeps full 512-bit intermediate precision: multiply before divide, once.
     *      Rounded DOWN, so collateral is never valued optimistically.
     */
    function _collateralValue(uint256 amount, uint256 price_) internal view returns (uint256) {
        if (amount == 0) return 0;
        return Math.mulDiv(amount, price_ * DEBT_UNIT, COLLATERAL_UNIT * FEED_UNIT, Math.Rounding.Floor);
    }

    /// @dev Collateral worth `repayAmount` plus the 5% bonus. Rounded DOWN, in the borrower's favour.
    function _collateralForRepay(uint256 repayAmount, uint256 price_) internal view returns (uint256) {
        return Math.mulDiv(
            repayAmount * (BPS + LIQUIDATION_BONUS_BPS),
            COLLATERAL_UNIT * FEED_UNIT,
            BPS * DEBT_UNIT * price_,
            Math.Rounding.Floor
        );
    }

    /// @dev Inverse of `_collateralForRepay`. Rounded UP, in the pool's favour.
    function _repayForCollateral(uint256 collateralAmount, uint256 price_) internal view returns (uint256) {
        return Math.mulDiv(
            collateralAmount * price_ * DEBT_UNIT,
            BPS,
            COLLATERAL_UNIT * FEED_UNIT * (BPS + LIQUIDATION_BONUS_BPS),
            Math.Rounding.Ceil
        );
    }

    /**
     * @dev Validated Chainlink read. Never a DEX spot price, so it cannot be flash-loan manipulated.
     *      Rejects: non-positive answers, answers older than the configured heartbeat, incomplete
     *      rounds, and answers outside the configured sanity band (which is how a feed pinned to its
     *      aggregator min/max during a crash gets caught instead of silently wrecking every position).
     */
    function _price() internal view returns (uint256) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = PRICE_FEED.latestRoundData();

        if (answer <= 0) revert PriceOutOfBounds(0);
        if (updatedAt == 0 || answeredInRound < roundId) revert StalePrice(updatedAt, block.timestamp);
        if (block.timestamp - updatedAt > maxPriceStaleness) revert StalePrice(updatedAt, block.timestamp);

        // casting to 'uint256' is safe because the `answer <= 0` check above proves it is positive
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 p = uint256(answer);
        if (p < minPrice || p > maxPrice) revert PriceOutOfBounds(p);
        return p;
    }
}
