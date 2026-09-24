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
 * @title SaveVault
 * @notice A single-asset savings vault. Depositors hand over an ERC-20 and receive a
 *         transferable ERC-4626 receipt token representing a pro-rata claim on
 *         everything the vault holds. Yield is delivered by a keeper simply
 *         transferring more of the underlying token to this address, which raises
 *         `totalAssets()` and therefore every holder's claim, without touching supply.
 *
 * @dev Design constraints that drive this implementation:
 *
 *      1. `totalAssets()` is the live token balance. It has to be, because yield
 *         arrives as a plain transfer with no callback. The direct consequence is
 *         that the vault is *permanently* donation-sensitive by design, so the
 *         inflation/first-depositor attack cannot be handled by rejecting donations.
 *         It is handled with ERC-4626 virtual shares and assets via a non-zero
 *         `_decimalsOffset()` (see below).
 *
 *      2. Listing is permissionless, so the underlying token is fully untrusted.
 *         Deposits are credited from the observed balance delta rather than the
 *         requested amount, so a fee-on-transfer token cannot mint shares against
 *         assets the vault never received.
 *
 *      3. An untrusted token can hand control back to the caller mid-transfer
 *         (ERC-777 hooks, and anything with a transfer callback). Since share price
 *         is read from a balance that is in flux during those calls, every
 *         value-moving entry point takes a reentrancy guard.
 *
 *      4. There is no owner, no pause, no upgrade path and no rescue function.
 *         A permissionless listing registry whose vaults can be frozen or drained by
 *         a key is a worse trade than one that cannot be. See NOTES.md.
 */
contract SaveVault is ERC4626, ERC20Permit, ReentrancyGuard {
    using Math for uint256;

    /// @notice A deposit would have minted zero shares.
    error ZeroShares();
    /// @notice The vault received less than it asked for (fee-on-transfer token on the `mint` path).
    error InexactAssetTransfer(uint256 requested, uint256 received);

    /**
     * @dev Virtual-share offset used to price the empty vault.
     *
     * `_convertToShares` is `assets * (totalSupply + 10**offset) / (totalAssets + 1)`,
     * i.e. the vault behaves as if it always held `10**offset` virtual shares backed by
     * 1 virtual wei of assets. To make a victim's deposit round down to zero shares an
     * attacker must donate on the order of `10**6` times the victim's deposit, and the
     * virtual shares absorb that donation rather than the attacker's position, so the
     * attack costs far more than it can ever extract.
     *
     * Cost of this choice: the receipt token has `assetDecimals + 6` decimals, and a
     * dust-sized fraction of every yield drip accrues to the virtual shares instead of
     * to holders. Both are accepted.
     */
    uint8 private constant DECIMALS_OFFSET = 6;

    constructor(IERC20 asset_, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
        ERC4626(asset_)
    {}

    // -------------------------------------------------------------------------
    // Deposits
    // -------------------------------------------------------------------------

    /**
     * @notice Deposit `assets` of the underlying and mint receipt tokens to `receiver`.
     * @dev Shares are derived from the balance actually received, priced against the
     *      balance held *before* the transfer. For a well-behaved token this is
     *      identical to `previewDeposit(assets)`; for a fee-on-transfer token it mints
     *      only what was really delivered, so existing holders are never diluted.
     *      `previewDeposit` is consequently an upper bound, not an exact quote.
     * @return shares Receipt tokens actually minted.
     */
    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
        uint256 maxAssets = maxDeposit(receiver);
        if (assets > maxAssets) revert ERC4626ExceededMaxDeposit(receiver, assets, maxAssets);

        IERC20 token = IERC20(asset());

        // Snapshot before the transfer: this is `totalAssets()` at the price we quote.
        uint256 assetsBefore = token.balanceOf(address(this));
        SafeERC20.safeTransferFrom(token, _msgSender(), address(this), assets);
        // Reverts on underflow if the token somehow reduced our balance.
        uint256 received = token.balanceOf(address(this)) - assetsBefore;

        shares = received.mulDiv(totalSupply() + 10 ** DECIMALS_OFFSET, assetsBefore + 1, Math.Rounding.Floor);
        // Refuse to take assets for nothing. Also blocks the "deposit dust for free" leg
        // of an inflation attempt rather than silently swallowing the caller's tokens.
        if (shares == 0) revert ZeroShares();

        _mint(receiver, shares);
        emit Deposit(_msgSender(), receiver, received, shares);
    }

    /**
     * @notice Mint exactly `shares` receipt tokens to `receiver`, pulling the required assets.
     * @dev Exact-share semantics and fee-on-transfer tokens are mutually exclusive: if the
     *      vault is shorted on the way in, the requested share count is no longer backed.
     *      This path therefore reverts rather than silently minting fewer shares than asked.
     *      Use {deposit} for fee-on-transfer tokens.
     * @return assets Underlying pulled from the caller.
     */
    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
        uint256 maxShares = maxMint(receiver);
        if (shares > maxShares) revert ERC4626ExceededMaxMint(receiver, shares, maxShares);
        if (shares == 0) revert ZeroShares();

        assets = previewMint(shares); // rounds up, in the vault's favour

        IERC20 token = IERC20(asset());
        uint256 assetsBefore = token.balanceOf(address(this));
        SafeERC20.safeTransferFrom(token, _msgSender(), address(this), assets);
        uint256 received = token.balanceOf(address(this)) - assetsBefore;

        // A surplus is fine: it just becomes yield for everyone. A shortfall is not.
        if (received < assets) revert InexactAssetTransfer(assets, received);

        _mint(receiver, shares);
        emit Deposit(_msgSender(), receiver, assets, shares);
    }

    // -------------------------------------------------------------------------
    // Withdrawals
    // -------------------------------------------------------------------------

    /**
     * @notice Burn receipt tokens from `owner` and send exactly `assets` of underlying to `receiver`.
     * @dev Shares burned round up, in the vault's favour. A fee-on-transfer token will
     *      deliver less than `assets` to `receiver`; that fee is borne by the withdrawer
     *      and never by the remaining holders.
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256)
    {
        return super.withdraw(assets, receiver, owner);
    }

    /// @notice Burn exactly `shares` from `owner` and send the corresponding underlying to `receiver`.
    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
        return super.redeem(shares, receiver, owner);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /**
     * @dev Everything the vault holds backs the receipt token, including tokens pushed in
     *      by the keeper and unsolicited donations. There is no idle/deployed split and
     *      no cached total that could drift from reality.
     */
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return DECIMALS_OFFSET;
    }

    /// @dev Receipt-token decimals: underlying decimals + {DECIMALS_OFFSET}.
    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
        return ERC4626.decimals();
    }
}
