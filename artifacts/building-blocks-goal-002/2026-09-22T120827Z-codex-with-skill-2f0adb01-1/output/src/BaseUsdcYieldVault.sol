// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "./lib/ERC20.sol";
import {SafeERC20} from "./lib/SafeERC20.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
import {IStrategy} from "./interfaces/IStrategy.sol";

contract BaseUsdcYieldVault is ERC20 {
    using SafeERC20 for IERC20;

    error NotOwner();
    error NotKeeper();
    error ZeroAddress();
    error ZeroAmount();
    error BadStrategyAsset();
    error InsufficientAssets();
    error StrategyHasAssets();
    error Reentrancy();

    event OwnerUpdated(address indexed owner);
    event KeeperUpdated(address indexed keeper, bool allowed);
    event StrategyUpdated(address indexed strategy);
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
    event Harvest(address indexed keeper, uint256 compoundedAssets);

    IERC20 public immutable assetToken;
    address public owner;
    IStrategy public strategy;
    mapping(address => bool) public isKeeper;
    uint256 private locked = 1;

    constructor(IERC20Metadata asset_, string memory name_, string memory symbol_, address owner_)
        ERC20(name_, symbol_, asset_.decimals())
    {
        if (address(asset_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        assetToken = IERC20(address(asset_));
        owner = owner_;
        emit OwnerUpdated(owner_);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert Reentrancy();
        locked = 2;
        _;
        locked = 1;
    }

    function asset() external view returns (address) {
        return address(assetToken);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
        emit OwnerUpdated(newOwner);
    }

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        if (keeper == address(0)) revert ZeroAddress();
        isKeeper[keeper] = allowed;
        emit KeeperUpdated(keeper, allowed);
    }

    function setStrategy(IStrategy newStrategy) external onlyOwner nonReentrant {
        IStrategy current = strategy;
        if (address(current) != address(0) && current.totalAssets() != 0) revert StrategyHasAssets();
        if (address(newStrategy) != address(0) && newStrategy.asset() != address(assetToken)) {
            revert BadStrategyAsset();
        }
        strategy = newStrategy;
        emit StrategyUpdated(address(newStrategy));
        _investIdle();
    }

    function totalAssets() public view returns (uint256 assets_) {
        assets_ = assetToken.balanceOf(address(this));
        IStrategy current = strategy;
        if (address(current) != address(0)) assets_ += current.totalAssets();
    }

    function convertToShares(uint256 assets_) public view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? assets_ : (assets_ * supply) / totalAssets();
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? shares : (shares * totalAssets()) / supply;
    }

    function previewDeposit(uint256 assets_) external view returns (uint256) {
        return convertToShares(assets_);
    }

    function previewMint(uint256 shares) external view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? shares : _mulDivUp(shares, totalAssets(), supply);
    }

    function previewWithdraw(uint256 assets_) public view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? assets_ : _mulDivUp(assets_, supply, totalAssets());
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }

    function deposit(uint256 assets_, address receiver) external nonReentrant returns (uint256 shares) {
        if (assets_ == 0) revert ZeroAmount();
        shares = convertToShares(assets_);
        require(shares != 0, "ZERO_SHARES");

        assetToken.safeTransferFrom(msg.sender, address(this), assets_);
        _mint(receiver, shares);
        _investIdle();

        emit Deposit(msg.sender, receiver, assets_, shares);
    }

    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets_) {
        if (shares == 0) revert ZeroAmount();
        uint256 supply = totalSupply;
        assets_ = supply == 0 ? shares : _mulDivUp(shares, totalAssets(), supply);

        assetToken.safeTransferFrom(msg.sender, address(this), assets_);
        _mint(receiver, shares);
        _investIdle();

        emit Deposit(msg.sender, receiver, assets_, shares);
    }

    function withdraw(uint256 assets_, address receiver, address sharesOwner) external nonReentrant returns (uint256 shares) {
        if (assets_ == 0) revert ZeroAmount();
        shares = previewWithdraw(assets_);
        _spendAllowanceIfNeeded(sharesOwner, shares);
        _burn(sharesOwner, shares);
        _ensureAssets(assets_);
        assetToken.safeTransfer(receiver, assets_);

        emit Withdraw(msg.sender, receiver, sharesOwner, assets_, shares);
    }

    function redeem(uint256 shares, address receiver, address sharesOwner) external nonReentrant returns (uint256 assets_) {
        if (shares == 0) revert ZeroAmount();
        assets_ = convertToAssets(shares);
        _spendAllowanceIfNeeded(sharesOwner, shares);
        _burn(sharesOwner, shares);
        _ensureAssets(assets_);
        assetToken.safeTransfer(receiver, assets_);

        emit Withdraw(msg.sender, receiver, sharesOwner, assets_, shares);
    }

    function harvest(uint256 minRewardAssets, uint256 minPairedWeth, uint256 minLiquidity)
        external
        nonReentrant
        returns (uint256 compoundedAssets)
    {
        if (!isKeeper[msg.sender]) revert NotKeeper();
        IStrategy current = strategy;
        if (address(current) == address(0)) return 0;
        compoundedAssets = current.harvest(minRewardAssets, minPairedWeth, minLiquidity);
        emit Harvest(msg.sender, compoundedAssets);
    }

    function _investIdle() internal {
        IStrategy current = strategy;
        if (address(current) == address(0)) return;
        uint256 idle = assetToken.balanceOf(address(this));
        if (idle == 0) return;
        assetToken.safeTransfer(address(current), idle);
        current.deposit(idle);
    }

    function _ensureAssets(uint256 assets_) internal {
        uint256 available = assetToken.balanceOf(address(this));
        if (available >= assets_) return;

        IStrategy current = strategy;
        if (address(current) != address(0)) {
            current.withdraw(assets_ - available);
        }
        if (assetToken.balanceOf(address(this)) < assets_) revert InsufficientAssets();
    }

    function _spendAllowanceIfNeeded(address sharesOwner, uint256 shares) internal {
        if (msg.sender == sharesOwner) return;
        uint256 allowed = allowance[sharesOwner][msg.sender];
        require(allowed >= shares, "ERC20: allowance");
        if (allowed != type(uint256).max) {
            unchecked {
                allowance[sharesOwner][msg.sender] = allowed - shares;
            }
            emit Approval(sharesOwner, msg.sender, allowance[sharesOwner][msg.sender]);
        }
    }

    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 z) {
        z = (x * y) / denominator;
        if ((x * y) % denominator != 0) z++;
    }
}
