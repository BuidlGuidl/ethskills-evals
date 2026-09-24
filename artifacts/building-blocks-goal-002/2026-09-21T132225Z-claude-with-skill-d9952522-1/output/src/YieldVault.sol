// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC4626, ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IStrategy} from "./interfaces/IStrategy.sol";

/// @title YieldVault
/// @notice ERC4626 USDC vault with a single strategy. Deposits sit idle until the keeper's next
///         `harvest()`, which claims rewards, compounds them, and invests idle USDC.
/// @dev    Harvested profit unlocks linearly over `profitUnlockTime` so nobody can deposit right
///         before a harvest and capture yield earned by earlier depositors.
///         Deviation from ERC4626: `redeem` may pay less than `previewRedeem` because the
///         withdrawer pays their own exit swap cost (bounded by strategy slippage limits).
///         `withdraw` reverts instead of paying less.
contract YieldVault is ERC4626, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IStrategy public strategy;
    address public keeper;
    uint256 public depositCap;
    uint256 public profitUnlockTime = 1 days;

    uint256 public lockedProfitAtHarvest;
    uint256 public lastHarvest;

    event StrategySet(address strategy);
    event KeeperSet(address keeper);
    event DepositCapSet(uint256 cap);
    event ProfitUnlockTimeSet(uint256 time);
    event Harvest(uint256 profit, uint256 invested, uint256 totalAssets);

    error NotKeeper();
    error StrategyAlreadySet();
    error BadStrategy();
    error BadParam();
    error WithdrawShortfall(uint256 requested, uint256 available);

    modifier onlyKeeper() {
        if (msg.sender != keeper && msg.sender != owner()) revert NotKeeper();
        _;
    }

    constructor(IERC20 usdc, address owner_, address keeper_, uint256 depositCap_)
        ERC20("Aerodrome USDC-WETH Vault", "aeroUSDC")
        ERC4626(usdc)
        Ownable(owner_)
    {
        keeper = keeper_;
        depositCap = depositCap_;
        emit KeeperSet(keeper_);
        emit DepositCapSet(depositCap_);
    }

    // ---------------------------------------------------------------------
    // Accounting
    // ---------------------------------------------------------------------

    function totalAssets() public view override returns (uint256) {
        uint256 gross = IERC20(asset()).balanceOf(address(this));
        if (address(strategy) != address(0)) gross += strategy.totalAssets();
        uint256 locked = lockedProfit();
        return gross > locked ? gross - locked : 0;
    }

    /// @notice Part of the last harvest's profit not yet reflected in the share price.
    function lockedProfit() public view returns (uint256) {
        uint256 elapsed = block.timestamp - lastHarvest;
        if (elapsed >= profitUnlockTime) return 0;
        return lockedProfitAtHarvest * (profitUnlockTime - elapsed) / profitUnlockTime;
    }

    /// @dev Virtual shares/assets offset against first-depositor inflation attacks.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    // ---------------------------------------------------------------------
    // Deposit limits
    // ---------------------------------------------------------------------

    function maxDeposit(address) public view override returns (uint256) {
        if (paused() || address(strategy) == address(0)) return 0;
        uint256 assets = totalAssets();
        return assets >= depositCap ? 0 : depositCap - assets;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return convertToShares(maxDeposit(receiver));
    }

    // ---------------------------------------------------------------------
    // Exits (always allowed, even when paused)
    // ---------------------------------------------------------------------

    function withdraw(uint256 assets, address receiver, address owner_)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        uint256 maxAssets = maxWithdraw(owner_);
        if (assets > maxAssets) revert ERC4626ExceededMaxWithdraw(owner_, assets, maxAssets);
        shares = previewWithdraw(assets);
        _exit(receiver, owner_, assets, shares, true);
    }

    function redeem(uint256 shares, address receiver, address owner_)
        public
        override
        nonReentrant
        returns (uint256 assets)
    {
        uint256 maxShares = maxRedeem(owner_);
        if (shares > maxShares) revert ERC4626ExceededMaxRedeem(owner_, shares, maxShares);
        assets = _exit(receiver, owner_, previewRedeem(shares), shares, false);
    }

    function _exit(address receiver, address owner_, uint256 assets, uint256 shares, bool exact)
        internal
        returns (uint256)
    {
        if (msg.sender != owner_) _spendAllowance(owner_, msg.sender, shares);

        IERC20 usdc = IERC20(asset());
        uint256 idle = usdc.balanceOf(address(this));
        if (idle < assets) {
            strategy.withdraw(assets - idle);
            idle = usdc.balanceOf(address(this));
        }
        if (idle < assets) {
            if (exact) revert WithdrawShortfall(assets, idle);
            assets = idle;
        }

        _burn(owner_, shares);
        usdc.safeTransfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner_, assets, shares);
        return assets;
    }

    // ---------------------------------------------------------------------
    // Keeper
    // ---------------------------------------------------------------------

    /// @notice Claim + sell rewards, then invest all idle USDC. Profit unlocks over `profitUnlockTime`.
    function harvest() external onlyKeeper nonReentrant returns (uint256 profit) {
        IStrategy s = strategy;
        profit = s.harvest();

        IERC20 usdc = IERC20(asset());
        uint256 idle = usdc.balanceOf(address(this));
        if (idle > 0 && !paused()) usdc.safeTransfer(address(s), idle);
        if (!paused()) s.invest();

        lockedProfitAtHarvest = lockedProfit() + profit;
        lastHarvest = block.timestamp;
        emit Harvest(profit, idle, totalAssets());
    }

    // ---------------------------------------------------------------------
    // Owner
    // ---------------------------------------------------------------------

    function setStrategy(IStrategy s) external onlyOwner {
        if (address(strategy) != address(0)) revert StrategyAlreadySet();
        if (s.asset() != asset()) revert BadStrategy();
        strategy = s;
        emit StrategySet(address(s));
    }

    function setKeeper(address k) external onlyOwner {
        keeper = k;
        emit KeeperSet(k);
    }

    function setDepositCap(uint256 cap) external onlyOwner {
        depositCap = cap;
        emit DepositCapSet(cap);
    }

    function setProfitUnlockTime(uint256 t) external onlyOwner {
        if (t == 0 || t > 7 days) revert BadParam();
        lockedProfitAtHarvest = lockedProfit();
        lastHarvest = block.timestamp;
        profitUnlockTime = t;
        emit ProfitUnlockTimeSet(t);
    }

    /// @notice Pauses deposits and investing. Withdrawals stay open.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
