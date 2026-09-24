// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title SavingsVault
 * @notice A single-asset, ungoverned savings vault. Depositors get a transferable
 *         ERC-4626 receipt token representing a pro-rata claim on the vault's balance.
 *         Yield arrives as a plain ERC-20 transfer of the underlying into this address
 *         (the keeper). New underlying is recognised as profit and released to holders
 *         linearly over `VESTING_PERIOD` instead of all at once.
 *
 * @dev Design constraints that drive this implementation:
 *
 *      1. Listing is permissionless, so the underlying token is UNTRUSTED. Every vault
 *         is a separate contract holding exactly one token: a malicious or broken token
 *         can only ever harm the depositors of its own vault. There is no shared pool,
 *         no shared approval, and no cross-vault state.
 *
 *      2. There is no owner, no pause, no fee, no upgrade path. Nobody — including the
 *         deployer — can move a depositor's funds or stop them withdrawing.
 *
 *      3. Yield arrives by donation, so `totalAssets()` must be balance-derived. That is
 *         exactly the precondition for the ERC-4626 inflation attack, so the vault uses
 *         both a virtual-share offset and a permanently burned dead-share tranche.
 *
 *      4. Balance-derived accounting plus instant withdrawals is also the precondition
 *         for yield sniping (deposit in front of the keeper, withdraw behind it). The
 *         linear vesting of incoming profit is what removes that edge.
 *
 *      5. Deposits measure the actual balance delta, so fee-on-transfer tokens are
 *         accounted correctly rather than over-crediting the depositor.
 */
