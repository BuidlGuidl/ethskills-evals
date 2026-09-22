// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "./lib/ERC20.sol";
import {IERC20, IERC20Metadata} from "./interfaces/IERC20.sol";
import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
import {AerodromeUsdcWethStrategy} from "./strategies/AerodromeUsdcWethStrategy.sol";

contract BaseUsdcYieldVault is ERC20 {
    using SafeTransferLib for IERC20;

    error NotOwner();
    error ZeroAmount();
    error ZeroAddress();
    error StrategyAlreadySet();
    error StrategyHasAssets();
    error InsufficientLiquidity();

    event StrategySet(address indexed strategy);
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    IERC20 public immutable assetToken;
    address public owner;
    AerodromeUsdcWethStrategy public strategy;

    constructor(IERC20Metadata asset_, address owner_)
        ERC20("Base USDC Aerodrome Vault", "bUSDC-AERO", asset_.decimals())
    {
        if (address(asset_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        assetToken = asset_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function asset() external view returns (address) {
        return address(assetToken);
    }

    function setStrategy(AerodromeUsdcWethStrategy strategy_) external onlyOwner {
        if (address(strategy_) == address(0)) revert ZeroAddress();
        if (address(strategy) != address(0)) revert StrategyAlreadySet();
        if (totalSupply != 0 || assetToken.balanceOf(address(this)) != 0) revert StrategyHasAssets();
        strategy = strategy_;
        emit StrategySet(address(strategy_));
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function totalAssets() public view returns (uint256) {
        uint256 idle = assetToken.balanceOf(address(this));
        AerodromeUsdcWethStrategy currentStrategy = strategy;
        if (address(currentStrategy) == address(0)) return idle;
        return idle + currentStrategy.totalAssets();
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? assets : assets * supply / totalAssets();
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? shares : shares * totalAssets() / supply;
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }

    function previewWithdraw(uint256 assets) external view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 total = totalAssets();
        return supply == 0 ? assets : _ceilDiv(assets * supply, total);
    }

    function deposit(uint256 assets, address receiver) public returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        shares = convertToShares(assets);
        if (shares == 0) revert ZeroAmount();

        assetToken.safeTransferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);
        _deploy(assets);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function mint(uint256 shares, address receiver) external returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        uint256 supply = totalSupply;
        assets = supply == 0 ? shares : _ceilDiv(shares * totalAssets(), supply);
        deposit(assets, receiver);
    }

    function withdraw(uint256 assets, address receiver, address sharesOwner)
        external
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        shares = _ceilDiv(assets * totalSupply, totalAssets());
        _spendAllowanceIfNeeded(sharesOwner, shares);
        _burn(sharesOwner, shares);
        _pullAssets(assets);
        assetToken.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, sharesOwner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address sharesOwner)
        external
        returns (uint256 assets)
    {
        if (shares == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        assets = convertToAssets(shares);
        _spendAllowanceIfNeeded(sharesOwner, shares);
        _burn(sharesOwner, shares);
        _pullAssets(assets);
        assetToken.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, sharesOwner, assets, shares);
    }

    function _deploy(uint256 assets) internal {
        AerodromeUsdcWethStrategy currentStrategy = strategy;
        if (address(currentStrategy) == address(0)) return;
        assetToken.safeTransfer(address(currentStrategy), assets);
        currentStrategy.deposit(assets);
    }

    function _pullAssets(uint256 assets) internal {
        uint256 balance = assetToken.balanceOf(address(this));
        if (balance < assets) {
            AerodromeUsdcWethStrategy currentStrategy = strategy;
            if (address(currentStrategy) == address(0)) revert InsufficientLiquidity();
            currentStrategy.withdraw(assets - balance, address(this));
            balance = assetToken.balanceOf(address(this));
        }
        if (balance < assets) revert InsufficientLiquidity();
    }

    function _spendAllowanceIfNeeded(address sharesOwner, uint256 shares) internal {
        if (msg.sender == sharesOwner) return;
        uint256 allowed = allowance[sharesOwner][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= shares, "ERC20_ALLOWANCE");
            unchecked {
                allowance[sharesOwner][msg.sender] = allowed - shares;
            }
            emit Approval(sharesOwner, msg.sender, allowance[sharesOwner][msg.sender]);
        }
    }

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }
}
