// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

contract BorrowingMarket is Ownable, ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant COLLATERAL_FACTOR_BPS = 7_000;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 internal constant PRICE_SCALE = 1e18;
    uint256 internal constant USDC_SCALE = 1e6;

    struct Position {
        uint256 collateralAmount;
        uint256 debtPrincipal;
        uint256 lastAccrued;
    }

    IERC20 public immutable weth;
    IERC20 public immutable usdc;
    uint8 public immutable usdcDecimals;
    AggregatorV3Interface public immutable ethUsdOracle;
    uint8 public immutable oracleDecimals;
    uint256 public immutable annualInterestBps;
    uint256 public immutable maxOracleAge;

    mapping(address account => Position) public positions;

    event CollateralDeposited(address indexed account, uint256 amount);
    event CollateralWithdrawn(address indexed account, uint256 amount);
    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
    event Liquidated(
        address indexed liquidator,
        address indexed account,
        uint256 repaidDebt,
        uint256 seizedCollateral,
        uint256 remainingDebt
    );
    event LiquidityAdded(address indexed provider, uint256 amount);
    event LiquidityRemoved(address indexed recipient, uint256 amount);

    error ZeroAmount();
    error UnsupportedUsdcDecimals(uint8 decimals_);
    error OracleDecimalsTooLarge(uint8 decimals_);
    error OraclePriceInvalid();
    error OracleTimestampInvalid(uint256 updatedAt, uint256 currentTimestamp);
    error OraclePriceStale(uint256 updatedAt, uint256 maxAge);
    error PositionHealthy();
    error PositionUnhealthy();
    error BorrowLimitExceeded(uint256 debt, uint256 maxDebt);
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error InsufficientCollateral(uint256 requested, uint256 available);
    error NoDebt();
    error NothingToLiquidate();

    constructor(
        address initialOwner,
        IERC20 weth_,
        IERC20 usdc_,
        AggregatorV3Interface ethUsdOracle_,
        uint256 annualInterestBps_,
        uint256 maxOracleAge_
    ) Ownable(initialOwner) {
        weth = weth_;
        usdc = usdc_;
        ethUsdOracle = ethUsdOracle_;
        annualInterestBps = annualInterestBps_;
        maxOracleAge = maxOracleAge_;

        uint8 decimals_ = IERC20Metadata(address(usdc_)).decimals();
        if (decimals_ != 6) revert UnsupportedUsdcDecimals(decimals_);
        usdcDecimals = decimals_;

        uint8 oracleDecimals_ = ethUsdOracle_.decimals();
        if (oracleDecimals_ > 18) revert OracleDecimalsTooLarge(oracleDecimals_);
        oracleDecimals = oracleDecimals_;
    }

    function depositCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrue(position);
        position.collateralAmount += amount;

        weth.safeTransferFrom(msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrue(position);

        uint256 collateralAmount = position.collateralAmount;
        if (amount > collateralAmount) revert InsufficientCollateral(amount, collateralAmount);

        position.collateralAmount = collateralAmount - amount;
        _ensureBorrowHealthy(position);

        weth.safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrue(position);

        uint256 newDebt = position.debtPrincipal + amount;
        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
        if (newDebt > maxDebt) revert BorrowLimitExceeded(newDebt, maxDebt);

        uint256 available = usdc.balanceOf(address(this));
        if (amount > available) revert InsufficientLiquidity(amount, available);

        position.debtPrincipal = newDebt;
        position.lastAccrued = block.timestamp;

        usdc.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount, newDebt);
    }

    function repay(uint256 amount) external returns (uint256 repaidAmount) {
        repaidAmount = _repay(msg.sender, msg.sender, amount);
    }

    function repayFor(address account, uint256 amount) external returns (uint256 repaidAmount) {
        repaidAmount = _repay(msg.sender, account, amount);
    }

    function liquidate(address account, uint256 requestedRepayAmount)
        external
        nonReentrant
        returns (uint256 actualRepayAmount, uint256 seizedCollateral)
    {
        if (requestedRepayAmount == 0) revert ZeroAmount();

        Position storage position = positions[account];
        _accrue(position);

        uint256 debt = position.debtPrincipal;
        if (debt == 0) revert NoDebt();

        uint256 price = _ethPrice();
        if (!_isLiquidatable(position.collateralAmount, debt, price)) revert PositionHealthy();

        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, price);
        uint256 maxRepayFromCollateral = collateralValue.mulDiv(BPS, LIQUIDATION_BONUS_BPS);

        actualRepayAmount = requestedRepayAmount;
        if (actualRepayAmount > debt) {
            actualRepayAmount = debt;
        }
        if (actualRepayAmount > maxRepayFromCollateral) {
            actualRepayAmount = maxRepayFromCollateral;
        }
        if (actualRepayAmount == 0) revert NothingToLiquidate();

        uint256 baseCollateral = actualRepayAmount.mulDiv(1e30, price);
        seizedCollateral = baseCollateral.mulDiv(LIQUIDATION_BONUS_BPS, BPS);

        position.debtPrincipal = debt - actualRepayAmount;
        position.collateralAmount -= seizedCollateral;
        position.lastAccrued = block.timestamp;

        usdc.safeTransferFrom(msg.sender, address(this), actualRepayAmount);
        weth.safeTransfer(msg.sender, seizedCollateral);

        emit Liquidated(msg.sender, account, actualRepayAmount, seizedCollateral, position.debtPrincipal);
    }

    function addLiquidity(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit LiquidityAdded(msg.sender, amount);
    }

    function removeLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();

        uint256 available = usdc.balanceOf(address(this));
        if (amount > available) revert InsufficientLiquidity(amount, available);

        usdc.safeTransfer(recipient, amount);
        emit LiquidityRemoved(recipient, amount);
    }

    function previewDebt(address account) external view returns (uint256) {
        return _accruedDebt(positions[account]);
    }

    function currentLtvBps(address account) external view returns (uint256) {
        Position memory position = positions[account];
        if (position.debtPrincipal == 0) return 0;

        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _ethPrice());
        if (collateralValue == 0) return type(uint256).max;

        return _accruedDebt(position).mulDiv(BPS, collateralValue);
    }

    function maxBorrowable(address account) external view returns (uint256) {
        return _maxBorrowable(positions[account].collateralAmount, _ethPrice());
    }

    function isLiquidatable(address account) external view returns (bool) {
        Position memory position = positions[account];
        return _isLiquidatable(position.collateralAmount, _accruedDebt(position), _ethPrice());
    }

    function _repay(address payer, address account, uint256 amount) internal nonReentrant returns (uint256 repaidAmount) {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[account];
        _accrue(position);

        uint256 debt = position.debtPrincipal;
        if (debt == 0) revert NoDebt();

        repaidAmount = amount > debt ? debt : amount;
        position.debtPrincipal = debt - repaidAmount;
        position.lastAccrued = block.timestamp;

        usdc.safeTransferFrom(payer, address(this), repaidAmount);
        emit Repaid(payer, account, repaidAmount, position.debtPrincipal);
    }

    function _accrue(Position storage position) internal {
        uint256 debt = _accruedDebt(position);
        position.debtPrincipal = debt;
        position.lastAccrued = block.timestamp;
    }

    function _accruedDebt(Position memory position) internal view returns (uint256) {
        uint256 principal = position.debtPrincipal;
        if (principal == 0) return 0;

        uint256 elapsed = block.timestamp - position.lastAccrued;
        if (elapsed == 0) return principal;

        uint256 interest = principal.mulDiv(annualInterestBps * elapsed, BPS * SECONDS_PER_YEAR);
        return principal + interest;
    }

    function _ensureBorrowHealthy(Position memory position) internal view {
        uint256 debt = position.debtPrincipal;
        if (debt == 0) return;

        uint256 maxDebt = _maxBorrowable(position.collateralAmount, _ethPrice());
        if (debt > maxDebt) revert PositionUnhealthy();
    }

    function _maxBorrowable(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
        return collateralValue.mulDiv(COLLATERAL_FACTOR_BPS, BPS);
    }

    function _isLiquidatable(uint256 collateralAmount, uint256 debt, uint256 price) internal pure returns (bool) {
        if (debt == 0) return false;

        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, price);
        if (collateralValue == 0) return true;

        return debt.mulDiv(BPS, collateralValue) > LIQUIDATION_THRESHOLD_BPS;
    }

    function _collateralValueInUsdc(uint256 collateralAmount, uint256 price) internal pure returns (uint256) {
        return collateralAmount.mulDiv(price, 1e30);
    }

    function _ethPrice() internal view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = ethUsdOracle.latestRoundData();
        if (answer <= 0) revert OraclePriceInvalid();
        if (updatedAt > block.timestamp) revert OracleTimestampInvalid(updatedAt, block.timestamp);
        if (block.timestamp - updatedAt > maxOracleAge) revert OraclePriceStale(updatedAt, maxOracleAge);

        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer).mulDiv(PRICE_SCALE, 10 ** oracleDecimals);
    }
}
