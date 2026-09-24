// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
import {MinimalERC20} from "./lib/MinimalERC20.sol";
import {BaseAerodromeStrategy} from "./BaseAerodromeStrategy.sol";

contract BaseUsdcYieldVault is MinimalERC20 {
    using SafeTransferLib for IERC20;

    IERC20 public immutable asset;
    BaseAerodromeStrategy public strategy;
    address public owner;

    uint256 private locked = 1;

    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );
    event StrategyUpdated(address indexed strategy);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    error ZeroAmount();
    error ZeroAddress();
    error Unauthorized();
    error InsufficientAssets();
    error Reentrancy();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert Reentrancy();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(IERC20 asset_, BaseAerodromeStrategy strategy_, address owner_)
        MinimalERC20("Base USDC Aerodrome Vault", "baUSDC", asset_.decimals())
    {
        if (address(asset_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        asset = asset_;
        strategy = strategy_;
        owner = owner_;
    }

    function setStrategy(BaseAerodromeStrategy newStrategy) external onlyOwner {
        if (address(newStrategy) == address(0)) revert ZeroAddress();
        if (totalAssets() != asset.balanceOf(address(this))) revert InsufficientAssets();
        strategy = newStrategy;
        emit StrategyUpdated(address(newStrategy));
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function totalAssets() public view returns (uint256) {
        uint256 managed = address(strategy) == address(0) ? 0 : strategy.totalAssets();
        return asset.balanceOf(address(this)) + managed;
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 total = totalAssets();
        return supply == 0 || total == 0 ? assets : assets * supply / total;
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? shares : shares * totalAssets() / supply;
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    function previewWithdraw(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 total = totalAssets();
        return supply == 0 || total == 0 ? assets : _mulDivUp(assets, supply, total);
    }

    function maxWithdraw(address account) external view returns (uint256) {
        return convertToAssets(balanceOf[account]);
    }

    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        shares = convertToShares(assets);
        if (shares == 0) revert ZeroAmount();

        asset.safeTransferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);
        _investIdle();

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address account)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        shares = previewWithdraw(assets);
        _spendAllowanceIfNeeded(account, shares);
        _burn(account, shares);

        uint256 idle = asset.balanceOf(address(this));
        if (idle < assets) {
            strategy.withdraw(assets - idle, address(this));
        }

        if (asset.balanceOf(address(this)) < assets) revert InsufficientAssets();
        asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, account, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address account) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        assets = convertToAssets(shares);
        _spendAllowanceIfNeeded(account, shares);
        _burn(account, shares);

        uint256 idle = asset.balanceOf(address(this));
        if (idle < assets) {
            strategy.withdraw(assets - idle, address(this));
        }

        if (asset.balanceOf(address(this)) < assets) revert InsufficientAssets();
        asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, account, assets, shares);
    }

    function _investIdle() private {
        uint256 idle = asset.balanceOf(address(this));
        if (idle == 0 || address(strategy) == address(0)) return;
        asset.safeTransfer(address(strategy), idle);
        strategy.deposit(idle);
    }

    function _spendAllowanceIfNeeded(address account, uint256 shares) private {
        if (msg.sender == account) return;
        uint256 allowed = allowance[account][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < shares) revert Unauthorized();
            unchecked {
                allowance[account][msg.sender] = allowed - shares;
            }
            emit Approval(account, msg.sender, allowance[account][msg.sender]);
        }
    }

    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
        return x == 0 ? 0 : ((x * y - 1) / denominator) + 1;
    }
}

