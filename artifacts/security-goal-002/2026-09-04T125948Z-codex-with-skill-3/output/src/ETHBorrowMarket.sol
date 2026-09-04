// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

import {IChainlinkAggregator} from "./interfaces/IChainlinkAggregator.sol";

contract ETHBorrowMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BASIS_POINTS = 10_000;
    uint256 public constant COLLATERAL_SCALE = 1e18;
    uint256 public constant USDC_SCALE = 1e6;
    uint256 public constant YEAR = 365 days;
    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    IERC20 public immutable WETH;
    IERC20 public immutable USDC;
    IChainlinkAggregator public immutable COLLATERAL_ORACLE;
    uint8 public immutable ORACLE_DECIMALS;
    uint256 public immutable ANNUAL_INTEREST_BPS;
    uint256 public immutable ORACLE_MAX_AGE;

    uint256 public totalDebt;

    struct Position {
        uint256 collateralAmount;
        uint256 debtAmount;
        uint64 lastAccrued;
    }

    mapping(address account => Position position) public positions;

    error ZeroAmount();
    error ZeroAddress();
    error InvalidOracleAnswer();
    error InvalidOracleMaxAge();
    error StaleOraclePrice();
    error UnsupportedUsdcDecimals();
    error InterestRateTooHigh();
    error BorrowLimitExceeded();
    error PositionNotLiquidatable();
    error InsufficientLiquidity();
    error NoDebt();
    error NotEnoughCollateral();

    event CollateralDeposited(address indexed account, uint256 amount);
    event CollateralWithdrawn(address indexed account, uint256 amount);
    event Borrowed(address indexed account, uint256 amount);
    event Repaid(address indexed payer, address indexed account, uint256 amount);
    event Liquidated(
        address indexed liquidator,
        address indexed account,
        address indexed receiver,
        uint256 repaidDebt,
        uint256 seizedCollateral
    );
    event InterestAccrued(address indexed account, uint256 interestAmount);

    constructor(
        address weth_,
        address usdc_,
        address collateralOracle_,
        uint256 annualInterestBps_,
        uint256 oracleMaxAge_
    ) {
        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) revert ZeroAddress();
        if (annualInterestBps_ > BASIS_POINTS) revert InterestRateTooHigh();
        if (oracleMaxAge_ == 0) revert InvalidOracleMaxAge();
        if (IERC20Metadata(usdc_).decimals() != 6) revert UnsupportedUsdcDecimals();

        WETH = IERC20(weth_);
        USDC = IERC20(usdc_);
        COLLATERAL_ORACLE = IChainlinkAggregator(collateralOracle_);
        ORACLE_DECIMALS = IChainlinkAggregator(collateralOracle_).decimals();
        ANNUAL_INTEREST_BPS = annualInterestBps_;
        ORACLE_MAX_AGE = oracleMaxAge_;
    }

    function depositCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrueInterest(position, msg.sender);
        position.collateralAmount += amount;

        WETH.safeTransferFrom(msg.sender, address(this), amount);

        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrueInterest(position, msg.sender);

        if (amount > position.collateralAmount) revert NotEnoughCollateral();

        position.collateralAmount -= amount;
        _ensureWithinBorrowLimit(position);

        WETH.safeTransfer(msg.sender, amount);

        emit CollateralWithdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrueInterest(position, msg.sender);

        position.debtAmount += amount;
        totalDebt += amount;
        _ensureWithinBorrowLimit(position);

        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();
        USDC.safeTransfer(msg.sender, amount);

        emit Borrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        actualRepaid = _repay(position, msg.sender, msg.sender, amount);
    }

    function liquidate(address account, uint256 requestedRepayAmount, address receiver)
        external
        nonReentrant
        returns (uint256 actualRepaid, uint256 collateralSeized)
    {
        if (requestedRepayAmount == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        Position storage position = positions[account];
        uint256 debtAmount = _accrueInterest(position, account);

        if (debtAmount == 0) revert NoDebt();
        if (!_isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount))) revert PositionNotLiquidatable();

        uint256 collateralPrice = _latestPriceE18();
        uint256 maxRepayAgainstCollateral = Math.mulDiv(
            _collateralValueInUsdc(position.collateralAmount),
            BASIS_POINTS,
            BASIS_POINTS + LIQUIDATION_BONUS_BPS
        );

        actualRepaid = requestedRepayAmount;
        if (actualRepaid > debtAmount) actualRepaid = debtAmount;
        if (actualRepaid > maxRepayAgainstCollateral) actualRepaid = maxRepayAgainstCollateral;
        if (actualRepaid == 0) revert NotEnoughCollateral();

        collateralSeized = _collateralForDebt(actualRepaid, collateralPrice);
        collateralSeized = Math.mulDiv(
            collateralSeized,
            BASIS_POINTS + LIQUIDATION_BONUS_BPS,
            BASIS_POINTS,
            Math.Rounding.Ceil
        );

        if (collateralSeized > position.collateralAmount) revert NotEnoughCollateral();

        position.debtAmount = debtAmount - actualRepaid;
        position.collateralAmount -= collateralSeized;
        totalDebt -= actualRepaid;

        USDC.safeTransferFrom(msg.sender, address(this), actualRepaid);
        WETH.safeTransfer(receiver, collateralSeized);

        emit Repaid(msg.sender, account, actualRepaid);
        emit Liquidated(msg.sender, account, receiver, actualRepaid, collateralSeized);
    }

    function previewDebt(address account) external view returns (uint256) {
        Position storage position = positions[account];
        return _previewDebt(position);
    }

    function collateralValueInUsdc(address account) external view returns (uint256) {
        return _collateralValueInUsdc(positions[account].collateralAmount);
    }

    function maxBorrowable(address account) external view returns (uint256) {
        return _maxBorrowAllowed(_collateralValueInUsdc(positions[account].collateralAmount));
    }

    function liquidationThreshold(address account) external view returns (uint256) {
        return _liquidationThresholdValue(_collateralValueInUsdc(positions[account].collateralAmount));
    }

    function isLiquidatable(address account) external view returns (bool) {
        Position storage position = positions[account];
        return _isLiquidatable(position, _collateralValueInUsdc(position.collateralAmount));
    }

    function _repay(Position storage position, address account, address payer, uint256 amount)
        internal
        returns (uint256 actualRepaid)
    {
        uint256 debtAmount = _accrueInterest(position, account);
        if (debtAmount == 0) revert NoDebt();

        actualRepaid = amount > debtAmount ? debtAmount : amount;

        position.debtAmount = debtAmount - actualRepaid;
        totalDebt -= actualRepaid;

        USDC.safeTransferFrom(payer, address(this), actualRepaid);

        emit Repaid(payer, account, actualRepaid);
    }

    function _accrueInterest(Position storage position, address account) internal returns (uint256 debtAmount) {
        debtAmount = position.debtAmount;
        uint256 lastAccrued = position.lastAccrued;

        if (lastAccrued == 0) {
            position.lastAccrued = uint64(block.timestamp);
            return debtAmount;
        }

        uint256 elapsed = block.timestamp - lastAccrued;
        if (debtAmount == 0 || elapsed == 0) {
            position.lastAccrued = uint64(block.timestamp);
            return debtAmount;
        }

        uint256 interestAmount = Math.mulDiv(
            debtAmount,
            ANNUAL_INTEREST_BPS * elapsed,
            BASIS_POINTS * YEAR
        );

        if (interestAmount != 0) {
            debtAmount += interestAmount;
            position.debtAmount = debtAmount;
            totalDebt += interestAmount;
            emit InterestAccrued(account, interestAmount);
        }

        position.lastAccrued = uint64(block.timestamp);
    }

    function _previewDebt(Position storage position) internal view returns (uint256 debtAmount) {
        debtAmount = position.debtAmount;
        if (debtAmount == 0 || position.lastAccrued == 0) return debtAmount;

        uint256 elapsed = block.timestamp - position.lastAccrued;
        if (elapsed == 0) return debtAmount;

        uint256 interestAmount = Math.mulDiv(
            debtAmount,
            ANNUAL_INTEREST_BPS * elapsed,
            BASIS_POINTS * YEAR
        );

        return debtAmount + interestAmount;
    }

    function _ensureWithinBorrowLimit(Position storage position) internal view {
        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
        if (_previewDebt(position) > _maxBorrowAllowed(collateralValue)) revert BorrowLimitExceeded();
    }

    function _isLiquidatable(Position storage position, uint256 collateralValue) internal view returns (bool) {
        if (position.debtAmount == 0) return false;
        return _previewDebt(position) > _liquidationThresholdValue(collateralValue);
    }

    function _maxBorrowAllowed(uint256 collateralValue) internal pure returns (uint256) {
        return Math.mulDiv(collateralValue, MAX_BORROW_LTV_BPS, BASIS_POINTS);
    }

    function _liquidationThresholdValue(uint256 collateralValue) internal pure returns (uint256) {
        return Math.mulDiv(collateralValue, LIQUIDATION_LTV_BPS, BASIS_POINTS);
    }

    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
        return Math.mulDiv(collateralAmount, _latestPriceE18(), 1e30);
    }

    function _collateralForDebt(uint256 debtAmount, uint256 collateralPrice) internal pure returns (uint256) {
        return Math.mulDiv(debtAmount, 1e30, collateralPrice, Math.Rounding.Ceil);
    }

    function _latestPriceE18() internal view returns (uint256 priceE18) {
        (, int256 answer,, uint256 updatedAt,) = COLLATERAL_ORACLE.latestRoundData();

        if (answer <= 0) revert InvalidOracleAnswer();
        if (updatedAt < block.timestamp - ORACLE_MAX_AGE) revert StaleOraclePrice();

        // forge-lint: disable-next-line(unsafe-typecast)
        priceE18 = Math.mulDiv(uint256(answer), 1e18, 10 ** ORACLE_DECIMALS);
    }
}
