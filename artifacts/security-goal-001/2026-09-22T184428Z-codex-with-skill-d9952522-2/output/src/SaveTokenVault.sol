// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice ERC-4626 receipt-token vault for one underlying ERC-20.
/// @dev Yield is accounted for as direct transfers of the underlying into this contract.
contract SaveTokenVault is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 internal constant DECIMALS_OFFSET = 6;

    error AssetIsZero();
    error AssetIsNotContract(address asset);
    error FeeOnTransferToken(address token, uint256 expected, uint256 actual);
    error InvalidReceiver();

    constructor(IERC20 asset_, string memory name_, string memory symbol_)
        ERC4626(asset_)
        ERC20(name_, symbol_)
    {
        address assetAddress = address(asset_);
        if (assetAddress == address(0)) {
            revert AssetIsZero();
        }
        if (assetAddress.code.length == 0) {
            revert AssetIsNotContract(assetAddress);
        }
    }

    function deposit(uint256 assets, address receiver)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver)
        public
        override
        nonReentrant
        returns (uint256 assets)
    {
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256 assets)
    {
        return super.redeem(shares, receiver, owner);
    }

    function _transferIn(address from, uint256 assets) internal override {
        IERC20 token = IERC20(asset());
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), assets);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;

        if (received != assets) {
            revert FeeOnTransferToken(address(token), assets, received);
        }
    }

    function _transferOut(address to, uint256 assets) internal override {
        if (to == address(this)) {
            revert InvalidReceiver();
        }

        IERC20 token = IERC20(asset());
        uint256 balanceBefore = token.balanceOf(to);
        token.safeTransfer(to, assets);
        uint256 received = token.balanceOf(to) - balanceBefore;

        if (received != assets) {
            revert FeeOnTransferToken(address(token), assets, received);
        }
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return DECIMALS_OFFSET;
    }
}
