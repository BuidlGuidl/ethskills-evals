// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SaveVault
 * @notice A single-asset savings vault for one arbitrary ERC-20. Depositors receive a transferable
 *         ERC-4626 receipt token ("share") representing a pro-rata claim on the vault's assets.
 *         Yield arrives as more of the same underlying: a keeper transfers tokens into the vault and
 *         anyone calls {syncRewards} to start streaming them to holders.
 *
 * @dev The vault has NO admin, NO pause, NO upgrade path and NO asset-rescue function. Listing is
 *      permissionless, so any privileged role here would be a role held by whoever happened to list
 *      the token — i.e. a rug vector against that vault's depositors. Immutability is the trade-off:
 *      a vault for a broken token cannot be repaired, only abandoned. Each vault is fully isolated,
 *      so a misbehaving token can only damage its own vault.
 *
 * Accounting notes (the two things that make this safe for permissionless listing):
 *
 * 1. `totalAssets()` is NOT `asset.balanceOf(address(this))`. It is an internally tracked
 *    `storedTotalAssets` plus the linearly-vested portion of the last synced reward. A raw token
 *    balance would make the share price a function of anything anyone transfers in, which is exactly
 *    the ERC-4626 donation/inflation attack. Here an unsolicited transfer changes nothing until
 *    {syncRewards} is called, and then it vests over `rewardsCycleLength` rather than landing in one
 *    block. That also removes the sandwich: an MEV bot cannot deposit in front of the keeper and
 *    redeem behind it, because no yield is credited instantaneously.
 *
 * 2. Deposits are credited from the measured balance delta and reverted if it differs from the
 *    requested amount. Fee-on-transfer tokens are therefore rejected at deposit time rather than
 *    silently minting more claim than the vault actually received.
 */
