// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title SaveVault
/// @notice A single-asset savings vault. Depositors receive a transferable
///         receipt token (shares) representing a pro-rata claim on everything
///         the vault holds. Yield is recognised implicitly: a keeper transfers
///         more of the underlying in, `totalAssets()` rises, and every share
///         becomes worth more.
///
/// @dev Deliberately *not* advertised as ERC-4626 compliant. The vault is
///      deployed permissionlessly for arbitrary tokens, and ERC-4626 requires
///      guarantees (`previewDeposit` exactness, `mint` returning exactly the
///      requested shares) that cannot hold for fee-on-transfer assets. The
///      ERC-4626 method set and events are kept for composability; the places
///      where behaviour diverges are documented on each function.
///
///      Accounting invariants:
///        * every balance-changing entry point is `nonReentrant`
///        * share math uses virtual assets/shares (OZ inflation-attack defence)
///        * `MIN_LOCKED_SHARES` are burned on the first deposit, so
///          `totalSupply()` can never return to zero
///        * rounding always resolves in favour of the vault (i.e. of the
///          existing shareholders)
contract SaveVault is ERC20, ERC20Permit, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Share decimals are underlying decimals + this offset.
    /// @dev Virtual shares = 10**DECIMALS_OFFSET against 1 virtual asset. This
    ///      makes a donation ("inflation") attack cost the attacker ~10**OFFSET
    ///      times whatever they could steal.
    uint8 public constant DECIMALS_OFFSET = 3;

    /// @notice Shares permanently burned on the first deposit.
    /// @dev Guarantees totalSupply() > 0 forever, so the first-deposit branch
    ///      of the share math can never be re-entered by draining the vault.
    uint256 public constant MIN_LOCKED_SHARES = 10 ** 3;

    address private constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice The underlying ERC-20 this vault saves.
    IERC20 public immutable asset;

    uint8 private immutable _assetDecimals;

    /*//////////////////////////////////////////////////////////////
                             EVENTS / ERRORS
    //////////////////////////////////////////////////////////////*/

    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );

    error ZeroAddress();
    error ZeroAmount();
    error SlippageExceeded(uint256 actual, uint256 bound);
    error InsufficientInitialDeposit(uint256 shares, uint256 required);
    /// @dev The asset moved a different amount than requested (fee-on-transfer
    ///      or rebasing) on a path that requires an exact amount.
    error InexactAssetTransfer(uint256 requested, uint256 received);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address asset_, string memory name_, string memory symbol_, uint8 assetDecimals_)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
    {
        if (asset_ == address(0)) revert ZeroAddress();
        asset = IERC20(asset_);
        _assetDecimals = assetDecimals_;
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    function decimals() public view override returns (uint8) {
        return _assetDecimals + DECIMALS_OFFSET;
    }

    /// @notice Everything the vault can pay out, including keeper yield that
    ///         simply landed here by transfer.
    /// @dev Balance-based on purpose: that is the only way a plain transfer from
    ///      the keeper can lift every holder's claim without a permissioned
    ///      `notifyReward` call. The cost is that anyone can donate; see the
    ///      virtual-share defence above.
    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, totalAssets(), Math.Rounding.Floor);
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, totalAssets(), Math.Rounding.Floor);
    }

    /// @dev For a fee-on-transfer asset the realised share count will be lower
    ///      than this quote, because only what actually arrives is credited.
    function previewDeposit(uint256 assets) public view returns (uint256) {
        return convertToShares(assets);
    }

    function previewMint(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, totalAssets(), Math.Rounding.Ceil);
    }

    function previewWithdraw(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, totalAssets(), Math.Rounding.Ceil);
    }

    function previewRedeem(uint256 shares) public view returns (uint256) {
        return convertToAssets(shares);
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

    /*//////////////////////////////////////////////////////////////
                             DEPOSIT / MINT
    //////////////////////////////////////////////////////////////*/

    /// @notice Deposit `assets` and receive shares, crediting only what actually
    ///         arrived (fee-on-transfer safe).
    /// @param minSharesOut Slippage bound. Required because the share price can
    ///        move between simulation and execution (keeper yield, donations,
    ///        or a transfer fee) and because a stale quote is how depositors get
    ///        sandwiched.
    function deposit(uint256 assets, address receiver, uint256 minSharesOut)
        public
        nonReentrant
        returns (uint256 shares)
    {
        if (receiver == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAmount();

        // Snapshot before pulling: this is the basis the incoming assets are
        // priced against. Taking it after would price the deposit against itself.
        uint256 assetsBefore = totalAssets();
        uint256 received = _pull(assets);

        shares = _convertToShares(received, assetsBefore, Math.Rounding.Floor);
        if (shares == 0) revert ZeroAmount();

        if (totalSupply() == 0) {
            // First deposit: permanently lock a slice of the supply so the
            // share price can never be reset by emptying the vault.
            if (shares <= MIN_LOCKED_SHARES) {
                revert InsufficientInitialDeposit(shares, MIN_LOCKED_SHARES + 1);
            }
            unchecked {
                shares -= MIN_LOCKED_SHARES;
            }
            _mint(BURN_ADDRESS, MIN_LOCKED_SHARES);
        }

        if (shares < minSharesOut) revert SlippageExceeded(shares, minSharesOut);

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, received, shares);
    }

    /// @notice ERC-4626-shaped overload. Equivalent to `deposit(assets, receiver, 0)`.
    /// @dev No slippage bound — only safe from a contract that checks the return
    ///      value itself. Prefer the three-argument form from an EOA/router.
    function deposit(uint256 assets, address receiver) external returns (uint256) {
        return deposit(assets, receiver, 0);
    }

    /// @notice Mint exactly `shares`, paying at most `maxAssetsIn`.
    /// @dev Reverts for fee-on-transfer assets: "exactly `shares`" and "the
    ///      vault receives less than it pulled" cannot both hold. Use `deposit`
    ///      for those tokens.
    function mint(uint256 shares, address receiver, uint256 maxAssetsIn) public nonReentrant returns (uint256 assets) {
        if (receiver == address(0)) revert ZeroAddress();
        if (shares == 0) revert ZeroAmount();

        uint256 assetsBefore = totalAssets();
        assets = _convertToAssets(shares, assetsBefore, Math.Rounding.Ceil);
        if (assets == 0) revert ZeroAmount();
        if (assets > maxAssetsIn) revert SlippageExceeded(assets, maxAssetsIn);

        uint256 received = _pull(assets);
        if (received != assets) revert InexactAssetTransfer(assets, received);

        if (totalSupply() == 0) {
            if (shares <= MIN_LOCKED_SHARES) {
                revert InsufficientInitialDeposit(shares, MIN_LOCKED_SHARES + 1);
            }
            unchecked {
                shares -= MIN_LOCKED_SHARES;
            }
            _mint(BURN_ADDRESS, MIN_LOCKED_SHARES);
        }

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function mint(uint256 shares, address receiver) external returns (uint256) {
        return mint(shares, receiver, type(uint256).max);
    }

    /*//////////////////////////////////////////////////////////////
                            WITHDRAW / REDEEM
    //////////////////////////////////////////////////////////////*/

    /// @notice Burn `shares` from `owner` and send the underlying to `receiver`.
    /// @param minAssetsOut Slippage bound, measured as assets leaving the vault.
    function redeem(uint256 shares, address receiver, address owner, uint256 minAssetsOut)
        public
        nonReentrant
        returns (uint256 assets)
    {
        if (receiver == address(0)) revert ZeroAddress();
        if (shares == 0) revert ZeroAmount();

        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);

        assets = _convertToAssets(shares, totalAssets(), Math.Rounding.Floor);
        if (assets == 0) revert ZeroAmount();
        if (assets < minAssetsOut) revert SlippageExceeded(assets, minAssetsOut);

        // Effects before interactions: burning first means a token with a
        // transfer hook re-entering (on top of the guard) still sees a
        // consistent share price.
        _burn(owner, shares);
        asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256) {
        return redeem(shares, receiver, owner, 0);
    }

    /// @notice Withdraw exactly `assets` out of the vault, burning at most
    ///         `maxSharesIn` shares from `owner`.
    /// @dev `assets` is measured leaving the vault. For a fee-on-transfer asset
    ///      the receiver lands less than that; the shortfall is the token's fee,
    ///      not vault slippage.
    function withdraw(uint256 assets, address receiver, address owner, uint256 maxSharesIn)
        public
        nonReentrant
        returns (uint256 shares)
    {
        if (receiver == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAmount();

        shares = _convertToShares(assets, totalAssets(), Math.Rounding.Ceil);
        if (shares == 0) revert ZeroAmount();
        if (shares > maxSharesIn) revert SlippageExceeded(shares, maxSharesIn);

        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);

        _burn(owner, shares);
        asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256) {
        return withdraw(assets, receiver, owner, type(uint256).max);
    }

    /*//////////////////////////////////////////////////////////////
                              INTERNAL MATH
    //////////////////////////////////////////////////////////////*/

    /// @dev Pulls `assets` from the caller and returns the measured increase in
    ///      the vault's balance. Never trusts the requested amount.
    function _pull(uint256 assets) private returns (uint256 received) {
        uint256 before = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), assets);
        uint256 afterBal = asset.balanceOf(address(this));
        // A token whose balance *shrinks* on an inbound transfer would
        // underflow here; reverting is the correct outcome.
        received = afterBal - before;
        if (received == 0) revert ZeroAmount();
    }

    /// @param totalAssets_ the asset basis the conversion is priced against
    function _convertToShares(uint256 assets, uint256 totalAssets_, Math.Rounding rounding)
        private
        view
        returns (uint256)
    {
        uint256 supply = totalSupply();
        // Bootstrapping: price the very first deposit against a clean slate so
        // that assets pre-donated into the vault cannot dilute it. They are
        // absorbed as a gift to that depositor, which makes the donation a pure
        // loss for whoever made it.
        uint256 basis = supply == 0 ? 0 : totalAssets_;
        return assets.mulDiv(supply + 10 ** DECIMALS_OFFSET, basis + 1, rounding);
    }

    function _convertToAssets(uint256 shares, uint256 totalAssets_, Math.Rounding rounding)
        private
        view
        returns (uint256)
    {
        uint256 supply = totalSupply();
        uint256 basis = supply == 0 ? 0 : totalAssets_;
        return shares.mulDiv(basis + 1, supply + 10 ** DECIMALS_OFFSET, rounding);
    }
}
