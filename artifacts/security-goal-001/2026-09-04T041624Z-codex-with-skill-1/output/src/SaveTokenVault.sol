// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @notice Permissionless single-asset vault with transferable pro-rata receipt tokens.
/// @dev Yield is expressed as direct donations of the underlying asset into the vault.
contract SaveTokenVault is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAddressListingOperator();
    error UnsupportedAssetOnDeposit(uint256 expectedAssets, uint256 actualAssets);
    error UnsupportedAssetOnWithdraw(uint256 expectedAssets, uint256 actualAssets);
    error InvalidReceiver(address receiver);

    address public immutable listingOperator;

    constructor(IERC20 asset_, string memory name_, string memory symbol_, address listingOperator_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
    {
        if (listingOperator_ == address(0)) revert ZeroAddressListingOperator();
        listingOperator = listingOperator_;
    }

    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
        return super.redeem(shares, receiver, owner);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        uint256 balanceBefore = totalAssets();
        IERC20(asset()).safeTransferFrom(caller, address(this), assets);
        uint256 receivedAssets = totalAssets() - balanceBefore;

        if (receivedAssets != assets) {
            revert UnsupportedAssetOnDeposit(assets, receivedAssets);
        }

        _mint(receiver, shares);
        emit Deposit(caller, receiver, assets, shares);
    }

    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares) internal override {
        if (receiver == address(this)) revert InvalidReceiver(receiver);

        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        uint256 vaultBalanceBefore = totalAssets();
        uint256 receiverBalanceBefore = IERC20(asset()).balanceOf(receiver);

        _burn(owner, shares);
        IERC20(asset()).safeTransfer(receiver, assets);

        uint256 vaultAssetsDebited = vaultBalanceBefore - totalAssets();
        uint256 receiverAssetsCredited = IERC20(asset()).balanceOf(receiver) - receiverBalanceBefore;

        if (vaultAssetsDebited != assets || receiverAssetsCredited != assets) {
            revert UnsupportedAssetOnWithdraw(assets, receiverAssetsCredited);
        }

        emit Withdraw(caller, receiver, owner, assets, shares);
    }
}

