// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

contract WethUsdcBorrowMarket is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Position {
        uint256 collateralWeth;
        uint256 debtUsdc;
        uint64 lastAccrued;
    }

    uint256 public constant BPS = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    IERC20 public immutable WETH;
    IERC20 public immutable USDC;
    AggregatorV3Interface public immutable ETH_USD_FEED;
    AggregatorV3Interface public immutable USDC_USD_FEED;

    uint256 public immutable WETH_SCALE;
    uint256 public immutable USDC_SCALE;
    uint256 public immutable ETH_USD_FEED_SCALE;
    uint256 public immutable USDC_USD_FEED_SCALE;
    uint256 public immutable MAX_ETH_USD_ORACLE_AGE;
    uint256 public immutable MAX_USDC_USD_ORACLE_AGE;
    uint256 public immutable ANNUAL_INTEREST_RATE_BPS;

    uint256 public totalDebtUsdc;

    mapping(address account => Position position) public positions;

    event CollateralDeposited(address indexed account, uint256 amount);
    event CollateralWithdrawn(address indexed account, address indexed to, uint256 amount);
    event Borrowed(address indexed account, address indexed to, uint256 amount);
    event Repaid(address indexed account, address indexed payer, uint256 amount);
    event Liquidated(
        address indexed borrower,
        address indexed liquidator,
        address indexed collateralReceiver,
        uint256 debtRepaid,
        uint256 collateralSeized
    );
    event LiquidityDeposited(address indexed owner, uint256 amount);
    event LiquidityWithdrawn(address indexed owner, address indexed to, uint256 amount);

    error ZeroAmount();
    error ZeroAddress();
    error UnsupportedDecimals();
    error OraclePriceInvalid();
    error OraclePriceStale(uint256 updatedAt);
    error PositionNotHealthy(uint256 debtUsdc, uint256 maxDebtUsdc);
    error PositionNotLiquidatable(uint256 debtUsdc, uint256 liquidationDebtUsdc);
    error InsufficientCollateral();
    error InsufficientLiquidity();
    error TransferAmountMismatch();
    error RepayTooLarge(uint256 maxRepayUsdc);
    error AnnualRateTooHigh();

    constructor(
        IERC20Metadata weth_,
        IERC20Metadata usdc_,
        AggregatorV3Interface ethUsdFeed_,
        AggregatorV3Interface usdcUsdFeed_,
        uint256 annualInterestRateBps_,
        uint256 maxEthUsdOracleAge_,
        uint256 maxUsdcUsdOracleAge_,
        address owner_
    ) Ownable(owner_) {
        if (
            address(weth_) == address(0) || address(usdc_) == address(0) || address(ethUsdFeed_) == address(0)
                || address(usdcUsdFeed_) == address(0) || owner_ == address(0)
        ) {
            revert ZeroAddress();
        }
        if (maxEthUsdOracleAge_ == 0 || maxUsdcUsdOracleAge_ == 0) revert ZeroAmount();
        if (annualInterestRateBps_ > BPS) revert AnnualRateTooHigh();

        uint8 wethDecimals = weth_.decimals();
        uint8 usdcDecimals = usdc_.decimals();
        uint8 ethUsdPriceDecimals = ethUsdFeed_.decimals();
        uint8 usdcUsdPriceDecimals = usdcUsdFeed_.decimals();
        if (wethDecimals > 18 || usdcDecimals > 18 || ethUsdPriceDecimals > 18 || usdcUsdPriceDecimals > 18) {
            revert UnsupportedDecimals();
        }

        WETH = IERC20(address(weth_));
        USDC = IERC20(address(usdc_));
        ETH_USD_FEED = ethUsdFeed_;
        USDC_USD_FEED = usdcUsdFeed_;
        WETH_SCALE = 10 ** wethDecimals;
        USDC_SCALE = 10 ** usdcDecimals;
        ETH_USD_FEED_SCALE = 10 ** ethUsdPriceDecimals;
        USDC_USD_FEED_SCALE = 10 ** usdcUsdPriceDecimals;
        ANNUAL_INTEREST_RATE_BPS = annualInterestRateBps_;
        MAX_ETH_USD_ORACLE_AGE = maxEthUsdOracleAge_;
        MAX_USDC_USD_ORACLE_AGE = maxUsdcUsdOracleAge_;
    }

    function depositLiquidity(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _pullExact(USDC, msg.sender, amount);
        emit LiquidityDeposited(msg.sender, amount);
    }

    function withdrawLiquidity(uint256 amount, address to) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        USDC.safeTransfer(to, amount);
        emit LiquidityWithdrawn(msg.sender, to, amount);
    }

    function depositCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrue(position);
        _pullExact(WETH, msg.sender, amount);

        position.collateralWeth += amount;
        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount, address to) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        Position storage position = positions[msg.sender];
        uint256 debt = _accrue(position);
        if (position.collateralWeth < amount) revert InsufficientCollateral();

        uint256 newCollateral = position.collateralWeth - amount;
        _requireWithinBorrowLimit(newCollateral, debt);

        position.collateralWeth = newCollateral;
        WETH.safeTransfer(to, amount);
        emit CollateralWithdrawn(msg.sender, to, amount);
    }

    function borrow(uint256 amount, address to) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        Position storage position = positions[msg.sender];
        uint256 debt = _accrue(position) + amount;
        _requireWithinBorrowLimit(position.collateralWeth, debt);

        position.debtUsdc = debt;
        totalDebtUsdc += amount;
        USDC.safeTransfer(to, amount);
        emit Borrowed(msg.sender, to, amount);
    }

    function repay(uint256 maxAmount) external nonReentrant returns (uint256 repaid) {
        if (maxAmount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        uint256 debt = _accrue(position);
        repaid = Math.min(maxAmount, debt);
        if (repaid == 0) revert ZeroAmount();

        _pullExact(USDC, msg.sender, repaid);
        _decreaseDebt(position, debt, repaid);
        emit Repaid(msg.sender, msg.sender, repaid);
    }

    function liquidate(address borrower, uint256 maxRepayAmount, address collateralReceiver)
        external
        nonReentrant
        returns (uint256 repaid, uint256 seizedWeth)
    {
        if (borrower == address(0) || collateralReceiver == address(0)) revert ZeroAddress();
        if (maxRepayAmount == 0) revert ZeroAmount();

        Position storage position = positions[borrower];
        uint256 debt = _accrue(position);
        uint256 liquidationDebt = _liquidationDebt(position.collateralWeth);
        if (debt <= liquidationDebt) revert PositionNotLiquidatable(debt, liquidationDebt);

        repaid = Math.min(maxRepayAmount, debt);
        seizedWeth = _wethForUsdc(repaid);
        seizedWeth = Math.mulDiv(seizedWeth, BPS + LIQUIDATION_BONUS_BPS, BPS, Math.Rounding.Ceil);
        if (seizedWeth > position.collateralWeth) revert RepayTooLarge(maxLiquidatableDebt(position.collateralWeth));

        _pullExact(USDC, msg.sender, repaid);
        _decreaseDebt(position, debt, repaid);
        position.collateralWeth -= seizedWeth;

        WETH.safeTransfer(collateralReceiver, seizedWeth);
        emit Liquidated(borrower, msg.sender, collateralReceiver, repaid, seizedWeth);
    }

    function currentDebt(address account) external view returns (uint256) {
        Position memory position = positions[account];
        return _debtWithInterest(position.debtUsdc, position.lastAccrued);
    }

    function collateralValueUsdc(address account) external view returns (uint256) {
        return _collateralValueUsdc(positions[account].collateralWeth);
    }

    function maxBorrowable(address account) external view returns (uint256) {
        Position memory position = positions[account];
        uint256 debt = _debtWithInterest(position.debtUsdc, position.lastAccrued);
        uint256 maxDebt = _maxBorrowDebt(position.collateralWeth);
        return maxDebt > debt ? maxDebt - debt : 0;
    }

    function isLiquidatable(address account) external view returns (bool) {
        Position memory position = positions[account];
        uint256 debt = _debtWithInterest(position.debtUsdc, position.lastAccrued);
        return debt > 0 && debt > _liquidationDebt(position.collateralWeth);
    }

    function quoteLiquidation(address borrower, uint256 maxRepayAmount)
        external
        view
        returns (uint256 repaid, uint256 seizedWeth)
    {
        Position memory position = positions[borrower];
        uint256 debt = _debtWithInterest(position.debtUsdc, position.lastAccrued);
        repaid = Math.min(maxRepayAmount, debt);
        seizedWeth = _wethForUsdc(repaid);
        seizedWeth = Math.mulDiv(seizedWeth, BPS + LIQUIDATION_BONUS_BPS, BPS, Math.Rounding.Ceil);
    }

    function accountSnapshot(address account)
        external
        view
        returns (
            uint256 collateralWeth,
            uint256 collateralValueUsdc_,
            uint256 debtUsdc_,
            uint256 maxBorrowDebtUsdc,
            uint256 liquidationDebtUsdc,
            bool liquidatable
        )
    {
        Position memory position = positions[account];
        collateralWeth = position.collateralWeth;
        collateralValueUsdc_ = _collateralValueUsdc(collateralWeth);
        debtUsdc_ = _debtWithInterest(position.debtUsdc, position.lastAccrued);
        maxBorrowDebtUsdc = Math.mulDiv(collateralValueUsdc_, MAX_BORROW_LTV_BPS, BPS);
        liquidationDebtUsdc = Math.mulDiv(collateralValueUsdc_, LIQUIDATION_LTV_BPS, BPS);
        liquidatable = debtUsdc_ > 0 && debtUsdc_ > liquidationDebtUsdc;
    }

    function maxLiquidatableDebt(uint256 collateralWeth) public view returns (uint256) {
        uint256 collateralWithoutBonus = Math.mulDiv(collateralWeth, BPS, BPS + LIQUIDATION_BONUS_BPS);
        return _collateralValueUsdc(collateralWithoutBonus);
    }

    function latestEthUsdPrice() public view returns (uint256 price) {
        price = _readPrice(ETH_USD_FEED, MAX_ETH_USD_ORACLE_AGE);
    }

    function latestUsdcUsdPrice() public view returns (uint256 price) {
        price = _readPrice(USDC_USD_FEED, MAX_USDC_USD_ORACLE_AGE);
    }

    function _readPrice(AggregatorV3Interface feed, uint256 maxAge) internal view returns (uint256 price) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
        if (answer <= 0 || answeredInRound < roundId) revert OraclePriceInvalid();
        if (updatedAt == 0 || updatedAt > block.timestamp || block.timestamp - updatedAt > maxAge) {
            revert OraclePriceStale(updatedAt);
        }
        // casting to uint256 is safe because negative and zero answers are rejected above.
        // forge-lint: disable-next-line(unsafe-typecast)
        price = uint256(answer);
    }

    function _accrue(Position storage position) internal returns (uint256 debt) {
        debt = _debtWithInterest(position.debtUsdc, position.lastAccrued);
        if (debt != position.debtUsdc) {
            totalDebtUsdc += debt - position.debtUsdc;
            position.debtUsdc = debt;
        }
        position.lastAccrued = uint64(block.timestamp);
    }

    function _debtWithInterest(uint256 debt, uint64 lastAccrued) internal view returns (uint256) {
        if (debt == 0 || lastAccrued == 0 || lastAccrued >= block.timestamp) return debt;

        uint256 elapsed = block.timestamp - lastAccrued;
        uint256 interest = Math.mulDiv(debt, ANNUAL_INTEREST_RATE_BPS * elapsed, BPS * SECONDS_PER_YEAR);
        return debt + interest;
    }

    function _decreaseDebt(Position storage position, uint256 currentDebt_, uint256 amount) internal {
        uint256 newDebt = currentDebt_ - amount;
        position.debtUsdc = newDebt;
        totalDebtUsdc -= amount;
        position.lastAccrued = uint64(block.timestamp);
    }

    function _requireWithinBorrowLimit(uint256 collateralWeth, uint256 debtUsdc) internal view {
        uint256 maxDebt = _maxBorrowDebt(collateralWeth);
        if (debtUsdc > maxDebt) revert PositionNotHealthy(debtUsdc, maxDebt);
    }

    function _maxBorrowDebt(uint256 collateralWeth) internal view returns (uint256) {
        return Math.mulDiv(_collateralValueUsdc(collateralWeth), MAX_BORROW_LTV_BPS, BPS);
    }

    function _liquidationDebt(uint256 collateralWeth) internal view returns (uint256) {
        return Math.mulDiv(_collateralValueUsdc(collateralWeth), LIQUIDATION_LTV_BPS, BPS);
    }

    function _collateralValueUsdc(uint256 collateralWeth) internal view returns (uint256) {
        uint256 ethUsdPrice = latestEthUsdPrice();
        uint256 usdcUsdPrice = latestUsdcUsdPrice();
        uint256 usdEthFeedUnits = Math.mulDiv(collateralWeth, ethUsdPrice, WETH_SCALE);
        uint256 usdUsdcFeedUnits = Math.mulDiv(usdEthFeedUnits, USDC_USD_FEED_SCALE, ETH_USD_FEED_SCALE);
        return Math.mulDiv(usdUsdcFeedUnits, USDC_SCALE, usdcUsdPrice);
    }

    function _wethForUsdc(uint256 usdcAmount) internal view returns (uint256) {
        uint256 ethUsdPrice = latestEthUsdPrice();
        uint256 usdcUsdPrice = latestUsdcUsdPrice();
        uint256 usdUsdcFeedUnits = Math.mulDiv(usdcAmount, usdcUsdPrice, USDC_SCALE);
        uint256 usdEthFeedUnits = Math.mulDiv(usdUsdcFeedUnits, ETH_USD_FEED_SCALE, USDC_USD_FEED_SCALE);
        return Math.mulDiv(usdEthFeedUnits, WETH_SCALE, ethUsdPrice, Math.Rounding.Ceil);
    }

    function _pullExact(IERC20 token, address from, uint256 amount) internal {
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        if (token.balanceOf(address(this)) - balanceBefore != amount) revert TransferAmountMismatch();
    }
}
