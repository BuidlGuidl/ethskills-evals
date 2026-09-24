// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IERC20Metadata is IERC20 {
    function decimals() external view returns (uint8);
}

interface IChainlinkFeed {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

library SafeToken {
    error TokenCallFailed(address token);
    error TokenTransferFailed(address token);

    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        _call(token, abi.encodeCall(IERC20.transfer, (to, amount)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        _call(token, abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
    }

    function _call(IERC20 token, bytes memory data) private {
        (bool success, bytes memory returndata) = address(token).call(data);
        if (!success) revert TokenCallFailed(address(token));
        if (returndata.length != 0 && !abi.decode(returndata, (bool))) {
            revert TokenTransferFailed(address(token));
        }
    }
}

library FullMath {
    function mulDiv(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
        unchecked {
            uint256 prod0;
            uint256 prod1;
            assembly {
                let mm := mulmod(x, y, not(0))
                prod0 := mul(x, y)
                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
            }

            if (prod1 == 0) return prod0 / denominator;
            require(denominator > prod1);

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
                prod0 := or(prod0, mul(prod1, twos))
            }

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

    function mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
        result = mulDiv(x, y, denominator);
        if (mulmod(x, y, denominator) != 0) result++;
    }
}

contract BorrowingMarket {
    using SafeToken for IERC20Metadata;

    struct Position {
        uint256 collateralAmount;
        uint256 debtAmount;
        uint64 lastAccrued;
    }

    uint256 public constant BPS = 10_000;
    uint256 public constant BORROW_LIMIT_BPS = 7_000;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    uint256 public constant USD_SCALE = 1e18;
    uint256 public constant YEAR = 365 days;

    IERC20Metadata public immutable COLLATERAL_TOKEN;
    IERC20Metadata public immutable DEBT_TOKEN;
    IChainlinkFeed public immutable COLLATERAL_USD_FEED;
    IChainlinkFeed public immutable DEBT_USD_FEED;
    uint256 public immutable ANNUAL_RATE_BPS;
    uint256 public immutable COLLATERAL_FEED_MAX_AGE;
    uint256 public immutable DEBT_FEED_MAX_AGE;
    uint256 public immutable COLLATERAL_UNIT;
    uint256 public immutable DEBT_UNIT;
    uint256 public immutable COLLATERAL_FEED_UNIT;
    uint256 public immutable DEBT_FEED_UNIT;

    address public owner;
    uint256 public totalCollateral;

    mapping(address borrower => Position position) private positions;

    bool private locked;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event CollateralDeposited(address indexed borrower, uint256 amount);
    event CollateralWithdrawn(address indexed borrower, uint256 amount);
    event Borrowed(address indexed borrower, uint256 amount);
    event Repaid(address indexed payer, address indexed borrower, uint256 amount);
    event Liquidated(
        address indexed liquidator, address indexed borrower, uint256 repaidAmount, uint256 seizedCollateral
    );
    event ReservesDeposited(address indexed from, uint256 amount);
    event ReservesWithdrawn(address indexed to, uint256 amount);
    event ExcessCollateralSwept(address indexed to, uint256 amount);
    event TokenSwept(address indexed token, address indexed to, uint256 amount);

    error AmountZero();
    error BadAddress();
    error BadDecimals();
    error BadRate();
    error BorrowLimitExceeded();
    error FeedStale(address feed);
    error InsufficientCollateral();
    error InsufficientCollateralForBonus();
    error NotLiquidatable();
    error NothingToRepay();
    error NotOwner();
    error Reentrancy();
    error TransferAmountMismatch();

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _onlyOwner() private view {
        if (msg.sender != owner) revert NotOwner();
    }

    function _nonReentrantBefore() private {
        if (locked) revert Reentrancy();
        locked = true;
    }

    function _nonReentrantAfter() private {
        locked = false;
    }

    constructor(
        IERC20Metadata collateralToken_,
        IERC20Metadata debtToken_,
        IChainlinkFeed collateralUsdFeed_,
        IChainlinkFeed debtUsdFeed_,
        uint256 annualRateBps_,
        uint256 collateralFeedMaxAge_,
        uint256 debtFeedMaxAge_,
        address owner_
    ) {
        if (
            address(collateralToken_) == address(0) || address(debtToken_) == address(0)
                || address(collateralUsdFeed_) == address(0) || address(debtUsdFeed_) == address(0)
                || owner_ == address(0)
        ) revert BadAddress();
        if (annualRateBps_ > BPS) revert BadRate();
        if (collateralFeedMaxAge_ == 0 || debtFeedMaxAge_ == 0) revert AmountZero();

        uint8 collateralDecimals = collateralToken_.decimals();
        uint8 debtDecimals = debtToken_.decimals();
        uint8 collateralOracleDecimals = collateralUsdFeed_.decimals();
        uint8 debtOracleDecimals = debtUsdFeed_.decimals();
        if (collateralDecimals > 18 || debtDecimals > 18 || collateralOracleDecimals > 18 || debtOracleDecimals > 18) {
            revert BadDecimals();
        }

        COLLATERAL_TOKEN = collateralToken_;
        DEBT_TOKEN = debtToken_;
        COLLATERAL_USD_FEED = collateralUsdFeed_;
        DEBT_USD_FEED = debtUsdFeed_;
        ANNUAL_RATE_BPS = annualRateBps_;
        COLLATERAL_FEED_MAX_AGE = collateralFeedMaxAge_;
        DEBT_FEED_MAX_AGE = debtFeedMaxAge_;
        COLLATERAL_UNIT = 10 ** collateralDecimals;
        DEBT_UNIT = 10 ** debtDecimals;
        COLLATERAL_FEED_UNIT = 10 ** collateralOracleDecimals;
        DEBT_FEED_UNIT = 10 ** debtOracleDecimals;
        owner = owner_;

        emit OwnershipTransferred(address(0), owner_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert BadAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function depositCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert AmountZero();

        uint256 balanceBefore = COLLATERAL_TOKEN.balanceOf(address(this));
        COLLATERAL_TOKEN.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = COLLATERAL_TOKEN.balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert TransferAmountMismatch();

        Position storage position = positions[msg.sender];
        position.collateralAmount += received;
        totalCollateral += received;

        emit CollateralDeposited(msg.sender, received);
    }

    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert AmountZero();

        Position storage position = positions[msg.sender];
        _accrue(position);
        if (position.collateralAmount < amount) revert InsufficientCollateral();

        position.collateralAmount -= amount;
        totalCollateral -= amount;

        if (!_borrowLimitHealthy(position.collateralAmount, position.debtAmount)) revert BorrowLimitExceeded();

        COLLATERAL_TOKEN.safeTransfer(msg.sender, amount);

        emit CollateralWithdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant {
        if (amount == 0) revert AmountZero();

        Position storage position = positions[msg.sender];
        _accrue(position);
        position.debtAmount += amount;
        position.lastAccrued = uint64(block.timestamp);

        if (!_borrowLimitHealthy(position.collateralAmount, position.debtAmount)) revert BorrowLimitExceeded();

        DEBT_TOKEN.safeTransfer(msg.sender, amount);

        emit Borrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external nonReentrant returns (uint256 repaid) {
        if (amount == 0) revert AmountZero();

        Position storage position = positions[msg.sender];
        _accrue(position);
        repaid = _repay(msg.sender, position, amount);

        emit Repaid(msg.sender, msg.sender, repaid);
    }

    function liquidate(address borrower, uint256 repayAmount)
        external
        nonReentrant
        returns (uint256 repaid, uint256 seizedCollateral)
    {
        if (borrower == address(0)) revert BadAddress();
        if (repayAmount == 0) revert AmountZero();

        Position storage position = positions[borrower];
        _accrue(position);
        if (!_liquidatable(position.collateralAmount, position.debtAmount)) revert NotLiquidatable();

        repaid = repayAmount < position.debtAmount ? repayAmount : position.debtAmount;
        uint256 repayValueUsd = debtValueUsd(repaid);
        uint256 seizeValueUsd = FullMath.mulDivUp(repayValueUsd, BPS + LIQUIDATION_BONUS_BPS, BPS);
        seizedCollateral = collateralAmountFromUsd(seizeValueUsd);
        if (seizedCollateral == 0) revert AmountZero();
        if (seizedCollateral > position.collateralAmount) revert InsufficientCollateralForBonus();

        position.debtAmount -= repaid;
        position.collateralAmount -= seizedCollateral;
        totalCollateral -= seizedCollateral;

        DEBT_TOKEN.safeTransferFrom(msg.sender, address(this), repaid);
        COLLATERAL_TOKEN.safeTransfer(msg.sender, seizedCollateral);

        emit Repaid(msg.sender, borrower, repaid);
        emit Liquidated(msg.sender, borrower, repaid, seizedCollateral);
    }

    function depositReserves(uint256 amount) external nonReentrant {
        if (amount == 0) revert AmountZero();
        uint256 balanceBefore = DEBT_TOKEN.balanceOf(address(this));
        DEBT_TOKEN.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = DEBT_TOKEN.balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert TransferAmountMismatch();
        emit ReservesDeposited(msg.sender, received);
    }

    function withdrawReserves(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert BadAddress();
        if (amount == 0) revert AmountZero();
        DEBT_TOKEN.safeTransfer(to, amount);
        emit ReservesWithdrawn(to, amount);
    }

    function sweepExcessCollateral(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert BadAddress();
        if (amount == 0) revert AmountZero();

        uint256 balance = COLLATERAL_TOKEN.balanceOf(address(this));
        if (balance < totalCollateral + amount) revert InsufficientCollateral();

        COLLATERAL_TOKEN.safeTransfer(to, amount);
        emit ExcessCollateralSwept(to, amount);
    }

    function sweepToken(IERC20Metadata token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (address(token) == address(COLLATERAL_TOKEN) || address(token) == address(DEBT_TOKEN)) revert BadAddress();
        if (to == address(0)) revert BadAddress();
        if (amount == 0) revert AmountZero();
        token.safeTransfer(to, amount);
        emit TokenSwept(address(token), to, amount);
    }

    function positionOf(address borrower)
        external
        view
        returns (
            uint256 collateralAmount,
            uint256 debtAmount,
            uint256 collateralValueUsd18,
            uint256 debtValueUsd18,
            uint256 maxBorrowValueUsd18,
            uint256 liquidationDebtValueUsd18,
            uint256 healthFactorBps
        )
    {
        Position storage position = positions[borrower];
        collateralAmount = position.collateralAmount;
        debtAmount = _debtWithInterest(position);
        collateralValueUsd18 = collateralValueUsd(collateralAmount);
        debtValueUsd18 = debtValueUsd(debtAmount);
        maxBorrowValueUsd18 = FullMath.mulDiv(collateralValueUsd18, BORROW_LIMIT_BPS, BPS);
        liquidationDebtValueUsd18 = FullMath.mulDiv(collateralValueUsd18, LIQUIDATION_THRESHOLD_BPS, BPS);
        healthFactorBps =
            debtValueUsd18 == 0 ? type(uint256).max : FullMath.mulDiv(liquidationDebtValueUsd18, BPS, debtValueUsd18);
    }

    function currentDebt(address borrower) external view returns (uint256) {
        return _debtWithInterest(positions[borrower]);
    }

    function isBorrowLimitHealthy(address borrower) external view returns (bool) {
        Position storage position = positions[borrower];
        return _borrowLimitHealthy(position.collateralAmount, _debtWithInterest(position));
    }

    function isLiquidatable(address borrower) external view returns (bool) {
        Position storage position = positions[borrower];
        return _liquidatable(position.collateralAmount, _debtWithInterest(position));
    }

    function collateralValueUsd(uint256 collateralAmount) public view returns (uint256) {
        uint256 price = _price(COLLATERAL_USD_FEED, COLLATERAL_FEED_MAX_AGE);
        return FullMath.mulDiv(collateralAmount, price * USD_SCALE, COLLATERAL_UNIT * COLLATERAL_FEED_UNIT);
    }

    function debtValueUsd(uint256 debtAmount) public view returns (uint256) {
        uint256 price = _price(DEBT_USD_FEED, DEBT_FEED_MAX_AGE);
        return FullMath.mulDiv(debtAmount, price * USD_SCALE, DEBT_UNIT * DEBT_FEED_UNIT);
    }

    function collateralAmountFromUsd(uint256 usdValue18) public view returns (uint256) {
        uint256 price = _price(COLLATERAL_USD_FEED, COLLATERAL_FEED_MAX_AGE);
        return FullMath.mulDivUp(usdValue18, COLLATERAL_UNIT * COLLATERAL_FEED_UNIT, price * USD_SCALE);
    }

    function _repay(address payer, Position storage position, uint256 amount) private returns (uint256 repaid) {
        if (position.debtAmount == 0) revert NothingToRepay();
        repaid = amount < position.debtAmount ? amount : position.debtAmount;
        position.debtAmount -= repaid;
        DEBT_TOKEN.safeTransferFrom(payer, address(this), repaid);
    }

    function _accrue(Position storage position) private {
        uint256 debt = _debtWithInterest(position);
        position.debtAmount = debt;
        position.lastAccrued = debt == 0 ? 0 : uint64(block.timestamp);
    }

    function _debtWithInterest(Position storage position) private view returns (uint256) {
        uint256 debt = position.debtAmount;
        if (debt == 0) return 0;
        uint256 elapsed = block.timestamp - position.lastAccrued;
        if (elapsed == 0 || ANNUAL_RATE_BPS == 0) return debt;

        uint256 annualInterest = FullMath.mulDiv(debt, ANNUAL_RATE_BPS, BPS);
        uint256 accruedInterest = FullMath.mulDiv(annualInterest, elapsed, YEAR);
        return debt + accruedInterest;
    }

    function _borrowLimitHealthy(uint256 collateralAmount, uint256 debtAmount) private view returns (bool) {
        if (debtAmount == 0) return true;
        uint256 collateralUsd = collateralValueUsd(collateralAmount);
        uint256 debtUsd = debtValueUsd(debtAmount);
        return FullMath.mulDiv(collateralUsd, BORROW_LIMIT_BPS, BPS) >= debtUsd;
    }

    function _liquidatable(uint256 collateralAmount, uint256 debtAmount) private view returns (bool) {
        if (debtAmount == 0) return false;
        uint256 collateralUsd = collateralValueUsd(collateralAmount);
        uint256 debtUsd = debtValueUsd(debtAmount);
        return debtUsd > FullMath.mulDiv(collateralUsd, LIQUIDATION_THRESHOLD_BPS, BPS);
    }

    function _price(IChainlinkFeed feed, uint256 maxAge) private view returns (uint256) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
        if (answer <= 0 || updatedAt == 0 || answeredInRound < roundId) revert FeedStale(address(feed));
        if (block.timestamp - updatedAt > maxAge) revert FeedStale(address(feed));
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer);
    }
}
