// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {TokenMetadata} from "./libraries/TokenMetadata.sol";

/// @title SaveVault
/// @notice A single-asset savings vault. Depositors receive a transferable ERC-20 receipt token
///         (the "share") representing a pro-rata claim on the vault's assets. Yield is delivered by
///         a keeper simply transferring more of the underlying into this contract.
///
/// @dev Security-relevant design decisions, in the order they matter:
///
///      1. **Accounted assets, not raw balance.** `totalAssets()` is derived from an internal
///         accounting variable, never from `asset.balanceOf(this)` directly. A raw transfer into the
///         vault does *not* immediately change any holder's claim. This is what defends the vault
///         against (a) the first-depositor donation/inflation attack and (b) a keeper payment being
///         sandwiched by a just-in-time deposit.
///
///      2. **Rewards stream linearly.** `syncRewards()` picks up whatever untracked balance has
///         accumulated and releases it over `REWARDS_CYCLE_LENGTH`. Depositing right before a keeper
///         payment therefore captures almost none of it, and a donor cannot move the share price in
///         one block. Deposits and withdrawals stay open the entire time — the stream throttles the
///         *price*, it never locks a user's principal.
///
///      3. **Virtual shares.** Inherited from OpenZeppelin's ERC4626, with a decimals offset, so the
///         residual rounding/inflation edge on an empty vault is economically pointless.
///
///      4. **Untrusted underlying.** Listing is permissionless, so the asset is assumed hostile:
///         `SafeERC20` everywhere, deposits credited from the measured balance delta (fee-on-transfer
///         safe), and every value-moving entry point is `nonReentrant` (ERC-777 / callback tokens).
///
///      5. **No admin.** There is no owner, pauser, upgrade path or rescue function. Each vault is
///         isolated and immutable, so a malicious or broken token can only ever harm the depositors
///         who chose it.
contract SaveVault is ERC4626, ReentrancyGuard {
    using Math for uint256;

    /// @notice Duration over which a batch of keeper rewards is released to share holders.
    uint256 public constant REWARDS_CYCLE_LENGTH = 24 hours;

    /// @dev Virtual-share offset used by the inherited conversion math.
    uint8 private constant DECIMALS_OFFSET = 3;

    /// @dev Cached, non-reverting share decimals (display only).
    uint8 private immutable _shareDecimals;

    /// @notice Assets the vault accounts for, including rewards that are still streaming.
    uint256 public storedTotalAssets;

    /// @notice Size of the reward batch currently streaming.
    uint256 public lastRewardAmount;

    /// @notice Start of the current reward stream.
    uint64 public lastSync;

    /// @notice End of the current reward stream.
    uint64 public rewardsCycleEnd;

    event RewardsSynced(uint256 amount, uint64 cycleStart, uint64 cycleEnd);
    event LossRecognized(uint256 previousAssets, uint256 newAssets);

    error ZeroShares();
    error ZeroAssets();
    error CycleNotEnded(uint64 cycleEnd);
    error UnexpectedAssetAmount(uint256 expected, uint256 received);

    /// @param asset_ The underlying ERC-20. Untrusted.
    constructor(IERC20 asset_)
        ERC4626(asset_)
        ERC20(
            string.concat("Save ", TokenMetadata.safeSymbol(address(asset_))),
            string.concat("sv", TokenMetadata.safeSymbol(address(asset_)))
        )
    {
        uint8 underlying = TokenMetadata.safeDecimals(address(asset_));
        _shareDecimals = underlying + DECIMALS_OFFSET; // safeDecimals caps the underlying at 36
        lastSync = uint64(block.timestamp);
        rewardsCycleEnd = uint64(block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Accounting
    // ---------------------------------------------------------------------

    /// @inheritdoc ERC4626
    /// @dev Everything a holder can claim: accounted assets minus the part of the current reward
    ///      batch that has not vested yet. Deliberately independent of `balanceOf(address(this))`.
    function totalAssets() public view override returns (uint256) {
        return storedTotalAssets - lockedRewards();
    }

    /// @notice Portion of the current reward batch that has not been released to holders yet.
    function lockedRewards() public view returns (uint256) {
        uint256 end = rewardsCycleEnd;
        if (block.timestamp >= end) return 0;

        uint256 start = lastSync;
        uint256 amount = lastRewardAmount;
        // end > start is guaranteed: a cycle is only ever opened as `now + REWARDS_CYCLE_LENGTH`.
        return amount - amount.mulDiv(block.timestamp - start, end - start);
    }

    /// @notice Tokens sitting in the vault that have not been picked up by `syncRewards()` yet.
    function pendingRewards() public view returns (uint256) {
        uint256 balance = IERC20(asset()).balanceOf(address(this));
        uint256 stored = storedTotalAssets;
        return balance > stored ? balance - stored : 0;
    }

    /// @notice Start streaming any untracked balance to share holders over the next cycle.
    /// @dev Permissionless: it can only ever move value *to* existing holders, and it cannot be
    ///      called again until the current stream has fully vested, so it cannot be used to
    ///      indefinitely postpone the release of rewards.
    function syncRewards() external nonReentrant {
        uint64 end = rewardsCycleEnd;
        if (block.timestamp < end) revert CycleNotEnded(end);

        uint256 balance = IERC20(asset()).balanceOf(address(this));
        uint256 stored = storedTotalAssets;

        uint256 nextRewards;
        if (balance >= stored) {
            nextRewards = balance - stored;
        } else {
            // Negative rebase, or the token confiscated part of the vault's balance. Recognize the
            // loss pro-rata rather than letting accounting drift away from reality.
            emit LossRecognized(stored, balance);
        }

        storedTotalAssets = balance;
        lastRewardAmount = nextRewards;
        lastSync = uint64(block.timestamp);
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 newEnd = uint64(block.timestamp + REWARDS_CYCLE_LENGTH); // uint64 seconds: year 5.8e11
        rewardsCycleEnd = newEnd;

        emit RewardsSynced(nextRewards, uint64(block.timestamp), newEnd);
    }

    // ---------------------------------------------------------------------
    // ERC-4626 entry points
    // ---------------------------------------------------------------------

    /// @inheritdoc ERC4626
    /// @dev Shares are minted against the amount of underlying that actually arrived, measured as a
    ///      balance delta, so a fee-on-transfer token cannot mint a claim on assets the vault never
    ///      received. The conversion uses the pre-deposit totals.
    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
        if (assets == 0) revert ZeroAssets();

        uint256 received = _pullAssets(msg.sender, assets);
        uint256 shares = _convertToShares(received, Math.Rounding.Floor);
        if (shares == 0) revert ZeroShares();

        storedTotalAssets += received;
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, received, shares);
        return shares;
    }

    /// @inheritdoc ERC4626
    /// @dev Exact-share entry point. It cannot honour its own quote on a fee-on-transfer token, so
    ///      it reverts on a short transfer; those tokens must use `deposit()`.
    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
        if (shares == 0) revert ZeroShares();

        uint256 assets = previewMint(shares);
        uint256 received = _pullAssets(msg.sender, assets);
        if (received != assets) revert UnexpectedAssetAmount(assets, received);

        storedTotalAssets += assets;
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
        return assets;
    }

    /// @inheritdoc ERC4626
    /// @dev `assets` is the amount leaving the vault. On a fee-on-transfer token the receiver gets
    ///      less than that; the difference is the token's fee, not vault value.
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256)
    {
        if (assets == 0) revert ZeroAssets();

        uint256 maxAssets = maxWithdraw(owner);
        if (assets > maxAssets) revert ERC4626ExceededMaxWithdraw(owner, assets, maxAssets);

        uint256 shares = previewWithdraw(assets); // rounds up, in the vault's favour
        _burnAndSend(msg.sender, receiver, owner, assets, shares);
        return shares;
    }

    /// @inheritdoc ERC4626
    function redeem(uint256 shares, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256)
    {
        if (shares == 0) revert ZeroShares();

        uint256 maxShares = maxRedeem(owner);
        if (shares > maxShares) revert ERC4626ExceededMaxRedeem(owner, shares, maxShares);

        uint256 assets = previewRedeem(shares); // rounds down, in the vault's favour
        if (assets == 0) revert ZeroAssets();

        _burnAndSend(msg.sender, receiver, owner, assets, shares);
        return assets;
    }

    /// @inheritdoc ERC4626
    function decimals() public view override returns (uint8) {
        return _shareDecimals;
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    /// @dev Pulls `assets` from `from` and returns the amount that actually arrived.
    function _pullAssets(address from, uint256 assets) private returns (uint256 received) {
        IERC20 token = IERC20(asset());
        uint256 balanceBefore = token.balanceOf(address(this));
        SafeERC20.safeTransferFrom(token, from, address(this), assets);
        uint256 balanceAfter = token.balanceOf(address(this));

        // A token that shrinks the vault's balance on an incoming transfer is not usable here.
        if (balanceAfter < balanceBefore) revert UnexpectedAssetAmount(assets, 0);
        received = balanceAfter - balanceBefore;
        if (received == 0) revert ZeroAssets();
        // Never credit more than was asked for: an untracked donation sitting in the vault must go
        // through `syncRewards()` and be shared with everyone, not be swept by the next depositor.
        if (received > assets) received = assets;
    }

    /// @dev Checks-effects-interactions: allowance, burn and accounting all happen before the token
    ///      is given a chance to call back in.
    function _burnAndSend(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        private
    {
        if (caller != owner) _spendAllowance(owner, caller, shares);

        _burn(owner, shares);
        // Safe: assets <= totalAssets() = storedTotalAssets - lockedRewards() <= storedTotalAssets.
        storedTotalAssets -= assets;
        SafeERC20.safeTransfer(IERC20(asset()), receiver, assets);

        emit Withdraw(caller, receiver, owner, assets, shares);
    }

    /// @inheritdoc ERC4626
    function _decimalsOffset() internal pure override returns (uint8) {
        return DECIMALS_OFFSET;
    }
}
