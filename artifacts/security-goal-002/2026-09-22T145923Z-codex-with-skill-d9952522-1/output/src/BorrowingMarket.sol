// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IChainlinkAggregatorV3 {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
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

            if (prod1 == 0) {
                require(denominator != 0, "MATH_DIV_ZERO");
                return prod0 / denominator;
            }

            require(denominator > prod1, "MATH_OVERFLOW");

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

    function mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
        result = mulDiv(x, y, denominator);
        if (mulmod(x, y, denominator) != 0) result++;
    }
}

library SafeTransferLib {
    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = address(token).call(abi.encodeCall(token.transfer, (to, amount)));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = address(token).call(abi.encodeCall(token.transferFrom, (from, to, amount)));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FROM_FAILED");
    }
}

contract Ownable {
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "OWNER_ZERO");
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "OWNER_ZERO");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private locked = NOT_ENTERED;

    modifier nonReentrant() {
        require(locked == NOT_ENTERED, "REENTRANCY");
        locked = ENTERED;
        _;
        locked = NOT_ENTERED;
    }
}

contract WethUsdcBorrowingMarket is Ownable, ReentrancyGuard {
    using FullMath for uint256;
    using SafeTransferLib for IERC20;

    struct Position {
        uint256 collateralWeth;
        uint256 debtUsdc;
        uint256 lastAccrued;
    }

    uint256 public constant WETH_SCALE = 1e18;
    uint256 public constant USDC_SCALE = 1e6;
    uint256 public constant WAD = 1e18;
    uint256 public constant YEAR = 365 days;
    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_BORROW_BPS = 7_000;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    uint256 public constant MAX_ANNUAL_INTEREST_RATE_WAD = WAD;

    IERC20 public immutable weth;
    IERC20 public immutable usdc;
    IChainlinkAggregatorV3 public immutable ethUsdFeed;
    uint8 public immutable ethUsdFeedDecimals;
    uint256 public immutable ethUsdMaxAge;
    uint256 public immutable annualInterestRateWad;

    mapping(address => Position) public positions;

    event LiquidityProvided(address indexed provider, uint256 amountUsdc);
    event IdleLiquidityWithdrawn(address indexed to, uint256 amountUsdc);
    event CollateralDeposited(address indexed borrower, uint256 amountWeth);
    event CollateralWithdrawn(address indexed borrower, uint256 amountWeth);
    event Borrowed(address indexed borrower, uint256 amountUsdc);
    event Repaid(address indexed borrower, address indexed payer, uint256 amountUsdc);
    event Liquidated(address indexed borrower, address indexed liquidator, uint256 repaidUsdc, uint256 seizedWeth);

    constructor(
        IERC20 weth_,
        IERC20 usdc_,
        IChainlinkAggregatorV3 ethUsdFeed_,
        uint256 ethUsdMaxAge_,
        uint256 annualInterestRateWad_,
        address initialOwner
    ) Ownable(initialOwner) {
        require(address(weth_) != address(0), "WETH_ZERO");
        require(address(usdc_) != address(0), "USDC_ZERO");
        require(address(ethUsdFeed_) != address(0), "FEED_ZERO");
        require(ethUsdMaxAge_ != 0, "MAX_AGE_ZERO");
        require(annualInterestRateWad_ <= MAX_ANNUAL_INTEREST_RATE_WAD, "RATE_TOO_HIGH");

        weth = weth_;
        usdc = usdc_;
        ethUsdFeed = ethUsdFeed_;
        ethUsdFeedDecimals = ethUsdFeed_.decimals();
        ethUsdMaxAge = ethUsdMaxAge_;
        annualInterestRateWad = annualInterestRateWad_;
    }

    function provideLiquidity(uint256 amountUsdc) external onlyOwner nonReentrant {
        require(amountUsdc != 0, "ZERO_AMOUNT");
        _pullExact(usdc, msg.sender, amountUsdc);
        emit LiquidityProvided(msg.sender, amountUsdc);
    }

    function withdrawIdleLiquidity(address to, uint256 amountUsdc) external onlyOwner nonReentrant {
        require(to != address(0), "TO_ZERO");
        require(amountUsdc != 0, "ZERO_AMOUNT");
        usdc.safeTransfer(to, amountUsdc);
        emit IdleLiquidityWithdrawn(to, amountUsdc);
    }

    function depositCollateral(uint256 amountWeth) external nonReentrant {
        require(amountWeth != 0, "ZERO_AMOUNT");
        Position storage position = positions[msg.sender];
        _accrue(position);

        position.collateralWeth += amountWeth;
        _pullExact(weth, msg.sender, amountWeth);

        emit CollateralDeposited(msg.sender, amountWeth);
    }

    function withdrawCollateral(uint256 amountWeth) external nonReentrant {
        require(amountWeth != 0, "ZERO_AMOUNT");
        Position storage position = positions[msg.sender];
        _accrue(position);
        require(position.collateralWeth >= amountWeth, "INSUFFICIENT_COLLATERAL");

        position.collateralWeth -= amountWeth;
        require(_withinBorrowLimit(position.collateralWeth, position.debtUsdc), "BORROW_LIMIT");

        weth.safeTransfer(msg.sender, amountWeth);
        emit CollateralWithdrawn(msg.sender, amountWeth);
    }

    function borrow(uint256 amountUsdc) external nonReentrant {
        require(amountUsdc != 0, "ZERO_AMOUNT");
        Position storage position = positions[msg.sender];
        _accrue(position);

        position.debtUsdc += amountUsdc;
        require(_withinBorrowLimit(position.collateralWeth, position.debtUsdc), "BORROW_LIMIT");

        usdc.safeTransfer(msg.sender, amountUsdc);
        emit Borrowed(msg.sender, amountUsdc);
    }

    function repay(uint256 amountUsdc) external nonReentrant returns (uint256 repaidUsdc) {
        require(amountUsdc != 0, "ZERO_AMOUNT");
        repaidUsdc = _repay(msg.sender, msg.sender, amountUsdc);
    }

    function repayFor(address borrower, uint256 amountUsdc) external nonReentrant returns (uint256 repaidUsdc) {
        require(amountUsdc != 0, "ZERO_AMOUNT");
        require(borrower != address(0), "BORROWER_ZERO");
        repaidUsdc = _repay(borrower, msg.sender, amountUsdc);
    }

    function liquidate(address borrower, uint256 maxRepayUsdc)
        external
        nonReentrant
        returns (uint256 repaidUsdc, uint256 seizedWeth)
    {
        require(borrower != address(0), "BORROWER_ZERO");
        require(maxRepayUsdc != 0, "ZERO_AMOUNT");

        Position storage position = positions[borrower];
        _accrue(position);
        require(_isLiquidatable(position.collateralWeth, position.debtUsdc), "NOT_LIQUIDATABLE");

        uint256 price = _ethUsdPrice();
        uint256 maxRepayForCollateral =
            _wethToUsdc(position.collateralWeth, price).mulDiv(BPS, BPS + LIQUIDATION_BONUS_BPS);

        repaidUsdc = _min(maxRepayUsdc, position.debtUsdc);
        repaidUsdc = _min(repaidUsdc, maxRepayForCollateral);
        require(repaidUsdc != 0, "NO_REPAY");

        seizedWeth = _usdcToWeth(repaidUsdc.mulDiv(BPS + LIQUIDATION_BONUS_BPS, BPS), price);
        require(seizedWeth != 0, "NO_SEIZE");
        require(seizedWeth <= position.collateralWeth, "SEIZE_EXCEEDS_COLLATERAL");

        position.debtUsdc -= repaidUsdc;
        position.collateralWeth -= seizedWeth;

        _pullExact(usdc, msg.sender, repaidUsdc);
        weth.safeTransfer(msg.sender, seizedWeth);

        emit Liquidated(borrower, msg.sender, repaidUsdc, seizedWeth);
    }

    function debtOf(address borrower) external view returns (uint256) {
        Position memory position = positions[borrower];
        return _debtWithInterest(position.debtUsdc, position.lastAccrued);
    }

    function collateralValueUsdc(address borrower) external view returns (uint256) {
        return _wethToUsdc(positions[borrower].collateralWeth, _ethUsdPrice());
    }

    function health(address borrower)
        external
        view
        returns (
            uint256 collateralWeth,
            uint256 collateralValueInUsdc,
            uint256 debtUsdc,
            uint256 ltvBps,
            bool liquidatable
        )
    {
        Position memory position = positions[borrower];
        collateralWeth = position.collateralWeth;
        collateralValueInUsdc = _wethToUsdc(collateralWeth, _ethUsdPrice());
        debtUsdc = _debtWithInterest(position.debtUsdc, position.lastAccrued);
        ltvBps = collateralValueInUsdc == 0
            ? (debtUsdc == 0 ? 0 : type(uint256).max)
            : debtUsdc.mulDiv(BPS, collateralValueInUsdc);
        liquidatable = collateralValueInUsdc == 0
            ? debtUsdc != 0
            : debtUsdc > collateralValueInUsdc.mulDiv(LIQUIDATION_THRESHOLD_BPS, BPS);
    }

    function _repay(address borrower, address payer, uint256 amountUsdc) private returns (uint256 repaidUsdc) {
        Position storage position = positions[borrower];
        _accrue(position);

        repaidUsdc = _min(amountUsdc, position.debtUsdc);
        require(repaidUsdc != 0, "NO_DEBT");

        position.debtUsdc -= repaidUsdc;
        _pullExact(usdc, payer, repaidUsdc);

        emit Repaid(borrower, payer, repaidUsdc);
    }

    function _accrue(Position storage position) private {
        if (position.lastAccrued == 0) {
            position.lastAccrued = block.timestamp;
            return;
        }

        position.debtUsdc = _debtWithInterest(position.debtUsdc, position.lastAccrued);
        position.lastAccrued = block.timestamp;
    }

    function _debtWithInterest(uint256 debtUsdc, uint256 lastAccrued) private view returns (uint256) {
        if (debtUsdc == 0 || lastAccrued == 0 || block.timestamp <= lastAccrued || annualInterestRateWad == 0) {
            return debtUsdc;
        }

        uint256 elapsed = block.timestamp - lastAccrued;
        uint256 interest = debtUsdc.mulDivUp(annualInterestRateWad * elapsed, WAD * YEAR);
        return debtUsdc + interest;
    }

    function _withinBorrowLimit(uint256 collateralWeth, uint256 debtUsdc) private view returns (bool) {
        if (debtUsdc == 0) return true;
        uint256 collateralValue = _wethToUsdc(collateralWeth, _ethUsdPrice());
        return debtUsdc <= collateralValue.mulDiv(MAX_BORROW_BPS, BPS);
    }

    function _isLiquidatable(uint256 collateralWeth, uint256 debtUsdc) private view returns (bool) {
        if (debtUsdc == 0) return false;
        uint256 collateralValue = _wethToUsdc(collateralWeth, _ethUsdPrice());
        return debtUsdc > collateralValue.mulDiv(LIQUIDATION_THRESHOLD_BPS, BPS);
    }

    function _wethToUsdc(uint256 amountWeth, uint256 ethUsdPrice) private view returns (uint256) {
        return amountWeth.mulDiv(ethUsdPrice * USDC_SCALE, WETH_SCALE * (10 ** ethUsdFeedDecimals));
    }

    function _usdcToWeth(uint256 amountUsdc, uint256 ethUsdPrice) private view returns (uint256) {
        return amountUsdc.mulDiv(WETH_SCALE * (10 ** ethUsdFeedDecimals), ethUsdPrice * USDC_SCALE);
    }

    function _ethUsdPrice() private view returns (uint256) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = ethUsdFeed.latestRoundData();
        require(answer > 0, "BAD_PRICE");
        require(updatedAt != 0, "BAD_PRICE_TIME");
        require(updatedAt <= block.timestamp, "BAD_PRICE_TIME");
        require(answeredInRound >= roundId, "STALE_ROUND");
        require(block.timestamp - updatedAt <= ethUsdMaxAge, "STALE_PRICE");
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer);
    }

    function _pullExact(IERC20 token, address from, uint256 amount) private {
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - beforeBalance;
        require(received == amount, "TOKEN_AMOUNT_MISMATCH");
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}
