// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

contract EthUsdCMBorrowingMarket {
    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;
    uint256 public constant RAY = 1e27;
    uint256 public constant BORROW_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    uint256 public constant MAX_PRICE_AGE = 2 hours;

    IERC20 public immutable WETH;
    IERC20 public immutable USDC;
    IAggregatorV3 public immutable ETH_USD_ORACLE;
    address public immutable OWNER;
    uint256 public immutable ANNUAL_INTEREST_RATE_RAY;

    uint256 public totalDebtPrincipal;
    uint256 public borrowIndex = RAY;
    uint256 public lastAccrualTime;

    struct Position {
        uint256 collateralAmount;
        uint256 debtPrincipal;
    }

    mapping(address account => Position) public positions;

    error NotOwner();
    error AmountIsZero();
    error TransferFailed();
    error InsufficientLiquidity();
    error InsufficientCollateral();
    error PositionNotLiquidatable();
    error PositionWouldBeUnsafe();
    error InvalidOracleAnswer();
    error StaleOraclePrice();
    error InvalidOracleDecimals();
    error ZeroAddress();

    event LiquidityAdded(address indexed provider, uint256 amount);
    event LiquidityRemoved(address indexed provider, address indexed to, uint256 amount);
    event CollateralDeposited(address indexed account, uint256 amount);
    event CollateralWithdrawn(address indexed account, uint256 amount);
    event Borrowed(address indexed account, uint256 amount, uint256 newDebt);
    event Repaid(address indexed payer, address indexed account, uint256 amount, uint256 remainingDebt);
    event Liquidated(
        address indexed liquidator,
        address indexed account,
        uint256 repaidAmount,
        uint256 collateralSeized,
        uint256 remainingDebt
    );
    event Accrued(uint256 newBorrowIndex, uint256 timestamp);

    constructor(
        address owner_,
        address weth_,
        address usdc_,
        address ethUsdOracle_,
        uint256 annualInterestRateBps
    ) {
        if (owner_ == address(0) || weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) {
            revert ZeroAddress();
        }

        OWNER = owner_;
        WETH = IERC20(weth_);
        USDC = IERC20(usdc_);
        ETH_USD_ORACLE = IAggregatorV3(ethUsdOracle_);
        ANNUAL_INTEREST_RATE_RAY = (annualInterestRateBps * RAY) / BPS;
        lastAccrualTime = block.timestamp;

        if (ETH_USD_ORACLE.decimals() != 8) revert InvalidOracleDecimals();
        if (WETH.decimals() != 18 || USDC.decimals() != 6) revert InvalidOracleDecimals();
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function accrueInterest() public {
        uint256 elapsed = block.timestamp - lastAccrualTime;
        if (elapsed == 0) return;

        uint256 interestFactor = (ANNUAL_INTEREST_RATE_RAY * elapsed) / YEAR;
        borrowIndex += (borrowIndex * interestFactor) / RAY;
        lastAccrualTime = block.timestamp;

        emit Accrued(borrowIndex, block.timestamp);
    }

    function _onlyOwner() internal view {
        if (msg.sender != OWNER) revert NotOwner();
    }

    function addLiquidity(uint256 amount) external onlyOwner {
        if (amount == 0) revert AmountIsZero();
        _safeTransferFrom(USDC, msg.sender, address(this), amount);
        emit LiquidityAdded(msg.sender, amount);
    }

        function removeLiquidity(uint256 amount, address to) external onlyOwner {
        if (amount == 0) revert AmountIsZero();
        _safeTransfer(USDC, to, amount);
        emit LiquidityRemoved(msg.sender, to, amount);
    }

    function depositCollateral(uint256 amount) external {
        if (amount == 0) revert AmountIsZero();
        Position storage position = positions[msg.sender];
        position.collateralAmount += amount;
        _safeTransferFrom(WETH, msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external {
        if (amount == 0) revert AmountIsZero();
        accrueInterest();

        Position storage position = positions[msg.sender];
        if (amount > position.collateralAmount) revert InsufficientCollateral();

        position.collateralAmount -= amount;
        if (!_isWithinLiquidationThreshold(position.collateralAmount, _debtFromPrincipal(position.debtPrincipal))) {
            revert PositionWouldBeUnsafe();
        }

        _safeTransfer(WETH, msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external {
        if (amount == 0) revert AmountIsZero();
        accrueInterest();

        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        Position storage position = positions[msg.sender];
        uint256 currentDebt = _debtFromPrincipal(position.debtPrincipal);
        uint256 nextDebt = currentDebt + amount;

        if (nextDebt > maxBorrowable(position.collateralAmount)) revert PositionWouldBeUnsafe();

        uint256 principalToMint = _debtToPrincipalUp(amount);
        position.debtPrincipal += principalToMint;
        totalDebtPrincipal += principalToMint;

        _safeTransfer(USDC, msg.sender, amount);
        emit Borrowed(msg.sender, amount, nextDebt);
    }

    function repay(uint256 amount) external returns (uint256 repaidAmount) {
        repaidAmount = _repay(msg.sender, msg.sender, amount);
    }

    function repayFor(address account, uint256 amount) external returns (uint256 repaidAmount) {
        repaidAmount = _repay(msg.sender, account, amount);
    }

    function liquidate(address account, uint256 maxRepayAmount) external returns (uint256 repaidAmount, uint256 collateralSeized) {
        if (maxRepayAmount == 0) revert AmountIsZero();
        accrueInterest();

        Position storage position = positions[account];
        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
        if (!_isLiquidatable(position.collateralAmount, debt)) revert PositionNotLiquidatable();

        uint256 repayCap = maxLiquidationRepay(account);
        repaidAmount = maxRepayAmount > repayCap ? repayCap : maxRepayAmount;
        if (repaidAmount == 0) revert PositionNotLiquidatable();

        uint256 principalToBurn;
        if (repaidAmount >= debt) {
            principalToBurn = position.debtPrincipal;
            repaidAmount = debt;
        } else {
            principalToBurn = (repaidAmount * RAY) / borrowIndex;
            if (principalToBurn == 0) revert AmountIsZero();
            repaidAmount = _debtFromPrincipal(principalToBurn);
        }

        collateralSeized = collateralForDebt(repaidAmount);
        collateralSeized = (collateralSeized * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
        if (collateralSeized > position.collateralAmount) revert InsufficientCollateral();

        position.debtPrincipal -= principalToBurn;
        totalDebtPrincipal -= principalToBurn;
        position.collateralAmount -= collateralSeized;

        _safeTransferFrom(USDC, msg.sender, address(this), repaidAmount);
        _safeTransfer(WETH, msg.sender, collateralSeized);

        emit Liquidated(msg.sender, account, repaidAmount, collateralSeized, _debtFromPrincipal(position.debtPrincipal));
    }

    function debtOf(address account) external view returns (uint256) {
        return _debtFromPrincipalAtIndex(positions[account].debtPrincipal, _previewBorrowIndex());
    }

    function collateralValue(address account) external view returns (uint256) {
        return collateralValue(positionCollateral(account));
    }

    function positionCollateral(address account) public view returns (uint256) {
        return positions[account].collateralAmount;
    }

    function maxBorrowable(uint256 collateralAmount) public view returns (uint256) {
        return (collateralValue(collateralAmount) * BORROW_LTV_BPS) / BPS;
    }

    function liquidationThreshold(uint256 collateralAmount) public view returns (uint256) {
        return (collateralValue(collateralAmount) * LIQUIDATION_LTV_BPS) / BPS;
    }

    function maxLiquidationRepay(address account) public view returns (uint256) {
        Position storage position = positions[account];
        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
        if (!_isLiquidatable(position.collateralAmount, debt)) return 0;

        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
        return (collateralValueUsdc * BPS) / (BPS + LIQUIDATION_BONUS_BPS);
    }

    function collateralValue(uint256 collateralAmount) public view returns (uint256) {
        return (collateralAmount * _readEthUsdPrice()) / 1e20;
    }

    function collateralForDebt(uint256 usdcAmount) public view returns (uint256) {
        return (usdcAmount * 1e20) / _readEthUsdPrice();
    }

    function healthRatioBps(address account) external view returns (uint256) {
        Position storage position = positions[account];
        uint256 debt = _debtFromPrincipalAtIndex(position.debtPrincipal, _previewBorrowIndex());
        uint256 collateralValueUsdc = collateralValue(position.collateralAmount);
        if (collateralValueUsdc == 0) {
            return debt == 0 ? 0 : type(uint256).max;
        }
        return (debt * BPS) / collateralValueUsdc;
    }

    function _repay(address payer, address account, uint256 amount) internal returns (uint256 repaidAmount) {
        if (amount == 0) revert AmountIsZero();
        accrueInterest();

        Position storage position = positions[account];
        uint256 debt = _debtFromPrincipal(position.debtPrincipal);
        if (debt == 0) revert AmountIsZero();

        uint256 principalToBurn;
        if (amount >= debt) {
            principalToBurn = position.debtPrincipal;
            repaidAmount = debt;
        } else {
            principalToBurn = (amount * RAY) / borrowIndex;
            if (principalToBurn == 0) revert AmountIsZero();
            repaidAmount = _debtFromPrincipal(principalToBurn);
        }

        position.debtPrincipal -= principalToBurn;
        totalDebtPrincipal -= principalToBurn;

        _safeTransferFrom(USDC, payer, address(this), repaidAmount);
        emit Repaid(payer, account, repaidAmount, _debtFromPrincipal(position.debtPrincipal));
    }

    function _previewBorrowIndex() internal view returns (uint256) {
        uint256 elapsed = block.timestamp - lastAccrualTime;
        if (elapsed == 0) return borrowIndex;
        uint256 interestFactor = (ANNUAL_INTEREST_RATE_RAY * elapsed) / YEAR;
        return borrowIndex + ((borrowIndex * interestFactor) / RAY);
    }

    function _debtFromPrincipal(uint256 principal) internal view returns (uint256) {
        return _debtFromPrincipalAtIndex(principal, borrowIndex);
    }

    function _debtFromPrincipalAtIndex(uint256 principal, uint256 index) internal pure returns (uint256) {
        return (principal * index) / RAY;
    }

    function _debtToPrincipalUp(uint256 debtAmount) internal view returns (uint256) {
        return ((debtAmount * RAY) + borrowIndex - 1) / borrowIndex;
    }

    function _isLiquidatable(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
        return debt > liquidationThreshold(collateralAmount);
    }

    function _isWithinLiquidationThreshold(uint256 collateralAmount, uint256 debt) internal view returns (bool) {
        return debt <= liquidationThreshold(collateralAmount);
    }

    function _readEthUsdPrice() internal view returns (uint256 price) {
        (, int256 answer,, uint256 updatedAt,) = ETH_USD_ORACLE.latestRoundData();
        if (answer <= 0) revert InvalidOracleAnswer();
        if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StaleOraclePrice();
        // forge-lint: disable-next-line(unsafe-typecast)
        price = uint256(answer);
    }

    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
        bool ok = token.transfer(to, amount);
        if (!ok) revert TransferFailed();
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        bool ok = token.transferFrom(from, to, amount);
        if (!ok) revert TransferFailed();
    }
}
