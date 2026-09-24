// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @notice Small WETH-collateralized USDC borrowing market for Ethereum mainnet.
/// @dev Assumes WETH has 18 decimals and USDC has 6 decimals.
contract WethUsdcBorrowMarket {
    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;
    uint256 public constant WETH_UNIT = 1e18;
    uint256 public constant USDC_UNIT = 1e6;
    uint256 public constant WETH_TO_USDC_SCALE = 1e12;

    uint256 public constant MAX_BORROW_BPS = 7_000;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    IERC20 public immutable WETH;
    IERC20 public immutable USDC;
    IAggregatorV3 public immutable ETH_USD_PRICE_FEED;
    uint256 public immutable PRICE_FEED_UNIT;
    uint64 public immutable MAX_PRICE_AGE;
    uint64 public immutable ANNUAL_INTEREST_BPS;

    address public owner;
    uint256 public totalCollateralWeth;
    uint256 public totalDebtUsdc;

    uint256 private _locked = 1;

    struct Position {
        uint256 collateralWeth;
        uint256 debtUsdc;
        uint64 lastAccrued;
    }

    mapping(address borrower => Position) public positions;

    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event LiquiditySupplied(address indexed supplier, uint256 amountUsdc);
    event LiquidityWithdrawn(address indexed to, uint256 amountUsdc);
    event CollateralDeposited(address indexed borrower, uint256 amountWeth);
    event CollateralWithdrawn(address indexed borrower, uint256 amountWeth);
    event Borrowed(address indexed borrower, uint256 amountUsdc);
    event Repaid(address indexed borrower, address indexed payer, uint256 amountUsdc);
    event InterestAccrued(address indexed borrower, uint256 interestUsdc, uint256 newDebtUsdc);
    event Liquidated(
        address indexed borrower,
        address indexed liquidator,
        uint256 repaidUsdc,
        uint256 seizedWeth
    );

    error AmountZero();
    error BadPrice();
    error BorrowTooHigh();
    error InsufficientCollateral();
    error InsufficientLiquidity();
    error InvalidAddress();
    error InvalidRate();
    error InvalidOracleDecimals();
    error NotLiquidatable();
    error NotOwner();
    error ReentrantCall();
    error StalePrice();
    error TransferFailed();

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _checkOwner() private view {
        if (msg.sender != owner) revert NotOwner();
    }

    function _nonReentrantBefore() private {
        if (_locked != 1) revert ReentrantCall();
        _locked = 2;
    }

    function _nonReentrantAfter() private {
        _locked = 1;
    }

    constructor(
        address weth_,
        address usdc_,
        address ethUsdPriceFeed_,
        uint64 annualInterestBps_,
        uint64 maxPriceAge_
    ) {
        if (weth_ == address(0) || usdc_ == address(0) || ethUsdPriceFeed_ == address(0)) {
            revert InvalidAddress();
        }
        if (annualInterestBps_ > BPS) revert InvalidRate();
        if (maxPriceAge_ == 0) revert StalePrice();

        uint8 oracleDecimals = IAggregatorV3(ethUsdPriceFeed_).decimals();
        if (oracleDecimals > 18) revert InvalidOracleDecimals();

        WETH = IERC20(weth_);
        USDC = IERC20(usdc_);
        ETH_USD_PRICE_FEED = IAggregatorV3(ethUsdPriceFeed_);
        PRICE_FEED_UNIT = 10 ** uint256(oracleDecimals);
        ANNUAL_INTEREST_BPS = annualInterestBps_;
        MAX_PRICE_AGE = maxPriceAge_;
        owner = msg.sender;

        emit OwnerUpdated(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnerUpdated(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Adds USDC cash that borrowers can draw from.
    function supplyLiquidity(uint256 amountUsdc) external onlyOwner nonReentrant {
        if (amountUsdc == 0) revert AmountZero();
        _safeTransferFrom(address(USDC), msg.sender, address(this), amountUsdc);
        emit LiquiditySupplied(msg.sender, amountUsdc);
    }

    /// @notice Withdraws idle USDC cash. Existing borrowers still owe their debt to this contract.
    function withdrawLiquidity(address to, uint256 amountUsdc) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        if (amountUsdc == 0) revert AmountZero();
        if (USDC.balanceOf(address(this)) < amountUsdc) revert InsufficientLiquidity();
        _safeTransfer(address(USDC), to, amountUsdc);
        emit LiquidityWithdrawn(to, amountUsdc);
    }

    function depositCollateral(uint256 amountWeth) external nonReentrant {
        if (amountWeth == 0) revert AmountZero();

        _safeTransferFrom(address(WETH), msg.sender, address(this), amountWeth);

        Position storage position = positions[msg.sender];
        if (position.debtUsdc != 0) _accrue(msg.sender, position);
        position.collateralWeth += amountWeth;
        totalCollateralWeth += amountWeth;

        emit CollateralDeposited(msg.sender, amountWeth);
    }

    function withdrawCollateral(uint256 amountWeth) external nonReentrant {
        if (amountWeth == 0) revert AmountZero();

        Position storage position = positions[msg.sender];
        _accrue(msg.sender, position);
        if (position.collateralWeth < amountWeth) revert InsufficientCollateral();

        position.collateralWeth -= amountWeth;
        totalCollateralWeth -= amountWeth;
        _requireBorrowHealthy(position);

        _safeTransfer(address(WETH), msg.sender, amountWeth);
        emit CollateralWithdrawn(msg.sender, amountWeth);
    }

    function borrow(uint256 amountUsdc) external nonReentrant {
        if (amountUsdc == 0) revert AmountZero();
        if (USDC.balanceOf(address(this)) < amountUsdc) revert InsufficientLiquidity();

        Position storage position = positions[msg.sender];
        _accrue(msg.sender, position);

        position.debtUsdc += amountUsdc;
        position.lastAccrued = uint64(block.timestamp);
        totalDebtUsdc += amountUsdc;
        _requireBorrowHealthy(position);

        _safeTransfer(address(USDC), msg.sender, amountUsdc);
        emit Borrowed(msg.sender, amountUsdc);
    }

    function repay(uint256 amountUsdc) external nonReentrant returns (uint256 repaidUsdc) {
        if (amountUsdc == 0) revert AmountZero();
        repaidUsdc = _repayFor(msg.sender, msg.sender, amountUsdc);
    }

    /// @notice Repays a borrower's debt and receives WETH collateral at oracle value plus a 5% bonus.
    /// @dev The actual repayment is capped to the borrower's debt and the amount their collateral can cover.
    function liquidate(address borrower, uint256 maxRepayUsdc)
        external
        nonReentrant
        returns (uint256 repaidUsdc, uint256 seizedWeth)
    {
        if (borrower == address(0)) revert InvalidAddress();
        if (maxRepayUsdc == 0) revert AmountZero();

        Position storage position = positions[borrower];
        _accrue(borrower, position);

        uint256 ethUsdPrice = _ethUsdPrice();
        if (!_isLiquidatable(position, ethUsdPrice)) revert NotLiquidatable();

        uint256 collateralValueUsdc = _collateralValueUsdc(position.collateralWeth, ethUsdPrice);
        uint256 maxRepayByCollateral = (collateralValueUsdc * BPS) / (BPS + LIQUIDATION_BONUS_BPS);
        repaidUsdc = _min(maxRepayUsdc, _min(position.debtUsdc, maxRepayByCollateral));
        if (repaidUsdc == 0) revert AmountZero();

        seizedWeth = _seizedCollateralWeth(repaidUsdc, ethUsdPrice);
        if (seizedWeth > position.collateralWeth) seizedWeth = position.collateralWeth;

        _safeTransferFrom(address(USDC), msg.sender, address(this), repaidUsdc);

        position.debtUsdc -= repaidUsdc;
        position.collateralWeth -= seizedWeth;
        totalDebtUsdc -= repaidUsdc;
        totalCollateralWeth -= seizedWeth;
        position.lastAccrued = position.debtUsdc == 0 ? 0 : uint64(block.timestamp);

        _safeTransfer(address(WETH), msg.sender, seizedWeth);
        emit Liquidated(borrower, msg.sender, repaidUsdc, seizedWeth);
    }

    function debtOf(address borrower) external view returns (uint256) {
        return _debtWithAccruedInterest(positions[borrower]);
    }

    function collateralValueOf(address borrower) external view returns (uint256) {
        return _collateralValueUsdc(positions[borrower].collateralWeth, _ethUsdPrice());
    }

    function borrowableUsdc(address borrower) external view returns (uint256) {
        Position storage position = positions[borrower];
        uint256 maxDebt = (_collateralValueUsdc(position.collateralWeth, _ethUsdPrice()) * MAX_BORROW_BPS) / BPS;
        uint256 currentDebt = _debtWithAccruedInterest(position);
        return currentDebt >= maxDebt ? 0 : maxDebt - currentDebt;
    }

    function ltvBps(address borrower) external view returns (uint256) {
        Position storage position = positions[borrower];
        uint256 debt = _debtWithAccruedInterest(position);
        if (debt == 0) return 0;
        uint256 collateralValue = _collateralValueUsdc(position.collateralWeth, _ethUsdPrice());
        if (collateralValue == 0) return type(uint256).max;
        return (debt * BPS) / collateralValue;
    }

    function isBorrowHealthy(address borrower) external view returns (bool) {
        Position storage position = positions[borrower];
        uint256 debt = _debtWithAccruedInterest(position);
        if (debt == 0) return true;
        uint256 collateralValue = _collateralValueUsdc(position.collateralWeth, _ethUsdPrice());
        return debt <= (collateralValue * MAX_BORROW_BPS) / BPS;
    }

    function isLiquidatable(address borrower) external view returns (bool) {
        Position storage position = positions[borrower];
        return _isLiquidatableWithAccruedInterest(position, _ethUsdPrice());
    }

    function _repayFor(address borrower, address payer, uint256 amountUsdc) private returns (uint256 repaidUsdc) {
        Position storage position = positions[borrower];
        _accrue(borrower, position);

        repaidUsdc = _min(amountUsdc, position.debtUsdc);
        if (repaidUsdc == 0) revert AmountZero();

        _safeTransferFrom(address(USDC), payer, address(this), repaidUsdc);

        position.debtUsdc -= repaidUsdc;
        totalDebtUsdc -= repaidUsdc;
        position.lastAccrued = position.debtUsdc == 0 ? 0 : uint64(block.timestamp);

        emit Repaid(borrower, payer, repaidUsdc);
    }

    function _accrue(address borrower, Position storage position) private {
        if (position.debtUsdc == 0) {
            position.lastAccrued = 0;
            return;
        }

        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
        if (elapsed == 0 || ANNUAL_INTEREST_BPS == 0) return;

        uint256 interest = (position.debtUsdc * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
        if (interest == 0) {
            position.lastAccrued = uint64(block.timestamp);
            return;
        }

        position.debtUsdc += interest;
        position.lastAccrued = uint64(block.timestamp);
        totalDebtUsdc += interest;

        emit InterestAccrued(borrower, interest, position.debtUsdc);
    }

    function _debtWithAccruedInterest(Position storage position) private view returns (uint256) {
        if (position.debtUsdc == 0) return 0;
        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
        uint256 interest = (position.debtUsdc * ANNUAL_INTEREST_BPS * elapsed) / (BPS * YEAR);
        return position.debtUsdc + interest;
    }

    function _requireBorrowHealthy(Position storage position) private view {
        if (position.debtUsdc == 0) return;
        uint256 collateralValueUsdc = _collateralValueUsdc(position.collateralWeth, _ethUsdPrice());
        if (position.debtUsdc > (collateralValueUsdc * MAX_BORROW_BPS) / BPS) revert BorrowTooHigh();
    }

    function _isLiquidatableWithAccruedInterest(Position storage position, uint256 ethUsdPrice)
        private
        view
        returns (bool)
    {
        Position memory current = position;
        current.debtUsdc = _debtWithAccruedInterest(position);
        return _isLiquidatable(current, ethUsdPrice);
    }

    function _isLiquidatable(Position memory position, uint256 ethUsdPrice) private view returns (bool) {
        if (position.debtUsdc == 0) return false;
        uint256 collateralValueUsdc = _collateralValueUsdc(position.collateralWeth, ethUsdPrice);
        return position.debtUsdc > (collateralValueUsdc * LIQUIDATION_THRESHOLD_BPS) / BPS;
    }

    function _collateralValueUsdc(uint256 collateralWeth, uint256 ethUsdPrice) private view returns (uint256) {
        return _mulDiv(collateralWeth, ethUsdPrice, PRICE_FEED_UNIT * WETH_TO_USDC_SCALE);
    }

    function _seizedCollateralWeth(uint256 repayUsdc, uint256 ethUsdPrice) private view returns (uint256) {
        uint256 repayWithBonus = (repayUsdc * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
        return _mulDiv(repayWithBonus, PRICE_FEED_UNIT * WETH_UNIT, ethUsdPrice * USDC_UNIT);
    }

    function _ethUsdPrice() private view returns (uint256) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) =
            ETH_USD_PRICE_FEED.latestRoundData();

        if (answer <= 0) revert BadPrice();
        if (answeredInRound < roundId) revert StalePrice();
        if (updatedAt == 0 || updatedAt + MAX_PRICE_AGE < block.timestamp) revert StalePrice();

        // Safe because negative and zero oracle answers are rejected above.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer);
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    /// @dev Full precision floor(x * y / denominator), adapted from Uniswap V3 FullMath.
    function _mulDiv(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256 result) {
        unchecked {
            uint256 prod0;
            uint256 prod1;
            assembly {
                let mm := mulmod(x, y, not(0))
                prod0 := mul(x, y)
                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
            }

            if (prod1 == 0) return prod0 / denominator;
            if (denominator <= prod1) revert();

            uint256 remainder;
            assembly {
                remainder := mulmod(x, y, denominator)
                prod1 := sub(prod1, gt(remainder, prod0))
                prod0 := sub(prod0, remainder)
            }

            uint256 twos = denominator & (0 - denominator);
            assembly {
                denominator := div(denominator, twos)
                prod0 := div(prod0, twos)
                twos := add(div(sub(0, twos), twos), 1)
            }
            prod0 |= prod1 * twos;

            uint256 inverse = (3 * denominator) ^ 2;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;

            result = prod0 * inverse;
        }
    }
}
