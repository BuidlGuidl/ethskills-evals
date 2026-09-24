// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract SaveAnyTokenVault is ERC20, IERC4626, ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    uint8 private constant DECIMALS_OFFSET = 9;
    uint256 private constant VIRTUAL_ASSETS = 1;
    uint256 private constant VIRTUAL_SHARES = 10 ** DECIMALS_OFFSET;

    IERC20 private immutable _ASSET;
    address private immutable _FACTORY;

    uint8 private immutable _VAULT_DECIMALS;

    error InvalidAsset();
    error InvalidReceiver();
    error ZeroAssets();
    error ZeroShares();
    error FeeOnTransferAsset();

    constructor(IERC20 asset_, address factory_, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        if (address(asset_) == address(0)) revert InvalidAsset();

        _ASSET = asset_;
        _FACTORY = factory_;
        _VAULT_DECIMALS = _receiptDecimals(asset_);
    }

    function asset() public view returns (address) {
        return address(_ASSET);
    }

    function factory() public view returns (address) {
        return _FACTORY;
    }

    function decimals() public view override(ERC20, IERC20Metadata) returns (uint8) {
        return _VAULT_DECIMALS;
    }

    function totalAssets() public view returns (uint256) {
        return _ASSET.balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }

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

    function maxDeposit(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function maxMint(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        return convertToAssets(balanceOf(owner));
    }

    function maxRedeem(address owner) external view returns (uint256) {
        return balanceOf(owner);
    }

    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAssets();
        if (receiver == address(0)) revert InvalidReceiver();

        shares = previewDeposit(assets);
        if (shares == 0) revert ZeroShares();

        uint256 balanceBefore = totalAssets();
        _ASSET.safeTransferFrom(msg.sender, address(this), assets);
        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferAsset();

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0)) revert InvalidReceiver();

        assets = previewMint(shares);
        if (assets == 0) revert ZeroAssets();

        uint256 balanceBefore = totalAssets();
        _ASSET.safeTransferFrom(msg.sender, address(this), assets);
        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferAsset();

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAssets();
        if (receiver == address(0)) revert InvalidReceiver();

        shares = previewWithdraw(assets);
        if (shares == 0) revert ZeroShares();

        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }

        _burn(owner, shares);
        _ASSET.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0)) revert InvalidReceiver();

        assets = previewRedeem(shares);
        if (assets == 0) revert ZeroAssets();

        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }

        _burn(owner, shares);
        _ASSET.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function _convertToShares(uint256 assets, Math.Rounding rounding) internal view returns (uint256) {
        return assets.mulDiv(totalSupply() + VIRTUAL_SHARES, totalAssets() + VIRTUAL_ASSETS, rounding);
    }

    function _convertToAssets(uint256 shares, Math.Rounding rounding) internal view returns (uint256) {
        return shares.mulDiv(totalAssets() + VIRTUAL_ASSETS, totalSupply() + VIRTUAL_SHARES, rounding);
    }

    function _receiptDecimals(IERC20 token) private view returns (uint8) {
        try IERC20Metadata(address(token)).decimals() returns (uint8 assetDecimals) {
            if (assetDecimals <= type(uint8).max - DECIMALS_OFFSET) {
                return assetDecimals + DECIMALS_OFFSET;
            }
        } catch {}

        return 18 + DECIMALS_OFFSET;
    }
}
