// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";
import {PriceOracle} from "./PriceOracle.sol";
import {CollateralVault} from "./CollateralVault.sol";

/// @notice Overcollateralised USDC lending market. Deployed behind MarketProxy; storage layout is append-only.
contract LendingMarket {
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 internal constant BORROW_TYPEHASH = keccak256("Borrow(address borrower,uint256 amount)");

    uint256 internal constant BPS = 10_000;
    uint256 internal constant WAD = 1e18;
    uint256 internal constant SECONDS_PER_BLOCK = 12;

    bool public initialized;
    address public owner;
    PriceOracle public oracle;
    CollateralVault public vault;
    IERC20 public debtAsset;
    uint256 public liquidationThreshold;
    uint256 public liquidationBonus;
    uint256 public borrowRate;
    uint256 public borrowIndex;
    uint256 public lastAccrualBlock;
    address[] public collateralTokens;
    mapping(address => bool) public isCollateral;
    mapping(address => uint256) public principalOf;
    address[] public borrowers;
    bytes32 public domainSeparator;

    error AlreadyInitialized();
    error NotOwner();
    error NotCollateral(address token);
    error BadSignature();
    error Unhealthy();
    error Healthy();
    error NothingBorrowed();

    event Initialized(address indexed owner);
    event Upgraded(address indexed implementation);
    event OracleUpdated(address indexed oracle);
    event LiquidationThresholdUpdated(uint256 bps);
    event BorrowRateUpdated(uint256 bps);
    event CollateralListed(address indexed token);
    event Borrowed(address indexed borrower, uint256 amount);
    event Repaid(address indexed borrower, address indexed payer, uint256 amount);
    event Liquidated(address indexed borrower, address indexed liquidator, uint256 debtRepaid);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function initialize(address owner_, PriceOracle oracle_, CollateralVault vault_, IERC20 debtAsset_) external {
        if (initialized) revert AlreadyInitialized();
        initialized = true;

        owner = owner_;
        oracle = oracle_;
        vault = vault_;
        debtAsset = debtAsset_;

        liquidationThreshold = 8_000;
        liquidationBonus = 500;
        borrowRate = 400;
        borrowIndex = WAD;
        lastAccrualBlock = block.number;

        domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("ArbiLend"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );

        emit Initialized(owner_);
    }

    function upgradeTo(address newImplementation) external {
        assembly {
            sstore(IMPLEMENTATION_SLOT, newImplementation)
        }
        emit Upgraded(newImplementation);
    }

    function setOracle(PriceOracle newOracle) external {
        oracle = newOracle;
        emit OracleUpdated(address(newOracle));
    }

    function setLiquidationThreshold(uint256 bps) external {
        liquidationThreshold = bps;
        emit LiquidationThresholdUpdated(bps);
    }

    function setBorrowRate(uint256 bps) external onlyOwner {
        accrueInterest();
        borrowRate = bps;
        emit BorrowRateUpdated(bps);
    }

    function listCollateral(address token) external onlyOwner {
        if (!isCollateral[token]) {
            isCollateral[token] = true;
            collateralTokens.push(token);
            vault.setSupported(token, true);
            emit CollateralListed(token);
        }
    }

    /// @notice Advances the borrow index by the interest owed since the last accrual.
    function accrueInterest() public {
        uint256 blocksElapsed = block.number - lastAccrualBlock;
        if (blocksElapsed == 0) return;

        uint256 secondsElapsed = blocksElapsed * SECONDS_PER_BLOCK;
        uint256 growth = borrowIndex * borrowRate * secondsElapsed / (BPS * 365 days);

        borrowIndex += growth;
        lastAccrualBlock = block.number;
    }

    function debtOf(address user) public view returns (uint256) {
        return principalOf[user] * borrowIndex / WAD;
    }

    function collateralValueUsd(address user) public view returns (uint256 total) {
        for (uint256 i = 0; i < collateralTokens.length; i++) {
            address token = collateralTokens[i];
            uint256 amount = vault.balanceOf(user, token);
            if (amount == 0) continue;
            total += amount * oracle.getPrice(token) / 10 ** IERC20(token).decimals();
        }
    }

    function debtValueUsd(address user) public view returns (uint256) {
        return debtOf(user) * oracle.getPrice(address(debtAsset)) / 10 ** debtAsset.decimals();
    }

    /// @notice Health factor scaled to 1e18. Below 1e18 the position can be liquidated.
    function healthFactor(address user) public view returns (uint256) {
        uint256 debtUsd = debtValueUsd(user);
        if (debtUsd == 0) return type(uint256).max;

        return (collateralValueUsd(user) / debtUsd) * liquidationThreshold * WAD / BPS;
    }

    function requireHealthy(address user) external view {
        if (healthFactor(user) < WAD) revert Unhealthy();
    }

    function borrow(uint256 amount) external {
        _borrow(msg.sender, amount);
    }

    /// @notice Borrow on behalf of a signer who authorised the amount off-chain.
    function borrowWithSig(address borrower, uint256 amount, uint8 v, bytes32 r, bytes32 s) external {
        bytes32 structHash = keccak256(abi.encode(BORROW_TYPEHASH, borrower, amount));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        if (ecrecover(digest, v, r, s) != borrower) revert BadSignature();

        _borrow(borrower, amount);
    }

    function repay(address onBehalfOf, uint256 amount) external {
        accrueInterest();

        uint256 debt = debtOf(onBehalfOf);
        if (debt == 0) revert NothingBorrowed();
        if (amount > debt) amount = debt;

        debtAsset.transferFrom(msg.sender, address(this), amount);
        principalOf[onBehalfOf] -= amount * WAD / borrowIndex;

        emit Repaid(onBehalfOf, msg.sender, amount);
    }

    function liquidate(address user) external {
        accrueInterest();
        if (healthFactor(user) >= WAD) revert Healthy();
        _liquidate(user);
    }

    /// @notice Sweeps every underwater position in one call. Run by the keeper after a large price move.
    function liquidateAll() external {
        accrueInterest();
        for (uint256 i = 0; i < borrowers.length; i++) {
            if (healthFactor(borrowers[i]) < WAD) _liquidate(borrowers[i]);
        }
    }

    function _borrow(address borrower, uint256 amount) internal {
        accrueInterest();

        if (principalOf[borrower] == 0) borrowers.push(borrower);
        principalOf[borrower] += amount * WAD / borrowIndex;

        if (healthFactor(borrower) < WAD) revert Unhealthy();
        debtAsset.transfer(borrower, amount);

        emit Borrowed(borrower, amount);
    }

    function _liquidate(address user) internal {
        uint256 debt = debtOf(user);
        if (debt == 0) return;

        debtAsset.transferFrom(msg.sender, address(this), debt);
        principalOf[user] = 0;

        uint256 seizeUsd = debt * oracle.getPrice(address(debtAsset)) / 10 ** debtAsset.decimals();
        seizeUsd = seizeUsd * (BPS + liquidationBonus) / BPS;

        for (uint256 i = 0; i < collateralTokens.length && seizeUsd > 0; i++) {
            address token = collateralTokens[i];
            uint256 amount = vault.balanceOf(user, token);
            if (amount == 0) continue;

            uint256 price = oracle.getPrice(token);
            uint256 unit = 10 ** IERC20(token).decimals();
            uint256 valueUsd = amount * price / unit;
            uint256 takeUsd = valueUsd < seizeUsd ? valueUsd : seizeUsd;

            vault.seize(user, token, msg.sender, takeUsd * unit / price);
            seizeUsd -= takeUsd;
        }

        emit Liquidated(user, msg.sender, debt);
    }
}
