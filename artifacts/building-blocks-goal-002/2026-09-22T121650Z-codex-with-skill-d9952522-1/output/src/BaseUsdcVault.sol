// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "./interfaces/IERC20.sol";
import { AerodromeUsdcWethStrategy } from "./AerodromeUsdcWethStrategy.sol";
import { Owned } from "./utils/Owned.sol";
import { ReentrancyGuard } from "./utils/ReentrancyGuard.sol";
import { SafeTransferLib } from "./utils/SafeTransferLib.sol";

contract BaseUsdcVault is Owned, ReentrancyGuard {
    using SafeTransferLib for IERC20;

    error InsufficientShares();
    error NotApproved();
    error NotKeeper();
    error Paused();
    error ZeroAmount();

    IERC20 public immutable asset;
    AerodromeUsdcWethStrategy public immutable strategy;

    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    bool public paused;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public keepers;

    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event Harvest(address indexed keeper, uint256 rewardAmount, uint256 liquidityMinted);
    event KeeperSet(address indexed keeper, bool allowed);
    event PausedSet(bool paused);
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Withdraw(
        address indexed caller,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    constructor(
        IERC20 asset_,
        AerodromeUsdcWethStrategy strategy_,
        address owner_,
        string memory name_,
        string memory symbol_
    ) Owned(owner_) {
        asset = asset_;
        strategy = strategy_;
        name = name_;
        symbol = symbol_;
        decimals = asset_.decimals();
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        keepers[keeper] = allowed;
        emit KeeperSet(keeper, allowed);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedSet(paused_);
    }

    function totalAssets() public view returns (uint256) {
        return strategy.totalAssets();
    }

    function previewDeposit(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 assetsBefore = totalAssets();
        if (supply == 0 || assetsBefore == 0) return assets;
        return assets * supply / assetsBefore;
    }

    function previewRedeem(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply;
        if (supply == 0) return 0;
        return shares * totalAssets() / supply;
    }

    function deposit(
        uint256 assets,
        address receiver,
        AerodromeUsdcWethStrategy.DepositParams calldata params
    ) external nonReentrant whenNotPaused returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        shares = previewDeposit(assets);
        if (shares == 0) revert InsufficientShares();

        _mint(receiver, shares);
        asset.safeTransferFrom(msg.sender, address(strategy), assets);
        strategy.deposit(assets, params);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner_,
        AerodromeUsdcWethStrategy.WithdrawParams calldata params
    ) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        if (msg.sender != owner_) _spendAllowance(owner_, msg.sender, shares);

        assets = previewRedeem(shares);
        _burn(owner_, shares);
        uint256 assetsOut = strategy.withdraw(assets, receiver, params);

        emit Withdraw(msg.sender, receiver, owner_, assetsOut, shares);
        return assetsOut;
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner_,
        AerodromeUsdcWethStrategy.WithdrawParams calldata params
    ) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        uint256 supply = totalSupply;
        uint256 managed = totalAssets();
        shares = (assets * supply + managed - 1) / managed;
        if (msg.sender != owner_) _spendAllowance(owner_, msg.sender, shares);

        _burn(owner_, shares);
        uint256 assetsOut = strategy.withdraw(assets, receiver, params);

        emit Withdraw(msg.sender, receiver, owner_, assetsOut, shares);
    }

    function harvest(AerodromeUsdcWethStrategy.HarvestParams calldata params)
        external
        nonReentrant
        returns (uint256 rewardAmount, uint256 liquidityMinted)
    {
        if (!keepers[msg.sender] && msg.sender != owner) revert NotKeeper();
        (rewardAmount, liquidityMinted) = strategy.harvest(params);
        emit Harvest(msg.sender, rewardAmount, liquidityMinted);
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
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _spendAllowance(address owner_, address spender, uint256 amount) internal {
        uint256 allowed = allowance[owner_][spender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert NotApproved();
            allowance[owner_][spender] = allowed - amount;
            emit Approval(owner_, spender, allowed - amount);
        }
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        uint256 balance = balanceOf[from];
        if (balance < amount) revert InsufficientShares();
        unchecked {
            balanceOf[from] = balance - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        uint256 balance = balanceOf[from];
        if (balance < amount) revert InsufficientShares();
        unchecked {
            balanceOf[from] = balance - amount;
            totalSupply -= amount;
        }
        emit Transfer(from, address(0), amount);
    }
}
