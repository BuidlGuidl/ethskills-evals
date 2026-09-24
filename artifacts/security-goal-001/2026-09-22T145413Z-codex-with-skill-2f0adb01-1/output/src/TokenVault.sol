// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";
import {Math} from "./libraries/Math.sol";
import {SafeERC20} from "./libraries/SafeERC20.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";

contract TokenVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 public constant DECIMALS_OFFSET = 6;
    uint256 public constant VIRTUAL_ASSETS = 1;
    uint256 public constant VIRTUAL_SHARES = 10 ** DECIMALS_OFFSET;

    IERC20 public immutable asset;
    address public immutable factory;
    address public immutable listedBy;

    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    error ZeroAddress();
    error AssetIsNotContract();
    error EmptyMetadata();
    error ZeroAssets();
    error ZeroShares();
    error InsufficientBalance();
    error InsufficientAllowance();
    error ExceedsMaxWithdraw();
    error ExceedsMaxRedeem();

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );

    constructor(address asset_, string memory name_, string memory symbol_, address listedBy_) {
        if (asset_ == address(0) || listedBy_ == address(0)) revert ZeroAddress();
        if (asset_.code.length == 0) revert AssetIsNotContract();
        if (bytes(name_).length == 0 || bytes(symbol_).length == 0) revert EmptyMetadata();

        asset = IERC20(asset_);
        factory = msg.sender;
        listedBy = listedBy_;
        name = name_;
        symbol = symbol_;
        decimals = _receiptDecimals(asset_);
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

    function previewWithdraw(uint256 assets) external view returns (uint256) {
        return _convertToShares(assets, totalAssets(), totalSupply, Math.Rounding.Up);
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }

    function maxWithdraw(address owner) public view returns (uint256) {
        return convertToAssets(balanceOf[owner]);
    }

    function maxRedeem(address owner) public view returns (uint256) {
        return balanceOf[owner];
    }

    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAssets();
        if (receiver == address(0)) revert ZeroAddress();

        uint256 assetsBefore = totalAssets();
        uint256 supplyBefore = totalSupply;

        asset.safeTransferFrom(msg.sender, address(this), assets);

        uint256 received = totalAssets() - assetsBefore;
        if (received == 0) revert ZeroAssets();

        shares = _convertToShares(received, assetsBefore, supplyBefore, Math.Rounding.Down);
        if (shares == 0) revert ZeroShares();

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, received, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAssets();
        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
        if (assets > maxWithdraw(owner)) revert ExceedsMaxWithdraw();

        shares = _convertToShares(assets, totalAssets(), totalSupply, Math.Rounding.Up);
        _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);

        asset.safeTransfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
        if (shares > maxRedeem(owner)) revert ExceedsMaxRedeem();

        assets = _convertToAssets(shares, totalAssets(), totalSupply, Math.Rounding.Down);
        if (assets == 0) revert ZeroAssets();

        _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);

        asset.safeTransfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _convertToShares(uint256 assets, uint256 assets_, uint256 supply_, Math.Rounding rounding)
        internal
        pure
        returns (uint256)
    {
        return Math.mulDiv(assets, supply_ + VIRTUAL_SHARES, assets_ + VIRTUAL_ASSETS, rounding);
    }

    function _convertToAssets(uint256 shares, uint256 assets_, uint256 supply_, Math.Rounding rounding)
        internal
        pure
        returns (uint256)
    {
        return Math.mulDiv(shares, assets_ + VIRTUAL_ASSETS, supply_ + VIRTUAL_SHARES, rounding);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        uint256 balance = balanceOf[from];
        if (balance < amount) revert InsufficientBalance();

        unchecked {
            balanceOf[from] = balance - amount;
            totalSupply -= amount;
        }

        emit Transfer(from, address(0), amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();

        uint256 balance = balanceOf[from];
        if (balance < amount) revert InsufficientBalance();

        unchecked {
            balanceOf[from] = balance - amount;
            balanceOf[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        if (owner == spender) return;

        uint256 currentAllowance = allowance[owner][spender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) revert InsufficientAllowance();
            unchecked {
                allowance[owner][spender] = currentAllowance - amount;
            }
            emit Approval(owner, spender, allowance[owner][spender]);
        }
    }

    function _receiptDecimals(address asset_) internal view returns (uint8) {
        (bool success, bytes memory data) = asset_.staticcall(abi.encodeWithSignature("decimals()"));
        if (success && data.length >= 32) {
            uint256 assetDecimals = abi.decode(data, (uint256));
            if (assetDecimals <= type(uint8).max - DECIMALS_OFFSET) {
                // forge-lint: disable-next-line(unsafe-typecast)
                return uint8(assetDecimals) + DECIMALS_OFFSET;
            }
        }

        return 18 + DECIMALS_OFFSET;
    }
}