contract SavingsVault is ERC4626, ERC20Permit, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    /// @notice Window over which newly received underlying is released to share holders.
    uint256 public constant VESTING_PERIOD = 24 hours;

    /// @notice Shares permanently burned on the first deposit (anti-inflation floor).
    uint256 public constant DEAD_SHARES = 1e3;

    /// @notice Sink for the dead shares. `_mint` rejects address(0), so use the burn address.
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /// @dev Extra decimals on the share token. 10**3 virtual shares back every real share.
    uint8 private constant DECIMALS_OFFSET = 3;

    IERC20 private immutable _underlying;

    /// @dev Underlying the vault has accounted for. Diverges from `balanceOf(this)` only
    ///      between an inbound transfer and the next `_sync()`.
    uint256 private _trackedAssets;

    /// @dev Profit still locked at `_vestingStart`, released linearly over `_vestingPeriod`.
    uint256 private _vestingAmount;
    uint64 private _vestingStart;
    uint64 private _vestingPeriod;

    event Sync(uint256 trackedAssets, uint256 lockedProfit, uint256 vestingPeriod);

    error ZeroAmount();
    error InvalidReceiver();
    error NothingReceived();
    error SlippageExceeded(uint256 actual, uint256 limit);
    error InsufficientSeedDeposit(uint256 shares, uint256 required);
    error FeeOnTransferNotSupportedByMint();

    constructor(IERC20 underlying_, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
        ERC4626(underlying_)
    {
        _underlying = underlying_;
    }

    // ---------------------------------------------------------------------
    // Accounting
    // ---------------------------------------------------------------------

    /**
     * @notice Underlying currently claimable by share holders.
     * @dev Real balance minus the profit that has not vested yet. This is a pure view of
     *      what `_sync()` would produce, so previews and execution never disagree.
     */
    function totalAssets() public view override returns (uint256) {
        (uint256 balance, uint256 locked,,) = _projectedState();
        return balance - locked;
    }

    /// @notice Profit received but not yet released to share holders.
    function lockedProfit() external view returns (uint256) {
        (, uint256 locked,,) = _projectedState();
        return locked;
    }

    /// @notice Underlying the vault has accounted for (claimable + still vesting).
    function trackedAssets() external view returns (uint256) {
        return _trackedAssets;
    }

    /// @notice Timestamp at which all currently-known profit is fully released.
    function vestingEnd() external view returns (uint256) {
        return uint256(_vestingStart) + uint256(_vestingPeriod);
    }

    /**
     * @notice Recognise underlying that was transferred in directly (keeper yield, or any
     *         stray donation) and start vesting it.
     * @dev Permissionless and never required: every deposit/withdraw path syncs first.
     *      Exposed so a keeper can start the vesting clock in the same tx as its transfer.
     */
    function sync() external nonReentrant {
        _sync();
    }

    /// @dev Current locked profit given the stored vesting schedule. Rounded up (conservative).
    function _lockedNow() private view returns (uint256 locked, uint256 remainingTime) {
        uint256 amount = _vestingAmount;
        if (amount == 0) return (0, 0);
        uint256 period = _vestingPeriod;
        uint256 elapsed = block.timestamp - _vestingStart;
        if (period == 0 || elapsed >= period) return (0, 0);
        remainingTime = period - elapsed;
        locked = amount.mulDiv(remainingTime, period, Math.Rounding.Ceil);
    }

    /**
     * @dev Computes the vesting state the vault *would* hold after syncing to its real
     *      balance, without writing. Single source of truth shared by `totalAssets()`
     *      (view path) and `_sync()` (write path).
     */
    function _projectedState() private view returns (uint256 balance, uint256 locked, uint256 period, bool changed) {
        balance = _underlying.balanceOf(address(this));
        uint256 tracked = _trackedAssets;
        (uint256 remaining, uint256 remainingTime) = _lockedNow();

        if (balance > tracked) {
            // New underlying arrived. Blend it into the existing unlock schedule using a
            // value-weighted period, so dusting the vault cannot stretch the unlock of
            // profit that is already vesting.
            uint256 gain = balance - tracked;
            locked = remaining + gain;
            period = remaining.mulDiv(remainingTime, locked) + gain.mulDiv(VESTING_PERIOD, locked);
            changed = true;
        } else if (balance < tracked) {
            // Underlying left without going through withdraw (negative rebase, token-side
            // burn, blocklist seizure). Absorb it into locked profit first, then into the
            // share price. Keep the existing unlock schedule rather than restarting it.
            uint256 loss = tracked - balance;
            locked = remaining > loss ? remaining - loss : 0;
            period = remainingTime;
            changed = true;
        } else {
            locked = remaining;
            period = remainingTime;
        }

        // `locked` can never exceed what the vault actually holds.
        if (locked > balance) locked = balance;
        if (locked == 0) period = 0;
    }

    /// @dev Folds any balance change into the vesting schedule.
    function _sync() private {
        (uint256 balance, uint256 locked, uint256 period, bool changed) = _projectedState();
        if (!changed) return;
        _trackedAssets = balance;
        _vestingAmount = locked;
        _vestingStart = uint64(block.timestamp);
        // `period` is a weighted average of prior remaining time and VESTING_PERIOD, so it
        // is bounded by VESTING_PERIOD (24h) and always fits in uint64.
        // forge-lint: disable-next-line(unsafe-typecast)
        _vestingPeriod = uint64(period);
        emit Sync(balance, locked, period);
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return DECIMALS_OFFSET;
    }

    // ---------------------------------------------------------------------
    // Deposit / mint
    // ---------------------------------------------------------------------

    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
        return _depositAssets(assets, receiver, 0);
    }

    /**
     * @notice Deposit with an explicit floor on shares received.
     * @dev Use this from anything automated. The share price moves with every keeper
     *      transfer, and fee-on-transfer tokens credit less than `assets`.
     */
    function deposit(uint256 assets, address receiver, uint256 minSharesOut) external nonReentrant returns (uint256) {
        return _depositAssets(assets, receiver, minSharesOut);
    }

    function _depositAssets(uint256 assets, address receiver, uint256 minSharesOut) private returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        _checkReceiver(receiver);
        _sync();

        // Snapshot before the pull: after it, the incoming tokens are indistinguishable
        // from a keeper donation and would otherwise be priced into the depositor's own
        // share count.
        uint256 supplyBefore = totalSupply();
        uint256 assetsBefore = totalAssets();

        uint256 received = _pull(assets);

        shares = received.mulDiv(supplyBefore + 10 ** DECIMALS_OFFSET, assetsBefore + 1, Math.Rounding.Floor);

        if (supplyBefore == 0) {
            // First deposit: burn a fixed tranche of shares forever. Together with the
            // virtual offset this makes share-price manipulation via donation
            // unprofitable regardless of how small the first real deposit is.
            if (shares <= DEAD_SHARES) revert InsufficientSeedDeposit(shares, DEAD_SHARES + 1);
            shares -= DEAD_SHARES;
            _trackedAssets += received;
            _mint(BURN_ADDRESS, DEAD_SHARES);
        } else {
            if (shares == 0) revert ZeroAmount();
            _trackedAssets += received;
        }

        if (shares < minSharesOut) revert SlippageExceeded(shares, minSharesOut);

        _mint(receiver, shares);
        emit Deposit(_msgSender(), receiver, received, shares);
    }

    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
        return _mintShares(shares, receiver, type(uint256).max);
    }

    /// @notice Mint with an explicit ceiling on underlying spent.
    function mint(uint256 shares, address receiver, uint256 maxAssetsIn) external nonReentrant returns (uint256) {
        return _mintShares(shares, receiver, maxAssetsIn);
    }

    function _mintShares(uint256 shares, address receiver, uint256 maxAssetsIn) private returns (uint256 received) {
        if (shares == 0) revert ZeroAmount();
        _checkReceiver(receiver);
        _sync();

        uint256 supplyBefore = totalSupply();
        uint256 assetsBefore = totalAssets();

        uint256 assets = shares.mulDiv(assetsBefore + 1, supplyBefore + 10 ** DECIMALS_OFFSET, Math.Rounding.Ceil);
        if (assets == 0) revert ZeroAmount();
        if (assets > maxAssetsIn) revert SlippageExceeded(assets, maxAssetsIn);

        received = _pull(assets);
        // A fee-on-transfer token would leave the vault short of the underlying that the
        // requested shares are worth. `mint` has no way to express that, so it reverts;
        // `deposit` is the correct entrypoint for those tokens.
        if (received < assets) revert FeeOnTransferNotSupportedByMint();

        uint256 minted = shares;
        if (supplyBefore == 0) {
            if (minted <= DEAD_SHARES) revert InsufficientSeedDeposit(minted, DEAD_SHARES + 1);
            minted -= DEAD_SHARES;
            _trackedAssets += received;
            _mint(BURN_ADDRESS, DEAD_SHARES);
        } else {
            _trackedAssets += received;
        }

        _mint(receiver, minted);
        emit Deposit(_msgSender(), receiver, received, minted);
    }

    /// @dev Pulls `assets` and returns the amount the vault actually gained.
    function _pull(uint256 assets) private returns (uint256 received) {
        uint256 balanceBefore = _underlying.balanceOf(address(this));
        _underlying.safeTransferFrom(_msgSender(), address(this), assets);
        uint256 balanceAfter = _underlying.balanceOf(address(this));
        // Defensive: a token whose balance went down on a transfer-in is not accountable.
        if (balanceAfter <= balanceBefore) revert NothingReceived();
        received = balanceAfter - balanceBefore;
    }

    // ---------------------------------------------------------------------
    // Withdraw / redeem
    // ---------------------------------------------------------------------

    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {
        return _withdrawAssets(assets, receiver, owner, type(uint256).max);
    }

    /// @notice Withdraw with an explicit ceiling on shares burned.
    function withdraw(uint256 assets, address receiver, address owner, uint256 maxSharesIn)
        external
        nonReentrant
        returns (uint256)
    {
        return _withdrawAssets(assets, receiver, owner, maxSharesIn);
    }

    function _withdrawAssets(uint256 assets, address receiver, address owner, uint256 maxSharesIn)
        private
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAmount();
        _checkReceiver(receiver);
        _sync();

        uint256 maxAssets = maxWithdraw(owner);
        if (assets > maxAssets) revert ERC4626ExceededMaxWithdraw(owner, assets, maxAssets);

        shares = _convertToShares(assets, Math.Rounding.Ceil);
        if (shares > maxSharesIn) revert SlippageExceeded(shares, maxSharesIn);

        _settleWithdraw(receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
        return _redeemShares(shares, receiver, owner, 0);
    }

    /// @notice Redeem with an explicit floor on underlying received.
    function redeem(uint256 shares, address receiver, address owner, uint256 minAssetsOut)
        external
        nonReentrant
        returns (uint256)
    {
        return _redeemShares(shares, receiver, owner, minAssetsOut);
    }

    function _redeemShares(uint256 shares, address receiver, address owner, uint256 minAssetsOut)
        private
        returns (uint256 assets)
    {
        if (shares == 0) revert ZeroAmount();
        _checkReceiver(receiver);
        _sync();

        uint256 maxShares = maxRedeem(owner);
        if (shares > maxShares) revert ERC4626ExceededMaxRedeem(owner, shares, maxShares);

        assets = _convertToAssets(shares, Math.Rounding.Floor);
        if (assets == 0) revert ZeroAmount();
        if (assets < minAssetsOut) revert SlippageExceeded(assets, minAssetsOut);

        _settleWithdraw(receiver, owner, assets, shares);
    }

    /// @dev Checks-effects-interactions: allowance, burn and accounting all land before
    ///      the untrusted token is touched.
    function _settleWithdraw(address receiver, address owner, uint256 assets, uint256 shares) private {
        address caller = _msgSender();
        if (caller != owner) _spendAllowance(owner, caller, shares);

        _burn(owner, shares);
        _trackedAssets -= assets;

        _underlying.safeTransfer(receiver, assets);
        emit Withdraw(caller, receiver, owner, assets, shares);
    }

    // ---------------------------------------------------------------------
    // Shared helpers
    // ---------------------------------------------------------------------

    /// @dev Shares sent to the vault itself would be stranded and would corrupt nothing
    ///      but the holder's own balance; reject rather than silently accept.
    function _checkReceiver(address receiver) private view {
        if (receiver == address(0) || receiver == address(this) || receiver == BURN_ADDRESS) {
            revert InvalidReceiver();
        }
    }

    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
        return ERC4626.decimals();
    }
}
