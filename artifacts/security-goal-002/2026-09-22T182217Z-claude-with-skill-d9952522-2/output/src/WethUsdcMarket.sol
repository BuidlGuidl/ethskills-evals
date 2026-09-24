// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/**
 * @title WethUsdcMarket
 * @notice Single-pair borrowing market: lock WETH as collateral, borrow USDC against it.
 *
 * Two sides:
 *  - Lenders deposit USDC and receive ERC-4626 shares. Share value grows as borrower
 *    interest accrues into `totalAssets()`.
 *  - Borrowers deposit WETH collateral and draw USDC up to `MAX_LTV_BPS` of the USD value
 *    of that collateral. Debt accrues flat (non-compounding) annual interest through a
 *    global borrow index; per-position debt is stored index-normalised ("scaled").
 *
 * Units: every USD-denominated quantity in this contract (debt, collateral value, repay
 * amounts) is expressed in USDC's own decimals, read from the token at deployment.
 * Collateral is expressed in WETH's decimals. The oracle answer is converted between the
 * two with `PRICE_SCALE`, derived from all three decimal counts in the constructor.
 */
contract WethUsdcMarket is ERC4626, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    /* ------------------------------------------------------------------ */
    /*                              constants                             */
    /* ------------------------------------------------------------------ */

    uint256 internal constant BPS = 10_000;
    uint256 internal constant RAY = 1e27;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    /// @notice Borrowing is capped at 70% of collateral value.
    uint256 public constant MAX_LTV_BPS = 7_000;
    /// @notice A position becomes liquidatable strictly above 85% of collateral value.
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
    /// @notice Liquidator premium on seized collateral: 5%.
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    /// @notice A healthy-but-underwater-threshold position can only be half repaid per call.
    uint256 public constant CLOSE_FACTOR_BPS = 5_000;

    /// @notice Hard ceiling on the configurable borrow rate: 100% APR.
    uint256 public constant MAX_BORROW_RATE_BPS = 10_000;
    /// @notice Bounds on the configurable oracle staleness window.
    uint256 public constant MIN_PRICE_MAX_AGE = 20 minutes;
    uint256 public constant MAX_PRICE_MAX_AGE = 2 days;

    /* ------------------------------------------------------------------ */
    /*                              immutables                            */
    /* ------------------------------------------------------------------ */

    /// @notice Collateral token (WETH on mainnet).
    IERC20 public immutable collateralToken;
    /// @notice Oracle reporting collateral/USD (Chainlink ETH/USD on mainnet).
    IAggregatorV3 public immutable priceFeed;
    /// @dev 10 ** (collateralDecimals + feedDecimals - debtDecimals).
    uint256 internal immutable PRICE_SCALE;

    /* ------------------------------------------------------------------ */
    /*                               storage                              */
    /* ------------------------------------------------------------------ */

    struct Position {
        uint256 collateral; // WETH units
        uint256 scaledDebt; // debt normalised by borrowIndex, RAY-scaled
    }

    mapping(address => Position) internal _positions;

    /// @notice Sum of every position's scaled debt.
    uint256 public totalScaledDebt;
    /// @notice Borrow index, RAY. Monotonically increasing.
    uint256 public borrowIndex;
    /// @notice Timestamp `borrowIndex` was last brought current.
    uint256 public lastAccrualTimestamp;
    /// @notice Flat annual borrow rate in bps.
    uint256 public borrowRateBps;
    /// @notice Maximum tolerated age of an oracle answer.
    uint256 public priceMaxAge;

    /* ------------------------------------------------------------------ */
    /*                                events                              */
    /* ------------------------------------------------------------------ */

    event CollateralDeposited(address indexed account, uint256 amount);
    event CollateralWithdrawn(address indexed account, address indexed to, uint256 amount);
    event Borrowed(address indexed account, address indexed to, uint256 amount);
    event Repaid(address indexed payer, address indexed account, uint256 amount);
    event Liquidated(
        address indexed liquidator, address indexed account, uint256 repaidDebt, uint256 seizedCollateral
    );
    event Accrued(uint256 borrowIndex, uint256 interest);
    event BorrowRateSet(uint256 bps);
    event PriceMaxAgeSet(uint256 seconds_);

    /* ------------------------------------------------------------------ */
    /*                                errors                              */
    /* ------------------------------------------------------------------ */

    error ZeroAmount();
    error ZeroAddress();
    error UnsupportedDecimals();
    error InsufficientCollateral();
    error InsufficientLiquidity();
    error PositionUnhealthy();
    error PositionHealthy();
    error NoDebt();
    error RateTooHigh();
    error BadPriceMaxAge();
    error StalePrice(uint256 updatedAt);
    error InvalidPrice(int256 answer);
    error UnexpectedTransferAmount();

    /* ------------------------------------------------------------------ */
    /*                             construction                           */
    /* ------------------------------------------------------------------ */

    /**
     * @param debtToken_       USDC.
     * @param collateralToken_ WETH.
     * @param priceFeed_       Chainlink ETH/USD aggregator (the proxy, not the implementation).
     * @param borrowRateBps_   Flat annual borrow rate, bps.
     * @param priceMaxAge_     Staleness window for the feed; must cover its heartbeat plus margin.
     * @param owner_           Multisig/timelock that will own the market.
     */
    constructor(
        IERC20 debtToken_,
        IERC20 collateralToken_,
        IAggregatorV3 priceFeed_,
        uint256 borrowRateBps_,
        uint256 priceMaxAge_,
        address owner_
    )
        ERC20("WETH/USDC Market Deposit", "mUSDC")
        ERC4626(debtToken_)
        Ownable(owner_)
    {
        if (address(collateralToken_) == address(0) || address(priceFeed_) == address(0)) revert ZeroAddress();

        collateralToken = collateralToken_;
        priceFeed = priceFeed_;

        uint8 debtDecimals = IERC20Metadata(address(debtToken_)).decimals();
        uint8 collateralDecimals = IERC20Metadata(address(collateralToken_)).decimals();
        uint8 feedDecimals = priceFeed_.decimals();
        // Keeps the conversion a single exponent; true for USDC(6)/WETH(18)/Chainlink(8).
        if (uint256(collateralDecimals) + uint256(feedDecimals) < uint256(debtDecimals)) revert UnsupportedDecimals();
        uint256 exponent = uint256(collateralDecimals) + uint256(feedDecimals) - uint256(debtDecimals);
        if (exponent > 48) revert UnsupportedDecimals();
        PRICE_SCALE = 10 ** exponent;

        borrowIndex = RAY;
        lastAccrualTimestamp = block.timestamp;

        _setBorrowRate(borrowRateBps_);
        _setPriceMaxAge(priceMaxAge_);
    }

    /// @dev Virtual shares/assets offset hardening the empty vault against donation inflation.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    /* ------------------------------------------------------------------ */
    /*                           interest accrual                         */
    /* ------------------------------------------------------------------ */

    /// @notice Bring `borrowIndex` up to the current block.
    function accrue() public {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0) return;

        uint256 indexBefore = borrowIndex;
        uint256 indexAfter = _indexAt(indexBefore, elapsed);

        lastAccrualTimestamp = block.timestamp;
        if (indexAfter == indexBefore) return;

        borrowIndex = indexAfter;

        uint256 scaled = totalScaledDebt;
        uint256 interest = scaled == 0
            ? 0
            : scaled.mulDiv(indexAfter, RAY, Math.Rounding.Ceil) - scaled.mulDiv(indexBefore, RAY, Math.Rounding.Ceil);
        emit Accrued(indexAfter, interest);
    }

    /// @dev Flat (simple, non-compounding) interest applied to the index.
    function _indexAt(uint256 index, uint256 elapsed) internal view returns (uint256) {
        if (elapsed == 0 || borrowRateBps == 0) return index;
        return index + index.mulDiv(borrowRateBps * elapsed, BPS * SECONDS_PER_YEAR);
    }

    /// @notice `borrowIndex` as of now, without writing state.
    function currentBorrowIndex() public view returns (uint256) {
        return _indexAt(borrowIndex, block.timestamp - lastAccrualTimestamp);
    }

    /* ------------------------------------------------------------------ */
    /*                                oracle                              */
    /* ------------------------------------------------------------------ */

    /// @notice Latest validated collateral price, in the feed's own decimals.
    function collateralPrice() public view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = priceFeed.latestRoundData();
        if (answer <= 0) revert InvalidPrice(answer);
        // A future-dated answer means a misbehaving feed; treat it as unusable.
        if (updatedAt == 0 || updatedAt > block.timestamp) revert StalePrice(updatedAt);
        if (block.timestamp - updatedAt > priceMaxAge) revert StalePrice(updatedAt);
        // casting to 'uint256' is safe because `answer` is checked positive above
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer);
    }

    /// @notice USD value (in debt-token decimals) of `collateralAmount` of collateral.
    function collateralValue(uint256 collateralAmount) public view returns (uint256) {
        return collateralAmount.mulDiv(collateralPrice(), PRICE_SCALE);
    }

    /// @notice Collateral amount worth `debtAmount` of debt token, rounded down.
    function collateralForDebt(uint256 debtAmount) public view returns (uint256) {
        return debtAmount.mulDiv(PRICE_SCALE, collateralPrice());
    }

    /* ------------------------------------------------------------------ */
    /*                               position                             */
    /* ------------------------------------------------------------------ */

    /// @notice Collateral and current (interest-inclusive) debt of `account`.
    function positionOf(address account) public view returns (uint256 collateral, uint256 debt) {
        Position storage p = _positions[account];
        collateral = p.collateral;
        debt = p.scaledDebt.mulDiv(currentBorrowIndex(), RAY, Math.Rounding.Ceil);
    }

    /// @notice Current debt of `account`, interest included.
    function debtOf(address account) public view returns (uint256 debt) {
        (, debt) = positionOf(account);
    }

    /// @dev Debt using the stored index; only valid right after `accrue()`.
    function _debt(Position storage p) internal view returns (uint256) {
        return p.scaledDebt.mulDiv(borrowIndex, RAY, Math.Rounding.Ceil);
    }

    /// @notice Largest additional amount `account` may borrow right now, liquidity aside.
    function maxBorrow(address account) external view returns (uint256) {
        (uint256 collateral, uint256 debt) = positionOf(account);
        uint256 limit = collateralValue(collateral).mulDiv(MAX_LTV_BPS, BPS);
        return debt >= limit ? 0 : limit - debt;
    }

    /// @notice True if `account` may currently be liquidated.
    function isLiquidatable(address account) external view returns (bool) {
        (uint256 collateral, uint256 debt) = positionOf(account);
        return debt * BPS > collateralValue(collateral) * LIQUIDATION_THRESHOLD_BPS;
    }

    /* ------------------------------------------------------------------ */
    /*                           borrower actions                         */
    /* ------------------------------------------------------------------ */

    /// @notice Lock `amount` of collateral for `onBehalfOf`.
    function depositCollateral(uint256 amount, address onBehalfOf) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (onBehalfOf == address(0)) revert ZeroAddress();

        uint256 received = _pullExact(collateralToken, msg.sender, amount);
        _positions[onBehalfOf].collateral += received;

        emit CollateralDeposited(onBehalfOf, received);
    }

    /// @notice Withdraw `amount` of collateral to `to`, leaving the position within max LTV.
    function withdrawCollateral(uint256 amount, address to) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        accrue();

        Position storage p = _positions[msg.sender];
        if (amount > p.collateral) revert InsufficientCollateral();

        uint256 remaining = p.collateral - amount;
        p.collateral = remaining;
        _requireWithinLtv(remaining, _debt(p));

        collateralToken.safeTransfer(to, amount);
        emit CollateralWithdrawn(msg.sender, to, amount);
    }

    /// @notice Borrow `amount` of the debt token against already-locked collateral.
    function borrow(uint256 amount, address to) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        accrue();

        if (amount > _cash()) revert InsufficientLiquidity();

        Position storage p = _positions[msg.sender];
        uint256 scaled = amount.mulDiv(RAY, borrowIndex, Math.Rounding.Ceil);
        p.scaledDebt += scaled;
        totalScaledDebt += scaled;

        _requireWithinLtv(p.collateral, _debt(p));

        IERC20(asset()).safeTransfer(to, amount);
        emit Borrowed(msg.sender, to, amount);
    }

    /**
     * @notice Repay debt owed by `onBehalfOf`. Repaying is always open, even while paused.
     * @param amount Debt-token amount; pass `type(uint256).max` to clear the position.
     * @return repaid Amount actually pulled from the caller.
     */
    function repay(uint256 amount, address onBehalfOf) external nonReentrant returns (uint256 repaid) {
        if (amount == 0) revert ZeroAmount();
        accrue();

        Position storage p = _positions[onBehalfOf];
        uint256 debt = _debt(p);
        if (debt == 0) revert NoDebt();

        repaid = amount > debt ? debt : amount;
        _reduceDebt(p, debt, repaid);

        uint256 received = _pullExact(IERC20(asset()), msg.sender, repaid);
        // `_pullExact` reverts on any shortfall, so `received == repaid` here.
        emit Repaid(msg.sender, onBehalfOf, received);
    }

    /* ------------------------------------------------------------------ */
    /*                              liquidation                           */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Repay part of an unhealthy position's debt and seize collateral plus a 5% bonus.
     * @param account     Borrower to liquidate.
     * @param repayAmount Debt-token amount offered; clamped to the close factor and to what the
     *                    remaining collateral can actually pay for.
     * @param to          Recipient of the seized collateral.
     * @return repaid  Debt-token amount actually taken from the caller.
     * @return seized  Collateral amount sent to `to`.
     */
    function liquidate(address account, uint256 repayAmount, address to)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 repaid, uint256 seized)
    {
        if (repayAmount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        accrue();

        Position storage p = _positions[account];
        uint256 debt = _debt(p);
        uint256 collateral = p.collateral;
        uint256 value = collateralValue(collateral);

        if (debt * BPS <= value * LIQUIDATION_THRESHOLD_BPS) revert PositionHealthy();

        // Half the debt per call, except on an insolvent position where the whole
        // position should be closable so no dust debt is stranded behind bad debt.
        uint256 maxRepay = value >= debt ? debt.mulDiv(CLOSE_FACTOR_BPS, BPS) : debt;
        repaid = repayAmount > maxRepay ? maxRepay : repayAmount;

        seized = collateralForDebt(repaid.mulDiv(BPS + LIQUIDATION_BONUS_BPS, BPS));
        if (seized > collateral) {
            // Collateral cannot cover the bonus: hand over what is left and charge only
            // what that collateral is worth net of the bonus. The rest stays as bad debt.
            seized = collateral;
            repaid = collateralValue(seized).mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS);
        }
        if (repaid == 0 || seized == 0) revert ZeroAmount();

        p.collateral = collateral - seized;
        _reduceDebt(p, debt, repaid);

        _pullExact(IERC20(asset()), msg.sender, repaid);
        collateralToken.safeTransfer(to, seized);

        emit Liquidated(msg.sender, account, repaid, seized);
    }

    /* ------------------------------------------------------------------ */
    /*                             lender side                            */
    /* ------------------------------------------------------------------ */

    /// @notice Idle debt-token liquidity held by the market.
    function _cash() internal view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    /// @notice Debt-token liquidity available to borrow or withdraw.
    function availableLiquidity() external view returns (uint256) {
        return _cash();
    }

    /// @notice Aggregate outstanding borrower debt, interest included.
    function totalDebt() public view returns (uint256) {
        return totalScaledDebt.mulDiv(currentBorrowIndex(), RAY, Math.Rounding.Ceil);
    }

    /// @inheritdoc ERC4626
    function totalAssets() public view override returns (uint256) {
        return _cash() + totalDebt();
    }

    /// @inheritdoc ERC4626
    function maxWithdraw(address owner_) public view override returns (uint256) {
        return Math.min(super.maxWithdraw(owner_), _cash());
    }

    /// @inheritdoc ERC4626
    function maxRedeem(address owner_) public view override returns (uint256) {
        return Math.min(super.maxRedeem(owner_), _convertToShares(_cash(), Math.Rounding.Floor));
    }

    /// @inheritdoc ERC4626
    function maxDeposit(address) public view override returns (uint256) {
        return paused() ? 0 : type(uint256).max;
    }

    /// @inheritdoc ERC4626
    function maxMint(address) public view override returns (uint256) {
        return paused() ? 0 : type(uint256).max;
    }

    // Accrual must land before shares are priced, so the index is refreshed in the public
    // entry points rather than in `_deposit`/`_withdraw` (which run after conversion).

    function deposit(uint256 assets, address receiver) public override nonReentrant whenNotPaused returns (uint256) {
        accrue();
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override nonReentrant whenNotPaused returns (uint256) {
        accrue();
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner_)
        public
        override
        nonReentrant
        returns (uint256)
    {
        accrue();
        return super.withdraw(assets, receiver, owner_);
    }

    function redeem(uint256 shares, address receiver, address owner_) public override nonReentrant returns (uint256) {
        accrue();
        return super.redeem(shares, receiver, owner_);
    }

    /* ------------------------------------------------------------------ */
    /*                               internals                            */
    /* ------------------------------------------------------------------ */

    function _requireWithinLtv(uint256 collateral, uint256 debt) internal view {
        if (debt == 0) return;
        if (debt * BPS > collateralValue(collateral) * MAX_LTV_BPS) revert PositionUnhealthy();
    }

    /// @dev Subtract `amount` from a position whose current debt is `debt`.
    function _reduceDebt(Position storage p, uint256 debt, uint256 amount) internal {
        uint256 scaled = p.scaledDebt;
        if (amount >= debt) {
            p.scaledDebt = 0;
            totalScaledDebt -= scaled;
        } else {
            // Round the credited scaled amount down so repayment never cancels more
            // debt than was paid for.
            uint256 scaledRepaid = amount.mulDiv(RAY, borrowIndex);
            if (scaledRepaid > scaled) scaledRepaid = scaled;
            p.scaledDebt = scaled - scaledRepaid;
            totalScaledDebt -= scaledRepaid;
        }
    }

    /// @dev Pull `amount` and require the balance to move by exactly that much, so a
    ///      fee-on-transfer or otherwise surprising token cannot desync accounting.
    function _pullExact(IERC20 token, address from, uint256 amount) internal returns (uint256) {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received != amount) revert UnexpectedTransferAmount();
        return received;
    }

    /* ------------------------------------------------------------------ */
    /*                                 admin                              */
    /* ------------------------------------------------------------------ */

    /// @notice Update the flat annual borrow rate. Accrues at the old rate first.
    function setBorrowRate(uint256 bps) external onlyOwner {
        accrue();
        _setBorrowRate(bps);
    }

    /// @notice Update the oracle staleness window.
    function setPriceMaxAge(uint256 seconds_) external onlyOwner {
        _setPriceMaxAge(seconds_);
    }

    /// @notice Stop new supply, borrowing, collateral withdrawal and liquidation.
    ///         Repayment stays open so borrowers are never trapped.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _setBorrowRate(uint256 bps) internal {
        if (bps > MAX_BORROW_RATE_BPS) revert RateTooHigh();
        borrowRateBps = bps;
        emit BorrowRateSet(bps);
    }

    function _setPriceMaxAge(uint256 seconds_) internal {
        if (seconds_ < MIN_PRICE_MAX_AGE || seconds_ > MAX_PRICE_MAX_AGE) revert BadPriceMaxAge();
        priceMaxAge = seconds_;
        emit PriceMaxAgeSet(seconds_);
    }
}
