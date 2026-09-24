// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice ERC-4626 savings vault whose share token is the transferable receipt.
/// @dev Yield is accounted for by direct transfers of the underlying asset into this contract.
contract TokenSavingsVault is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 private constant DECIMALS_OFFSET = 6;

    address public immutable FACTORY;

    error ZeroAddress();
    error InexactAssetTransfer(uint256 expected, uint256 received);
    error SharesBelowMinimum(uint256 shares, uint256 minimum);
    error SharesAboveMaximum(uint256 shares, uint256 maximum);
    error AssetsBelowMinimum(uint256 assets, uint256 minimum);
    error AssetsAboveMaximum(uint256 assets, uint256 maximum);

    constructor(IERC20 asset_, string memory name_, string memory symbol_, address factory_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
    {
        if (address(asset_) == address(0) || factory_ == address(0)) {
            revert ZeroAddress();
        }

        FACTORY = factory_;
    }

    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
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

    function depositWithMinShares(uint256 assets, address receiver, uint256 minShares)
        external
        returns (uint256 shares)
    {
        shares = deposit(assets, receiver);
        if (shares < minShares) {
            revert SharesBelowMinimum(shares, minShares);
        }
    }

    function mintWithMaxAssets(uint256 shares, address receiver, uint256 maxAssets) external returns (uint256 assets) {
        assets = mint(shares, receiver);
        if (assets > maxAssets) {
            revert AssetsAboveMaximum(assets, maxAssets);
        }
    }

    function withdrawWithMaxShares(uint256 assets, address receiver, address owner, uint256 maxShares)
        external
        returns (uint256 shares)
    {
        shares = withdraw(assets, receiver, owner);
        if (shares > maxShares) {
            revert SharesAboveMaximum(shares, maxShares);
        }
    }

    function redeemWithMinAssets(uint256 shares, address receiver, address owner, uint256 minAssets)
        external
        returns (uint256 assets)
    {
        assets = redeem(shares, receiver, owner);
        if (assets < minAssets) {
            revert AssetsBelowMinimum(assets, minAssets);
        }
    }

    function _transferIn(address from, uint256 assets) internal override {
        IERC20 token = IERC20(asset());
        uint256 balanceBefore = token.balanceOf(address(this));

        token.safeTransferFrom(from, address(this), assets);

        uint256 received = token.balanceOf(address(this)) - balanceBefore;
        if (received != assets) {
            revert InexactAssetTransfer(assets, received);
        }
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return DECIMALS_OFFSET;
    }
}
