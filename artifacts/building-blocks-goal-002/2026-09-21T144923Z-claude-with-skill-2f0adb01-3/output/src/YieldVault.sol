// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20, ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IStrategy} from "./interfaces/IStrategy.sol";

/// @title YieldVault
/// @notice ERC-4626 USDC vault with a single strategy.
/// @dev - Deposits sit idle until the keeper calls harvest(), which pushes them into the strategy.
///      - Harvest profit unlocks linearly over `profitUnlockTime` so nobody can deposit right before a
///        harvest and withdraw right after to capture it.
///      - Withdrawals unwind a pro-rata slice of idle USDC + strategy positions; the exiting user bears
///        their own unwind cost (swap fee/slippage). previewRedeem/previewWithdraw include a
///        `withdrawSlippageBps` haircut so they stay a lower bound on what redeem actually pays out.
contract YieldVault is ERC4626, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    uint256 internal constant BPS = 10_000;
    uint256 internal constant MAX_WITHDRAW_SLIPPAGE_BPS = 500;
    uint256 internal constant MAX_UNLOCK_TIME = 7 days;

    IStrategy public strategy;
    address public keeper;
    bool public isShutdown;

    /// @notice Max total assets accepted (guarded launch).
    uint256 public depositCap;
    uint256 public withdrawSlippageBps = 100;
    uint256 public profitUnlockTime = 6 hours;

    uint256 public lockedProfitAtHarvest;
    uint256 public lastHarvest;

    event StrategySet(address strategy);
    event KeeperSet(address keeper);
    event DepositCapSet(uint256 cap);
    event WithdrawSlippageSet(uint256 bps);
    event ProfitUnlockTimeSet(uint256 time);
    event Harvest(uint256 profit, uint256 invested, uint256 totalAssets);
    event Shutdown(uint256 assetsRecovered);

    error OnlyKeeper();
    error BadStrategy();
    error BadParam();
    error IsShutdown();
    error InsufficientOutput(uint256 got, uint256 min);

    modifier onlyKeeper() {
        if (msg.sender != keeper && msg.sender != owner()) revert OnlyKeeper();
        _;
    }

    constructor(IERC20 usdc, address owner_, address keeper_, uint256 depositCap_)
        ERC20("Aero USDC-WETH Yield Vault", "yvUSDC-AERO")
        ERC4626(usdc)
        Ownable(owner_)
    {
        keeper = keeper_;
        depositCap = depositCap_;
    }

    // ------------------------------------------------------------ accounting

    /// @notice Assets backing shares = idle + strategy value - still-locked harvest profit.
    function totalAssets() public view override returns (uint256) {
        uint256 raw = _rawTotalAssets();
        uint256 locked = lockedProfit();
        return raw > locked ? raw - locked : 0;
    }

    function lockedProfit() public view returns (uint256) {
        uint256 end = lastHarvest + profitUnlockTime;
        if (block.timestamp >= end) return 0;
        return lockedProfitAtHarvest.mulDiv(end - block.timestamp, profitUnlockTime);
    }

    function _rawTotalAssets() internal view returns (uint256) {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        return address(strategy) == address(0) ? idle : idle + strategy.totalAssets();
    }

    /// @dev Virtual shares/assets offset — makes first-depositor inflation attacks unprofitable.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    // ------------------------------------------------------------ limits

    function maxDeposit(address) public view override returns (uint256) {
        if (isShutdown || address(strategy) == address(0)) return 0;
        uint256 assets = totalAssets();
        return depositCap > assets ? depositCap - assets : 0;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return _convertToShares(maxDeposit(receiver), Math.Rounding.Floor);
    }

    function maxWithdraw(address owner_) public view override returns (uint256) {
        return previewRedeem(balanceOf(owner_));
    }

    /// @notice Lower bound on assets redeem() pays (fair value minus max unwind cost).
    function previewRedeem(uint256 shares) public view override returns (uint256) {
        return _haircut(_convertToAssets(shares, Math.Rounding.Floor));
    }

    function previewWithdraw(uint256 assets) public view override returns (uint256) {
        uint256 grossAssets = assets.mulDiv(BPS, BPS - withdrawSlippageBps, Math.Rounding.Ceil);
        return _convertToShares(grossAssets, Math.Rounding.Ceil);
    }

    // ------------------------------------------------------------ user entry points

    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
        return super.mint(shares, receiver);
    }

    /// @notice Burns `shares` and pays the realised USDC from unwinding their slice (>= previewRedeem).
    function redeem(uint256 shares, address receiver, address owner_) public override nonReentrant returns (uint256) {
        uint256 maxShares = maxRedeem(owner_);
        if (shares > maxShares) revert ERC4626ExceededMaxRedeem(owner_, shares, maxShares);

        uint256 minOut = previewRedeem(shares);
        uint256 payout = _exit(owner_, shares);
        if (payout < minOut) revert InsufficientOutput(payout, minOut);

        IERC20(asset()).safeTransfer(receiver, payout);
        emit Withdraw(msg.sender, receiver, owner_, payout, shares);
        return payout;
    }

    /// @notice Pays exactly `assets`; burns enough shares to cover worst-case unwind cost.
    ///         Any surplus from a better-than-worst-case unwind stays in the vault for remaining holders.
    function withdraw(uint256 assets, address receiver, address owner_) public override nonReentrant returns (uint256) {
        uint256 maxAssets = maxWithdraw(owner_);
        if (assets > maxAssets) revert ERC4626ExceededMaxWithdraw(owner_, assets, maxAssets);

        uint256 shares = previewWithdraw(assets);
        uint256 payout = _exit(owner_, shares);
        if (payout < assets) revert InsufficientOutput(payout, assets);

        IERC20(asset()).safeTransfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner_, assets, shares);
        return shares;
    }

    /// @dev Burns shares and pulls their pro-rata slice (by value) of idle USDC + strategy into this contract.
    function _exit(address owner_, uint256 shares) internal returns (uint256 payout) {
        if (msg.sender != owner_) _spendAllowance(owner_, msg.sender, shares);

        uint256 value = _convertToAssets(shares, Math.Rounding.Floor);
        uint256 raw = _rawTotalAssets();
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        _burn(owner_, shares);
        if (value == 0 || raw == 0) return 0;

        payout = idle.mulDiv(value, raw);
        if (address(strategy) != address(0)) payout += strategy.withdraw(value, raw);
    }

    // ------------------------------------------------------------ keeper

    /// @notice Claim + compound strategy rewards and invest idle deposits.
    /// @param minUsdcFromRewards floor for the AERO -> USDC sale, computed off-chain by the keeper.
    function harvest(uint256 minUsdcFromRewards) external onlyKeeper nonReentrant returns (uint256 profit) {
        if (isShutdown) revert IsShutdown();
        IStrategy strat = strategy;
        if (address(strat) == address(0)) revert BadStrategy();

        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle > 0) IERC20(asset()).safeTransfer(address(strat), idle);
        profit = strat.harvest(minUsdcFromRewards);

        lockedProfitAtHarvest = lockedProfit() + profit;
        lastHarvest = block.timestamp;
        emit Harvest(profit, idle, totalAssets());
    }

    // ------------------------------------------------------------ admin

    /// @notice One-time strategy wiring (strategy is deployed after the vault because it needs the vault address).
    function setStrategy(IStrategy strategy_) external onlyOwner {
        if (address(strategy) != address(0)) revert BadStrategy();
        if (strategy_.vault() != address(this) || strategy_.asset() != asset()) revert BadStrategy();
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

    function setWithdrawSlippageBps(uint256 bps) external onlyOwner {
        if (bps > MAX_WITHDRAW_SLIPPAGE_BPS) revert BadParam();
        withdrawSlippageBps = bps;
        emit WithdrawSlippageSet(bps);
    }

    function setProfitUnlockTime(uint256 time) external onlyOwner {
        if (time == 0 || time > MAX_UNLOCK_TIME) revert BadParam();
        // Freeze what is currently locked into a fresh schedule so the change is not retroactive.
        lockedProfitAtHarvest = lockedProfit();
        lastHarvest = block.timestamp;
        profitUnlockTime = time;
        emit ProfitUnlockTimeSet(time);
    }

    /// @notice Emergency: unwind the strategy to USDC and stop deposits/harvests. Withdrawals stay open and
    ///         no longer need the oracle. `minAssetsOut` is set by the owner since the oracle may be broken.
    function shutdown(uint256 minAssetsOut) external onlyOwner nonReentrant {
        isShutdown = true;
        uint256 recovered;
        if (address(strategy) != address(0)) recovered = strategy.exitAll(minAssetsOut);
        emit Shutdown(recovered);
    }

    function _haircut(uint256 assets) internal view returns (uint256) {
        return assets.mulDiv(BPS - withdrawSlippageBps, BPS);
    }
}
