// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SaveTokenVault is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAssetAddress();
    error UnsupportedAssetBehavior();

    event YieldDonated(address indexed caller, uint256 assets);

    constructor(IERC20 asset_, string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC4626(asset_) {
        if (address(asset_) == address(0)) {
            revert ZeroAssetAddress();
        }
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

    function donate(uint256 assets) external nonReentrant {
        _transferIn(_msgSender(), assets);
        emit YieldDonated(_msgSender(), assets);
    }

    function _transferIn(address from, uint256 assets) internal override {
        IERC20 assetToken = IERC20(asset());
        uint256 balanceBefore = assetToken.balanceOf(address(this));
        assetToken.safeTransferFrom(from, address(this), assets);
        uint256 received = assetToken.balanceOf(address(this)) - balanceBefore;

        if (received != assets) {
            revert UnsupportedAssetBehavior();
        }
    }
}
