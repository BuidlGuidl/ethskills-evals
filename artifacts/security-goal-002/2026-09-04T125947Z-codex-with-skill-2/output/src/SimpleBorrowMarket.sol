// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

contract SimpleBorrowMarket is ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;
    uint256 public constant WAD = 1e18;
    uint256 public constant RAY = 1e27;
    uint256 public constant MAX_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    IERC20 public immutable WETH;
    IERC20 public immutable USDC;
    AggregatorV3Interface public immutable ETH_USD_ORACLE;
    uint256 public immutable ANNUAL_INTEREST_RATE_WAD;
    uint256 public immutable MAX_ORACLE_AGE;

    uint256 public borrowIndexRay = RAY;
    uint256 public lastAccrualTimestamp;
    uint256 public totalDebtShares;

    struct Position {
        uint256 collateralAmount;
        uint256 debtShares;
    }

    mapping(address => Position) public positions;

    error ZeroAmount();
    error InvalidAddress();
    error InvalidInterestRate();
    error InvalidOracleConfig();
    error StaleOraclePrice();
    error InvalidOraclePrice();
    error PositionNotHealthy();
    error PositionNotLiquidatable();
    error RepayTooSmall();
    error WithdrawTooLarge();

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount, uint256 debtSharesMinted);
    event Repaid(address indexed payer, address indexed borrower, uint256 amount, uint256 debtSharesBurned);
    event Liquidated(
        address indexed liquidator,
        address indexed borrower,
        uint256 repaidUsdc,
        uint256 debtSharesBurned,
        uint256 collateralSeized
    );
    event InterestAccrued(uint256 newBorrowIndexRay, uint256 elapsed);

    constructor(
        address weth_,
        address usdc_,
        address ethUsdOracle_,
        uint256 annualInterestRateWad_,
        uint256 maxOracleAge_
    ) {
        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) revert InvalidAddress();
        if (annualInterestRateWad_ > WAD) revert InvalidInterestRate();
        if (maxOracleAge_ == 0) revert InvalidOracleConfig();

        WETH = IERC20(weth_);
        USDC = IERC20(usdc_);
        ETH_USD_ORACLE = AggregatorV3Interface(ethUsdOracle_);
        ANNUAL_INTEREST_RATE_WAD = annualInterestRateWad_;
        MAX_ORACLE_AGE = maxOracleAge_;
        lastAccrualTimestamp = block.timestamp;
    }

    function depositCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        position.collateralAmount += amount;

        WETH.safeTransferFrom(msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        _accrueInterest();

        Position storage position = positions[msg.sender];
        if (amount > position.collateralAmount) revert WithdrawTooLarge();

        position.collateralAmount -= amount;
        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();

        WETH.safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        _accrueInterest();

        Position storage position = positions[msg.sender];
        uint256 mintedDebtShares = _amountToDebtSharesUp(amount);
        position.debtShares += mintedDebtShares;
        totalDebtShares += mintedDebtShares;

        if (!_isHealthy(position.collateralAmount, _debtFromSharesUp(position.debtShares))) revert PositionNotHealthy();

        USDC.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount, mintedDebtShares);
    }

    function repay(uint256 amount) external nonReentrant returns (uint256 actualRepaid) {
        if (amount == 0) revert ZeroAmount();

        _accrueInterest();
        return _repay(msg.sender, msg.sender, amount);
    }

    function liquidate(address borrower, uint256 maxRepayAmount)
        external
        nonReentrant
        returns (uint256 repaidUsdc, uint256 seizedWeth)
    {
        if (maxRepayAmount == 0) revert ZeroAmount();

        _accrueInterest();

        Position storage position = positions[borrower];
        uint256 debt = _debtFromSharesUp(position.debtShares);
        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
        uint256 collateralValueUsdc = _collateralValueInUsdc(position.collateralAmount, oraclePrice, oracleDecimals);

        if (!_isLiquidatable(collateralValueUsdc, debt)) revert PositionNotLiquidatable();

        uint256 maxRepayFromCollateral =
            collateralValueUsdc.mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS, Math.Rounding.Floor);
        repaidUsdc = Math.min(maxRepayAmount, Math.min(debt, maxRepayFromCollateral));
        if (repaidUsdc == 0) revert RepayTooSmall();

        uint256 debtSharesToBurn;
        if (repaidUsdc >= debt) {
            repaidUsdc = debt;
            debtSharesToBurn = position.debtShares;
        } else {
            debtSharesToBurn = _amountToDebtSharesDown(repaidUsdc);
            if (debtSharesToBurn == 0) revert RepayTooSmall();
            repaidUsdc = _debtFromSharesDown(debtSharesToBurn);
        }

        seizedWeth = _usdcValueToWeth(
            repaidUsdc + repaidUsdc.mulDiv(LIQUIDATION_BONUS_BPS, BPS),
            oraclePrice,
            oracleDecimals
        );
        if (seizedWeth == 0) revert RepayTooSmall();
        if (seizedWeth > position.collateralAmount) revert PositionNotLiquidatable();

        position.debtShares -= debtSharesToBurn;
        totalDebtShares -= debtSharesToBurn;
        position.collateralAmount -= seizedWeth;

        USDC.safeTransferFrom(msg.sender, address(this), repaidUsdc);
        WETH.safeTransfer(msg.sender, seizedWeth);

        emit Repaid(msg.sender, borrower, repaidUsdc, debtSharesToBurn);
        emit Liquidated(msg.sender, borrower, repaidUsdc, debtSharesToBurn, seizedWeth);
    }

    function previewDebt(address borrower) external view returns (uint256) {
        return _debtFromSharesAtIndexUp(positions[borrower].debtShares, _previewBorrowIndexRay());
    }

    function previewHealthFactorBps(address borrower) external view returns (uint256) {
        Position storage position = positions[borrower];
        uint256 debt = _debtFromSharesAtIndexUp(position.debtShares, _previewBorrowIndexRay());
        return _healthFactorBps(position.collateralAmount, debt);
    }

    function collateralValueInUsdc(address borrower) external view returns (uint256) {
        return _collateralValueInUsdc(positions[borrower].collateralAmount);
    }

    function _repay(address payer, address borrower, uint256 requestedAmount) internal returns (uint256 actualRepaid) {
        Position storage position = positions[borrower];
        uint256 debtShares = position.debtShares;
        uint256 debt = _debtFromSharesUp(debtShares);

        if (requestedAmount >= debt) {
            actualRepaid = debt;
            position.debtShares = 0;
            totalDebtShares -= debtShares;
            USDC.safeTransferFrom(payer, address(this), actualRepaid);
            emit Repaid(payer, borrower, actualRepaid, debtShares);
            return actualRepaid;
        }

        uint256 debtSharesToBurn = _amountToDebtSharesDown(requestedAmount);
        if (debtSharesToBurn == 0) revert RepayTooSmall();

        actualRepaid = _debtFromSharesDown(debtSharesToBurn);
        position.debtShares = debtShares - debtSharesToBurn;
        totalDebtShares -= debtSharesToBurn;

        USDC.safeTransferFrom(payer, address(this), actualRepaid);
        emit Repaid(payer, borrower, actualRepaid, debtSharesToBurn);
    }

    function _accrueInterest() internal {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0) return;

        lastAccrualTimestamp = block.timestamp;
        if (totalDebtShares == 0 || ANNUAL_INTEREST_RATE_WAD == 0) return;

        uint256 interestFactorWad = ANNUAL_INTEREST_RATE_WAD.mulDiv(elapsed, YEAR);
        borrowIndexRay += borrowIndexRay.mulDiv(interestFactorWad, WAD);
        emit InterestAccrued(borrowIndexRay, elapsed);
    }

    function _previewBorrowIndexRay() internal view returns (uint256) {
        if (totalDebtShares == 0 || ANNUAL_INTEREST_RATE_WAD == 0) return borrowIndexRay;

        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0) return borrowIndexRay;

        uint256 interestFactorWad = ANNUAL_INTEREST_RATE_WAD.mulDiv(elapsed, YEAR);
        return borrowIndexRay + borrowIndexRay.mulDiv(interestFactorWad, WAD);
    }

    function _amountToDebtSharesUp(uint256 amount) internal view returns (uint256) {
        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Ceil);
    }

    function _amountToDebtSharesDown(uint256 amount) internal view returns (uint256) {
        return amount.mulDiv(RAY, borrowIndexRay, Math.Rounding.Floor);
    }

    function _debtFromSharesUp(uint256 debtShares) internal view returns (uint256) {
        return _debtFromSharesAtIndexUp(debtShares, borrowIndexRay);
    }

    function _debtFromSharesDown(uint256 debtShares) internal view returns (uint256) {
        return debtShares.mulDiv(borrowIndexRay, RAY, Math.Rounding.Floor);
    }

    function _debtFromSharesAtIndexUp(uint256 debtShares, uint256 indexRay) internal pure returns (uint256) {
        return debtShares.mulDiv(indexRay, RAY, Math.Rounding.Ceil);
    }

    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
        if (debtAmount == 0) return true;
        return debtAmount * BPS <= _collateralValueInUsdc(collateralAmount) * MAX_LTV_BPS;
    }

    function _isLiquidatable(uint256 collateralValueUsdc, uint256 debtAmount) internal pure returns (bool) {
        if (collateralValueUsdc == 0) return debtAmount > 0;
        return debtAmount * BPS > collateralValueUsdc * LIQUIDATION_LTV_BPS;
    }

    function _healthFactorBps(uint256 collateralAmount, uint256 debtAmount) internal view returns (uint256) {
        if (debtAmount == 0) return type(uint256).max;
        return _collateralValueInUsdc(collateralAmount).mulDiv(BPS, debtAmount);
    }

    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
        (uint256 oraclePrice, uint8 oracleDecimals) = _readOraclePrice();
        return _collateralValueInUsdc(collateralAmount, oraclePrice, oracleDecimals);
    }

    function _collateralValueInUsdc(uint256 collateralAmount, uint256 oraclePrice, uint8 oracleDecimals)
        internal
        pure
        returns (uint256)
    {
        return collateralAmount.mulDiv(oraclePrice, 10 ** (18 + oracleDecimals - 6), Math.Rounding.Floor);
    }

    function _usdcValueToWeth(uint256 usdcValue, uint256 oraclePrice, uint8 oracleDecimals)
        internal
        pure
        returns (uint256)
    {
        return usdcValue.mulDiv(10 ** (18 + oracleDecimals - 6), oraclePrice, Math.Rounding.Floor);
    }

    function _readOraclePrice() internal view returns (uint256 oraclePrice, uint8 oracleDecimals) {
        (, int256 answer,, uint256 updatedAt,) = ETH_USD_ORACLE.latestRoundData();
        if (answer <= 0) revert InvalidOraclePrice();
        if (updatedAt < block.timestamp - MAX_ORACLE_AGE) revert StaleOraclePrice();

        oracleDecimals = ETH_USD_ORACLE.decimals();
        if (oracleDecimals < 6 || oracleDecimals > 18) revert InvalidOracleConfig();
        // forge-lint: disable-next-line(unsafe-typecast)
        oraclePrice = uint256(answer);
    }
}
