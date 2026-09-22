// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
import {Math} from "./libraries/Math.sol";
import {SafeERC20} from "./libraries/SafeERC20.sol";
import {Ownable} from "./utils/Ownable.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";

contract WethUsdcBorrowMarket is Ownable, ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant MAX_BORROW_BPS = 7_000;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    uint256 public constant HEALTH_FACTOR_SCALE = 1e18;

    uint256 private constant WETH_SCALE = 1e18;
    uint256 private constant USDC_SCALE = 1e6;

    IERC20 public immutable WETH;
    IERC20 public immutable USDC;
    AggregatorV3Interface public immutable ETH_USD_FEED;

    uint256 public immutable ANNUAL_RATE_BPS;
    uint256 public immutable MAX_ORACLE_STALENESS;
    uint256 public immutable ORACLE_SCALE;

    struct Position {
        uint256 collateralAmount;
        uint256 debtPrincipal;
        uint256 lastAccruedAt;
    }

    mapping(address borrower => Position position) private _positions;

    event CollateralDeposited(address indexed borrower, uint256 amount);
    event CollateralWithdrawn(address indexed borrower, address indexed to, uint256 amount);
    event Borrowed(address indexed borrower, address indexed to, uint256 amount);
    event Repaid(address indexed borrower, address indexed payer, uint256 amount);
    event Liquidated(
        address indexed borrower, address indexed liquidator, uint256 repaidAmount, uint256 seizedCollateral
    );
    event LiquidityAdded(address indexed from, uint256 amount);
    event LiquidityRemoved(address indexed to, uint256 amount);

    error ZeroAmount();
    error ZeroAddress();
    error BadTokenDecimals();
    error BadRate();
    error BadOracleStaleness();
    error BadOracleDecimals();
    error StaleOracle();
    error InvalidOracleAnswer();
    error InsufficientLiquidity();
    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
    error PositionHealthy(uint256 debt, uint256 liquidationDebt);
    error SeizeAmountTooHigh(uint256 seizeAmount, uint256 collateralAmount);

    constructor(
        address weth_,
        address usdc_,
        address ethUsdFeed_,
        uint256 annualRateBps_,
        uint256 maxOracleStaleness_,
        address owner_
    ) Ownable(owner_) {
        if (weth_ == address(0) || usdc_ == address(0) || ethUsdFeed_ == address(0)) {
            revert ZeroAddress();
        }
        if (annualRateBps_ > BPS) revert BadRate();
        if (maxOracleStaleness_ == 0) revert BadOracleStaleness();

        if (IERC20Metadata(weth_).decimals() != 18 || IERC20Metadata(usdc_).decimals() != 6) {
            revert BadTokenDecimals();
        }

        uint8 feedDecimals = AggregatorV3Interface(ethUsdFeed_).decimals();
        if (feedDecimals == 0 || feedDecimals > 18) revert BadOracleDecimals();

        WETH = IERC20(weth_);
        USDC = IERC20(usdc_);
        ETH_USD_FEED = AggregatorV3Interface(ethUsdFeed_);
        ANNUAL_RATE_BPS = annualRateBps_;
        MAX_ORACLE_STALENESS = maxOracleStaleness_;
        ORACLE_SCALE = 10 ** feedDecimals;
    }

    function depositCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        _positions[msg.sender].collateralAmount += amount;
        WETH.safeTransferFrom(msg.sender, address(this), amount);

        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount, address to) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        Position storage position = _positions[msg.sender];
        uint256 debt = _accrue(position);
        position.collateralAmount -= amount;
        _requireWithinBorrowLimit(position.collateralAmount, debt);

        WETH.safeTransfer(to, amount);

        emit CollateralWithdrawn(msg.sender, to, amount);
    }

    function borrow(uint256 amount, address to) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        Position storage position = _positions[msg.sender];
        uint256 debt = _accrue(position) + amount;
        _requireWithinBorrowLimit(position.collateralAmount, debt);
        position.debtPrincipal = debt;
        position.lastAccruedAt = block.timestamp;

        USDC.safeTransfer(to, amount);

        emit Borrowed(msg.sender, to, amount);
    }

    function repay(uint256 maxAmount) external nonReentrant returns (uint256 repaid) {
        return _repayFor(msg.sender, maxAmount);
    }

    function repayFor(address borrower, uint256 maxAmount) external nonReentrant returns (uint256 repaid) {
        return _repayFor(borrower, maxAmount);
    }

    function _repayFor(address borrower, uint256 maxAmount) internal returns (uint256 repaid) {
        if (borrower == address(0)) revert ZeroAddress();
        if (maxAmount == 0) revert ZeroAmount();

        Position storage position = _positions[borrower];
        uint256 debt = _accrue(position);
        repaid = maxAmount < debt ? maxAmount : debt;
        if (repaid == 0) revert ZeroAmount();

        position.debtPrincipal = debt - repaid;
        position.lastAccruedAt = block.timestamp;

        USDC.safeTransferFrom(msg.sender, address(this), repaid);

        emit Repaid(borrower, msg.sender, repaid);
    }

    function liquidate(address borrower, uint256 maxRepayAmount)
        external
        nonReentrant
        returns (uint256 repaid, uint256 seizedCollateral)
    {
        if (borrower == address(0)) revert ZeroAddress();
        if (maxRepayAmount == 0) revert ZeroAmount();

        Position storage position = _positions[borrower];
        uint256 debt = _accrue(position);
        uint256 liquidationDebt = _maxDebtAt(position.collateralAmount, LIQUIDATION_THRESHOLD_BPS);
        if (debt <= liquidationDebt) revert PositionHealthy(debt, liquidationDebt);

        repaid = maxRepayAmount < debt ? maxRepayAmount : debt;
        seizedCollateral = collateralToSeize(repaid);
        if (seizedCollateral > position.collateralAmount) {
            revert SeizeAmountTooHigh(seizedCollateral, position.collateralAmount);
        }

        position.debtPrincipal = debt - repaid;
        position.collateralAmount -= seizedCollateral;
        position.lastAccruedAt = block.timestamp;

        USDC.safeTransferFrom(msg.sender, address(this), repaid);
        WETH.safeTransfer(msg.sender, seizedCollateral);

        emit Liquidated(borrower, msg.sender, repaid, seizedCollateral);
    }

    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        emit LiquidityAdded(msg.sender, amount);
    }

    function removeLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
        USDC.safeTransfer(to, amount);
        emit LiquidityRemoved(to, amount);
    }

    function positionOf(address borrower)
        external
        view
        returns (uint256 collateralAmount, uint256 storedDebtPrincipal, uint256 debtWithInterest, uint256 lastAccruedAt)
    {
        Position storage position = _positions[borrower];
        collateralAmount = position.collateralAmount;
        storedDebtPrincipal = position.debtPrincipal;
        debtWithInterest = _debtWithInterest(position);
        lastAccruedAt = position.lastAccruedAt;
    }

    function currentDebt(address borrower) external view returns (uint256) {
        return _debtWithInterest(_positions[borrower]);
    }

    function collateralValue(uint256 wethAmount) public view returns (uint256) {
        (uint256 price,) = _ethUsdPrice();
        uint256 usdValueWad = wethAmount.mulDiv(price, ORACLE_SCALE);
        return usdValueWad.mulDiv(USDC_SCALE, WETH_SCALE);
    }

    function collateralToSeize(uint256 usdcDebtAmount) public view returns (uint256) {
        (uint256 price,) = _ethUsdPrice();
        uint256 usdValueWad = usdcDebtAmount.mulDiv(WETH_SCALE, USDC_SCALE);
        uint256 baseWethAmount = usdValueWad.mulDiv(ORACLE_SCALE, price);
        return baseWethAmount.mulDiv(BPS + LIQUIDATION_BONUS_BPS, BPS, Math.Rounding.Up);
    }

    function healthFactor(address borrower) external view returns (uint256) {
        Position storage position = _positions[borrower];
        uint256 debt = _debtWithInterest(position);
        if (debt == 0) return type(uint256).max;
        return _maxDebtAt(position.collateralAmount, LIQUIDATION_THRESHOLD_BPS).mulDiv(HEALTH_FACTOR_SCALE, debt);
    }

    function ltvBps(address borrower) external view returns (uint256) {
        Position storage position = _positions[borrower];
        uint256 value = collateralValue(position.collateralAmount);
        if (value == 0) return position.debtPrincipal == 0 ? 0 : type(uint256).max;
        return _debtWithInterest(position).mulDiv(BPS, value);
    }

    function isLiquidatable(address borrower) external view returns (bool) {
        Position storage position = _positions[borrower];
        return _debtWithInterest(position) > _maxDebtAt(position.collateralAmount, LIQUIDATION_THRESHOLD_BPS);
    }

    function maxBorrow(address borrower) external view returns (uint256) {
        Position storage position = _positions[borrower];
        uint256 maxDebt = _maxDebtAt(position.collateralAmount, MAX_BORROW_BPS);
        uint256 debt = _debtWithInterest(position);
        return maxDebt > debt ? maxDebt - debt : 0;
    }

    function _accrue(Position storage position) internal returns (uint256 debt) {
        debt = _debtWithInterest(position);
        position.debtPrincipal = debt;
        position.lastAccruedAt = block.timestamp;
    }

    function _debtWithInterest(Position storage position) internal view returns (uint256) {
        uint256 principal = position.debtPrincipal;
        if (principal == 0) return 0;

        uint256 elapsed = block.timestamp - position.lastAccruedAt;
        uint256 interest = principal.mulDiv(ANNUAL_RATE_BPS * elapsed, BPS * SECONDS_PER_YEAR);
        return principal + interest;
    }

    function _requireWithinBorrowLimit(uint256 collateralAmount, uint256 debt) internal view {
        uint256 maxDebt = _maxDebtAt(collateralAmount, MAX_BORROW_BPS);
        if (debt > maxDebt) revert BorrowLimitExceeded(debt, maxDebt);
    }

    function _maxDebtAt(uint256 collateralAmount, uint256 bps) internal view returns (uint256) {
        return collateralValue(collateralAmount).mulDiv(bps, BPS);
    }

    function _ethUsdPrice() internal view returns (uint256 price, uint256 updatedAt) {
        (uint80 roundId, int256 answer,, uint256 roundUpdatedAt, uint80 answeredInRound) =
            ETH_USD_FEED.latestRoundData();
        if (answer <= 0 || answeredInRound < roundId) revert InvalidOracleAnswer();
        if (roundUpdatedAt == 0 || block.timestamp - roundUpdatedAt > MAX_ORACLE_STALENESS) revert StaleOracle();
        // forge-lint: disable-next-line(unsafe-typecast)
        return (uint256(answer), roundUpdatedAt);
    }
}
