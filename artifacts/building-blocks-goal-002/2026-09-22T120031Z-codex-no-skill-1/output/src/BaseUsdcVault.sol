// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {IStrategy} from "./interfaces/IStrategy.sol";
import {SafeERC20} from "./libraries/SafeERC20.sol";
import {ERC20} from "./utils/ERC20.sol";
import {Ownable} from "./utils/Ownable.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";

contract BaseUsdcVault is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );
    event StrategySet(address indexed strategy);

    IERC20 public immutable assetToken;
    IStrategy public strategy;

    constructor(IERC20 asset_, address owner_)
        ERC20("Base USDC LP Vault", "bUSDC-LP", asset_.decimals())
        Ownable(owner_)
    {
        assetToken = asset_;
    }

    function setStrategy(IStrategy strategy_) external onlyOwner {
        require(address(strategy) == address(0), "STRATEGY_ALREADY_SET");
        require(address(strategy_) != address(0), "ZERO_STRATEGY");
        require(strategy_.asset() == address(assetToken), "WRONG_ASSET");
        strategy = strategy_;
        emit StrategySet(address(strategy_));
    }

    function asset() external view returns (address) {
        return address(assetToken);
    }

    function totalAssets() public view returns (uint256) {
        IStrategy strategy_ = strategy;
        uint256 idle = assetToken.balanceOf(address(this));
        if (address(strategy_) == address(0)) return idle;
        return idle + strategy_.totalAssets();
    }

    function previewDeposit(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 total = totalAssets();
        return supply == 0 || total == 0 ? assets : (assets * supply) / total;
    }

    function previewRedeem(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? shares : (shares * totalAssets()) / supply;
    }

    function previewWithdraw(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 total = totalAssets();
        return supply == 0 || total == 0 ? assets : _ceilDiv(assets * supply, total);
    }

    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
        require(address(strategy) != address(0), "NO_STRATEGY");
        require(assets > 0, "ZERO_ASSETS");
        shares = previewDeposit(assets);
        require(shares > 0, "ZERO_SHARES");

        assetToken.safeTransferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);

        assetToken.safeTransfer(address(strategy), assets);
        strategy.deposit(assets);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner_) external nonReentrant returns (uint256 shares) {
        require(assets > 0, "ZERO_ASSETS");
        shares = previewWithdraw(assets);
        _spendAllowanceIfNeeded(owner_, shares);
        _burn(owner_, shares);

        _pullFromStrategy(assets);
        assetToken.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner_, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner_) external nonReentrant returns (uint256 assets) {
        require(shares > 0, "ZERO_SHARES");
        assets = previewRedeem(shares);
        require(assets > 0, "ZERO_ASSETS");

        _spendAllowanceIfNeeded(owner_, shares);
        _burn(owner_, shares);

        _pullFromStrategy(assets);
        assetToken.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner_, assets, shares);
    }

    function _pullFromStrategy(uint256 assets) private {
        uint256 idle = assetToken.balanceOf(address(this));
        if (idle >= assets) return;

        IStrategy strategy_ = strategy;
        require(address(strategy_) != address(0), "NO_STRATEGY");
        uint256 received = strategy_.withdraw(assets - idle, address(this));
        require(received + idle >= assets, "INSUFFICIENT_STRATEGY_ASSETS");
    }

    function _spendAllowanceIfNeeded(address owner_, uint256 shares) private {
        if (msg.sender == owner_) return;
        uint256 allowed = allowance[owner_][msg.sender];
        require(allowed >= shares, "ERC20: allowance");
        if (allowed != type(uint256).max) {
            unchecked {
                allowance[owner_][msg.sender] = allowed - shares;
            }
            emit Approval(owner_, msg.sender, allowance[owner_][msg.sender]);
        }
    }

    function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
        return a == 0 ? 0 : ((a - 1) / b) + 1;
    }
}

