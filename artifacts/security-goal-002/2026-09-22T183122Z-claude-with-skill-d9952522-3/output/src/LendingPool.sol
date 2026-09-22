// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/**
 * @title LendingPool
 * @notice Single-pair borrowing market: WETH is locked as collateral, USDC is borrowed against it.
 *
 * Supply side
 *   The pool is an ERC-4626 vault over the debt asset (USDC). Lenders deposit USDC and receive
 *   shares; share value grows as borrowers pay interest. `totalAssets` is idle cash plus
 *   outstanding borrows, minus the protocol reserve. Lender withdrawals are capped by idle cash,
 *   so the vault cannot hand out USDC that is currently lent to borrowers.
 *
 * Borrow side
 *   Collateral and debt are tracked per account. Debt is stored as a principal scaled by a global
 *   `borrowIndex`, so interest accrues to every borrower with one index update rather than a loop.
 *
 * Units
 *   Collateral is held in the collateral token's own decimals (WETH, 18). Debt, collateral *value*
 *   and every threshold comparison are in the debt token's decimals (USDC, 6). The oracle reports
 *   the price of one whole collateral token in whole debt tokens scaled by 1e18, and PRICE_SCALE
 *   converts between the two: value = amount * price / PRICE_SCALE.
 */
contract LendingPool is ERC4626, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 10_000;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    /// @dev Upper bounds on owner-settable parameters. These are enforced by the contract itself so
    ///      a compromised or mistaken owner cannot set an arbitrarily hostile configuration.
    uint256 internal constant MAX_RATE_PER_YEAR_WAD = 1e18; // 100% APR
    uint256 internal constant MAX_LIQUIDATION_BONUS_BPS = 2_000; // 20%
    uint256 internal constant MAX_RESERVE_FACTOR_BPS = 5_000; // 50%
    /// @dev Virtual-share offset for the empty-vault inflation/donation defence (see _decimalsOffset).
    uint8 internal constant DECIMALS_OFFSET = 6;

    // --------------------------------------------------------------------- //
    // Immutables
    // --------------------------------------------------------------------- //

    IERC20 public immutable collateralToken;

    /// @dev 10 ** (collateralDecimals + 18 - debtDecimals). WETH/USDC => 1e30.
    uint256 public immutable PRICE_SCALE;

    // --------------------------------------------------------------------- //
    // Risk parameters
    // --------------------------------------------------------------------- //

    IPriceOracle public oracle;

    /// @notice Max debt as a fraction of collateral value when opening/increasing exposure.
    uint256 public ltvBps;
    /// @notice Debt fraction of collateral value at or above which a position may be liquidated.
    uint256 public liquidationThresholdBps;
    /// @notice Extra collateral a liquidator receives on top of the value they repay.
    uint256 public liquidationBonusBps;
    /// @notice Max fraction of a position's debt repayable in a single liquidation.
    uint256 public closeFactorBps;
    /// @notice Fraction of accrued interest set aside for the protocol instead of lenders.
    uint256 public reserveFactorBps;
    /// @notice Flat annual borrow rate, 1e18 = 100%/year. Simple interest per accrual step.
    uint256 public ratePerYearWad;

    // --------------------------------------------------------------------- //
    // Market state
    // --------------------------------------------------------------------- //

    /// @notice Cumulative borrow index, starts at 1e18.
    uint256 public borrowIndex;
    /// @notice Sum of all outstanding debt in debt-token units, interest included.
    uint256 public totalBorrows;
    /// @notice Protocol-owned share of accrued interest, in debt-token units.
    uint256 public totalReserves;
    /// @notice Timestamp of the last interest accrual.
    uint256 public lastAccrualTime;
    /// @notice Collateral credited to positions. Excludes tokens donated straight to the contract.
    uint256 public totalCollateral;

    mapping(address account => uint256) public collateralOf;
    /// @dev debt = debtPrincipal * borrowIndex / 1e18, rounded up.
    mapping(address account => uint256) public debtPrincipal;

    // --------------------------------------------------------------------- //
    // Events
    // --------------------------------------------------------------------- //

    event CollateralDeposited(address indexed account, address indexed payer, uint256 amount);
    event CollateralWithdrawn(address indexed account, address indexed to, uint256 amount);
    event Borrowed(address indexed account, address indexed to, uint256 amount);
    event Repaid(address indexed account, address indexed payer, uint256 amount);
    event Liquidated(
        address indexed account, address indexed liquidator, uint256 debtRepaid, uint256 collateralSeized
    );
    event InterestAccrued(uint256 interest, uint256 borrowIndex, uint256 totalBorrows);
    event OracleUpdated(address indexed oracle);
    event RiskParamsUpdated(
        uint256 ltvBps, uint256 liquidationThresholdBps, uint256 liquidationBonusBps, uint256 closeFactorBps
    );
    event InterestParamsUpdated(uint256 ratePerYearWad, uint256 reserveFactorBps);
    event ReservesWithdrawn(address indexed to, uint256 amount);

    // --------------------------------------------------------------------- //
    // Errors
    // --------------------------------------------------------------------- //

    error ZeroAmount();
    error ZeroAddress();
    error InvalidParams();
    error InsufficientCollateral();
    error PositionUnhealthy(uint256 debt, uint256 maxDebt);
    error PositionHealthy();
    error NoDebt();
    error RepayExceedsCloseFactor(uint256 requested, uint256 maxRepay);
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error SlippageExceeded(uint256 seized, uint256 minSeized);
    error NothingReceived();

    // --------------------------------------------------------------------- //
    // Construction
    // --------------------------------------------------------------------- //

    struct InitParams {
        IERC20 debtToken; // USDC
        IERC20 collateralToken; // WETH
        IPriceOracle oracle;
        address owner;
        uint256 ltvBps;
        uint256 liquidationThresholdBps;
        uint256 liquidationBonusBps;
        uint256 closeFactorBps;
        uint256 reserveFactorBps;
        uint256 ratePerYearWad;
    }

    constructor(InitParams memory p, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC4626(p.debtToken)
        Ownable(p.owner)
    {
        if (address(p.collateralToken) == address(0) || address(p.debtToken) == address(0)) revert ZeroAddress();
        if (address(p.collateralToken) == address(p.debtToken)) revert InvalidParams();

        collateralToken = p.collateralToken;

        uint8 collateralDecimals = IERC20Metadata(address(p.collateralToken)).decimals();
        uint8 debtDecimals = IERC20Metadata(address(p.debtToken)).decimals();
        // Guards the exponent below and keeps value math inside uint256.
        if (collateralDecimals > 24 || debtDecimals > 24 || debtDecimals > collateralDecimals + 18) {
            revert InvalidParams();
        }
        PRICE_SCALE = 10 ** (uint256(collateralDecimals) + 18 - uint256(debtDecimals));

        borrowIndex = WAD;
        lastAccrualTime = block.timestamp;

        _setOracle(p.oracle);
        _setRiskParams(p.ltvBps, p.liquidationThresholdBps, p.liquidationBonusBps, p.closeFactorBps);
        _setInterestParams(p.ratePerYearWad, p.reserveFactorBps);
    }

    // --------------------------------------------------------------------- //
    // Interest accrual
    // --------------------------------------------------------------------- //

    /// @notice Bring the borrow index, total debt and reserves up to the current block.
    function accrueInterest() public {
        if (lastAccrualTime == block.timestamp) return;

        (uint256 index_, uint256 borrows_, uint256 reserves_) = _accrued();
        uint256 interest = borrows_ - totalBorrows;

        borrowIndex = index_;
        totalBorrows = borrows_;
        totalReserves = reserves_;
        lastAccrualTime = block.timestamp;

        emit InterestAccrued(interest, index_, borrows_);
    }

    /// @dev Pure projection of accrual to `block.timestamp`; used by both the state update and views
    ///      so a stale view can never disagree with what a transaction would compute.
    function _accrued() internal view returns (uint256 index_, uint256 borrows_, uint256 reserves_) {
        index_ = borrowIndex;
        borrows_ = totalBorrows;
        reserves_ = totalReserves;

        uint256 dt = block.timestamp - lastAccrualTime;
        if (dt == 0 || borrows_ == 0) return (index_, borrows_, reserves_);

        uint256 factor = Math.mulDiv(ratePerYearWad, dt, SECONDS_PER_YEAR);
        if (factor == 0) return (index_, borrows_, reserves_);

        uint256 interest = Math.mulDiv(borrows_, factor, WAD);
        borrows_ += interest;
        index_ += Math.mulDiv(index_, factor, WAD);
        reserves_ += Math.mulDiv(interest, reserveFactorBps, BPS);
    }

    // --------------------------------------------------------------------- //
    // Views
    // --------------------------------------------------------------------- //

    /// @notice Current debt of `account` in debt-token units, interest included.
    function debtOf(address account) public view returns (uint256) {
        uint256 principal = debtPrincipal[account];
        if (principal == 0) return 0;
        (uint256 index_,,) = _accrued();
        // Round up: the borrower owes the protocol, never the other way round.
        return Math.mulDiv(principal, index_, WAD, Math.Rounding.Ceil);
    }

    /// @notice Value of `account`'s collateral in debt-token units.
    function collateralValueOf(address account) public view returns (uint256) {
        return _collateralValue(collateralOf[account], oracle.collateralPriceInDebt());
    }

    /// @notice Largest debt `account` may hold before becoming liquidatable.
    function liquidationLimitOf(address account) public view returns (uint256) {
        return Math.mulDiv(collateralValueOf(account), liquidationThresholdBps, BPS);
    }

    /// @notice Largest debt `account` may hold and still be allowed to borrow or withdraw.
    function borrowLimitOf(address account) public view returns (uint256) {
        return Math.mulDiv(collateralValueOf(account), ltvBps, BPS);
    }

    /// @notice True when the position may be liquidated, i.e. debt exceeds the liquidation limit.
    function isLiquidatable(address account) public view returns (bool) {
        uint256 debt = debtOf(account);
        return debt > 0 && debt > liquidationLimitOf(account);
    }

    /// @notice Total outstanding debt including interest pending since the last accrual.
    /// @dev The raw `totalBorrows` storage getter is only correct as of `lastAccrualTime`.
    function totalBorrowsCurrent() public view returns (uint256) {
        (, uint256 borrows_,) = _accrued();
        return borrows_;
    }

    /// @notice Protocol reserves including the share of interest pending since the last accrual.
    function totalReservesCurrent() public view returns (uint256) {
        (,, uint256 reserves_) = _accrued();
        return reserves_;
    }

    /// @notice Current borrow index including accrual pending since the last update.
    function borrowIndexCurrent() public view returns (uint256) {
        (uint256 index_,,) = _accrued();
        return index_;
    }

    /// @notice USDC held by the pool that is not earmarked as protocol reserves.
    function availableLiquidity() public view returns (uint256) {
        uint256 cash = IERC20(asset()).balanceOf(address(this));
        (,, uint256 reserves_) = _accrued();
        return cash > reserves_ ? cash - reserves_ : 0;
    }

    /// @inheritdoc ERC4626
    function totalAssets() public view override returns (uint256) {
        (, uint256 borrows_, uint256 reserves_) = _accrued();
        uint256 gross = IERC20(asset()).balanceOf(address(this)) + borrows_;
        return gross > reserves_ ? gross - reserves_ : 0;
    }

    function _collateralValue(uint256 amount, uint256 price) internal view returns (uint256) {
        return Math.mulDiv(amount, price, PRICE_SCALE);
    }

    // --------------------------------------------------------------------- //
    // Borrower actions
    // --------------------------------------------------------------------- //

    /// @notice Lock collateral for `onBehalfOf`. Credits the amount actually received.
    function depositCollateral(uint256 amount, address onBehalfOf) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (onBehalfOf == address(0)) revert ZeroAddress();

        uint256 received = _pull(collateralToken, msg.sender, amount);

        collateralOf[onBehalfOf] += received;
        totalCollateral += received;

        emit CollateralDeposited(onBehalfOf, msg.sender, received);
    }

    /// @notice Withdraw collateral, provided the position stays within the LTV limit afterwards.
    function withdrawCollateral(uint256 amount, address to) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        accrueInterest();

        uint256 balance = collateralOf[msg.sender];
        if (amount > balance) revert InsufficientCollateral();

        collateralOf[msg.sender] = balance - amount;
        totalCollateral -= amount;

        _requireWithinLtv(msg.sender);

        collateralToken.safeTransfer(to, amount);
        emit CollateralWithdrawn(msg.sender, to, amount);
    }

    /// @notice Borrow USDC against already-locked collateral.
    function borrow(uint256 amount, address to) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        accrueInterest();

        uint256 available = availableLiquidity();
        if (amount > available) revert InsufficientLiquidity(amount, available);

        // Round the principal up so rounding never mints free debt relief.
        debtPrincipal[msg.sender] += Math.mulDiv(amount, WAD, borrowIndex, Math.Rounding.Ceil);
        totalBorrows += amount;

        _requireWithinLtv(msg.sender);

        IERC20(asset()).safeTransfer(to, amount);
        emit Borrowed(msg.sender, to, amount);
    }

    /// @notice Repay part or all of `onBehalfOf`'s debt. Repaying more than owed is capped, not refunded.
    /// @param amount Debt-token amount to repay; use type(uint256).max to repay in full.
    /// @return repaid The amount actually applied to the debt.
    function repay(uint256 amount, address onBehalfOf) external nonReentrant returns (uint256 repaid) {
        if (amount == 0) revert ZeroAmount();
        accrueInterest();

        uint256 debt = debtOf(onBehalfOf);
        if (debt == 0) revert NoDebt();

        repaid = _repay(onBehalfOf, amount > debt ? debt : amount, debt);
        emit Repaid(onBehalfOf, msg.sender, repaid);
    }

    // --------------------------------------------------------------------- //
    // Liquidation
    // --------------------------------------------------------------------- //

    /**
     * @notice Repay part of an unhealthy position's debt and seize the matching collateral plus bonus.
     * @param account     The borrower being liquidated.
     * @param repayAmount Debt-token amount to repay, capped at closeFactor * debt.
     * @param minSeized   Minimum collateral the caller accepts, guarding against a price move or a
     *                    partially-front-run repayment between simulation and execution.
     * @param to          Recipient of the seized collateral.
     */
    function liquidate(address account, uint256 repayAmount, uint256 minSeized, address to)
        external
        nonReentrant
        returns (uint256 repaid, uint256 seized)
    {
        if (repayAmount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        accrueInterest();

        uint256 price = oracle.collateralPriceInDebt();
        uint256 collateral = collateralOf[account];
        uint256 debt = debtOf(account);
        if (debt == 0) revert NoDebt();

        // Health is measured against the liquidation threshold, not the borrow LTV.
        if (debt <= Math.mulDiv(_collateralValue(collateral, price), liquidationThresholdBps, BPS)) {
            revert PositionHealthy();
        }

        uint256 maxRepay = Math.mulDiv(debt, closeFactorBps, BPS);
        if (repayAmount > maxRepay) revert RepayExceedsCloseFactor(repayAmount, maxRepay);

        repaid = _repay(account, repayAmount, debt);

        // Collateral of equal value to what was repaid, plus the liquidation bonus.
        seized = Math.mulDiv(Math.mulDiv(repaid, PRICE_SCALE, price), BPS + liquidationBonusBps, BPS);
        // A deeply underwater position may not have enough collateral to cover the bonus; the
        // liquidator takes what is there and the remaining debt stays as bad debt.
        if (seized > collateral) seized = collateral;
        if (seized < minSeized) revert SlippageExceeded(seized, minSeized);

        collateralOf[account] = collateral - seized;
        totalCollateral -= seized;

        collateralToken.safeTransfer(to, seized);
        emit Liquidated(account, msg.sender, repaid, seized);
    }

    // --------------------------------------------------------------------- //
    // Internal borrow-side helpers
    // --------------------------------------------------------------------- //

    /// @dev Pulls `amount` of debt token from msg.sender and writes down `account`'s debt by whatever
    ///      was actually received. Caller must have accrued interest and capped `amount` at `debt`.
    function _repay(address account, uint256 amount, uint256 debt) internal returns (uint256 repaid) {
        repaid = _pull(IERC20(asset()), msg.sender, amount);
        if (repaid > debt) repaid = debt;

        if (repaid == debt) {
            debtPrincipal[account] = 0;
        } else {
            // Round the principal reduction down so rounding never erases unpaid debt.
            uint256 principalDelta = Math.mulDiv(repaid, WAD, borrowIndex, Math.Rounding.Floor);
            uint256 principal = debtPrincipal[account];
            debtPrincipal[account] = principalDelta < principal ? principal - principalDelta : 0;
        }

        totalBorrows = totalBorrows > repaid ? totalBorrows - repaid : 0;
    }

    /// @dev Transfers in and returns the balance delta, so a fee-on-transfer or otherwise lossy
    ///      token can never credit more than the pool actually holds.
    function _pull(IERC20 token, address from, uint256 amount) internal returns (uint256 received) {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        received = token.balanceOf(address(this)) - before;
        if (received == 0) revert NothingReceived();
    }

    function _requireWithinLtv(address account) internal view {
        uint256 debt = debtOf(account);
        if (debt == 0) return;
        uint256 maxDebt = Math.mulDiv(collateralValueOf(account), ltvBps, BPS);
        if (debt > maxDebt) revert PositionUnhealthy(debt, maxDebt);
    }

    // --------------------------------------------------------------------- //
    // ERC-4626 supply side
    // --------------------------------------------------------------------- //

    /// @dev Virtual shares/assets offset. With the offset the empty vault cannot be inflated by a
    ///      direct token donation before the first real deposit.
    function _decimalsOffset() internal pure override returns (uint8) {
        return DECIMALS_OFFSET;
    }

    function maxDeposit(address receiver) public view override returns (uint256) {
        return paused() ? 0 : super.maxDeposit(receiver);
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return paused() ? 0 : super.maxMint(receiver);
    }

    /// @dev Lenders can only pull out USDC that is not currently lent out or reserved.
    function maxWithdraw(address owner_) public view override returns (uint256) {
        uint256 assets = super.maxWithdraw(owner_);
        uint256 available = availableLiquidity();
        return assets < available ? assets : available;
    }

    function maxRedeem(address owner_) public view override returns (uint256) {
        uint256 shares = super.maxRedeem(owner_);
        uint256 cashShares = _convertToShares(availableLiquidity(), Math.Rounding.Floor);
        return shares < cashShares ? shares : cashShares;
    }

    function deposit(uint256 assets, address receiver)
        public
        override
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        accrueInterest();
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override nonReentrant whenNotPaused returns (uint256) {
        accrueInterest();
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner_)
        public
        override
        nonReentrant
        returns (uint256)
    {
        accrueInterest();
        return super.withdraw(assets, receiver, owner_);
    }

    function redeem(uint256 shares, address receiver, address owner_)
        public
        override
        nonReentrant
        returns (uint256)
    {
        accrueInterest();
        return super.redeem(shares, receiver, owner_);
    }

    // --------------------------------------------------------------------- //
    // Owner controls
    // --------------------------------------------------------------------- //

    /// @notice Blocks new deposits and new borrows. Repay, withdraw and liquidate stay open so a
    ///         pause can never trap a borrower's collateral or stop the market from de-risking.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setOracle(IPriceOracle newOracle) external onlyOwner {
        accrueInterest();
        _setOracle(newOracle);
    }

    function setRiskParams(uint256 ltv, uint256 threshold, uint256 bonus, uint256 closeFactor) external onlyOwner {
        accrueInterest();
        _setRiskParams(ltv, threshold, bonus, closeFactor);
    }

    function setInterestParams(uint256 rate, uint256 reserveFactor) external onlyOwner {
        accrueInterest();
        _setInterestParams(rate, reserveFactor);
    }

    function withdrawReserves(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        accrueInterest();
        if (amount == 0 || amount > totalReserves) revert InvalidParams();

        uint256 cash = IERC20(asset()).balanceOf(address(this));
        if (amount > cash) revert InsufficientLiquidity(amount, cash);

        totalReserves -= amount;
        IERC20(asset()).safeTransfer(to, amount);
        emit ReservesWithdrawn(to, amount);
    }

    /// @notice Sweep tokens accidentally sent here. Cannot touch collateral backing positions, the
    ///         reserve, or any USDC belonging to lenders and borrowers.
    function sweep(IERC20 token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        accrueInterest();

        if (token == collateralToken) {
            uint256 surplus = token.balanceOf(address(this)) - totalCollateral;
            if (amount > surplus) revert InvalidParams();
        } else if (address(token) == asset()) {
            revert InvalidParams();
        }
        token.safeTransfer(to, amount);
    }

    function _setOracle(IPriceOracle newOracle) internal {
        if (address(newOracle) == address(0)) revert ZeroAddress();
        // Fail fast on a mis-wired oracle rather than discovering it on the first liquidation.
        if (newOracle.collateralPriceInDebt() == 0) revert InvalidParams();
        oracle = newOracle;
        emit OracleUpdated(address(newOracle));
    }

    function _setRiskParams(uint256 ltv, uint256 threshold, uint256 bonus, uint256 closeFactor) internal {
        if (ltv == 0 || ltv >= threshold) revert InvalidParams();
        if (threshold >= BPS) revert InvalidParams();
        if (bonus == 0 || bonus > MAX_LIQUIDATION_BONUS_BPS) revert InvalidParams();
        if (closeFactor == 0 || closeFactor > BPS) revert InvalidParams();
        // A liquidation at the threshold must not by itself push the position underwater:
        // threshold * (1 + bonus) must stay at or below 100% of collateral value.
        if (threshold * (BPS + bonus) > BPS * BPS) revert InvalidParams();

        ltvBps = ltv;
        liquidationThresholdBps = threshold;
        liquidationBonusBps = bonus;
        closeFactorBps = closeFactor;
        emit RiskParamsUpdated(ltv, threshold, bonus, closeFactor);
    }

    function _setInterestParams(uint256 rate, uint256 reserveFactor) internal {
        if (rate > MAX_RATE_PER_YEAR_WAD) revert InvalidParams();
        if (reserveFactor > MAX_RESERVE_FACTOR_BPS) revert InvalidParams();

        ratePerYearWad = rate;
        reserveFactorBps = reserveFactor;
        emit InterestParamsUpdated(rate, reserveFactor);
    }
}
