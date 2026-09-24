// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IChainlinkV3 {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

contract WethUsdcBorrowMarket {
    uint256 public constant BPS = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant USDC_SCALE = 1e6;
    uint256 public constant WETH_SCALE = 1e18;

    uint256 public constant MAX_LTV_BPS = 7_000;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    IERC20 public immutable WETH;
    IERC20 public immutable USDC;
    IChainlinkV3 public immutable ETH_USD_FEED;
    uint8 public immutable ETH_USD_FEED_DECIMALS;
    uint256 public immutable MAX_PRICE_AGE;
    uint256 public immutable ANNUAL_INTEREST_RATE_BPS;

    address public owner;
    uint256 private locked = 1;

    struct Position {
        uint256 collateralWeth;
        uint256 debtUsdc;
        uint64 lastAccrued;
    }

    mapping(address => Position) private positions;

    event OwnerTransferred(address indexed oldOwner, address indexed newOwner);
    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, address indexed payer, uint256 amount);
    event Liquidated(address indexed borrower, address indexed liquidator, uint256 repaidUsdc, uint256 seizedWeth);
    event UsdcReservesWithdrawn(address indexed to, uint256 amount);

    error ZeroAmount();
    error ZeroAddress();
    error InvalidRate();
    error InvalidOracleDecimals();
    error StalePrice();
    error InvalidPrice();
    error TransferFailed();
    error Unauthorized();
    error ReentrantCall();
    error InsufficientCollateral();
    error InsufficientLiquidity();
    error BorrowLimitExceeded();
    error PositionNotLiquidatable();
    error SeizeTooMuchCollateral();

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
        if (msg.sender != owner) revert Unauthorized();
    }

    function _nonReentrantBefore() private {
        if (locked != 1) revert ReentrantCall();
        locked = 2;
    }

    function _nonReentrantAfter() private {
        locked = 1;
    }

    constructor(
        address weth_,
        address usdc_,
        address ethUsdFeed_,
        uint256 annualInterestRateBps_,
        uint256 maxPriceAge_
    ) {
        if (weth_ == address(0) || usdc_ == address(0) || ethUsdFeed_ == address(0)) revert ZeroAddress();
        if (annualInterestRateBps_ > BPS) revert InvalidRate();
        if (maxPriceAge_ == 0) revert ZeroAmount();

        uint8 feedDecimals = IChainlinkV3(ethUsdFeed_).decimals();
        if (feedDecimals > 18) revert InvalidOracleDecimals();

        WETH = IERC20(weth_);
        USDC = IERC20(usdc_);
        ETH_USD_FEED = IChainlinkV3(ethUsdFeed_);
        ETH_USD_FEED_DECIMALS = feedDecimals;
        ANNUAL_INTEREST_RATE_BPS = annualInterestRateBps_;
        MAX_PRICE_AGE = maxPriceAge_;
        owner = msg.sender;

        emit OwnerTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    function depositCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        _accrue(msg.sender);
        positions[msg.sender].collateralWeth += amount;
        _safeTransferFrom(WETH, msg.sender, address(this), amount);

        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        if (position.collateralWeth < amount) revert InsufficientCollateral();

        position.collateralWeth -= amount;
        if (!_withinBorrowLimit(position.collateralWeth, position.debtUsdc)) revert BorrowLimitExceeded();

        _safeTransfer(WETH, msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        uint256 newDebt = position.debtUsdc + amount;
        if (!_withinBorrowLimit(position.collateralWeth, newDebt)) revert BorrowLimitExceeded();
        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        position.debtUsdc = newDebt;
        _safeTransfer(USDC, msg.sender, amount);

        emit Borrowed(msg.sender, amount);
    }

    function repay(uint256 amount) external nonReentrant returns (uint256 repaid) {
        if (amount == 0) revert ZeroAmount();

        _accrue(msg.sender);
        repaid = _repayFor(msg.sender, msg.sender, amount);
    }

    function liquidate(address borrower, uint256 repayAmount) external nonReentrant returns (uint256 repaid, uint256 seizedWeth) {
        if (borrower == address(0)) revert ZeroAddress();
        if (repayAmount == 0) revert ZeroAmount();

        _accrue(borrower);
        Position storage position = positions[borrower];
        if (!_isLiquidatable(position.collateralWeth, position.debtUsdc)) revert PositionNotLiquidatable();

        repaid = repayAmount < position.debtUsdc ? repayAmount : position.debtUsdc;
        seizedWeth = _wethForUsdc(repaid);
        seizedWeth += (seizedWeth * LIQUIDATION_BONUS_BPS) / BPS;
        if (seizedWeth > position.collateralWeth) revert SeizeTooMuchCollateral();

        position.debtUsdc -= repaid;
        position.collateralWeth -= seizedWeth;
        _safeTransferFrom(USDC, msg.sender, address(this), repaid);
        _safeTransfer(WETH, msg.sender, seizedWeth);

        emit Liquidated(borrower, msg.sender, repaid, seizedWeth);
    }

    function withdrawUsdcReserves(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (USDC.balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        _safeTransfer(USDC, to, amount);
        emit UsdcReservesWithdrawn(to, amount);
    }

    function positionOf(address user)
        external
        view
        returns (
            uint256 collateralWeth,
            uint256 debtUsdc,
            uint256 collateralValueInUsdc,
            uint256 maxBorrowUsdc,
            uint256 liquidationDebtUsdc,
            uint256 liquidationHealthBps
        )
    {
        Position memory position = positions[user];
        collateralWeth = position.collateralWeth;
        debtUsdc = _debtWithInterest(position);
        collateralValueInUsdc = _collateralValueUsdc(collateralWeth);
        maxBorrowUsdc = (collateralValueInUsdc * MAX_LTV_BPS) / BPS;
        liquidationDebtUsdc = (collateralValueInUsdc * LIQUIDATION_THRESHOLD_BPS) / BPS;
        liquidationHealthBps = debtUsdc == 0 ? type(uint256).max : (liquidationDebtUsdc * BPS) / debtUsdc;
    }

    function debtOf(address user) external view returns (uint256) {
        return _debtWithInterest(positions[user]);
    }

    function collateralValueUsdc(address user) external view returns (uint256) {
        return _collateralValueUsdc(positions[user].collateralWeth);
    }

    function isLiquidatable(address user) external view returns (bool) {
        Position memory position = positions[user];
        return _isLiquidatable(position.collateralWeth, _debtWithInterest(position));
    }

    function currentEthUsdPrice() external view returns (uint256 price, uint8 decimals) {
        price = _ethUsdPrice();
        decimals = ETH_USD_FEED_DECIMALS;
    }

    function _repayFor(address borrower, address payer, uint256 amount) private returns (uint256 repaid) {
        Position storage position = positions[borrower];
        repaid = amount < position.debtUsdc ? amount : position.debtUsdc;
        if (repaid == 0) revert ZeroAmount();

        position.debtUsdc -= repaid;
        _safeTransferFrom(USDC, payer, address(this), repaid);

        emit Repaid(borrower, payer, repaid);
    }

    function _accrue(address user) private {
        Position storage position = positions[user];
        position.debtUsdc = _debtWithInterest(position);
        position.lastAccrued = uint64(block.timestamp);
    }

    function _debtWithInterest(Position memory position) private view returns (uint256) {
        if (position.debtUsdc == 0) return 0;

        uint256 elapsed = block.timestamp - uint256(position.lastAccrued);
        uint256 interest = (position.debtUsdc * ANNUAL_INTEREST_RATE_BPS * elapsed) / (BPS * SECONDS_PER_YEAR);
        return position.debtUsdc + interest;
    }

    function _withinBorrowLimit(uint256 collateralWeth, uint256 debtUsdc) private view returns (bool) {
        uint256 collateralValue = _collateralValueUsdc(collateralWeth);
        return debtUsdc <= (collateralValue * MAX_LTV_BPS) / BPS;
    }

    function _isLiquidatable(uint256 collateralWeth, uint256 debtUsdc) private view returns (bool) {
        if (debtUsdc == 0) return false;
        uint256 collateralValue = _collateralValueUsdc(collateralWeth);
        return debtUsdc > (collateralValue * LIQUIDATION_THRESHOLD_BPS) / BPS;
    }

    function _collateralValueUsdc(uint256 collateralWeth) private view returns (uint256) {
        uint256 price = _ethUsdPrice();
        return (collateralWeth * price * USDC_SCALE) / (WETH_SCALE * (10 ** ETH_USD_FEED_DECIMALS));
    }

    function _wethForUsdc(uint256 amountUsdc) private view returns (uint256) {
        uint256 price = _ethUsdPrice();
        return (amountUsdc * (10 ** ETH_USD_FEED_DECIMALS) * WETH_SCALE) / (price * USDC_SCALE);
    }

    function _ethUsdPrice() private view returns (uint256) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = ETH_USD_FEED.latestRoundData();
        if (answer <= 0) revert InvalidPrice();
        if (updatedAt == 0 || block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
        if (answeredInRound < roundId) revert StalePrice();
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer);
    }

    function _safeTransfer(IERC20 token, address to, uint256 amount) private {
        (bool success, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) private {
        (bool success, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
