// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "./access/Ownable.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {Math} from "./libraries/Math.sol";
import {SafeERC20} from "./libraries/SafeERC20.sol";
import {ReentrancyGuard} from "./security/ReentrancyGuard.sol";

contract WethUsdcBorrowMarket is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    uint256 public constant WETH_UNIT = 1e18;
    uint256 public constant USDC_UNIT = 1e6;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    IERC20Metadata public immutable weth;
    IERC20Metadata public immutable usdc;
    IAggregatorV3 public immutable ethUsdFeed;
    uint256 public immutable feedUnit;
    uint256 public immutable annualInterestRateBps;
    uint256 public immutable maxOracleDelay;

    struct Position {
        uint256 collateralWeth;
        uint256 debtUsdc;
        uint64 lastAccrual;
    }

    mapping(address borrower => Position position) public positions;

    event CollateralDeposited(address indexed borrower, uint256 amount);
    event CollateralWithdrawn(address indexed borrower, address indexed recipient, uint256 amount);
    event Borrowed(address indexed borrower, address indexed recipient, uint256 amount);
    event Repaid(address indexed payer, address indexed borrower, uint256 amount);
    event Liquidated(
        address indexed liquidator,
        address indexed borrower,
        address indexed recipient,
        uint256 repaidUsdc,
        uint256 seizedWeth
    );
    event LiquiditySupplied(address indexed supplier, uint256 amount);
    event LiquidityWithdrawn(address indexed recipient, uint256 amount);

    error InvalidAddress();
    error InvalidAmount();
    error InvalidParameter();
    error InvalidTokenDecimals();
    error OraclePriceInvalid();
    error OraclePriceStale();
    error InsufficientCollateral();
    error InsufficientLiquidity();
    error BorrowLimitExceeded();
    error PositionUnhealthy();
    error PositionHealthy();
    error NoDebt();

    constructor(
        address weth_,
        address usdc_,
        address ethUsdFeed_,
        uint256 annualInterestRateBps_,
        uint256 maxOracleDelay_
    ) Ownable(msg.sender) {
        if (weth_ == address(0) || usdc_ == address(0) || ethUsdFeed_ == address(0)) revert InvalidAddress();
        if (maxOracleDelay_ == 0 || annualInterestRateBps_ > BPS) revert InvalidParameter();

        weth = IERC20Metadata(weth_);
        usdc = IERC20Metadata(usdc_);
        ethUsdFeed = IAggregatorV3(ethUsdFeed_);
        annualInterestRateBps = annualInterestRateBps_;
        maxOracleDelay = maxOracleDelay_;

        if (weth.decimals() != 18 || usdc.decimals() != 6) revert InvalidTokenDecimals();

        uint8 feedDecimals = ethUsdFeed.decimals();
        if (feedDecimals > 18) revert InvalidParameter();
        feedUnit = 10 ** uint256(feedDecimals);
    }

    function supplyLiquidity(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();

        IERC20(address(usdc)).safeTransferFrom(msg.sender, address(this), amount);
        emit LiquiditySupplied(msg.sender, amount);
    }

    function withdrawLiquidity(uint256 amount, address recipient) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidAddress();
        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();

        IERC20(address(usdc)).safeTransfer(recipient, amount);
        emit LiquidityWithdrawn(recipient, amount);
    }

    function depositCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();

        uint256 balanceBefore = weth.balanceOf(address(this));
        IERC20(address(weth)).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = weth.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert InvalidAmount();

        Position storage position = positions[msg.sender];
        position.collateralWeth += received;
        if (position.lastAccrual == 0) position.lastAccrual = uint64(block.timestamp);

        emit CollateralDeposited(msg.sender, received);
    }

    function withdrawCollateral(uint256 amount, address recipient) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidAddress();

        Position storage position = positions[msg.sender];
        _accrue(position);
        if (amount > position.collateralWeth) revert InsufficientCollateral();

        position.collateralWeth -= amount;
        if (position.debtUsdc != 0 && !_isHealthy(position.collateralWeth, position.debtUsdc)) {
            revert PositionUnhealthy();
        }

        IERC20(address(weth)).safeTransfer(recipient, amount);
        emit CollateralWithdrawn(msg.sender, recipient, amount);
    }

    function borrow(uint256 amount, address recipient) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidAddress();
        if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();

        Position storage position = positions[msg.sender];
        _accrue(position);
        if (position.collateralWeth == 0) revert InsufficientCollateral();

        uint256 newDebt = position.debtUsdc + amount;
        uint256 maxBorrow = Math.mulDiv(collateralValueUsdc(position.collateralWeth), MAX_BORROW_LTV_BPS, BPS);
        if (newDebt > maxBorrow) revert BorrowLimitExceeded();

        position.debtUsdc = newDebt;
        IERC20(address(usdc)).safeTransfer(recipient, amount);

        emit Borrowed(msg.sender, recipient, amount);
    }

    function repay(uint256 amount) external nonReentrant returns (uint256 repaid) {
        return _repay(msg.sender, msg.sender, amount);
    }

    function repayFor(address borrower, uint256 amount) external nonReentrant returns (uint256 repaid) {
        if (borrower == address(0)) revert InvalidAddress();
        return _repay(msg.sender, borrower, amount);
    }

    function liquidate(address borrower, uint256 maxRepayAmount, address recipient)
        external
        nonReentrant
        returns (uint256 repaid, uint256 seizedWeth)
    {
        if (borrower == address(0) || recipient == address(0)) revert InvalidAddress();
        if (maxRepayAmount == 0) revert InvalidAmount();

        Position storage position = positions[borrower];
        _accrue(position);
        if (position.debtUsdc == 0) revert NoDebt();
        if (_isHealthy(position.collateralWeth, position.debtUsdc)) revert PositionHealthy();

        uint256 maxRepayByCollateral =
            Math.mulDiv(collateralValueUsdc(position.collateralWeth), BPS, BPS + LIQUIDATION_BONUS_BPS);
        repaid = _min(maxRepayAmount, _min(position.debtUsdc, maxRepayByCollateral));
        if (repaid == 0) revert InvalidAmount();

        seizedWeth = _wethSeizedForRepay(repaid);
        if (seizedWeth > position.collateralWeth) seizedWeth = position.collateralWeth;

        position.debtUsdc -= repaid;
        position.collateralWeth -= seizedWeth;

        IERC20(address(usdc)).safeTransferFrom(msg.sender, address(this), repaid);
        IERC20(address(weth)).safeTransfer(recipient, seizedWeth);

        emit Liquidated(msg.sender, borrower, recipient, repaid, seizedWeth);
    }

    function accrue(address borrower) external {
        if (borrower == address(0)) revert InvalidAddress();
        _accrue(positions[borrower]);
    }

    function debtWithInterest(address borrower) public view returns (uint256) {
        Position memory position = positions[borrower];
        return _debtWithInterest(position);
    }

    function collateralValueUsdc(uint256 wethAmount) public view returns (uint256) {
        uint256 price = _ethUsdPrice();
        return Math.mulDiv(wethAmount, price * USDC_UNIT, WETH_UNIT * feedUnit);
    }

    function currentLtvBps(address borrower) external view returns (uint256) {
        Position memory position = positions[borrower];
        uint256 debt = _debtWithInterest(position);
        if (debt == 0) return 0;

        uint256 collateralValue = collateralValueUsdc(position.collateralWeth);
        if (collateralValue == 0) return type(uint256).max;
        return Math.mulDiv(debt, BPS, collateralValue);
    }

    function isHealthy(address borrower) external view returns (bool) {
        Position memory position = positions[borrower];
        return _isHealthy(position.collateralWeth, _debtWithInterest(position));
    }

    function maxBorrowable(address borrower) external view returns (uint256) {
        Position memory position = positions[borrower];
        uint256 maxDebt = Math.mulDiv(collateralValueUsdc(position.collateralWeth), MAX_BORROW_LTV_BPS, BPS);
        uint256 debt = _debtWithInterest(position);
        return maxDebt > debt ? maxDebt - debt : 0;
    }

    function liquidatable(address borrower) external view returns (bool) {
        Position memory position = positions[borrower];
        uint256 debt = _debtWithInterest(position);
        return debt != 0 && !_isHealthy(position.collateralWeth, debt);
    }

    function quoteLiquidation(address borrower, uint256 maxRepayAmount)
        external
        view
        returns (uint256 repaid, uint256 seizedWeth)
    {
        if (maxRepayAmount == 0) return (0, 0);

        Position memory position = positions[borrower];
        uint256 debt = _debtWithInterest(position);
        if (debt == 0 || _isHealthy(position.collateralWeth, debt)) return (0, 0);

        uint256 maxRepayByCollateral =
            Math.mulDiv(collateralValueUsdc(position.collateralWeth), BPS, BPS + LIQUIDATION_BONUS_BPS);
        repaid = _min(maxRepayAmount, _min(debt, maxRepayByCollateral));
        seizedWeth = _wethSeizedForRepay(repaid);
        if (seizedWeth > position.collateralWeth) seizedWeth = position.collateralWeth;
    }

    function _repay(address payer, address borrower, uint256 amount) private returns (uint256 repaid) {
        if (amount == 0) revert InvalidAmount();

        Position storage position = positions[borrower];
        _accrue(position);
        if (position.debtUsdc == 0) revert NoDebt();

        repaid = _min(amount, position.debtUsdc);
        position.debtUsdc -= repaid;

        IERC20(address(usdc)).safeTransferFrom(payer, address(this), repaid);
        emit Repaid(payer, borrower, repaid);
    }

    function _accrue(Position storage position) private {
        uint256 debt = _debtWithInterest(position);
        position.debtUsdc = debt;
        position.lastAccrual = uint64(block.timestamp);
    }

    function _debtWithInterest(Position memory position) private view returns (uint256) {
        if (position.debtUsdc == 0) return 0;
        if (position.lastAccrual == 0 || block.timestamp <= position.lastAccrual) return position.debtUsdc;

        uint256 elapsed = block.timestamp - position.lastAccrual;
        uint256 interest = Math.mulDiv(position.debtUsdc, annualInterestRateBps * elapsed, BPS * SECONDS_PER_YEAR);
        return position.debtUsdc + interest;
    }

    function _isHealthy(uint256 collateralWeth, uint256 debtUsdc) private view returns (bool) {
        if (debtUsdc == 0) return true;

        uint256 collateralValue = collateralValueUsdc(collateralWeth);
        return debtUsdc <= Math.mulDiv(collateralValue, LIQUIDATION_LTV_BPS, BPS);
    }

    function _wethSeizedForRepay(uint256 repayUsdc) private view returns (uint256) {
        uint256 price = _ethUsdPrice();
        uint256 wethEquivalent = Math.mulDivUp(repayUsdc, WETH_UNIT * feedUnit, price * USDC_UNIT);
        return Math.mulDivUp(wethEquivalent, BPS + LIQUIDATION_BONUS_BPS, BPS);
    }

    function _ethUsdPrice() private view returns (uint256) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = ethUsdFeed.latestRoundData();
        if (answer <= 0 || updatedAt == 0 || answeredInRound < roundId) revert OraclePriceInvalid();
        if (block.timestamp - updatedAt > maxOracleDelay) revert OraclePriceStale();
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer);
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}
