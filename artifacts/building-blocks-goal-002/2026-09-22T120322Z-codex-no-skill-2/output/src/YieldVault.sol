// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "./interfaces/IERC20.sol";
import { Ownable } from "./Ownable.sol";
import { ReentrancyGuard } from "./ReentrancyGuard.sol";
import { SafeTransferLib } from "./SafeTransferLib.sol";

interface IYieldStrategy {
    function totalAssets() external view returns (uint256);
    function recordDeposit(uint256 assets) external;
    function withdraw(uint256 assets, address receiver, uint256 minUsdcFromWeth, uint256 deadline)
        external
        returns (uint256 amountOut);
}

contract YieldVault is Ownable, ReentrancyGuard {
    using SafeTransferLib for IERC20;

    error StrategyNotSet();
    error ZeroAssets();
    error ZeroShares();
    error InsufficientAllowance();
    error InsufficientBalance();

    string public name;
    string public symbol;
    uint8 public immutable decimals;

    IERC20 public immutable asset;
    IYieldStrategy public strategy;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event StrategySet(address indexed strategy);
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    constructor(IERC20 asset_, string memory name_, string memory symbol_, address owner_)
        Ownable(owner_)
    {
        asset = asset_;
        decimals = asset_.decimals();
        name = name_;
        symbol = symbol_;
    }

    function setStrategy(IYieldStrategy newStrategy) external onlyOwner {
        if (address(newStrategy) == address(0)) revert StrategyNotSet();
        strategy = newStrategy;
        emit StrategySet(address(newStrategy));
    }

    function totalAssets() public view returns (uint256) {
        uint256 vaultIdle = asset.balanceOf(address(this));
        if (address(strategy) == address(0)) return vaultIdle;
        return vaultIdle + strategy.totalAssets();
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

    function previewDeposit(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 managed = totalAssets();
        return supply == 0 ? assets : assets * supply / managed;
    }

    function previewWithdraw(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 managed = totalAssets();
        return (assets * supply + managed - 1) / managed;
    }

    function previewRedeem(uint256 shares) public view returns (uint256) {
        return shares * totalAssets() / totalSupply;
    }

    function deposit(uint256 assets, address receiver)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAssets();
        IYieldStrategy activeStrategy = strategy;
        if (address(activeStrategy) == address(0)) revert StrategyNotSet();

        uint256 managedBefore = totalAssets();
        uint256 supply = totalSupply;
        shares = supply == 0 ? assets : assets * supply / managedBefore;
        if (shares == 0) revert ZeroShares();

        asset.safeTransferFrom(msg.sender, address(activeStrategy), assets);
        activeStrategy.recordDeposit(assets);
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address sharesOwner,
        uint256 minUsdcFromWeth,
        uint256 deadline
    ) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAssets();
        shares = previewWithdraw(assets);
        _spendAllowanceIfNeeded(sharesOwner, shares);
        _burn(sharesOwner, shares);
        strategy.withdraw(assets, receiver, minUsdcFromWeth, deadline);
        emit Withdraw(msg.sender, receiver, sharesOwner, assets, shares);
    }

    function redeem(
        uint256 shares,
        address receiver,
        address sharesOwner,
        uint256 minUsdcFromWeth,
        uint256 deadline
    ) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroShares();
        assets = previewRedeem(shares);
        _spendAllowanceIfNeeded(sharesOwner, shares);
        _burn(sharesOwner, shares);
        strategy.withdraw(assets, receiver, minUsdcFromWeth, deadline);
        emit Withdraw(msg.sender, receiver, sharesOwner, assets, shares);
    }

    function _spendAllowanceIfNeeded(address sharesOwner, uint256 shares) private {
        if (msg.sender == sharesOwner) return;
        uint256 allowed = allowance[sharesOwner][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < shares) revert InsufficientAllowance();
            allowance[sharesOwner][msg.sender] = allowed - shares;
            emit Approval(sharesOwner, msg.sender, allowance[sharesOwner][msg.sender]);
        }
    }

    function _transfer(address from, address to, uint256 amount) private {
        uint256 balance = balanceOf[from];
        if (balance < amount) revert InsufficientBalance();
        balanceOf[from] = balance - amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) private {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) private {
        uint256 balance = balanceOf[from];
        if (balance < amount) revert InsufficientBalance();
        balanceOf[from] = balance - amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }
}
