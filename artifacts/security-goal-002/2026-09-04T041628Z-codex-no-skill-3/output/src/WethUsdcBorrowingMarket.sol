// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

contract WethUsdcBorrowingMarket {
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant USDC_SCALE = 1e6;
    uint256 public constant WETH_SCALE = 1e18;

    uint256 public constant MAX_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    IERC20 public immutable WETH;
    IERC20 public immutable USDC;
    IAggregatorV3 public immutable COLLATERAL_ORACLE;
    uint8 public immutable ORACLE_DECIMALS;
    uint256 public immutable ANNUAL_INTEREST_BPS;
    uint256 public immutable MAX_ORACLE_DELAY;

    struct Position {
        uint256 collateralAmount;
        uint256 debtPrincipal;
        uint256 lastAccrualTime;
    }

    mapping(address => Position) public positions;

    error ZeroAmount();
    error InvalidAddress();
    error InvalidAnnualRate();
    error InvalidOraclePrice();
    error StaleOraclePrice();
    error InsufficientLiquidity();
    error BorrowLimitExceeded();
    error PositionNotLiquidatable();
    error RepayTooSmall();
    error TransferFailed();

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed receiver, uint256 amount);
    event Borrowed(address indexed user, address indexed receiver, uint256 amount);
    event Repaid(address indexed user, address indexed payer, uint256 amount);
    event Liquidated(
        address indexed user,
        address indexed liquidator,
        address indexed receiver,
        uint256 repaidDebt,
        uint256 collateralSeized
    );

    constructor(
        address weth_,
        address usdc_,
        address collateralOracle_,
        uint256 annualInterestBps_,
        uint256 maxOracleDelay_
    ) {
        if (weth_ == address(0) || usdc_ == address(0) || collateralOracle_ == address(0)) {
            revert InvalidAddress();
        }
        if (annualInterestBps_ > BPS_DENOMINATOR) {
            revert InvalidAnnualRate();
        }
        WETH = IERC20(weth_);
        USDC = IERC20(usdc_);
        COLLATERAL_ORACLE = IAggregatorV3(collateralOracle_);
        ORACLE_DECIMALS = IAggregatorV3(collateralOracle_).decimals();
        ANNUAL_INTEREST_BPS = annualInterestBps_;
        MAX_ORACLE_DELAY = maxOracleDelay_;
    }

    function depositCollateral(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrue(position);
        position.collateralAmount += amount;

        _safeTransferFrom(WETH, msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount, address receiver) external {
        if (amount == 0) revert ZeroAmount();
        if (receiver == address(0)) revert InvalidAddress();

        Position storage position = positions[msg.sender];
        _accrue(position);
        position.collateralAmount -= amount;

        _ensureHealthy(position);
        _safeTransfer(WETH, receiver, amount);
        emit CollateralWithdrawn(msg.sender, receiver, amount);
    }

    function borrow(uint256 amount, address receiver) external {
        if (amount == 0) revert ZeroAmount();
        if (receiver == address(0)) revert InvalidAddress();

        Position storage position = positions[msg.sender];
        _accrue(position);
        position.debtPrincipal += amount;

        _ensureHealthy(position);
        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        _safeTransfer(USDC, receiver, amount);
        emit Borrowed(msg.sender, receiver, amount);
    }

    function repay(uint256 amount) external returns (uint256 repaid) {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrue(position);

        repaid = amount > position.debtPrincipal ? position.debtPrincipal : amount;
        if (repaid == 0) revert RepayTooSmall();

        position.debtPrincipal -= repaid;
        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
        emit Repaid(msg.sender, msg.sender, repaid);
    }

    function liquidate(
        address user,
        uint256 requestedRepayAmount,
        address receiver
    ) external returns (uint256 actualRepaid, uint256 collateralSeized) {
        if (requestedRepayAmount == 0) revert ZeroAmount();
        if (receiver == address(0)) revert InvalidAddress();

        Position storage position = positions[user];
        _accrue(position);

        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
        uint256 liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
        if (position.debtPrincipal <= liquidationThreshold) revert PositionNotLiquidatable();

        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtPrincipal
            ? position.debtPrincipal
            : requestedRepayAmount;
        uint256 maxRepayFromCollateral = _maxRepaySupportedByCollateral(position.collateralAmount);
        actualRepaid = maxRepayFromDebt > maxRepayFromCollateral
            ? maxRepayFromCollateral
            : maxRepayFromDebt;
        if (actualRepaid == 0) revert RepayTooSmall();

        collateralSeized = _collateralForDebt(actualRepaid);
        position.debtPrincipal -= actualRepaid;
        position.collateralAmount -= collateralSeized;

        _safeTransferFrom(USDC, msg.sender, address(this), actualRepaid);
        _safeTransfer(WETH, receiver, collateralSeized);
        emit Liquidated(user, msg.sender, receiver, actualRepaid, collateralSeized);
    }

    function getPosition(address user)
        external
        view
        returns (
            uint256 collateralAmount,
            uint256 debt,
            uint256 collateralValue,
            uint256 maxBorrow,
            uint256 liquidationThreshold,
            bool liquidatable
        )
    {
        Position memory position = positions[user];
        debt = _previewAccruedDebt(position);
        collateralAmount = position.collateralAmount;
        collateralValue = _collateralValueInUsdc(collateralAmount);
        maxBorrow = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
        liquidationThreshold = (collateralValue * LIQUIDATION_LTV_BPS) / BPS_DENOMINATOR;
        liquidatable = debt > liquidationThreshold;
    }

    function previewDebt(address user) external view returns (uint256) {
        return _previewAccruedDebt(positions[user]);
    }

    function collateralValueInUsdc(address user) external view returns (uint256) {
        return _collateralValueInUsdc(positions[user].collateralAmount);
    }

    function _ensureHealthy(Position memory position) internal view {
        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount);
        uint256 maxDebt = (collateralValue * MAX_LTV_BPS) / BPS_DENOMINATOR;
        if (position.debtPrincipal > maxDebt) revert BorrowLimitExceeded();
    }

    function _accrue(Position storage position) internal {
        position.debtPrincipal = _previewAccruedDebt(position);
        position.lastAccrualTime = block.timestamp;
    }

    function _previewAccruedDebt(Position memory position) internal view returns (uint256) {
        if (position.debtPrincipal == 0) {
            return 0;
        }

        if (position.lastAccrualTime == 0) {
            return position.debtPrincipal;
        }

        uint256 elapsed = block.timestamp - position.lastAccrualTime;
        uint256 interest = (position.debtPrincipal * ANNUAL_INTEREST_BPS * elapsed) /
            (BPS_DENOMINATOR * SECONDS_PER_YEAR);
        return position.debtPrincipal + interest;
    }

    function _collateralValueInUsdc(uint256 collateralAmount) internal view returns (uint256) {
        uint256 price = _readOraclePrice();
        return (collateralAmount * price * USDC_SCALE) / (WETH_SCALE * (10 ** ORACLE_DECIMALS));
    }

    function _maxRepaySupportedByCollateral(uint256 collateralAmount) internal view returns (uint256) {
        uint256 price = _readOraclePrice();
        return
            (collateralAmount *
                price *
                USDC_SCALE *
                BPS_DENOMINATOR) /
            (WETH_SCALE * (10 ** ORACLE_DECIMALS) * (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS));
    }

    function _collateralForDebt(uint256 debtAmount) internal view returns (uint256) {
        uint256 price = _readOraclePrice();
        return
            (debtAmount *
                WETH_SCALE *
                (10 ** ORACLE_DECIMALS) *
                (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS)) /
            (price * USDC_SCALE * BPS_DENOMINATOR);
    }

    function _readOraclePrice() internal view returns (uint256 price) {
        (, int256 answer, , uint256 updatedAt, ) = COLLATERAL_ORACLE.latestRoundData();
        if (answer <= 0) revert InvalidOraclePrice();
        if (MAX_ORACLE_DELAY != 0 && block.timestamp - updatedAt > MAX_ORACLE_DELAY) {
            revert StaleOraclePrice();
        }
        // forge-lint: disable-next-line(unsafe-typecast)
        price = uint256(answer);
    }

    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
        (bool success, bytes memory data) =
            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) =
            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }
}
