// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IChainlinkV3Aggregator {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

library SafeTransferLib {
    error TransferFailed();

    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        _call(token, abi.encodeCall(IERC20.transfer, (to, amount)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        _call(token, abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
    }

    function _call(IERC20 token, bytes memory data) private {
        (bool ok, bytes memory returned) = address(token).call(data);
        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) {
            revert TransferFailed();
        }
    }
}

abstract contract ReentrancyGuard {
    error Reentrancy();

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status = _NOT_ENTERED;

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        if (_status == _ENTERED) revert Reentrancy();
        _status = _ENTERED;
    }

    function _nonReentrantAfter() private {
        _status = _NOT_ENTERED;
    }
}

abstract contract Ownable {
    error NotOwner();
    error ZeroAddress();

    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() private view {
        if (msg.sender != owner) revert NotOwner();
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

contract FixedRateWethBorrowMarket is Ownable, ReentrancyGuard {
    using SafeTransferLib for IERC20;

    struct Position {
        uint128 collateralWeth;
        uint128 debtUsdc;
        uint40 lastAccrued;
    }

    uint256 public constant BPS = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant WETH_SCALE = 1e18;
    uint256 public constant USDC_SCALE = 1e6;

    uint256 public constant MAX_BORROW_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_LTV_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    IERC20 public immutable WETH;
    IERC20 public immutable USDC;
    IChainlinkV3Aggregator public immutable ETH_USD_ORACLE;
    uint8 public immutable ORACLE_DECIMALS;
    uint256 public immutable ORACLE_SCALE;
    uint256 public immutable ANNUAL_INTEREST_BPS;
    uint256 public immutable MAX_ORACLE_STALENESS;

    bool public paused;
    uint256 public totalStoredDebtUsdc;

    mapping(address borrower => Position position) public positions;

    event PausedSet(bool paused);
    event MarketFunded(address indexed funder, uint256 amountUsdc);
    event MarketUsdcWithdrawn(address indexed recipient, uint256 amountUsdc);
    event CollateralDeposited(address indexed borrower, uint256 amountWeth);
    event CollateralWithdrawn(address indexed borrower, uint256 amountWeth);
    event Borrowed(address indexed borrower, uint256 amountUsdc);
    event Repaid(address indexed payer, address indexed borrower, uint256 amountUsdc);
    event Liquidated(
        address indexed liquidator, address indexed borrower, uint256 repaidUsdc, uint256 seizedWeth
    );

    error AmountZero();
    error BorrowTooHigh();
    error DebtTooHigh();
    error InsufficientCollateral();
    error InsufficientLiquidity();
    error NotLiquidatable();
    error OracleDecimalsTooHigh();
    error OraclePriceInvalid();
    error OraclePriceStale();
    error Paused();
    error Uint40Overflow();
    error Uint128Overflow();

    constructor(
        address weth_,
        address usdc_,
        address ethUsdOracle_,
        uint256 annualInterestBps_,
        uint256 maxOracleStaleness_,
        address owner_
    ) Ownable(owner_) {
        if (weth_ == address(0) || usdc_ == address(0) || ethUsdOracle_ == address(0)) {
            revert ZeroAddress();
        }
        if (annualInterestBps_ > BPS) revert DebtTooHigh();
        if (maxOracleStaleness_ == 0) revert AmountZero();

        uint8 oracleDecimals_ = IChainlinkV3Aggregator(ethUsdOracle_).decimals();
        if (oracleDecimals_ > 18) revert OracleDecimalsTooHigh();

        WETH = IERC20(weth_);
        USDC = IERC20(usdc_);
        ETH_USD_ORACLE = IChainlinkV3Aggregator(ethUsdOracle_);
        ORACLE_DECIMALS = oracleDecimals_;
        ORACLE_SCALE = 10 ** uint256(oracleDecimals_);
        ANNUAL_INTEREST_BPS = annualInterestBps_;
        MAX_ORACLE_STALENESS = maxOracleStaleness_;
    }

    modifier whenNotPaused() {
        _whenNotPaused();
        _;
    }

    function _whenNotPaused() private view {
        if (paused) revert Paused();
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedSet(paused_);
    }

    function fundMarket(uint256 amountUsdc) external nonReentrant {
        if (amountUsdc == 0) revert AmountZero();
        USDC.safeTransferFrom(msg.sender, address(this), amountUsdc);
        emit MarketFunded(msg.sender, amountUsdc);
    }

    function withdrawMarketUsdc(address recipient, uint256 amountUsdc)
        external
        onlyOwner
        nonReentrant
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (amountUsdc == 0) revert AmountZero();
        USDC.safeTransfer(recipient, amountUsdc);
        emit MarketUsdcWithdrawn(recipient, amountUsdc);
    }

    function depositCollateral(uint256 amountWeth) external nonReentrant whenNotPaused {
        if (amountWeth == 0) revert AmountZero();

        Position storage position = positions[msg.sender];
        _accrue(position);
        uint256 newCollateral = uint256(position.collateralWeth) + amountWeth;
        position.collateralWeth = _toUint128(newCollateral);

        WETH.safeTransferFrom(msg.sender, address(this), amountWeth);
        emit CollateralDeposited(msg.sender, amountWeth);
    }

    function withdrawCollateral(uint256 amountWeth) external nonReentrant whenNotPaused {
        if (amountWeth == 0) revert AmountZero();

        Position storage position = positions[msg.sender];
        _accrue(position);
        if (amountWeth > position.collateralWeth) revert InsufficientCollateral();

        uint256 newCollateral = uint256(position.collateralWeth) - amountWeth;
        _requireWithinBorrowLimit(position.debtUsdc, newCollateral);
        position.collateralWeth = _toUint128(newCollateral);

        WETH.safeTransfer(msg.sender, amountWeth);
        emit CollateralWithdrawn(msg.sender, amountWeth);
    }

    function borrow(uint256 amountUsdc) external nonReentrant whenNotPaused {
        if (amountUsdc == 0) revert AmountZero();
        if (USDC.balanceOf(address(this)) < amountUsdc) revert InsufficientLiquidity();

        Position storage position = positions[msg.sender];
        _accrue(position);
        uint256 newDebt = uint256(position.debtUsdc) + amountUsdc;
        _requireWithinBorrowLimit(newDebt, position.collateralWeth);
        position.debtUsdc = _toUint128(newDebt);
        totalStoredDebtUsdc += amountUsdc;

        USDC.safeTransfer(msg.sender, amountUsdc);
        emit Borrowed(msg.sender, amountUsdc);
    }

    function repay(uint256 maxAmountUsdc) external returns (uint256 repaidUsdc) {
        repaidUsdc = repayFor(msg.sender, maxAmountUsdc);
    }

    function repayFor(address borrower, uint256 maxAmountUsdc)
        public
        nonReentrant
        returns (uint256 repaidUsdc)
    {
        if (borrower == address(0)) revert ZeroAddress();
        if (maxAmountUsdc == 0) revert AmountZero();

        Position storage position = positions[borrower];
        _accrue(position);
        repaidUsdc = _min(maxAmountUsdc, position.debtUsdc);
        if (repaidUsdc == 0) revert AmountZero();

        position.debtUsdc = _toUint128(uint256(position.debtUsdc) - repaidUsdc);
        totalStoredDebtUsdc -= repaidUsdc;

        USDC.safeTransferFrom(msg.sender, address(this), repaidUsdc);
        emit Repaid(msg.sender, borrower, repaidUsdc);
    }

    function liquidate(address borrower, uint256 maxRepayUsdc)
        external
        nonReentrant
        returns (uint256 repaidUsdc, uint256 seizedWeth)
    {
        if (borrower == address(0)) revert ZeroAddress();
        if (maxRepayUsdc == 0) revert AmountZero();

        Position storage position = positions[borrower];
        _accrue(position);
        if (!_isLiquidatable(position.debtUsdc, position.collateralWeth)) revert NotLiquidatable();

        repaidUsdc = _min(maxRepayUsdc, position.debtUsdc);
        seizedWeth = liquidationSeizeAmount(repaidUsdc);
        if (seizedWeth == 0) revert AmountZero();
        if (seizedWeth > position.collateralWeth) revert InsufficientCollateral();

        position.debtUsdc = _toUint128(uint256(position.debtUsdc) - repaidUsdc);
        position.collateralWeth = _toUint128(uint256(position.collateralWeth) - seizedWeth);
        totalStoredDebtUsdc -= repaidUsdc;

        USDC.safeTransferFrom(msg.sender, address(this), repaidUsdc);
        WETH.safeTransfer(msg.sender, seizedWeth);

        emit Liquidated(msg.sender, borrower, repaidUsdc, seizedWeth);
    }

    function currentDebt(address borrower) public view returns (uint256) {
        Position memory position = positions[borrower];
        return _debtWithAccruedInterest(position.debtUsdc, position.lastAccrued);
    }

    function collateralValueUsdc(address borrower) external view returns (uint256) {
        return _collateralValueUsdc(positions[borrower].collateralWeth);
    }

    function positionHealth(address borrower)
        external
        view
        returns (
            uint256 collateralWeth,
            uint256 collateralValueUsdc_,
            uint256 debtUsdc,
            uint256 ltvBps,
            bool liquidatable
        )
    {
        Position memory position = positions[borrower];
        collateralWeth = position.collateralWeth;
        collateralValueUsdc_ = _collateralValueUsdc(collateralWeth);
        debtUsdc = _debtWithAccruedInterest(position.debtUsdc, position.lastAccrued);
        ltvBps = _ltvBps(debtUsdc, collateralValueUsdc_);
        liquidatable = debtUsdc > (collateralValueUsdc_ * LIQUIDATION_LTV_BPS) / BPS;
    }

    function maxBorrowableUsdc(address borrower) external view returns (uint256) {
        Position memory position = positions[borrower];
        uint256 maxDebt = (_collateralValueUsdc(position.collateralWeth) * MAX_BORROW_LTV_BPS) / BPS;
        uint256 debt = _debtWithAccruedInterest(position.debtUsdc, position.lastAccrued);
        return maxDebt > debt ? maxDebt - debt : 0;
    }

    function liquidationSeizeAmount(uint256 repayUsdc) public view returns (uint256) {
        if (repayUsdc == 0) return 0;
        uint256 price = _ethUsdPrice();
        uint256 baseWeth = (repayUsdc * WETH_SCALE * ORACLE_SCALE) / (price * USDC_SCALE);
        return (baseWeth * (BPS + LIQUIDATION_BONUS_BPS)) / BPS;
    }

    function _accrue(Position storage position) private {
        uint256 newDebt = _debtWithAccruedInterest(position.debtUsdc, position.lastAccrued);
        uint256 oldDebt = position.debtUsdc;

        if (newDebt != oldDebt) {
            position.debtUsdc = _toUint128(newDebt);
            totalStoredDebtUsdc += newDebt - oldDebt;
        }
        position.lastAccrued = _toUint40(block.timestamp);
    }

    function _debtWithAccruedInterest(uint256 debtUsdc, uint256 lastAccrued)
        private
        view
        returns (uint256)
    {
        if (debtUsdc == 0) return 0;
        if (lastAccrued == 0 || block.timestamp <= lastAccrued || ANNUAL_INTEREST_BPS == 0) {
            return debtUsdc;
        }

        uint256 elapsed = block.timestamp - lastAccrued;
        uint256 interest = (debtUsdc * ANNUAL_INTEREST_BPS * elapsed) / (BPS * SECONDS_PER_YEAR);
        return debtUsdc + interest;
    }

    function _requireWithinBorrowLimit(uint256 debtUsdc, uint256 collateralWeth) private view {
        uint256 collateralValue = _collateralValueUsdc(collateralWeth);
        if (debtUsdc > (collateralValue * MAX_BORROW_LTV_BPS) / BPS) revert BorrowTooHigh();
    }

    function _isLiquidatable(uint256 debtUsdc, uint256 collateralWeth) private view returns (bool) {
        uint256 collateralValue = _collateralValueUsdc(collateralWeth);
        return debtUsdc > (collateralValue * LIQUIDATION_LTV_BPS) / BPS;
    }

    function _collateralValueUsdc(uint256 collateralWeth) private view returns (uint256) {
        if (collateralWeth == 0) return 0;
        uint256 price = _ethUsdPrice();
        uint256 valueUsdOracleDecimals = (collateralWeth * price) / WETH_SCALE;
        return (valueUsdOracleDecimals * USDC_SCALE) / ORACLE_SCALE;
    }

    function _ethUsdPrice() private view returns (uint256) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) =
            ETH_USD_ORACLE.latestRoundData();
        if (answer <= 0 || answeredInRound < roundId) revert OraclePriceInvalid();
        if (
            updatedAt == 0 || updatedAt > block.timestamp
                || block.timestamp - updatedAt > MAX_ORACLE_STALENESS
        ) {
            revert OraclePriceStale();
        }
        // answer is checked to be positive above.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer);
    }

    function _ltvBps(uint256 debtUsdc, uint256 collateralValueUsdc_)
        private
        pure
        returns (uint256)
    {
        if (debtUsdc == 0) return 0;
        if (collateralValueUsdc_ == 0) return type(uint256).max;
        return (debtUsdc * BPS) / collateralValueUsdc_;
    }

    function _toUint128(uint256 value) private pure returns (uint128) {
        if (value > type(uint128).max) revert Uint128Overflow();
        // value is bounded above.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint128(value);
    }

    function _toUint40(uint256 value) private pure returns (uint40) {
        if (value > type(uint40).max) revert Uint40Overflow();
        // value is bounded above.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint40(value);
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}
