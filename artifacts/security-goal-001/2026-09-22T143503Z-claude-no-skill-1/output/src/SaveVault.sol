// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {TokenMetadata} from "./TokenMetadata.sol";

/// @title SaveVault
/// @notice A single-asset savings vault. Depositors receive a transferable ERC-20 receipt token
///         representing a pro-rata claim on the vault's assets. Yield arrives as plain ERC-20
///         transfers of the same underlying into this address; no keeper call is required.
/// @dev Ownerless and immutable by construction: there is no admin, no upgrade path, no fee switch
///      and no pause. The only privileged actor is the underlying token itself, which is chosen by
///      whoever listed it.
///
///      Follows the ERC-4626 interface so the receipt composes with existing integrations, with two
///      deliberate deviations from the naive implementation, both forced by permissionless listing:
///
///      1. **Assets are tracked internally, not as `asset.balanceOf(this)`.** A bare transfer into
///         the vault does not change the share price on the spot; it is captured and released
///         linearly over `DRIP_PERIOD`. See `_accrue`.
///      2. **Every asset movement is measured as a real balance delta**, so fee-on-transfer tokens
///         credit what actually arrived rather than what was requested.
contract SaveVault is ERC20, ERC20Permit, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    /* --------------------------------------------------------------------- */
    /*                                Constants                              */
    /* --------------------------------------------------------------------- */

    /// @notice Window over which newly received yield is released into the share price.
    /// @dev Deposits and withdrawals are instant and there is no lockup, so yield recognised
    ///      atomically would be free money for whoever sandwiches the keeper's transfer: deposit in
    ///      the block before it, redeem in the block after, capture a pro-rata cut of a payout you
    ///      were never exposed to. Dripping the payout over a day makes that sandwich cost a day of
    ///      capital at risk for a day's worth of a fraction of the yield.
    uint256 public constant DRIP_PERIOD = 24 hours;

    /// @dev Virtual-share offset (OZ ERC-4626 style inflation defence). The share price is computed
    ///      against `totalSupply + 10**OFFSET` virtual shares and `totalAssets + 1` virtual assets,
    ///      so an attacker who pushes the price up by 10**OFFSET has to donate 10**OFFSET times the
    ///      value they hope to steal from a rounding-truncated victim. Defence in depth: the drip in
    ///      `_accrue` already denies a donation any instantaneous effect on the price.
    uint8 private constant DECIMALS_OFFSET = 3;

    /* --------------------------------------------------------------------- */
    /*                                 Storage                               */
    /* --------------------------------------------------------------------- */

    /// @notice The underlying ERC-20 this vault saves.
    IERC20 public immutable asset;

    uint8 private immutable _underlyingDecimals;

    /// @notice Assets currently backing the share price (principal + already-released yield).
    uint256 public totalAssetsStored;

    /// @notice Yield received but not yet released into the share price.
    uint256 public streamRemaining;

    /// @dev Timestamp of the last accrual, i.e. the start of the un-released portion of the stream.
    uint64 public lastAccrue;

    /// @dev Timestamp at which `streamRemaining` will be fully released.
    uint64 public streamEnd;

    /* --------------------------------------------------------------------- */
    /*                                  Events                               */
    /* --------------------------------------------------------------------- */

    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );
    /// @notice Emitted when unaccounted balance (keeper yield, or anyone's donation) is picked up.
    event YieldQueued(uint256 amount, uint256 streamRemaining, uint64 streamEnd);
    /// @notice Emitted when the vault's real balance is below its accounting and the difference is
    ///         written down across all holders. See `_accrue`.
    event ShortfallRecognised(uint256 amount);

    /* --------------------------------------------------------------------- */
    /*                                  Errors                               */
    /* --------------------------------------------------------------------- */

    error ZeroAssets();
    error ZeroShares();
    error ZeroAddress();
    error SelfTransfer();
    error InsufficientAssetsReceived(uint256 needed, uint256 received);
    error ExceedsMaxWithdraw(uint256 requested, uint256 max);
    error ExceedsMaxRedeem(uint256 requested, uint256 max);

    /* --------------------------------------------------------------------- */
    /*                               Construction                            */
    /* --------------------------------------------------------------------- */

    constructor(address underlying)
        ERC20(
            string.concat("Save ", TokenMetadata.readName(underlying)),
            string.concat("sv", TokenMetadata.readSymbol(underlying))
        )
        ERC20Permit(string.concat("Save ", TokenMetadata.readName(underlying)))
    {
        if (underlying == address(0)) revert ZeroAddress();
        asset = IERC20(underlying);
        _underlyingDecimals = TokenMetadata.readDecimals(underlying);
        // Smoke-test the one method the vault genuinely depends on. Reverts for an EOA (staticcall
        // to a codeless address returns empty data, which fails to decode) and for anything that
        // does not implement `balanceOf`, so such a "token" can never be listed.
        asset.balanceOf(address(this));
        lastAccrue = uint64(block.timestamp);
        streamEnd = uint64(block.timestamp);
    }

    function decimals() public view override returns (uint8) {
        return _underlyingDecimals + DECIMALS_OFFSET;
    }

    /* --------------------------------------------------------------------- */
    /*                            Yield accounting                           */
    /* --------------------------------------------------------------------- */

    /// @notice Assets backing the share price right now, including yield released since the last
    ///         state change but excluding yield still in the drip.
    function totalAssets() public view returns (uint256 stored) {
        (stored,) = _projected();
    }

    /// @notice Yield received but not yet reflected in the share price.
    function lockedYield() public view returns (uint256 remaining) {
        (, remaining) = _projected();
    }

    /// @notice Pulls any unaccounted balance into the drip and releases what is due. Permissionless;
    ///         every deposit/withdraw path calls it first, so it is never required for correctness.
    function sync() external nonReentrant {
        _accrue();
    }

    /// @dev Pure view of what `_accrue` would compute, minus the pickup of new donations (which does
    ///      not move `stored`, so previews stay consistent with what the next state change will do).
    function _projected() private view returns (uint256 stored, uint256 remaining) {
        stored = totalAssetsStored;
        remaining = streamRemaining;

        if (remaining > 0) {
            uint64 end = streamEnd;
            uint64 last = lastAccrue;
            if (block.timestamp >= end) {
                stored += remaining;
                remaining = 0;
            } else if (block.timestamp > last && end > last) {
                uint256 released = remaining.mulDiv(block.timestamp - last, end - last);
                stored += released;
                remaining -= released;
            }
        }

        // The underlying is untrusted: a rebase down, a blacklist sweep, or an admin burn can leave
        // the vault holding less than it thinks. Recognise that as a loss shared pro-rata by every
        // holder rather than letting withdrawals revert once the balance runs out, which would turn
        // the shortfall into a first-come-first-served race won by whoever pays the most gas.
        uint256 balance = asset.balanceOf(address(this));
        uint256 accounted = stored + remaining;
        if (balance < accounted) {
            uint256 shortfall = accounted - balance;
            if (shortfall >= remaining) {
                shortfall -= remaining;
                remaining = 0;
                stored -= shortfall;
            } else {
                remaining -= shortfall;
            }
        }
    }

    /// @dev Releases due yield, writes down any shortfall, then sweeps unaccounted balance (the
    ///      keeper's transfer) into a fresh drip window.
    function _accrue() private {
        (uint256 stored, uint256 remaining) = _projected();

        uint256 balance = asset.balanceOf(address(this));
        uint256 accountedBefore = totalAssetsStored + streamRemaining;
        if (balance < accountedBefore) emit ShortfallRecognised(accountedBefore - balance);

        // Post write-down, `stored + remaining <= balance`, so this cannot underflow.
        uint256 unaccounted = balance - stored - remaining;
        uint64 end = streamEnd;
        if (unaccounted > 0) {
            remaining += unaccounted;
            end = uint64(block.timestamp + DRIP_PERIOD);
            emit YieldQueued(unaccounted, remaining, end);
        }

        totalAssetsStored = stored;
        streamRemaining = remaining;
        streamEnd = end;
        lastAccrue = uint64(block.timestamp);
    }

    /* --------------------------------------------------------------------- */
    /*                              Share pricing                            */
    /* --------------------------------------------------------------------- */

    function _convertToShares(uint256 assets, uint256 stored, Math.Rounding rounding)
        private
        view
        returns (uint256)
    {
        return assets.mulDiv(totalSupply() + 10 ** DECIMALS_OFFSET, stored + 1, rounding);
    }

    function _convertToAssets(uint256 shares, uint256 stored, Math.Rounding rounding)
        private
        view
        returns (uint256)
    {
        return shares.mulDiv(stored + 1, totalSupply() + 10 ** DECIMALS_OFFSET, rounding);
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, totalAssets(), Math.Rounding.Floor);
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, totalAssets(), Math.Rounding.Floor);
    }

    /// @dev Rounding is always chosen against the caller and in favour of the existing holders:
    ///      minting rounds shares down / assets up, burning rounds shares up / assets down.
    function previewDeposit(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, totalAssets(), Math.Rounding.Floor);
    }

    function previewMint(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, totalAssets(), Math.Rounding.Ceil);
    }

    function previewWithdraw(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, totalAssets(), Math.Rounding.Ceil);
    }

    function previewRedeem(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, totalAssets(), Math.Rounding.Floor);
    }

    function maxDeposit(address) public pure returns (uint256) {
        return type(uint256).max;
    }

    function maxMint(address) public pure returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address owner) public view returns (uint256) {
        return convertToAssets(balanceOf(owner));
    }

    function maxRedeem(address owner) public view returns (uint256) {
        return balanceOf(owner);
    }

    /* --------------------------------------------------------------------- */
    /*                           Deposit / withdraw                          */
    /* --------------------------------------------------------------------- */

    /// @notice Deposits `assets` of the underlying and mints receipt shares to `receiver`.
    /// @dev For a fee-on-transfer token, shares are minted against the amount that actually landed.
    /// @return shares Receipt tokens minted.
    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAssets();
        if (receiver == address(0) || receiver == address(this)) revert ZeroAddress();
        _accrue();

        uint256 stored = totalAssetsStored;
        uint256 received = _pullAssets(msg.sender, assets);
        // Priced at the pre-deposit exchange rate; the depositor's own assets must not price them.
        shares = _convertToShares(received, stored, Math.Rounding.Floor);
        if (shares == 0) revert ZeroShares();

        totalAssetsStored = stored + received;
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, received, shares);
    }

    /// @notice Mints exactly `shares` receipt tokens to `receiver`, pulling the required assets.
    /// @dev Reverts for fee-on-transfer tokens, where the requested amount cannot arrive in full;
    ///      minting the exact share count anyway would dilute existing holders by the fee. Use
    ///      `deposit` for those tokens.
    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0) || receiver == address(this)) revert ZeroAddress();
        _accrue();

        uint256 stored = totalAssetsStored;
        assets = _convertToAssets(shares, stored, Math.Rounding.Ceil);
        if (assets == 0) revert ZeroAssets();

        uint256 received = _pullAssets(msg.sender, assets);
        if (received < assets) revert InsufficientAssetsReceived(assets, received);

        totalAssetsStored = stored + received;
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, received, shares);
    }

    /// @notice Burns `owner`'s shares and sends exactly `assets` of the underlying to `receiver`.
    /// @dev With a fee-on-transfer underlying the receiver nets less than `assets`; the vault debits
    ///      what it sent, so the remaining holders are unaffected.
    function withdraw(uint256 assets, address receiver, address owner)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAssets();
        if (receiver == address(0)) revert ZeroAddress();
        _accrue();

        uint256 stored = totalAssetsStored;
        uint256 ownerShares = balanceOf(owner);
        // Rounded up, so a withdrawal never leaves the vault short by a wei of dust.
        shares = _convertToShares(assets, stored, Math.Rounding.Ceil);
        if (shares > ownerShares) {
            revert ExceedsMaxWithdraw(assets, _convertToAssets(ownerShares, stored, Math.Rounding.Floor));
        }
        // shares <= totalSupply() implies assets <= stored, so the debit below cannot underflow.

        _burnFrom(msg.sender, owner, shares);
        totalAssetsStored = stored - assets;
        asset.safeTransfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    /// @notice Burns exactly `shares` of `owner`'s receipt tokens for the underlying.
    function redeem(uint256 shares, address receiver, address owner)
        external
        nonReentrant
        returns (uint256 assets)
    {
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0)) revert ZeroAddress();
        _accrue();

        if (shares > balanceOf(owner)) revert ExceedsMaxRedeem(shares, balanceOf(owner));

        uint256 stored = totalAssetsStored;
        assets = _convertToAssets(shares, stored, Math.Rounding.Floor);
        if (assets == 0) revert ZeroAssets();

        _burnFrom(msg.sender, owner, shares);
        totalAssetsStored = stored - assets;
        asset.safeTransfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    /* --------------------------------------------------------------------- */
    /*                                Internals                              */
    /* --------------------------------------------------------------------- */

    /// @dev Pulls `assets` from `from` and returns the amount that actually arrived.
    ///      Re-reading the balance is what makes fee-on-transfer tokens safe; `nonReentrant` on
    ///      every caller is what stops a token with a transfer hook from re-entering mid-delta.
    function _pullAssets(address from, uint256 assets) private returns (uint256 received) {
        uint256 before = asset.balanceOf(address(this));
        asset.safeTransferFrom(from, address(this), assets);
        uint256 afterBal = asset.balanceOf(address(this));
        // A conforming token cannot shrink the vault's balance on an inbound transfer.
        received = afterBal > before ? afterBal - before : 0;
        if (received == 0) revert ZeroAssets();
    }

    function _burnFrom(address spender, address owner, uint256 shares) private {
        if (spender != owner) _spendAllowance(owner, spender, shares);
        _burn(owner, shares);
    }

    /// @dev Receipt tokens sent to the vault itself would be unrecoverable and would silently
    ///      distort nothing but the holder's own claim; reject them rather than eat them.
    function _update(address from, address to, uint256 value) internal override {
        if (to == address(this)) revert SelfTransfer();
        super._update(from, to, value);
    }
}
