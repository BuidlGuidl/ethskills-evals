// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20, IERC20Metadata} from "./interfaces/IERC20.sol";

interface IYieldStrategy {
    function invest(uint256 assets) external;
    function withdrawToVault(uint256 assets) external returns (uint256 withdrawn);
    function totalAssets() external view returns (uint256);
}

contract YieldVault {
    string public name;
    string public symbol;
    uint8 public immutable decimals;

    IERC20 public immutable asset;
    IYieldStrategy public strategy;
    address public owner;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    uint256 private locked = 1;

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event StrategySet(address indexed strategy);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Withdraw(
        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );

    error InsufficientAssets();
    error InsufficientShares();
    error InvalidAddress();
    error ZeroAmount();
    error Unauthorized();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        require(locked == 1, "REENTRANCY");
        locked = 2;
        _;
        locked = 1;
    }

    constructor(IERC20Metadata usdc_, string memory name_, string memory symbol_, address owner_) {
        if (address(usdc_) == address(0) || owner_ == address(0)) revert InvalidAddress();
        asset = usdc_;
        decimals = usdc_.decimals();
        name = name_;
        symbol = symbol_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    function setStrategy(IYieldStrategy strategy_) external onlyOwner {
        if (address(strategy_) == address(0)) revert InvalidAddress();
        strategy = strategy_;
        emit StrategySet(address(strategy_));
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < value) revert InsufficientShares();
            allowance[from][msg.sender] = allowed - value;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }

        _transfer(from, to, value);
        return true;
    }

    function totalAssets() public view returns (uint256) {
        IYieldStrategy currentStrategy = strategy;
        uint256 strategyAssets = address(currentStrategy) == address(0) ? 0 : currentStrategy.totalAssets();
        return asset.balanceOf(address(this)) + strategyAssets;
    }

    function previewDeposit(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 assetsBefore = totalAssets();
        if (supply == 0 || assetsBefore == 0) return assets;
        return (assets * supply) / assetsBefore;
    }

    function previewWithdraw(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 assetsBefore = totalAssets();
        if (supply == 0 || assetsBefore == 0) return assets;
        return _mulDivUp(assets, supply, assetsBefore);
    }

    function previewRedeem(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply;
        if (supply == 0) return shares;
        return (shares * totalAssets()) / supply;
    }

    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert InvalidAddress();

        uint256 assetsBefore = totalAssets();
        uint256 supply = totalSupply;
        shares = supply == 0 || assetsBefore == 0 ? assets : (assets * supply) / assetsBefore;
        if (shares == 0) revert InsufficientShares();

        _safeTransferFrom(asset, msg.sender, address(this), assets);
        _mint(receiver, shares);
        _pushToStrategy(assets);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address shareOwner)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert InvalidAddress();

        shares = previewWithdraw(assets);
        _spendAllowanceIfNeeded(shareOwner, shares);
        _burn(shareOwner, shares);
        _ensureVaultAssets(assets);
        _safeTransfer(asset, receiver, assets);

        emit Withdraw(msg.sender, receiver, shareOwner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address shareOwner)
        external
        nonReentrant
        returns (uint256 assets)
    {
        if (shares == 0) revert ZeroAmount();
        if (receiver == address(0)) revert InvalidAddress();

        assets = previewRedeem(shares);
        if (assets == 0) revert InsufficientAssets();
        _spendAllowanceIfNeeded(shareOwner, shares);
        _burn(shareOwner, shares);
        _ensureVaultAssets(assets);
        _safeTransfer(asset, receiver, assets);

        emit Withdraw(msg.sender, receiver, shareOwner, assets, shares);
    }

    function _pushToStrategy(uint256 assets) internal {
        IYieldStrategy currentStrategy = strategy;
        if (address(currentStrategy) == address(0)) return;

        _safeApprove(asset, address(currentStrategy), assets);
        currentStrategy.invest(assets);
        _safeApprove(asset, address(currentStrategy), 0);
    }

    function _ensureVaultAssets(uint256 assets) internal {
        uint256 current = asset.balanceOf(address(this));
        if (current < assets) {
            IYieldStrategy currentStrategy = strategy;
            if (address(currentStrategy) == address(0)) revert InsufficientAssets();
            currentStrategy.withdrawToVault(assets - current);
            current = asset.balanceOf(address(this));
        }
        if (current < assets) revert InsufficientAssets();
    }

    function _spendAllowanceIfNeeded(address shareOwner, uint256 shares) internal {
        if (msg.sender == shareOwner) return;
        uint256 allowed = allowance[shareOwner][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < shares) revert InsufficientShares();
            allowance[shareOwner][msg.sender] = allowed - shares;
            emit Approval(shareOwner, msg.sender, allowance[shareOwner][msg.sender]);
        }
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (to == address(0)) revert InvalidAddress();
        uint256 fromBalance = balanceOf[from];
        if (fromBalance < value) revert InsufficientShares();
        balanceOf[from] = fromBalance - value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) internal {
        uint256 fromBalance = balanceOf[from];
        if (fromBalance < value) revert InsufficientShares();
        balanceOf[from] = fromBalance - value;
        totalSupply -= value;
        emit Transfer(from, address(0), value);
    }

    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
        return (x * y + denominator - 1) / denominator;
    }

    function _safeTransfer(IERC20 token, address to, uint256 value) internal {
        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, value)));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, value)));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FROM_FAILED");
    }

    function _safeApprove(IERC20 token, address spender, uint256 value) internal {
        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.approve, (spender, value)));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "APPROVE_FAILED");
    }
}

