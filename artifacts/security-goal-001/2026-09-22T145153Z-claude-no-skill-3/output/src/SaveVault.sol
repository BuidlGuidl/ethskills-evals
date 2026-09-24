// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {TokenMetadata} from "./lib/TokenMetadata.sol";

/// @dev Built at file scope so the strings can be passed to the ERC20 / ERC20Permit constructors.
function vaultName(address asset_) view returns (string memory) {
    string memory n = TokenMetadata.safeName(asset_);
    if (bytes(n).length == 0) n = "Unknown Token";
    return string.concat("Save ", n);
}

function vaultSymbol(address asset_) view returns (string memory) {
    string memory s = TokenMetadata.safeSymbol(asset_);
    if (bytes(s).length == 0) s = "TKN";
    return string.concat("sv", s);
}

/// @title SaveVault
/// @notice A single-asset, ownerless savings vault. Depositors receive a transferable ERC-20
///         receipt (the share token) representing a pro-rata claim on the vault's assets.
///         Yield is delivered by a keeper transferring more of the underlying straight in.
/// @dev Design constraints that shaped this contract:
///
///      1. Listing is permissionless, so the underlying may be *any* ERC-20: fee-on-transfer,
///         rebasing, non-standard return values, or outright malicious. One vault per asset
///         keeps blast radius to that asset's own depositors — this contract never touches
///         another vault's funds and never holds an allowance on anything.
///      2. Yield arrives as a bare `transfer`, so the vault has no way to distinguish "yield"
///         from "donation". Accounting is therefore balance-based, which is exactly the setup
///         the first-depositor inflation attack needs. Two independent mitigations below.
///      3. Deposits and withdrawals are open with no lockup, so a bare `transfer` of yield
///         would be sandwichable: deposit in the same block, capture the jump, leave. Incoming
///         balance is therefore vested linearly instead of recognised instantly.
///
///      There is no owner, no pause, no upgrade path and no rescue function. For a
///      permissionless-listing product, an admin key is a larger risk than the edge cases it
///      could fix.
contract SaveVault is IERC4626, ERC20, ERC20Permit, ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    /// @notice Window over which a newly observed balance increase becomes withdrawable.
    /// @dev Mitigation for (3): yield accrues to holders continuously rather than in a step,
    ///      so a just-in-time depositor earns only for the time actually held. Also blunts the
    ///      inflation attack, since a donation cannot move the share price within a block.
    uint256 public constant VESTING_PERIOD = 24 hours;

    /// @dev Virtual-share offset (ERC-4626 mitigation for (2)). Shares carry `OFFSET` more
    ///      decimals than the asset, and the conversions below behave as if the vault always
    ///      held 1 virtual asset against 10**OFFSET virtual shares. Inflating the share price
    ///      by one wei-of-share therefore costs the attacker ~10**OFFSET of the underlying,
    ///      and any value they burn doing it is donated to the victim rather than stolen.
    uint8 private constant OFFSET = 6;

    /// @dev Assets are rejected above this many decimals so that `decimals() + OFFSET` cannot
    ///      overflow uint8 and share amounts stay far away from uint256 limits.
    uint8 private constant MAX_ASSET_DECIMALS = 24;

    IERC20 private immutable _asset;
    uint8 private immutable _shareDecimals;

    /// @dev Vault balance as of the end of the last state-changing interaction. Any excess
    ///      observed later is an incoming transfer (keeper yield or donation).
    uint256 public recordedBalance;
    /// @dev Amount still vesting as of `lastAccrual`.
    uint256 public lockedProfit;
    uint256 public lastAccrual;

    error AssetNotAContract();
    error UnsupportedDecimals(uint8 decimals);
    error ZeroAssets();
    error ZeroShares();
    error ExceededMaxWithdraw(uint256 assets, uint256 max);
    error ExceededMaxRedeem(uint256 shares, uint256 max);
    error InexactTransfer(uint256 requested, uint256 received);

    /// @notice Emitted whenever an incoming transfer is picked up and put into vesting.
    event Accrued(uint256 amount, uint256 lockedProfit);

    constructor(address asset_)
        ERC20(vaultName(asset_), vaultSymbol(asset_))
        ERC20Permit(vaultName(asset_))
    {
        // A non-contract address would make every `transfer` a silent no-op, which would let
        // anyone "deposit" nothing and mint shares. SafeERC20 also checks this, but failing
        // at listing time is cheaper than failing per call.
        if (asset_.code.length == 0) revert AssetNotAContract();

        uint8 assetDecimals = TokenMetadata.safeDecimals(asset_, 18);
        if (assetDecimals > MAX_ASSET_DECIMALS) revert UnsupportedDecimals(assetDecimals);

        _asset = IERC20(asset_);
        _shareDecimals = assetDecimals + OFFSET;
        lastAccrual = block.timestamp;
    }

    /* ------------------------------------------------------------------ */
    /*                              accounting                             */
    /* ------------------------------------------------------------------ */

    function asset() public view returns (address) {
        return address(_asset);
    }

    function decimals() public view override(ERC20, IERC20Metadata) returns (uint8) {
        return _shareDecimals;
    }

    /// @notice Assets currently backing the shares: everything the vault holds, minus the
    ///         portion of recently received yield that has not vested yet.
    function totalAssets() public view returns (uint256) {
        uint256 balance = _asset.balanceOf(address(this));
        uint256 unvested = _unvestedProfit();
        // Clamp rather than underflow: a rebasing or seizing token can shrink the balance
        // out from under the vesting schedule.
        return balance > unvested ? balance - unvested : 0;
    }

    /// @notice Portion of `lockedProfit` still locked, decaying linearly to zero.
    function _unvestedProfit() internal view returns (uint256) {
        uint256 elapsed = block.timestamp - lastAccrual;
        if (elapsed >= VESTING_PERIOD) return 0;
        return lockedProfit.mulDiv(VESTING_PERIOD - elapsed, VESTING_PERIOD);
    }

    /// @notice Recognises any balance increase since the last interaction and restarts the
    ///         vesting clock on the combined unvested amount.
    /// @dev Permissionless and idempotent; called at the start of every mutating entry point.
    ///      A loss (negative rebase, transfer fee charged on the vault) is *not* vested — it
    ///      is socialised immediately and pro-rata, which is the only honest thing to do when
    ///      the tokens are simply gone.
    function sync() external nonReentrant {
        _accrue();
        recordedBalance = _asset.balanceOf(address(this));
    }

    function _accrue() private {
        uint256 balance = _asset.balanceOf(address(this));
        uint256 recorded = recordedBalance;
        uint256 unvested = _unvestedProfit();

        if (balance > recorded) {
            uint256 gain = balance - recorded;
            lockedProfit = unvested + gain;
            emit Accrued(gain, unvested + gain);
        } else {
            lockedProfit = unvested;
        }
        lastAccrual = block.timestamp;
    }

    /// @dev Share price with the virtual offset applied. `+1` asset and `+10**OFFSET` shares
    ///      make the empty-vault case well defined and make donations unprofitable to exploit.
    function _convertToShares(uint256 assets, Math.Rounding rounding) private view returns (uint256) {
        return assets.mulDiv(totalSupply() + 10 ** OFFSET, totalAssets() + 1, rounding);
    }

    function _convertToAssets(uint256 shares, Math.Rounding rounding) private view returns (uint256) {
        return shares.mulDiv(totalAssets() + 1, totalSupply() + 10 ** OFFSET, rounding);
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }

    // Previews round in the direction that favours the vault (i.e. the existing holders),
    // so that no sequence of operations can extract value through rounding dust.
    function previewDeposit(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    function previewMint(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Ceil);
    }

    function previewWithdraw(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Ceil);
    }

    function previewRedeem(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }

    function maxDeposit(address) public pure returns (uint256) {
        return type(uint256).max;
    }

    function maxMint(address) public pure returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address owner) public view returns (uint256) {
        return _convertToAssets(balanceOf(owner), Math.Rounding.Floor);
    }

    function maxRedeem(address owner) public view returns (uint256) {
        return balanceOf(owner);
    }

    /* ------------------------------------------------------------------ */
    /*                              entry points                           */
    /* ------------------------------------------------------------------ */

    /// @notice Deposit `assets` of the underlying and receive shares.
    /// @dev Shares are priced off the amount the vault *actually received*, not the amount
    ///      requested, so a fee-on-transfer asset cannot mint shares against tokens that never
    ///      arrived. Returns the shares minted.
    function deposit(uint256 assets, address receiver) public nonReentrant returns (uint256 shares) {
        _accrue();
        if (assets == 0) revert ZeroAssets();

        // Snapshot before the transfer: `totalAssets()` reads the live balance, so pricing
        // after the pull would value the deposit against itself.
        uint256 assetsBefore = totalAssets();
        uint256 supplyBefore = totalSupply();

        uint256 received = _pull(msg.sender, assets);
        shares = received.mulDiv(supplyBefore + 10 ** OFFSET, assetsBefore + 1, Math.Rounding.Floor);
        if (shares == 0) revert ZeroShares();

        _mint(receiver, shares);
        recordedBalance = _asset.balanceOf(address(this));
        emit Deposit(msg.sender, receiver, received, shares);
    }

    /// @notice Mint exactly `shares`, pulling however much underlying that costs.
    /// @dev Reverts for fee-on-transfer assets, where "pull exactly N" is not expressible.
    ///      Use `deposit` with those. Returns the assets pulled.
    function mint(uint256 shares, address receiver) public nonReentrant returns (uint256 assets) {
        _accrue();
        if (shares == 0) revert ZeroShares();

        assets = previewMint(shares);
        if (assets == 0) revert ZeroAssets();

        uint256 received = _pull(msg.sender, assets);
        if (received != assets) revert InexactTransfer(assets, received);

        _mint(receiver, shares);
        recordedBalance = _asset.balanceOf(address(this));
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /// @notice Burn shares from `owner` to send exactly `assets` out of the vault.
    /// @dev With a fee-on-transfer asset the receiver nets less than `assets`; `assets` is what
    ///      leaves the vault. Returns the shares burned.
    function withdraw(uint256 assets, address receiver, address owner)
        public
        nonReentrant
        returns (uint256 shares)
    {
        _accrue();
        uint256 max = maxWithdraw(owner);
        if (assets > max) revert ExceededMaxWithdraw(assets, max);
        if (assets == 0) revert ZeroAssets();

        shares = previewWithdraw(assets);
        if (shares == 0) revert ZeroShares();

        _burnFor(owner, shares);
        // Burn before transfer: the asset may call back into this vault (ERC-777 hooks,
        // ERC-1363, or just a malicious token), and by then the accounting is already settled.
        // `nonReentrant` is the primary guard; ordering is the backstop.
        _asset.safeTransfer(receiver, assets);
        recordedBalance = _asset.balanceOf(address(this));
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    /// @notice Burn exactly `shares` from `owner` and send out the assets they are worth.
    /// @dev Returns the assets sent.
    function redeem(uint256 shares, address receiver, address owner)
        public
        nonReentrant
        returns (uint256 assets)
    {
        _accrue();
        uint256 max = maxRedeem(owner);
        if (shares > max) revert ExceededMaxRedeem(shares, max);
        if (shares == 0) revert ZeroShares();

        assets = previewRedeem(shares);
        if (assets == 0) revert ZeroAssets();

        _burnFor(owner, shares);
        _asset.safeTransfer(receiver, assets);
        recordedBalance = _asset.balanceOf(address(this));
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    /* ------------------------------------------------------------------ */
    /*                               internals                             */
    /* ------------------------------------------------------------------ */

    /// @dev Pulls `assets` from `from` and returns the amount the vault's balance actually grew
    ///      by. Never trusts the requested amount: fee-on-transfer assets deliver less, and a
    ///      rebasing asset can deliver something else entirely.
    function _pull(address from, uint256 assets) private returns (uint256 received) {
        uint256 before = _asset.balanceOf(address(this));
        _asset.safeTransferFrom(from, address(this), assets);
        uint256 balanceAfter = _asset.balanceOf(address(this));
        // Cannot underflow in practice, but a token that shrinks the vault's balance during
        // its own transfer should fail the deposit rather than mint free shares.
        if (balanceAfter <= before) revert ZeroAssets();
        received = balanceAfter - before;
    }

    function _burnFor(address owner, uint256 shares) private {
        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);
    }
}
