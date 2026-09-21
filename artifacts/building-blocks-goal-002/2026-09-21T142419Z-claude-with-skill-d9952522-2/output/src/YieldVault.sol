// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

interface IStrategy {
    function totalValue() external view returns (uint256);
    function invest(uint256 amount) external returns (uint256);
    function harvest() external;
    function withdraw(uint256 fraction, address to) external returns (uint256);
}

/// @title YieldVault
/// @notice USDC vault over one strategy. Deposits are zapped into the strategy immediately and
///         shares are minted for the (TWAP-valued) value actually added, so each depositor pays
///         their own entry swap cost. The keeper's `harvest()` compounds rewards.
/// @dev Not ERC-4626: entries/exits go through swaps, so users pass `minShares` / `minAssetsOut`.
///      Harvest gains unlock linearly to stop deposit/harvest sandwiches.
contract YieldVault is ERC20, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// @dev Virtual shares/assets offset; makes first-depositor inflation attacks unprofitable.
    uint256 private constant VIRTUAL_SHARES = 1e6;
    uint256 private constant VIRTUAL_ASSETS = 1;
    uint256 public constant PROFIT_UNLOCK_TIME = 6 hours;

    IERC20 public immutable asset;
    IStrategy public strategy;
    address public keeper;
    uint256 public depositCap;

    uint256 public lockedProfitAtHarvest;
    uint256 public lastHarvest;

    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event Redeem(address indexed owner, address indexed receiver, uint256 shares, uint256 assetsOut);
    event Harvest(uint256 valueBefore, uint256 valueAfter, uint256 lockedProfit);
    event StrategySet(address strategy);
    event KeeperSet(address keeper);
    event DepositCapSet(uint256 cap);

    error OnlyKeeper();
    error StrategyAlreadySet();
    error ZeroAmount();
    error Slippage(uint256 got, uint256 min);
    error CapExceeded();

    constructor(IERC20 asset_, address owner_, address keeper_, uint256 depositCap_)
        ERC20("Aerodrome USDC-WETH Vault", "yvUSDC-WETH")
        Ownable(owner_)
    {
        asset = asset_;
        keeper = keeper_;
        depositCap = depositCap_;
    }

    /// @dev 6 (USDC) + 6 (virtual offset).
    function decimals() public pure override returns (uint8) {
        return 12;
    }

    // ---------------------------------------------------------------------
    // Accounting
    // ---------------------------------------------------------------------

    /// @notice Strategy value minus the not-yet-unlocked part of the last harvest gain.
    function totalAssets() public view returns (uint256) {
        uint256 value = strategy.totalValue();
        uint256 locked = lockedProfit();
        return value > locked ? value - locked : 0;
    }

    function lockedProfit() public view returns (uint256) {
        uint256 elapsed = block.timestamp - lastHarvest;
        if (elapsed >= PROFIT_UNLOCK_TIME) return 0;
        return lockedProfitAtHarvest * (PROFIT_UNLOCK_TIME - elapsed) / PROFIT_UNLOCK_TIME;
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return Math.mulDiv(assets, totalSupply() + VIRTUAL_SHARES, totalAssets() + VIRTUAL_ASSETS);
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return Math.mulDiv(shares, totalAssets() + VIRTUAL_ASSETS, totalSupply() + VIRTUAL_SHARES);
    }

    // ---------------------------------------------------------------------
    // User
    // ---------------------------------------------------------------------

    function deposit(uint256 assets, address receiver, uint256 minShares)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAmount();
        uint256 valueBefore = strategy.totalValue();
        uint256 locked = lockedProfit();
        uint256 total = valueBefore > locked ? valueBefore - locked : 0;
        if (total + assets > depositCap) revert CapExceeded();

        asset.safeTransferFrom(msg.sender, address(strategy), assets);
        strategy.invest(assets); // reverts if spot has run away from TWAP
        uint256 valueAfter = strategy.totalValue();
        uint256 added = valueAfter > valueBefore ? valueAfter - valueBefore : 0;

        shares = Math.mulDiv(added, totalSupply() + VIRTUAL_SHARES, total + VIRTUAL_ASSETS);
        if (shares == 0 || shares < minShares) revert Slippage(shares, minShares);

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /// @notice Burn `shares` for a pro-rata slice of the strategy, paid in USDC.
    /// @dev Works while paused and in strategy emergency so users can always exit.
    function redeem(uint256 shares, address receiver, uint256 minAssetsOut)
        external
        nonReentrant
        returns (uint256 assetsOut)
    {
        if (shares == 0) revert ZeroAmount();
        uint256 value = strategy.totalValue();
        uint256 assets = convertToAssets(shares);
        // Fraction of every strategy holding owed to this redeemer (excludes locked profit).
        uint256 fraction = Math.min(Math.mulDiv(assets, 1e18, value), 1e18);

        _burn(msg.sender, shares);
        assetsOut = strategy.withdraw(fraction, receiver);
        if (assetsOut < minAssetsOut) revert Slippage(assetsOut, minAssetsOut);
        emit Redeem(msg.sender, receiver, shares, assetsOut);
    }

    // ---------------------------------------------------------------------
    // Keeper
    // ---------------------------------------------------------------------

    /// @notice Claim + sell rewards, reinvest them, lock the realised gain for gradual unlock.
    function harvest() external nonReentrant {
        if (msg.sender != keeper && msg.sender != owner()) revert OnlyKeeper();
        uint256 before = strategy.totalValue();
        strategy.harvest();
        uint256 afterValue = strategy.totalValue();

        uint256 gain = afterValue > before ? afterValue - before : 0;
        lockedProfitAtHarvest = lockedProfit() + gain;
        lastHarvest = block.timestamp;
        emit Harvest(before, afterValue, lockedProfitAtHarvest);
    }

    // ---------------------------------------------------------------------
    // Owner
    // ---------------------------------------------------------------------

    /// @notice One-time wiring (strategy needs the vault address at construction).
    function setStrategy(IStrategy strategy_) external onlyOwner {
        if (address(strategy) != address(0)) revert StrategyAlreadySet();
        strategy = strategy_;
        emit StrategySet(address(strategy_));
    }

    function setKeeper(address keeper_) external onlyOwner {
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    function setDepositCap(uint256 cap) external onlyOwner {
        depositCap = cap;
        emit DepositCapSet(cap);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
