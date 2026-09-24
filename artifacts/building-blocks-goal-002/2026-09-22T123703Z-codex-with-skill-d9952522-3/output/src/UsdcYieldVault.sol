// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AerodromeUsdcWethStrategy} from "./AerodromeUsdcWethStrategy.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {ReentrancyGuard} from "./lib/ReentrancyGuard.sol";
import {SafeTransferLib} from "./lib/SafeTransferLib.sol";

contract UsdcYieldVault is ReentrancyGuard {
    using SafeTransferLib for IERC20;

    string public constant name = "Base USDC-WETH Yield Vault";
    string public constant symbol = "bUSDCWETH";
    uint8 public constant decimals = 18;

    IERC20 public immutable asset;
    AerodromeUsdcWethStrategy public immutable strategy;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, uint256 shares, uint256 assets);

    constructor(address asset_, address strategy_) {
        require(asset_ != address(0) && strategy_ != address(0), "ZERO_ADDRESS");
        asset = IERC20(asset_);
        strategy = AerodromeUsdcWethStrategy(strategy_);
    }

    function totalAssets() external view returns (uint256) {
        return strategy.totalLp();
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
            require(allowed >= amount, "ALLOWANCE");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function deposit(
        uint256 assets,
        address receiver,
        AerodromeUsdcWethStrategy.InvestParams calldata params
    ) external nonReentrant returns (uint256 shares) {
        require(assets > 0, "ZERO_ASSETS");
        require(receiver != address(0), "ZERO_RECEIVER");

        uint256 lpBefore = strategy.totalLp();
        uint256 supplyBefore = totalSupply;

        asset.safeTransferFrom(msg.sender, address(strategy), assets);
        uint256 lpAdded = strategy.invest(assets, params);
        require(lpAdded > 0, "NO_LP");

        shares = supplyBefore == 0 || lpBefore == 0 ? lpAdded : (lpAdded * supplyBefore) / lpBefore;
        require(shares > 0, "ZERO_SHARES");
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(
        uint256 shares,
        address receiver,
        AerodromeUsdcWethStrategy.WithdrawParams calldata params
    ) external nonReentrant returns (uint256 assets) {
        require(shares > 0, "ZERO_SHARES");
        require(receiver != address(0), "ZERO_RECEIVER");

        uint256 supplyBefore = totalSupply;
        require(balanceOf[msg.sender] >= shares, "BALANCE");
        uint256 lpAmount = (strategy.totalLp() * shares) / supplyBefore;
        require(lpAmount > 0, "ZERO_LP");

        _burn(msg.sender, shares);
        assets = strategy.withdraw(lpAmount, receiver, params);

        emit Withdraw(msg.sender, receiver, shares, assets);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "ZERO_RECEIVER");
        require(balanceOf[from] >= amount, "BALANCE");
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
        totalSupply -= amount;
        balanceOf[from] -= amount;
        emit Transfer(from, address(0), amount);
    }
}

