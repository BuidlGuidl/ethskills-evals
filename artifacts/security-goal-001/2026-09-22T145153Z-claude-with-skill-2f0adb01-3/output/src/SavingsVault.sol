// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title SavingsVault
/// @notice Single-asset savings vault. Depositors get a transferable ERC-20 receipt
///         (the vault share) representing a pro-rata claim on the vault's assets.
///         Yield arrives as plain transfers of the underlying into this contract and is
///         recognised linearly over a fixed rewards cycle rather than instantly.
///
/// @dev Design notes (the parts that matter for safety):
///      * No owner, no pause, no fee switch, no upgradeability. Nothing here can take
///        user funds or freeze withdrawals.
///      * One vault holds exactly one token, so a hostile/broken ERC-20 can only ever
///        damage the depositors of its own vault.
///      * Accounting is *stored*, not `balanceOf`-based. Tokens sent in are only counted
///        once `syncRewards()` opens a cycle, and then only as they vest. That removes the
///        "deposit in front of the keeper, withdraw behind it" free-yield sandwich.
///      * Inflation ("first depositor donation") attack is mitigated by a 1e6 virtual
///        share offset plus permanently burned shares minted on the first deposit.
///      * Deposits credit the *measured* balance delta, so fee-on-transfer tokens cannot
///        be used to mint shares against assets that never arrived.
contract SavingsVault is ERC4626, ERC20Permit, ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    /// @dev Virtual shares/assets offset used by ERC-4626 conversions (OZ v5 mitigation).
    uint8 private constant DECIMALS_OFFSET = 6;

    /// @dev Shares burned on the first deposit, on top of the virtual offset.
    uint256 private constant BURNED_SHARES = 1e3;

    /// @dev Minimum shares the first deposit must produce, so the vault can never be
    ///      bootstrapped into a dust-supply state where rounding is meaningful.
    ///      At the 1e6 offset this is 1_000 wei of the underlying, which is negligible for
    ///      any real token but blocks the classic 1-wei bootstrap.
    uint256 private constant MIN_FIRST_DEPOSIT_SHARES = 1e9;

    /// @dev Burn sink: shares sent here are unrecoverable by anyone.
    address private constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /// @notice Length of a rewards vesting cycle, in seconds. Immutable per vault.
    uint256 public immutable rewardsCycleLength;

    /// @notice Assets that are fully accounted for (deposits + already-vested rewards).
    uint256 public storedTotalAssets;

    /// @notice Size of the reward batch currently vesting.
    uint256 public lastRewardAmount;

    /// @notice Start timestamp of the current vesting cycle.
    uint256 public lastSync;

    /// @notice End timestamp of the current vesting cycle.
    uint256 public rewardsCycleEnd;

    event RewardsSynced(uint256 amount, uint256 cycleStart, uint256 cycleEnd);

    error ZeroShares();
    error ZeroAssets();
    error ZeroAddress();
    error FirstDepositTooSmall();
    error AssetNotReceived();
    error UnsupportedDecimals();
    error InvalidCycleLength();
    error CycleNotEnded();

    constructor(IERC20 asset_, string memory name_, string memory symbol_, uint256 rewardsCycleLength_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
        ERC20Permit(name_)
    {
        // decimals() of the share token is underlyingDecimals + DECIMALS_OFFSET and is
        // returned as a uint8; refuse assets whose decimals would overflow or break
        // downstream integrations.
        if (_assetDecimals(address(asset_)) > 36) revert UnsupportedDecimals();
        if (rewardsCycleLength_ == 0) revert InvalidCycleLength();

        rewardsCycleLength = rewardsCycleLength_;
        lastSync = block.timestamp;
        rewardsCycleEnd = block.timestamp;
    }

    /* --------------------------------------------------------------------- */
    /*                              Accounting                               */
    /* --------------------------------------------------------------------- */

    /// @notice Assets currently backing the shares: everything booked, plus the vested
    ///         portion of the reward batch that is still streaming.
    /// @dev Deliberately NOT `asset.balanceOf(address(this))`. Un-synced or unvested
    ///      tokens are invisible to the share price, which is what makes donations and
    ///      keeper transfers non-front-runnable.
    function totalAssets() public view override returns (uint256) {
        uint256 stored_ = storedTotalAssets;
        uint256 reward_ = lastRewardAmount;
        uint256 end_ = rewardsCycleEnd;

        if (block.timestamp >= end_) return stored_ + reward_;

        uint256 start_ = lastSync;
        // end_ > block.timestamp >= start_ here, so the denominator is non-zero.
        return stored_ + reward_.mulDiv(block.timestamp - start_, end_ - start_, Math.Rounding.Floor);
    }

    /// @dev Moves the portion of the vesting batch that has already streamed into the
    ///      booked total, so that `storedTotalAssets == totalAssets()` at this instant.
    ///      Called before every balance-changing operation, which keeps withdrawals from
    ///      having to draw against the not-yet-booked reward batch. Share price is
    ///      unaffected: it only relabels assets that `totalAssets()` already counted.
    function _accrue() private {
        uint256 reward = lastRewardAmount;
        if (reward == 0) return;

        uint256 start = lastSync;
        uint256 end = rewardsCycleEnd;
        uint256 vested;
        if (block.timestamp >= end) {
            vested = reward;
        } else if (block.timestamp > start) {
            vested = reward.mulDiv(block.timestamp - start, end - start, Math.Rounding.Floor);
        } else {
            return;
        }
        if (vested == 0) return;

        storedTotalAssets += vested;
        lastRewardAmount = reward - vested;
        lastSync = block.timestamp;
    }

    /// @notice Assets sitting in the contract that are not yet recognised at all.
    function pendingRewards() public view returns (uint256) {
        uint256 booked = storedTotalAssets + lastRewardAmount;
        uint256 balance = IERC20(asset()).balanceOf(address(this));
        return balance > booked ? balance - booked : 0;
    }

    /// @notice Start a new vesting cycle for whatever the keeper has sent in.
    /// @dev Permissionless on purpose: the vault must not depend on a privileged caller to
    ///      keep paying out. A new cycle can only start once the previous one has finished
    ///      (or was empty), so nobody can repeatedly reset the stream to stall yield.
    function syncRewards() external nonReentrant {
        if (block.timestamp < rewardsCycleEnd && lastRewardAmount != 0) revert CycleNotEnded();
        _accrue();

        // Whatever was vesting is now fully vested and becomes part of the book.
        uint256 booked = storedTotalAssets + lastRewardAmount;
        uint256 balance = IERC20(asset()).balanceOf(address(this));
        uint256 nextRewards = balance > booked ? balance - booked : 0;

        uint256 end = block.timestamp + rewardsCycleLength;

        storedTotalAssets = booked;
        lastRewardAmount = nextRewards;
        lastSync = block.timestamp;
        rewardsCycleEnd = end;

        emit RewardsSynced(nextRewards, block.timestamp, end);
    }

    /* --------------------------------------------------------------------- */
    /*                          Deposit / withdraw                           */
    /* --------------------------------------------------------------------- */

    /// @inheritdoc ERC4626
    /// @dev Shares are computed from the assets actually received, evaluated against the
    ///      share price *before* the transfer. Returns the shares truly minted, which for
    ///      a fee-on-transfer asset is less than `previewDeposit(assets)`.
    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
        if (assets == 0) revert ZeroAssets();
        if (receiver == address(0)) revert ZeroAddress();
        _accrue();

        uint256 totalAssetsBefore = totalAssets();
        uint256 supplyBefore = totalSupply();

        uint256 received = _pullAsset(msg.sender, assets);
        uint256 shares = _convertToSharesAt(received, totalAssetsBefore, supplyBefore, Math.Rounding.Floor);
        if (shares == 0) revert ZeroShares();

        _settleDeposit(receiver, shares, received, supplyBefore);

        emit Deposit(msg.sender, receiver, received, shares);
        return shares;
    }

    /// @inheritdoc ERC4626
    /// @dev Reverts if the asset does not deliver the full quoted amount (fee-on-transfer
    ///      assets must use `deposit`, which is exact-input).
    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0)) revert ZeroAddress();
        _accrue();

        uint256 totalAssetsBefore = totalAssets();
        uint256 supplyBefore = totalSupply();
        uint256 assets = _convertToAssetsAt(shares, totalAssetsBefore, supplyBefore, Math.Rounding.Ceil);
        if (assets == 0) revert ZeroAssets();

        uint256 received = _pullAsset(msg.sender, assets);
        uint256 sharesAffordable =
            _convertToSharesAt(received, totalAssetsBefore, supplyBefore, Math.Rounding.Floor);
        if (sharesAffordable < shares) revert AssetNotReceived();

        _settleDeposit(receiver, shares, received, supplyBefore);

        emit Deposit(msg.sender, receiver, received, shares);
        return assets;
    }

    /// @inheritdoc ERC4626
    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {
        if (assets == 0) revert ZeroAssets();
        if (receiver == address(0)) revert ZeroAddress();
        _accrue();

        uint256 maxAssets = maxWithdraw(owner);
        if (assets > maxAssets) revert ERC4626ExceededMaxWithdraw(owner, assets, maxAssets);

        uint256 shares = previewWithdraw(assets);
        _withdraw(msg.sender, receiver, owner, assets, shares);
        return shares;
    }

    /// @inheritdoc ERC4626
    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0)) revert ZeroAddress();
        _accrue();

        uint256 maxShares = maxRedeem(owner);
        if (shares > maxShares) revert ERC4626ExceededMaxRedeem(owner, shares, maxShares);

        uint256 assets = previewRedeem(shares);
        if (assets == 0) revert ZeroAssets();
        _withdraw(msg.sender, receiver, owner, assets, shares);
        return assets;
    }

    /* --------------------------------------------------------------------- */
    /*                               Internals                               */
    /* --------------------------------------------------------------------- */

    /// @dev Mints shares and books the assets. On the very first deposit a fixed amount of
    ///      shares is minted to a burn address so the vault can never be emptied back down
    ///      to a one-wei share supply.
    function _settleDeposit(address receiver, uint256 shares, uint256 received, uint256 supplyBefore) private {
        storedTotalAssets += received;

        if (supplyBefore == 0) {
            if (shares < MIN_FIRST_DEPOSIT_SHARES) revert FirstDepositTooSmall();
            _mint(BURN_ADDRESS, BURNED_SHARES);
        }

        _mint(receiver, shares);
    }

    /// @dev Burn-then-pay. State is fully updated before the external token call, and the
    ///      whole entry point is `nonReentrant` on top of that.
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
    {
        if (caller != owner) _spendAllowance(owner, caller, shares);

        storedTotalAssets -= assets;
        _burn(owner, shares);

        IERC20(asset()).safeTransfer(receiver, assets);

        emit Withdraw(caller, receiver, owner, assets, shares);
    }

    /// @dev Transfers `assets` in and returns the balance delta actually observed.
    function _pullAsset(address from, uint256 assets) private returns (uint256 received) {
        IERC20 asset_ = IERC20(asset());
        uint256 balanceBefore = asset_.balanceOf(address(this));
        asset_.safeTransferFrom(from, address(this), assets);
        uint256 balanceAfter = asset_.balanceOf(address(this));
        if (balanceAfter <= balanceBefore) revert AssetNotReceived();
        received = balanceAfter - balanceBefore;
    }

    function _convertToSharesAt(uint256 assets, uint256 totalAssets_, uint256 supply_, Math.Rounding rounding)
        private
        pure
        returns (uint256)
    {
        return assets.mulDiv(supply_ + 10 ** DECIMALS_OFFSET, totalAssets_ + 1, rounding);
    }

    function _convertToAssetsAt(uint256 shares, uint256 totalAssets_, uint256 supply_, Math.Rounding rounding)
        private
        pure
        returns (uint256)
    {
        return shares.mulDiv(totalAssets_ + 1, supply_ + 10 ** DECIMALS_OFFSET, rounding);
    }

    function _assetDecimals(address asset_) private view returns (uint256) {
        (bool ok, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
        if (ok && data.length == 32) return abi.decode(data, (uint256));
        return 18;
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return DECIMALS_OFFSET;
    }

    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
        return ERC4626.decimals();
    }
}
