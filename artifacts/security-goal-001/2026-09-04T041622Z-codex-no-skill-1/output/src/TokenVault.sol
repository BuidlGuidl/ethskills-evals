// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";
import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
import {MathLib} from "./lib/MathLib.sol";

contract TokenVault {
    using SafeTransferLib for IERC20;

    error ZeroAssets();
    error ZeroShares();
    error InsufficientBalance();
    error InsufficientAllowance();
    error Reentrancy();
    error UnsupportedAssetDecimals();
    error FeeOnTransferUnsupported();

    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );

    IERC20 public immutable ASSET;
    address public immutable FACTORY;

    string public name;
    string public symbol;
    uint8 public immutable DECIMALS;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    uint256 private unlocked = 1;

    constructor(address asset_, string memory name_, string memory symbol_) {
        uint8 assetDecimals = _readDecimals(asset_);
        if (assetDecimals > 18) revert UnsupportedAssetDecimals();

        ASSET = IERC20(asset_);
        FACTORY = msg.sender;
        name = name_;
        symbol = symbol_;
        DECIMALS = assetDecimals;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function totalAssets() public view returns (uint256) {
        return ASSET.balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, MathLib.Rounding.Floor);
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, MathLib.Rounding.Floor);
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return _convertToShares(assets, MathLib.Rounding.Floor);
    }

    function previewMint(uint256 shares) external view returns (uint256) {
        return _convertToAssets(shares, MathLib.Rounding.Ceil);
    }

    function previewWithdraw(uint256 assets) external view returns (uint256) {
        return _convertToShares(assets, MathLib.Rounding.Ceil);
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return _convertToAssets(shares, MathLib.Rounding.Floor);
    }

    function deposit(uint256 assets, address owner) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAssets();

        shares = _convertToShares(assets, MathLib.Rounding.Floor);
        if (shares == 0) revert ZeroShares();

        uint256 balanceBefore = totalAssets();
        ASSET.safeTransferFrom(msg.sender, address(this), assets);
        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();

        _mint(owner, shares);
        emit Deposit(msg.sender, owner, assets, shares);
    }

    function mint(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroShares();

        assets = _convertToAssets(shares, MathLib.Rounding.Ceil);
        if (assets == 0) revert ZeroAssets();

        uint256 balanceBefore = totalAssets();
        ASSET.safeTransferFrom(msg.sender, address(this), assets);
        if (totalAssets() - balanceBefore != assets) revert FeeOnTransferUnsupported();

        _mint(owner, shares);
        emit Deposit(msg.sender, owner, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAssets();

        shares = _convertToShares(assets, MathLib.Rounding.Ceil);
        if (shares == 0) revert ZeroShares();

        _spendAllowanceIfNeeded(owner, msg.sender, shares);
        _burn(owner, shares);
        ASSET.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner)
        external
        nonReentrant
        returns (uint256 assets)
    {
        if (shares == 0) revert ZeroShares();

        _spendAllowanceIfNeeded(owner, msg.sender, shares);
        assets = _convertToAssets(shares, MathLib.Rounding.Floor);
        if (assets == 0) revert ZeroAssets();

        _burn(owner, shares);
        ASSET.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        _spendAllowanceIfNeeded(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _convertToShares(uint256 assets, MathLib.Rounding rounding) internal view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 totalManagedAssets = totalAssets();

        if (supply == 0 || totalManagedAssets == 0) {
            return assets;
        }

        return MathLib.mulDiv(assets, supply, totalManagedAssets, rounding);
    }

    function _convertToAssets(uint256 shares, MathLib.Rounding rounding) internal view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 totalManagedAssets = totalAssets();

        if (supply == 0 || totalManagedAssets == 0) {
            return shares;
        }

        return MathLib.mulDiv(shares, totalManagedAssets, supply, rounding);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        unchecked {
            balanceOf[to] += amount;
        }
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        uint256 accountBalance = balanceOf[from];
        if (accountBalance < amount) revert InsufficientBalance();

        unchecked {
            balanceOf[from] = accountBalance - amount;
            totalSupply -= amount;
        }
        emit Transfer(from, address(0), amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        uint256 accountBalance = balanceOf[from];
        if (accountBalance < amount) revert InsufficientBalance();

        unchecked {
            balanceOf[from] = accountBalance - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
        if (spender == owner) return;

        uint256 currentAllowance = allowance[owner][spender];
        if (currentAllowance < amount) revert InsufficientAllowance();

        if (currentAllowance != type(uint256).max) {
            unchecked {
                allowance[owner][spender] = currentAllowance - amount;
            }
            emit Approval(owner, spender, allowance[owner][spender]);
        }
    }

    function _nonReentrantBefore() internal {
        if (unlocked != 1) revert Reentrancy();
        unlocked = 2;
    }

    function _nonReentrantAfter() internal {
        unlocked = 1;
    }

    function _readDecimals(address asset_) internal view returns (uint8 assetDecimals) {
        (bool success, bytes memory data) = asset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
        if (!success || data.length < 32) revert UnsupportedAssetDecimals();
        assetDecimals = abi.decode(data, (uint8));
    }
}
