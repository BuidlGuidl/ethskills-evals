// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";
import {Math} from "./libraries/Math.sol";
import {SafeERC20} from "./libraries/SafeERC20.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";

contract TokenVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant _VIRTUAL_ASSETS = 1;
    uint256 private constant _VIRTUAL_SHARES = 1;

    IERC20 public immutable asset;
    address public immutable factory;

    string public name;
    string public symbol;
    uint8 public immutable decimals;

    uint256 public totalSupply;
    mapping(address account => uint256) public balanceOf;
    mapping(address owner => mapping(address spender => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    error ZeroAddress();
    error ZeroAmount();
    error ZeroShares();
    error SlippageExceeded();
    error InsufficientBalance();
    error InsufficientAllowance();

    constructor(IERC20 asset_, string memory name_, string memory symbol_, uint8 decimals_) {
        if (address(asset_) == address(0)) {
            revert ZeroAddress();
        }

        asset = asset_;
        factory = msg.sender;
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, totalAssets(), totalSupply, Math.Rounding.Down);
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return _convertToAssets(shares, totalAssets(), totalSupply, Math.Rounding.Down);
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    function previewWithdraw(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, totalAssets(), totalSupply, Math.Rounding.Up);
    }

    function previewRedeem(uint256 shares) public view returns (uint256) {
        return convertToAssets(shares);
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        return convertToAssets(balanceOf[owner]);
    }

    function maxRedeem(address owner) external view returns (uint256) {
        return balanceOf[owner];
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        return deposit(assets, receiver, 0);
    }

    function deposit(uint256 assets, address receiver, uint256 minShares) public nonReentrant returns (uint256 shares) {
        if (assets == 0) {
            revert ZeroAmount();
        }
        if (receiver == address(0)) {
            revert ZeroAddress();
        }

        uint256 assetsBefore = totalAssets();
        uint256 supplyBefore = totalSupply;

        asset.safeTransferFrom(msg.sender, address(this), assets);

        uint256 received = totalAssets() - assetsBefore;
        if (received == 0) {
            revert ZeroAmount();
        }

        shares = _convertToShares(received, assetsBefore, supplyBefore, Math.Rounding.Down);
        if (shares == 0) {
            revert ZeroShares();
        }
        if (shares < minShares) {
            revert SlippageExceeded();
        }

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, received, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        return withdraw(assets, receiver, owner, type(uint256).max);
    }

    function withdraw(uint256 assets, address receiver, address owner, uint256 maxShares)
        public
        nonReentrant
        returns (uint256 shares)
    {
        if (assets == 0) {
            revert ZeroAmount();
        }
        if (receiver == address(0) || owner == address(0)) {
            revert ZeroAddress();
        }

        shares = previewWithdraw(assets);
        if (shares == 0) {
            revert ZeroShares();
        }
        if (shares > maxShares) {
            revert SlippageExceeded();
        }

        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }

        _burn(owner, shares);
        asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        return redeem(shares, receiver, owner, 0);
    }

    function redeem(uint256 shares, address receiver, address owner, uint256 minAssets)
        public
        nonReentrant
        returns (uint256 assets)
    {
        if (shares == 0) {
            revert ZeroAmount();
        }
        if (receiver == address(0) || owner == address(0)) {
            revert ZeroAddress();
        }

        assets = previewRedeem(shares);
        if (assets == 0) {
            revert ZeroAmount();
        }
        if (assets < minAssets) {
            revert SlippageExceeded();
        }

        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }

        _burn(owner, shares);
        asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function _convertToShares(uint256 assets, uint256 totalAssets_, uint256 totalSupply_, Math.Rounding rounding)
        internal
        pure
        returns (uint256)
    {
        return Math.mulDiv(assets, totalSupply_ + _VIRTUAL_SHARES, totalAssets_ + _VIRTUAL_ASSETS, rounding);
    }

    function _convertToAssets(uint256 shares, uint256 totalAssets_, uint256 totalSupply_, Math.Rounding rounding)
        internal
        pure
        returns (uint256)
    {
        return Math.mulDiv(shares, totalAssets_ + _VIRTUAL_ASSETS, totalSupply_ + _VIRTUAL_SHARES, rounding);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) {
            revert ZeroAddress();
        }

        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) {
            revert InsufficientBalance();
        }

        unchecked {
            balanceOf[from] = fromBalance - amount;
            balanceOf[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        unchecked {
            balanceOf[to] += amount;
        }
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) {
            revert InsufficientBalance();
        }

        unchecked {
            balanceOf[from] = fromBalance - amount;
            totalSupply -= amount;
        }

        emit Transfer(from, address(0), amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        if (owner == address(0) || spender == address(0)) {
            revert ZeroAddress();
        }

        allowance[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowance[owner][spender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) {
                revert InsufficientAllowance();
            }
            unchecked {
                allowance[owner][spender] = currentAllowance - amount;
            }
        }
    }
}

