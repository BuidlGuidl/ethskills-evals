// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IStrategy} from "./interfaces/IStrategy.sol";

/// @title YieldVault
/// @notice ERC-4626 USDC vault. Deposits are forwarded to a single strategy as idle USDC;
///         the keeper deploys them into liquidity on harvest(). Withdrawals pull USDC back from
///         the strategy, and any exit cost (swap fee / slippage) is borne by the withdrawer, capped by maxLossBps.
///         `redeem` returns the USDC actually paid; `withdraw` may pay slightly less than requested.
contract YieldVault is ERC4626, Ownable {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;
    uint256 public constant MAX_LOSS_LIMIT_BPS = 1_000;

    IStrategy public strategy;
    uint256 public depositCap;
    uint256 public maxLossBps = 100;

    event StrategySet(address indexed strategy);
    event DepositCapSet(uint256 cap);
    event MaxLossSet(uint256 bps);

    error StrategyAlreadySet();
    error StrategyVaultMismatch();
    error MaxLossTooHigh();
    error WithdrawLossTooHigh(uint256 requested, uint256 available);

    constructor(IERC20 usdc, address owner_, uint256 depositCap_)
        ERC20("Base USDC-WETH Yield Vault", "yvUSDC-WETH")
        ERC4626(usdc)
        Ownable(owner_)
    {
        depositCap = depositCap_;
    }

    // ---------------------------------------------------------------- admin

    /// @notice One-time wiring of the strategy (it needs the vault address at construction).
    function setStrategy(IStrategy strategy_) external onlyOwner {
        if (address(strategy) != address(0)) revert StrategyAlreadySet();
        if (strategy_.vault() != address(this)) revert StrategyVaultMismatch();
        strategy = strategy_;
        emit StrategySet(address(strategy_));
    }

    function setDepositCap(uint256 cap) external onlyOwner {
        depositCap = cap;
        emit DepositCapSet(cap);
    }

    function setMaxLossBps(uint256 bps) external onlyOwner {
        if (bps > MAX_LOSS_LIMIT_BPS) revert MaxLossTooHigh();
        maxLossBps = bps;
        emit MaxLossSet(bps);
    }

    // ---------------------------------------------------------------- ERC-4626

    function totalAssets() public view override returns (uint256) {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        return address(strategy) == address(0) ? idle : idle + strategy.totalAssets();
    }

    function maxDeposit(address) public view override returns (uint256) {
        uint256 assets = totalAssets();
        return assets >= depositCap ? 0 : depositCap - assets;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return convertToShares(maxDeposit(receiver));
    }

    /// @dev Virtual shares/assets offset (OpenZeppelin) against first-depositor inflation attacks.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        super._deposit(caller, receiver, assets, shares);
        // Park funds in the strategy as idle USDC. No swaps in the user tx, so nothing to sandwich.
        if (address(strategy) != address(0)) {
            IERC20(asset()).safeTransfer(address(strategy), assets);
        }
    }

    /// @dev Same as OZ, but the receiver gets what was actually freed (see _pullAssets).
    function withdraw(uint256 assets, address receiver, address owner_) public override returns (uint256 shares) {
        uint256 maxAssets = maxWithdraw(owner_);
        if (assets > maxAssets) revert ERC4626ExceededMaxWithdraw(owner_, assets, maxAssets);
        shares = previewWithdraw(assets);
        _withdraw(_msgSender(), receiver, owner_, _pullAssets(assets), shares);
    }

    /// @dev Same as OZ, but returns the assets actually paid out.
    function redeem(uint256 shares, address receiver, address owner_) public override returns (uint256 assets) {
        uint256 maxShares = maxRedeem(owner_);
        if (shares > maxShares) revert ERC4626ExceededMaxRedeem(owner_, shares, maxShares);
        assets = _pullAssets(previewRedeem(shares));
        _withdraw(_msgSender(), receiver, owner_, assets, shares);
    }

    /// @dev Makes `assets` USDC available in the vault, unwinding strategy liquidity if needed.
    ///      Exit cost (swap fee/slippage) goes to the withdrawer, not remaining holders, capped by maxLossBps.
    function _pullAssets(uint256 assets) internal returns (uint256) {
        IERC20 usdc = IERC20(asset());
        uint256 idle = usdc.balanceOf(address(this));
        if (idle >= assets) return assets;
        strategy.withdraw(assets - idle);
        idle = usdc.balanceOf(address(this));
        if (idle >= assets) return assets;
        if (assets - idle > assets * maxLossBps / BPS) revert WithdrawLossTooHigh(assets, idle);
        return idle;
    }
}
