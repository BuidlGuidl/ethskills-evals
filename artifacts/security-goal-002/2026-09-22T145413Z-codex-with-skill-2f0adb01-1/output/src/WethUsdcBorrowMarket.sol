// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
import {SafeERC20} from "./libraries/SafeERC20.sol";
import {ReentrancyGuard} from "./ReentrancyGuard.sol";

contract WethUsdcBorrowMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant WETH_SCALE = 1e18;
    uint256 public constant USDC_SCALE = 1e6;
    uint256 public constant YEAR = 365 days;

    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    uint256 public constant MAX_ANNUAL_RATE_BPS = 10_000;

    IERC20 public immutable WETH;
    IERC20 public immutable USDC;
    AggregatorV3Interface public immutable ETH_USD_FEED;
    uint8 public immutable FEED_DECIMALS;
    uint256 public immutable MAX_PRICE_AGE;
    uint256 public immutable ANNUAL_RATE_BPS;

    struct Position {
        uint256 collateralWeth;
        uint256 debtUsdc;
        uint256 lastAccrued;
    }

    mapping(address borrower => Position position) public positions;

    event CollateralDeposited(address indexed borrower, uint256 amountWeth);
    event CollateralWithdrawn(address indexed borrower, uint256 amountWeth);
    event Borrowed(address indexed borrower, uint256 amountUsdc);
    event Repaid(address indexed payer, address indexed borrower, uint256 amountUsdc);
    event Liquidated(address indexed liquidator, address indexed borrower, uint256 repaidUsdc, uint256 seizedWeth);

    error ZeroAddress();
    error ZeroAmount();
    error BadTokenDecimals();
    error BadRate();
    error BadOracleConfig();
    error InvalidOracleAnswer();
    error StaleOracleAnswer();
    error InsufficientCollateral();
    error PositionUnhealthy();
    error PositionHealthy();
    error InsufficientMarketLiquidity();
    error NoDebt();

    constructor(address weth_, address usdc_, address ethUsdFeed_, uint256 maxPriceAge_, uint256 annualRateBps_) {
        if (weth_ == address(0) || usdc_ == address(0) || ethUsdFeed_ == address(0)) revert ZeroAddress();
        if (maxPriceAge_ == 0) revert BadOracleConfig();
        if (annualRateBps_ > MAX_ANNUAL_RATE_BPS) revert BadRate();
        if (IERC20Metadata(weth_).decimals() != 18 || IERC20Metadata(usdc_).decimals() != 6) {
            revert BadTokenDecimals();
        }

        uint8 decimals_ = AggregatorV3Interface(ethUsdFeed_).decimals();
        if (decimals_ > 18) revert BadOracleConfig();

        WETH = IERC20(weth_);
        USDC = IERC20(usdc_);
        ETH_USD_FEED = AggregatorV3Interface(ethUsdFeed_);
        FEED_DECIMALS = decimals_;
        MAX_PRICE_AGE = maxPriceAge_;
        ANNUAL_RATE_BPS = annualRateBps_;
    }

    function depositCollateral(uint256 amountWeth) external nonReentrant {
        if (amountWeth == 0) revert ZeroAmount();

        WETH.safeTransferFrom(msg.sender, address(this), amountWeth);
        positions[msg.sender].collateralWeth += amountWeth;

        emit CollateralDeposited(msg.sender, amountWeth);
    }

    function withdrawCollateral(uint256 amountWeth) external nonReentrant {
        if (amountWeth == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender];
        _accrue(position);
        if (position.collateralWeth < amountWeth) revert InsufficientCollateral();

        position.collateralWeth -= amountWeth;
        if (!_isHealthy(position.collateralWeth, position.debtUsdc)) revert PositionUnhealthy();

        WETH.safeTransfer(msg.sender, amountWeth);

        emit CollateralWithdrawn(msg.sender, amountWeth);
    }

    function borrow(uint256 amountUsdc) external nonReentrant {
        if (amountUsdc == 0) revert ZeroAmount();
        if (USDC.balanceOf(address(this)) < amountUsdc) revert InsufficientMarketLiquidity();

        Position storage position = positions[msg.sender];
        _accrue(position);

        if (position.debtUsdc == 0) {
            position.lastAccrued = block.timestamp;
        }
        position.debtUsdc += amountUsdc;
        if (!_isHealthy(position.collateralWeth, position.debtUsdc)) revert PositionUnhealthy();

        USDC.safeTransfer(msg.sender, amountUsdc);

        emit Borrowed(msg.sender, amountUsdc);
    }

    function repay(address borrower, uint256 maxAmountUsdc) external nonReentrant returns (uint256 repaidUsdc) {
        if (borrower == address(0)) revert ZeroAddress();
        if (maxAmountUsdc == 0) revert ZeroAmount();

        Position storage position = positions[borrower];
        _accrue(position);
        if (position.debtUsdc == 0) revert NoDebt();

        repaidUsdc = maxAmountUsdc < position.debtUsdc ? maxAmountUsdc : position.debtUsdc;
        USDC.safeTransferFrom(msg.sender, address(this), repaidUsdc);

        position.debtUsdc -= repaidUsdc;
        if (position.debtUsdc == 0) {
            position.lastAccrued = 0;
        }

        emit Repaid(msg.sender, borrower, repaidUsdc);
    }

    function liquidate(address borrower, uint256 maxRepayUsdc)
        external
        nonReentrant
        returns (uint256 repaidUsdc, uint256 seizedWeth)
    {
        if (borrower == address(0)) revert ZeroAddress();
        if (maxRepayUsdc == 0) revert ZeroAmount();

        Position storage position = positions[borrower];
        _accrue(position);
        if (!_isLiquidatable(position.collateralWeth, position.debtUsdc)) revert PositionHealthy();

        uint256 price = _ethUsdPrice();
        repaidUsdc = maxRepayUsdc < position.debtUsdc ? maxRepayUsdc : position.debtUsdc;
        seizedWeth = _seizedWethForRepayment(repaidUsdc, price);

        if (seizedWeth > position.collateralWeth) {
            uint256 repayableBaseWeth = (position.collateralWeth * BPS) / (BPS + LIQUIDATION_BONUS_BPS);
            repaidUsdc = _wethToUsdc(repayableBaseWeth, price);
            if (repaidUsdc > position.debtUsdc) {
                repaidUsdc = position.debtUsdc;
            }
            seizedWeth = _seizedWethForRepayment(repaidUsdc, price);
            if (seizedWeth > position.collateralWeth) {
                seizedWeth = position.collateralWeth;
            }
        }

        if (repaidUsdc == 0 || seizedWeth == 0) revert ZeroAmount();

        USDC.safeTransferFrom(msg.sender, address(this), repaidUsdc);

        position.debtUsdc -= repaidUsdc;
        position.collateralWeth -= seizedWeth;
        if (position.debtUsdc == 0) {
            position.lastAccrued = 0;
        }

        WETH.safeTransfer(msg.sender, seizedWeth);

        emit Liquidated(msg.sender, borrower, repaidUsdc, seizedWeth);
    }

    function accruedDebt(address borrower) external view returns (uint256) {
        Position memory position = positions[borrower];
        return _debtWithInterest(position.debtUsdc, position.lastAccrued);
    }

    function collateralValueUsdc(address borrower) external view returns (uint256) {
        return _wethToUsdc(positions[borrower].collateralWeth, _ethUsdPrice());
    }

    function isHealthy(address borrower) external view returns (bool) {
        Position memory position = positions[borrower];
        return _isHealthy(position.collateralWeth, _debtWithInterest(position.debtUsdc, position.lastAccrued));
    }

    function isLiquidatable(address borrower) external view returns (bool) {
        Position memory position = positions[borrower];
        return _isLiquidatable(position.collateralWeth, _debtWithInterest(position.debtUsdc, position.lastAccrued));
    }

    function maxBorrowableUsdc(address borrower) external view returns (uint256) {
        Position memory position = positions[borrower];
        uint256 debt = _debtWithInterest(position.debtUsdc, position.lastAccrued);
        uint256 limit = (_wethToUsdc(position.collateralWeth, _ethUsdPrice()) * MAX_BORROW_LTV_BPS) / BPS;
        return limit > debt ? limit - debt : 0;
    }

    function _accrue(Position storage position) internal {
        if (position.debtUsdc == 0) {
            position.lastAccrued = 0;
            return;
        }

        position.debtUsdc = _debtWithInterest(position.debtUsdc, position.lastAccrued);
        position.lastAccrued = block.timestamp;
    }

    function _debtWithInterest(uint256 debtUsdc, uint256 lastAccrued) internal view returns (uint256) {
        if (debtUsdc == 0) return 0;
        if (lastAccrued == 0 || block.timestamp <= lastAccrued) return debtUsdc;

        uint256 elapsed = block.timestamp - lastAccrued;
        uint256 interest = (debtUsdc * ANNUAL_RATE_BPS * elapsed) / (BPS * YEAR);
        return debtUsdc + interest;
    }

    function _isHealthy(uint256 collateralWeth, uint256 debtUsdc) internal view returns (bool) {
        if (debtUsdc == 0) return true;

        uint256 collateralValue = _wethToUsdc(collateralWeth, _ethUsdPrice());
        return debtUsdc * BPS <= collateralValue * MAX_BORROW_LTV_BPS;
    }

    function _isLiquidatable(uint256 collateralWeth, uint256 debtUsdc) internal view returns (bool) {
        if (debtUsdc == 0) return false;

        uint256 collateralValue = _wethToUsdc(collateralWeth, _ethUsdPrice());
        return debtUsdc * BPS > collateralValue * LIQUIDATION_THRESHOLD_BPS;
    }

    function _seizedWethForRepayment(uint256 repayUsdc, uint256 price) internal view returns (uint256) {
        uint256 baseWeth = _usdcToWeth(repayUsdc, price);
        return (baseWeth * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
    }

    function _wethToUsdc(uint256 amountWeth, uint256 price) internal view returns (uint256) {
        return (amountWeth * price) / (10 ** FEED_DECIMALS) / (WETH_SCALE / USDC_SCALE);
    }

    function _usdcToWeth(uint256 amountUsdc, uint256 price) internal view returns (uint256) {
        return (amountUsdc * (WETH_SCALE / USDC_SCALE) * (10 ** FEED_DECIMALS)) / price;
    }

    function _ethUsdPrice() internal view returns (uint256) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = ETH_USD_FEED.latestRoundData();
        if (answer <= 0 || updatedAt == 0 || answeredInRound < roundId) revert InvalidOracleAnswer();
        if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StaleOracleAnswer();
        // Casting is safe because non-positive oracle answers were rejected above.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer);
    }
}