contract SaveVault is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Shares carry this many extra decimals over the underlying, raising the cost of any
    ///         residual rounding/inflation griefing by 10**6. Defence in depth on top of (1) above.
    uint8 private constant DECIMALS_OFFSET = 6;

    /// @notice Bounds on the reward streaming period, chosen at listing time and then immutable.
    uint32 public constant MIN_REWARDS_CYCLE = 1 hours;
    uint32 public constant MAX_REWARDS_CYCLE = 30 days;

    /// @notice Duration over which each synced reward batch vests into `totalAssets()`.
    uint32 public immutable rewardsCycleLength;

    /// @notice Assets credited to depositors: principal plus all fully-vested rewards.
    uint256 public storedTotalAssets;

    /// @notice Size of the reward batch currently vesting.
    uint192 public lastRewardAmount;

    /// @notice Timestamp {syncRewards} last ran.
    uint32 public lastSync;

    /// @notice Timestamp the current reward batch finishes vesting.
    uint32 public rewardsCycleEnd;

    event RewardsSynced(uint256 amount, uint32 cycleStart, uint32 cycleEnd);

    error InvalidRewardsCycle();
    error CycleStillActive();
    error VaultInsolvent();
    error RewardAmountTooLarge();
    error UnexpectedTransferAmount(uint256 requested, uint256 received);
    error ZeroShares();
    error ZeroAssets();

    /**
     * @param asset_ The underlying ERC-20. Must be a contract; must not be fee-on-transfer or rebasing.
     * @param rewardsCycleLength_ Seconds over which each reward batch vests.
     */
    constructor(IERC20 asset_, uint32 rewardsCycleLength_, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
    {
        if (rewardsCycleLength_ < MIN_REWARDS_CYCLE || rewardsCycleLength_ > MAX_REWARDS_CYCLE) {
            revert InvalidRewardsCycle();
        }
        rewardsCycleLength = rewardsCycleLength_;
        lastSync = uint32(block.timestamp);
        rewardsCycleEnd = uint32(block.timestamp);
    }

    /*//////////////////////////////////////////////////////////////
                              ACCOUNTING
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Assets currently backing the outstanding shares.
     * @dev Deliberately independent of `asset.balanceOf(address(this))`. Unsynced transfers and the
     *      not-yet-vested part of the current reward batch are held by the vault but excluded here,
     *      so this value is always <= the real balance and every share is always redeemable.
     */
    function totalAssets() public view override returns (uint256) {
        uint192 lastRewardAmount_ = lastRewardAmount;
        uint32 rewardsCycleEnd_ = rewardsCycleEnd;
        uint32 lastSync_ = lastSync;

        if (block.timestamp >= rewardsCycleEnd_) {
            // Batch fully vested.
            return storedTotalAssets + lastRewardAmount_;
        }

        // rewardsCycleEnd_ > block.timestamp >= lastSync_, so the denominator is non-zero.
        uint256 unlocked = (uint256(lastRewardAmount_) * (block.timestamp - lastSync_)) / (rewardsCycleEnd_ - lastSync_);
        return storedTotalAssets + unlocked;
    }

    /**
     * @notice Fold everything that has vested so far into `storedTotalAssets`.
     * @dev Value-preserving: `totalAssets()` is identical either side of this call. It only moves
     *      already-vested assets out of the streaming bucket and into the principal bucket.
     *
     *      This MUST run before any operation that decrements `storedTotalAssets`. Without it,
     *      `totalAssets()` (principal + vested) can exceed `storedTotalAssets` mid-stream, so a
     *      redemption priced off `totalAssets()` would underflow the subtraction in {_withdraw} and
     *      revert — bricking withdrawals for everyone until the next sync. Checkpointing keeps the
     *      invariant `storedTotalAssets >= totalAssets()` true at the point of use.
     */
    function _checkpointRewards() internal {
        uint192 lastRewardAmount_ = lastRewardAmount;
        uint32 lastSync_ = lastSync;
        uint32 rewardsCycleEnd_ = rewardsCycleEnd;

        if (lastRewardAmount_ == 0) {
            lastSync = uint32(block.timestamp);
            return;
        }

        if (block.timestamp >= rewardsCycleEnd_) {
            // Stream finished: all of it is principal now.
            storedTotalAssets += lastRewardAmount_;
            lastRewardAmount = 0;
        } else {
            // rewardsCycleEnd_ > block.timestamp >= lastSync_, so the denominator is non-zero and
            // `vested` is strictly less than `lastRewardAmount_`.
            uint256 vested =
                (uint256(lastRewardAmount_) * (block.timestamp - lastSync_)) / (rewardsCycleEnd_ - lastSync_);
            storedTotalAssets += vested;
            lastRewardAmount = lastRewardAmount_ - uint192(vested);
        }

        lastSync = uint32(block.timestamp);
    }

    /**
     * @notice Roll any tokens the keeper transferred in into a new vesting cycle.
     * @dev Permissionless and gated on the previous cycle having finished. Calling it late only
     *      delays yield; it can never move yield to a caller of the attacker's choosing.
     */
    function syncRewards() public nonReentrant {
        uint256 timestamp = block.timestamp;
        if (timestamp < rewardsCycleEnd) revert CycleStillActive();

        // Cycle is over, so this folds the whole previous batch into principal.
        _checkpointRewards();

        uint256 accountedFor = storedTotalAssets;
        uint256 balance = IERC20(asset()).balanceOf(address(this));
        // A shortfall means the token moved balance out from under us (rebase/deflation/blocklist
        // clawback). Reverting is correct: the vault is already unable to honour its accounting.
        if (balance < accountedFor) revert VaultInsolvent();

        uint256 nextRewards = balance - accountedFor;
        if (nextRewards > type(uint192).max) revert RewardAmountTooLarge();

        // uint32 timestamps are safe until year 2106; `nextRewards` is bounds-checked above.
        uint32 start = uint32(timestamp);
        uint32 end = start + rewardsCycleLength;
        lastRewardAmount = uint192(nextRewards);
        lastSync = start;
        rewardsCycleEnd = end;

        emit RewardsSynced(nextRewards, start, end);
    }

    /*//////////////////////////////////////////////////////////////
                         DEPOSIT / WITHDRAW HOOKS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Pulls assets, verifies the vault actually received exactly `assets`, then mints.
     *      The balance-delta check rejects fee-on-transfer tokens instead of letting them dilute
     *      existing holders. Accounting is updated before the mint; the pull happens first because
     *      it must in order to measure the delta, which is why every public entry point is guarded.
     */
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        if (shares == 0) revert ZeroShares();

        IERC20 asset_ = IERC20(asset());
        uint256 balanceBefore = asset_.balanceOf(address(this));
        asset_.safeTransferFrom(caller, address(this), assets);
        uint256 received = asset_.balanceOf(address(this)) - balanceBefore;
        if (received != assets) revert UnexpectedTransferAmount(assets, received);

        storedTotalAssets += assets;
        _mint(receiver, shares);

        emit Deposit(caller, receiver, assets, shares);
    }

    /// @dev Checks-effects-interactions: allowance, burn and accounting all settle before the transfer out.
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
    {
        if (assets == 0) revert ZeroAssets();

        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        _burn(owner, shares);
        storedTotalAssets -= assets;

        IERC20(asset()).safeTransfer(receiver, assets);

        emit Withdraw(caller, receiver, owner, assets, shares);
    }

    /*//////////////////////////////////////////////////////////////
                          GUARDED ENTRY POINTS
    //////////////////////////////////////////////////////////////*/

    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
        _checkpointRewards();
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
        _checkpointRewards();
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {
        _checkpointRewards();
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
        _checkpointRewards();
        return super.redeem(shares, receiver, owner);
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return DECIMALS_OFFSET;
    }
}
