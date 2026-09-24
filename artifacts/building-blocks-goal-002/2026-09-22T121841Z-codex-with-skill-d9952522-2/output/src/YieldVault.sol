// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20Metadata} from "./interfaces/IERC20.sol";
import {IYieldStrategy} from "./interfaces/IYieldStrategy.sol";
import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";

contract YieldVault {
    using SafeTransferLib for address;

    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event Redeem(address indexed caller, address indexed receiver, address indexed owner, uint256 shares, uint256 assets);
    event StrategySet(address indexed strategy);
    event OwnerSet(address indexed owner);

    error ZeroAmount();
    error ZeroAddress();
    error NotOwner();
    error StrategyAlreadySet();
    error StrategyNotSet();
    error InsufficientAllowance();
    error InsufficientBalance();
    error Slippage();
    error Reentrant();

    string public name;
    string public symbol;
    uint8 public immutable decimals;
    address public immutable asset;
    address public owner;
    address public strategy;
    uint256 public totalSupply;
    uint256 public totalDebt;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    uint256 private locked = 1;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert Reentrant();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address asset_, string memory name_, string memory symbol_) {
        if (asset_ == address(0)) revert ZeroAddress();
        asset = asset_;
        name = name_;
        symbol = symbol_;
        owner = msg.sender;
        decimals = IERC20Metadata(asset_).decimals();
        emit OwnerSet(msg.sender);
    }

    function setStrategy(address strategy_) external onlyOwner {
        if (strategy_ == address(0)) revert ZeroAddress();
        if (strategy != address(0)) revert StrategyAlreadySet();
        strategy = strategy_;
        emit StrategySet(strategy_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
        emit OwnerSet(newOwner);
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
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance();
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }
        _transfer(from, to, amount);
        return true;
    }

    function deposit(uint256 assets, address receiver, uint256 minWethOut, uint256 minLiquidity)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();
        address strategy_ = strategy;
        if (strategy_ == address(0)) revert StrategyNotSet();

        shares = _convertToShares(assets);
        asset.safeTransferFrom(msg.sender, address(this), assets);
        asset.safeApprove(strategy_, assets);
        IYieldStrategy(strategy_).deposit(assets, minWethOut, minLiquidity);

        totalDebt += assets;
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address sharesOwner, uint256 minAssetsOut)
        external
        nonReentrant
        returns (uint256 assetsOut)
    {
        if (shares == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();
        address strategy_ = strategy;
        if (strategy_ == address(0)) revert StrategyNotSet();

        if (msg.sender != sharesOwner) {
            uint256 allowed = allowance[sharesOwner][msg.sender];
            if (allowed != type(uint256).max) {
                if (allowed < shares) revert InsufficientAllowance();
                allowance[sharesOwner][msg.sender] = allowed - shares;
                emit Approval(sharesOwner, msg.sender, allowance[sharesOwner][msg.sender]);
            }
        }

        uint256 supply = totalSupply;
        if (balanceOf[sharesOwner] < shares) revert InsufficientBalance();
        uint256 debtToBurn = (totalDebt * shares) / supply;
        uint128 liquidityToBurn = uint128((uint256(IYieldStrategy(strategy_).positionLiquidity()) * shares) / supply);

        _burn(sharesOwner, shares);
        if (debtToBurn > totalDebt) {
            totalDebt = 0;
        } else {
            totalDebt -= debtToBurn;
        }

        assetsOut = IYieldStrategy(strategy_).withdrawLiquidity(liquidityToBurn, minAssetsOut);
        if (assetsOut < minAssetsOut) revert Slippage();
        asset.safeTransfer(receiver, assetsOut);
        emit Redeem(msg.sender, receiver, sharesOwner, shares, assetsOut);
    }

    function totalAssets() external view returns (uint256) {
        return totalDebt;
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return _convertToShares(assets);
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? 0 : (totalDebt * shares) / supply;
    }

    function _convertToShares(uint256 assets) internal view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 || totalDebt == 0 ? assets : (assets * supply) / totalDebt;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[from] < amount) revert InsufficientBalance();
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
}

