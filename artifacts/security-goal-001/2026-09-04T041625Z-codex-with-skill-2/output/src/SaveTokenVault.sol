// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC4626} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract SaveTokenVault is ERC4626, ERC20Permit, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAssetAddress();
    error ZeroAmount();
    error InexactAssetTransfer(uint256 expectedAssets, uint256 actualAssets);

    event YieldDonated(address indexed caller, uint256 assetsReceived);

    IERC20 public immutable UNDERLYING_ASSET;

    constructor(IERC20 asset_, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
        ERC20Permit(name_)
    {
        if (address(asset_) == address(0)) {
            revert ZeroAssetAddress();
        }

        UNDERLYING_ASSET = asset_;
    }

    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
        return ERC4626.decimals();
    }

    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
        if (assets == 0) {
            revert ZeroAmount();
        }

        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
        if (shares == 0) {
            revert ZeroAmount();
        }

        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        if (assets == 0) {
            revert ZeroAmount();
        }

        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256 assets)
    {
        if (shares == 0) {
            revert ZeroAmount();
        }

        return super.redeem(shares, receiver, owner);
    }

    function donate(uint256 assets) external nonReentrant returns (uint256 assetsReceived) {
        if (assets == 0) {
            revert ZeroAmount();
        }

        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
        UNDERLYING_ASSET.safeTransferFrom(msg.sender, address(this), assets);
        assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;

        if (assetsReceived == 0) {
            revert InexactAssetTransfer(assets, 0);
        }

        emit YieldDonated(msg.sender, assetsReceived);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        uint256 balanceBefore = UNDERLYING_ASSET.balanceOf(address(this));
        UNDERLYING_ASSET.safeTransferFrom(caller, address(this), assets);
        uint256 assetsReceived = UNDERLYING_ASSET.balanceOf(address(this)) - balanceBefore;

        if (assetsReceived != assets) {
            revert InexactAssetTransfer(assets, assetsReceived);
        }

        _mint(receiver, shares);

        emit Deposit(caller, receiver, assets, shares);
    }
}
