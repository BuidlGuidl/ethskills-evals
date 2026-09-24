// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "./ERC20.sol";
import {IERC20} from "./IERC20.sol";
import {SafeERC20} from "./SafeERC20.sol";

contract SaveTokenVault is ERC20 {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAssets();
    error ZeroShares();
    error SlippageExceeded(uint256 actual, uint256 minimum);

    IERC20 private immutable ASSET;
    address private immutable FACTORY;

    uint256 private locked = 1;

    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );

    constructor(IERC20 asset_, string memory name_, string memory symbol_, uint8 decimals_)
        ERC20(name_, symbol_, decimals_)
    {
        if (address(asset_) == address(0)) revert ZeroAddress();

        ASSET = asset_;
        FACTORY = msg.sender;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function asset() public view returns (IERC20) {
        return ASSET;
    }

    function factory() public view returns (address) {
        return FACTORY;
    }

    function _nonReentrantBefore() private {
        require(locked == 1, "SaveTokenVault: reentrant call");
        locked = 2;
    }

    function _nonReentrantAfter() private {
        locked = 1;
    }

    function totalAssets() public view returns (uint256) {
        return ASSET.balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? assets : (assets * supply) / totalAssets();
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? shares : (shares * totalAssets()) / supply;
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        return convertToAssets(balanceOf[owner]);
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    function previewMint(uint256 shares) external view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? shares : _mulDivUp(shares, totalAssets(), supply);
    }

    function previewWithdraw(uint256 assets) external view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? assets : _mulDivUp(assets, supply, totalAssets());
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }

    function deposit(uint256 assets, address receiver, uint256 minSharesOut)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (receiver == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAssets();

        uint256 assetsBefore = totalAssets();
        ASSET.safeTransferFrom(msg.sender, address(this), assets);
        uint256 received = totalAssets() - assetsBefore;
        if (received == 0) revert ZeroAssets();

        uint256 supply = totalSupply;
        shares = supply == 0 ? received : (received * supply) / assetsBefore;
        if (shares == 0) revert ZeroShares();
        if (shares < minSharesOut) revert SlippageExceeded(shares, minSharesOut);

        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, received, shares);
    }

    function redeem(uint256 shares, address receiver, address owner, uint256 minAssetsOut)
        public
        nonReentrant
        returns (uint256 assetsOut)
    {
        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
        if (shares == 0) revert ZeroShares();

        _spendAllowance(owner, msg.sender, shares);

        assetsOut = convertToAssets(shares);
        if (assetsOut == 0) revert ZeroAssets();
        if (assetsOut < minAssetsOut) revert SlippageExceeded(assetsOut, minAssetsOut);

        _burn(owner, shares);
        ASSET.safeTransfer(receiver, assetsOut);

        emit Withdraw(msg.sender, receiver, owner, assetsOut, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner, uint256 maxSharesIn)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAssets();

        shares = _mulDivUp(assets, totalSupply, totalAssets());
        if (shares == 0) revert ZeroShares();
        if (shares > maxSharesIn) revert SlippageExceeded(shares, maxSharesIn);

        _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);
        ASSET.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
        return x == 0 ? 0 : ((x * y) - 1) / denominator + 1;
    }

    function _spendAllowance(address owner, address spender, uint256 shares) private {
        if (spender == owner) return;

        uint256 allowed = allowance[owner][spender];
        if (allowed != type(uint256).max) {
            require(allowed >= shares, "ERC20: insufficient allowance");
            unchecked {
                allowance[owner][spender] = allowed - shares;
            }
            emit Approval(owner, spender, allowance[owner][spender]);
        }
    }
}
