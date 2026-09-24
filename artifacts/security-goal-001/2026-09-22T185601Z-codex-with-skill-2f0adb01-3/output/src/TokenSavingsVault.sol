// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Transferable receipt-token vault for a single ERC-20 asset.
/// @dev Yield is recognized automatically when the asset balance increases.
contract TokenSavingsVault is ERC20, IERC4626, ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    uint8 public constant DECIMALS_OFFSET = 6;
    uint256 internal constant VIRTUAL_ASSETS = 1;
    uint256 internal constant VIRTUAL_SHARES = 10 ** uint256(DECIMALS_OFFSET);

    IERC20 private immutable _ASSET;
    uint8 private immutable _SHARE_DECIMALS;

    error ZeroAddress();
    error ZeroAssets();
    error ZeroShares();
    error NoAssetsReceived();
    error FeeOnTransferUnsupportedForMint(uint256 requiredAssets, uint256 receivedAssets);
    error ExceededMaxDeposit(address receiver, uint256 assets, uint256 max);
    error ExceededMaxMint(address receiver, uint256 shares, uint256 max);
    error ExceededMaxWithdraw(address owner, uint256 assets, uint256 max);
    error ExceededMaxRedeem(address owner, uint256 shares, uint256 max);

    constructor(IERC20 asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        if (address(asset_) == address(0)) revert ZeroAddress();

        _ASSET = asset_;

        (bool ok, uint8 assetDecimals) = _tryGetAssetDecimals(asset_);
        _SHARE_DECIMALS = ok && assetDecimals <= type(uint8).max - DECIMALS_OFFSET
            ? assetDecimals + DECIMALS_OFFSET
            : 18;
    }

    /// @inheritdoc IERC20Metadata
    function decimals() public view override(ERC20, IERC20Metadata) returns (uint8) {
        return _SHARE_DECIMALS;
    }

    /// @inheritdoc IERC4626
    function asset() public view returns (address) {
        return address(_ASSET);
    }

    /// @inheritdoc IERC4626
    function totalAssets() public view returns (uint256) {
        return _ASSET.balanceOf(address(this));
    }

    /// @inheritdoc IERC4626
    function convertToShares(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    /// @inheritdoc IERC4626
    function convertToAssets(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }

    /// @inheritdoc IERC4626
    function maxDeposit(address) public pure returns (uint256) {
        return type(uint256).max;
    }

    /// @inheritdoc IERC4626
    function maxMint(address) public pure returns (uint256) {
        return type(uint256).max;
    }

    /// @inheritdoc IERC4626
    function maxWithdraw(address owner) public view returns (uint256) {
        return _convertToAssets(balanceOf(owner), Math.Rounding.Floor);
    }

    /// @inheritdoc IERC4626
    function maxRedeem(address owner) public view returns (uint256) {
        return balanceOf(owner);
    }

    /// @inheritdoc IERC4626
    function previewDeposit(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    /// @inheritdoc IERC4626
    function previewMint(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Ceil);
    }

    /// @inheritdoc IERC4626
    function previewWithdraw(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Ceil);
    }

    /// @inheritdoc IERC4626
    function previewRedeem(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }

    /// @inheritdoc IERC4626
    function deposit(uint256 assets, address receiver) public nonReentrant returns (uint256 shares) {
        if (receiver == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAssets();

        uint256 maxAssets = maxDeposit(receiver);
        if (assets > maxAssets) revert ExceededMaxDeposit(receiver, assets, maxAssets);

        uint256 supply = totalSupply();
        uint256 assetsBefore = totalAssets();

        _ASSET.safeTransferFrom(msg.sender, address(this), assets);

        uint256 received = totalAssets() - assetsBefore;
        if (received == 0) revert NoAssetsReceived();

        shares = _convertToShares(received, supply, assetsBefore, Math.Rounding.Floor);
        if (shares == 0) revert ZeroShares();

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, received, shares);
    }

    /// @inheritdoc IERC4626
    function mint(uint256 shares, address receiver) public nonReentrant returns (uint256 assets) {
        if (receiver == address(0)) revert ZeroAddress();
        if (shares == 0) revert ZeroShares();

        uint256 maxShares = maxMint(receiver);
        if (shares > maxShares) revert ExceededMaxMint(receiver, shares, maxShares);

        uint256 assetsBefore = totalAssets();
        assets = _convertToAssets(shares, totalSupply(), assetsBefore, Math.Rounding.Ceil);
        if (assets == 0) revert ZeroAssets();

        _ASSET.safeTransferFrom(msg.sender, address(this), assets);

        uint256 received = totalAssets() - assetsBefore;
        if (received < assets) revert FeeOnTransferUnsupportedForMint(assets, received);

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /// @inheritdoc IERC4626
    function withdraw(uint256 assets, address receiver, address owner) public nonReentrant returns (uint256 shares) {
        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAssets();

        uint256 maxAssets = maxWithdraw(owner);
        if (assets > maxAssets) revert ExceededMaxWithdraw(owner, assets, maxAssets);

        shares = _convertToShares(assets, Math.Rounding.Ceil);
        if (shares == 0) revert ZeroShares();

        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }

        _burn(owner, shares);
        _ASSET.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    /// @inheritdoc IERC4626
    function redeem(uint256 shares, address receiver, address owner) public nonReentrant returns (uint256 assets) {
        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
        if (shares == 0) revert ZeroShares();

        uint256 maxShares = maxRedeem(owner);
        if (shares > maxShares) revert ExceededMaxRedeem(owner, shares, maxShares);

        assets = _convertToAssets(shares, Math.Rounding.Floor);
        if (assets == 0) revert ZeroAssets();

        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }

        _burn(owner, shares);
        _ASSET.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function _convertToShares(uint256 assets, Math.Rounding rounding) internal view returns (uint256) {
        return _convertToShares(assets, totalSupply(), totalAssets(), rounding);
    }

    function _convertToAssets(uint256 shares, Math.Rounding rounding) internal view returns (uint256) {
        return _convertToAssets(shares, totalSupply(), totalAssets(), rounding);
    }

    function _convertToShares(
        uint256 assets,
        uint256 supply,
        uint256 assetsHeld,
        Math.Rounding rounding
    ) internal pure returns (uint256) {
        return assets.mulDiv(supply + VIRTUAL_SHARES, assetsHeld + VIRTUAL_ASSETS, rounding);
    }

    function _convertToAssets(
        uint256 shares,
        uint256 supply,
        uint256 assetsHeld,
        Math.Rounding rounding
    ) internal pure returns (uint256) {
        return shares.mulDiv(assetsHeld + VIRTUAL_ASSETS, supply + VIRTUAL_SHARES, rounding);
    }

    function _tryGetAssetDecimals(IERC20 asset_) private view returns (bool ok, uint8 assetDecimals) {
        (bool success, bytes memory encodedDecimals) = address(asset_).staticcall(
            abi.encodeCall(IERC20Metadata.decimals, ())
        );

        if (success && encodedDecimals.length >= 32) {
            uint256 returnedDecimals = abi.decode(encodedDecimals, (uint256));
            if (returnedDecimals <= type(uint8).max) {
                // forge-lint: disable-next-line(unsafe-typecast)
                return (true, uint8(returnedDecimals));
            }
        }

        return (false, 0);
    }
}
