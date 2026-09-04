// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "./interfaces/IERC20.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

contract SimpleBorrowingMarket {
    error NotOwner();
    error AmountIsZero();
    error UnsupportedTokenDecimals();
    error TransferFailed();
    error PositionNotHealthy();
    error PositionHealthy();
    error InsufficientCollateral();
    error InsufficientLiquidity();
    error NoDebt();
    error NothingToLiquidate();

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed payer, address indexed user, uint256 amount);
    event Liquidated(
        address indexed liquidator,
        address indexed user,
        uint256 repaidUsdc,
        uint256 seizedWeth
    );
    event LiquidityDeposited(address indexed provider, uint256 amount);
    event LiquidityWithdrawn(address indexed receiver, uint256 amount);

    struct Position {
        uint256 collateralAmount;
        uint256 debtAmount;
        uint256 lastAccrualTime;
    }

    uint256 internal constant BPS = 10_000;
    uint256 internal constant YEAR = 365 days;
    uint256 public constant MAX_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    IERC20 public immutable WETH;
    IERC20 public immutable USDC;
    IPriceOracle public immutable ORACLE;
    address public immutable OWNER;
    uint256 public immutable ANNUAL_INTEREST_BPS;
    uint256 public totalDebtOutstanding;

    mapping(address => Position) public positions;

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    constructor(address weth_, address usdc_, address oracle_, uint256 annualInterestBps_) {
        WETH = IERC20(weth_);
        USDC = IERC20(usdc_);
        ORACLE = IPriceOracle(oracle_);
        OWNER = msg.sender;
        ANNUAL_INTEREST_BPS = annualInterestBps_;

        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert UnsupportedTokenDecimals();
    }

    function depositCollateral(uint256 amount) external {
        if (amount == 0) revert AmountIsZero();

        _accrue(msg.sender);
        positions[msg.sender].collateralAmount += amount;
        _safeTransferFrom(WETH, msg.sender, address(this), amount);

        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external {
        if (amount == 0) revert AmountIsZero();

        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        if (position.collateralAmount < amount) revert InsufficientCollateral();

        position.collateralAmount -= amount;
        if (!_isHealthy(position.collateralAmount, position.debtAmount)) revert PositionNotHealthy();

        _safeTransfer(WETH, msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external {
        if (amount == 0) revert AmountIsZero();

        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        uint256 newDebt = position.debtAmount + amount;
        if (!_isHealthyAtLtv(position.collateralAmount, newDebt, MAX_LTV_BPS)) revert PositionNotHealthy();
        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        position.debtAmount = newDebt;
        totalDebtOutstanding += amount;
        _safeTransfer(USDC, msg.sender, amount);

        emit Borrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external returns (uint256 repaid) {
        if (amount == 0) revert AmountIsZero();

        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        if (position.debtAmount == 0) revert NoDebt();

        repaid = amount > position.debtAmount ? position.debtAmount : amount;
        position.debtAmount -= repaid;
        totalDebtOutstanding -= repaid;
        _safeTransferFrom(USDC, msg.sender, address(this), repaid);

        emit Repaid(msg.sender, msg.sender, repaid);
    }

    function liquidate(address user, uint256 requestedRepayAmount) external returns (uint256 repaid, uint256 seized) {
        if (requestedRepayAmount == 0) revert AmountIsZero();

        _accrue(user);
        Position storage position = positions[user];
        if (position.debtAmount == 0) revert NoDebt();
        if (_isHealthyAtLtv(position.collateralAmount, position.debtAmount, LIQUIDATION_LTV_BPS)) {
            revert PositionHealthy();
        }

        uint256 priceE8 = _priceE8();
        uint256 maxRepayFromDebt = requestedRepayAmount > position.debtAmount ? position.debtAmount : requestedRepayAmount;
        uint256 maxRepayFromCollateral = (_collateralValueInUsdc(position.collateralAmount, priceE8) * BPS)
            / (BPS + LIQUIDATION_BONUS_BPS);

        repaid = maxRepayFromDebt > maxRepayFromCollateral ? maxRepayFromCollateral : maxRepayFromDebt;
        if (repaid == 0) revert NothingToLiquidate();

        seized = (repaid * (BPS + LIQUIDATION_BONUS_BPS) * 1e20) / (priceE8 * BPS);
        if (seized > position.collateralAmount) {
            seized = position.collateralAmount;
        }

        position.debtAmount -= repaid;
        position.collateralAmount -= seized;
        totalDebtOutstanding -= repaid;

        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
        _safeTransfer(WETH, msg.sender, seized);

        emit Repaid(msg.sender, user, repaid);
        emit Liquidated(msg.sender, user, repaid, seized);
    }

    function depositLiquidity(uint256 amount) external onlyOwner {
        if (amount == 0) revert AmountIsZero();

        _safeTransferFrom(USDC, msg.sender, address(this), amount);
        emit LiquidityDeposited(msg.sender, amount);
    }

    function withdrawLiquidity(uint256 amount, address to) external onlyOwner {
        if (amount == 0) revert AmountIsZero();

        uint256 lockedDebt = totalDebtOutstanding;
        uint256 liquidBalance = USDC.balanceOf(address(this));
        if (liquidBalance < amount || liquidBalance - amount < lockedDebt) revert InsufficientLiquidity();

        _safeTransfer(USDC, to, amount);
        emit LiquidityWithdrawn(to, amount);
    }

    function currentDebt(address user) external view returns (uint256) {
        Position memory position = positions[user];
        return _accruedDebt(position);
    }

    function healthFactorBps(address user) external view returns (uint256) {
        Position memory position = positions[user];
        uint256 debt = _accruedDebt(position);
        if (debt == 0) return type(uint256).max;

        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
        return (collateralValue * BPS) / debt;
    }

    function loanToValueBps(address user) external view returns (uint256) {
        Position memory position = positions[user];
        uint256 debt = _accruedDebt(position);
        if (debt == 0) return 0;

        uint256 collateralValue = _collateralValueInUsdc(position.collateralAmount, _priceE8());
        if (collateralValue == 0) return type(uint256).max;

        return (debt * BPS) / collateralValue;
    }

    function _accrue(address user) internal {
        Position storage position = positions[user];
        uint256 lastAccrualTime = position.lastAccrualTime;

        if (lastAccrualTime == 0) {
            position.lastAccrualTime = block.timestamp;
            return;
        }

        if (position.debtAmount != 0 && block.timestamp > lastAccrualTime) {
            uint256 elapsed = block.timestamp - lastAccrualTime;
            uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
            position.debtAmount += interest;
            totalDebtOutstanding += interest;
        }

        position.lastAccrualTime = block.timestamp;
    }

    function _accruedDebt(Position memory position) internal view returns (uint256) {
        if (position.debtAmount == 0 || position.lastAccrualTime == 0 || block.timestamp <= position.lastAccrualTime) {
            return position.debtAmount;
        }

        uint256 elapsed = block.timestamp - position.lastAccrualTime;
        uint256 interest = (position.debtAmount * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
        return position.debtAmount + interest;
    }

    function _isHealthy(uint256 collateralAmount, uint256 debtAmount) internal view returns (bool) {
        return _isHealthyAtLtv(collateralAmount, debtAmount, LIQUIDATION_LTV_BPS);
    }

    function _isHealthyAtLtv(uint256 collateralAmount, uint256 debtAmount, uint256 maxLtvBps) internal view returns (bool) {
        if (debtAmount == 0) return true;

        uint256 collateralValue = _collateralValueInUsdc(collateralAmount, _priceE8());
        if (collateralValue == 0) return false;

        return (debtAmount * BPS) <= (collateralValue * maxLtvBps);
    }

    function _collateralValueInUsdc(uint256 collateralAmount, uint256 priceE8) internal pure returns (uint256) {
        return (collateralAmount * priceE8) / 1e20;
    }

    function _priceE8() internal view returns (uint256 priceE8) {
        (priceE8,) = ORACLE.wethPriceInUsdc();
    }

    function _onlyOwner() internal view {
        if (msg.sender != OWNER) revert NotOwner();
    }

    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
        if (!token.transfer(to, amount)) revert TransferFailed();
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        if (!token.transferFrom(from, to, amount)) revert TransferFailed();
    }
}
