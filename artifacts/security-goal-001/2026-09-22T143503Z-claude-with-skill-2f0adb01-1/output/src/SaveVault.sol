// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title SaveVault
/// @notice A single-asset savings vault. Depositors get a transferable ERC-4626 receipt token
///         ("share") representing a pro-rata claim on everything the vault holds. Yield arrives as
///         a plain ERC-20 transfer of the underlying into this contract by a keeper, which lifts
///         every holder's claim proportionally.
///
/// @dev Trust model. There is no owner, no pauser, no upgrade path, no fee switch and no
///      privileged keeper address: once deployed this contract cannot be altered and nobody can
///      freeze or seize deposits. The only externally-controlled thing it touches is the
///      underlying token itself, which is assumed hostile because listing is permissionless.
///
///      Three consequences drive the code below:
///
///      1. Share price is derived from `balanceOf(this)`, because that is how the keeper delivers
///         yield. That makes the classic ERC-4626 inflation ("donation") attack structurally
///         possible, so it is priced out with a virtual-share/virtual-asset offset of 1e3 rather
///         than with a "no unexpected balance increase" check, which would break the product.
///      2. The underlying may take a fee on transfer, so deposits credit the *measured* balance
///         delta, never the requested amount.
///      3. The underlying may hand control back to the caller mid-transfer (ERC-777, ERC-1363,
///         hook-y tokens). Every entry point is `nonReentrant` on top of ERC-4626's CEI ordering.
contract SaveVault is ERC4626, ERC20Permit, ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    /// @notice Virtual-share offset used by the ERC-4626 conversion math.
    /// @dev Makes an empty vault behave as if it already held 1 wei of assets against 1e6 shares,
    ///      so the receipt token carries `underlying.decimals() + 6` decimals. Two effects:
    ///      an attacker must donate ~1e6x a victim's deposit to erase even one share of it, and
    ///      the worst-case rounding loss a depositor can be griefed into is ~1e-6 of their
    ///      deposit. Paired with the {ZeroShares} revert below, rounding a victim down to nothing
    ///      is not reachable at all: the deposit reverts instead of handing the pool free assets.
    uint8 internal constant DECIMALS_OFFSET = 6;

    /// @notice A deposit would have minted zero shares (dust, or an attempted rate manipulation).
    error ZeroShares();
    /// @notice A withdrawal would have moved zero assets.
    error ZeroAssets();
    /// @notice Output fell below the caller's stated minimum.
    error SlippageExceeded(uint256 actual, uint256 minimum);
    /// @notice The receipt token cannot hold its own underlying accounting balance.
    error InvalidReceiver();

    constructor(IERC20 asset_, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
        ERC4626(asset_)
    {}

    // ---------------------------------------------------------------------
    // ERC-4626 entry points
    // ---------------------------------------------------------------------

    /// @inheritdoc ERC4626
    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
        _checkReceiver(receiver);
        return super.deposit(assets, receiver);
    }

    /// @inheritdoc ERC4626
    /// @dev With a fee-on-transfer underlying the vault cannot mint exactly `shares` for the
    ///      grossed-up amount `previewMint` quotes, so it mints against what actually arrived and
    ///      the caller receives slightly fewer shares than requested. Use {deposit} for those
    ///      tokens; `mint` stays exact for every standard ERC-20.
    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
        _checkReceiver(receiver);
        return super.mint(shares, receiver);
    }

    /// @inheritdoc ERC4626
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256)
    {
        if (assets == 0) revert ZeroAssets();
        return super.withdraw(assets, receiver, owner);
    }

    /// @inheritdoc ERC4626
    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
        uint256 assets = super.redeem(shares, receiver, owner);
        if (assets == 0) revert ZeroAssets();
        return assets;
    }

    // ---------------------------------------------------------------------
    // Slippage-protected variants
    // ---------------------------------------------------------------------
    //
    // The exchange rate can legitimately move between signing and inclusion: the keeper may land a
    // yield transfer in the same block, and fee-on-transfer tokens make the credited amount
    // unknowable off-chain. These wrappers let integrators bound that without a router.

    /// @notice {deposit}, reverting unless at least `minSharesOut` shares are minted.
    function depositMin(uint256 assets, address receiver, uint256 minSharesOut) external returns (uint256 shares) {
        shares = deposit(assets, receiver);
        if (shares < minSharesOut) revert SlippageExceeded(shares, minSharesOut);
    }

    /// @notice {redeem}, reverting unless at least `minAssetsOut` underlying leave the vault.
    /// @dev The bound is on what the vault sends. A fee-on-transfer underlying will deliver less
    ///      than that to `receiver`; the fee is a property of the token, not of this contract.
    function redeemMin(uint256 shares, address receiver, address owner, uint256 minAssetsOut)
        external
        returns (uint256 assets)
    {
        assets = redeem(shares, receiver, owner);
        if (assets < minAssetsOut) revert SlippageExceeded(assets, minAssetsOut);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    /// @dev Credits the measured balance delta instead of the requested amount.
    ///
    ///      `shares` was quoted by `previewDeposit`/`previewMint` against the pre-transfer state,
    ///      and `balanceBefore` reads that same state, so re-deriving shares from the delta uses
    ///      exactly the rate the caller was quoted. Without this, a token taking a 1% transfer fee
    ///      would mint shares for 100% of the request and dilute existing holders on every deposit.
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        IERC20 token = IERC20(asset());
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(caller, address(this), assets);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;

        if (received != assets) {
            assets = received;
            shares = received.mulDiv(totalSupply() + 10 ** DECIMALS_OFFSET, balanceBefore + 1, Math.Rounding.Floor);
        }
        // Dust deposits that round to nothing must revert rather than silently donate to the pool.
        if (shares == 0) revert ZeroShares();

        _mint(receiver, shares);
        emit Deposit(caller, receiver, assets, shares);
    }

    /// @dev Shares that land on the vault itself would be counted as nobody's claim while their
    ///      underlying still inflates `totalAssets()` for everyone else. Reject up front.
    function _checkReceiver(address receiver) private view {
        if (receiver == address(this) || receiver == address(0)) revert InvalidReceiver();
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return DECIMALS_OFFSET;
    }

    /// @dev Resolve the diamond between ERC20 and ERC4626 (ERC4626 adds the offset).
    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
        return ERC4626.decimals();
    }
}
