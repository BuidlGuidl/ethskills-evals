// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {Math} from "./libraries/Math.sol";
import {SafeERC20} from "./libraries/SafeERC20.sol";

contract TokenVault {
    using SafeERC20 for address;

    uint256 private constant _VIRTUAL_ASSETS = 1;
    uint256 private constant _VIRTUAL_SHARES = 1_000_000;
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";

    address private immutable ASSET;
    uint8 private immutable SHARE_DECIMALS;

    string public name;
    string public symbol;

    uint256 public totalSupply;
    mapping(address account => uint256) public balanceOf;
    mapping(address owner => mapping(address spender => uint256)) public allowance;

    uint256 private _locked = 1;

    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );

    error ZeroAddress();
    error ZeroAmount();
    error ZeroShares();
    error InsufficientBalance();
    error InsufficientAllowance();
    error Reentrancy();

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    constructor(address asset_) {
        if (asset_ == address(0)) revert ZeroAddress();
        ASSET = asset_;
        SHARE_DECIMALS = _shareDecimals(asset_);

        string memory hexAsset = _toHexString(asset_);
        name = string.concat("Save Any Token Vault ", hexAsset);
        symbol = string.concat("sv-", hexAsset);
    }

    function asset() external view returns (address) {
        return ASSET;
    }

    function decimals() external view returns (uint8) {
        return SHARE_DECIMALS;
    }

    function _nonReentrantBefore() private {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
    }

    function _nonReentrantAfter() private {
        _locked = 1;
    }

    function totalAssets() public view returns (uint256) {
        return IERC20(ASSET).balanceOf(address(this));
    }

    function convertToShares(uint256 assets) external view returns (uint256) {
        return _convertToShares(assets, totalAssets(), totalSupply, Math.Rounding.Down);
    }

    function convertToAssets(uint256 shares) external view returns (uint256) {
        return _convertToAssets(shares, totalAssets(), totalSupply, Math.Rounding.Down);
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return _convertToShares(assets, totalAssets(), totalSupply, Math.Rounding.Down);
    }

    function previewWithdraw(uint256 assets) external view returns (uint256) {
        return _convertToShares(assets, totalAssets(), totalSupply, Math.Rounding.Up);
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return _convertToAssets(shares, totalAssets(), totalSupply, Math.Rounding.Down);
    }

    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        uint256 assetsBefore = totalAssets();
        uint256 supplyBefore = totalSupply;

        ASSET.safeTransferFrom(msg.sender, address(this), assets);

        uint256 received = totalAssets() - assetsBefore;
        if (received == 0) revert ZeroAmount();

        shares = _convertToShares(received, assetsBefore, supplyBefore, Math.Rounding.Down);
        if (shares == 0) revert ZeroShares();

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, received, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();

        uint256 assetsBefore = totalAssets();
        require(assets <= assetsBefore, "Vault: insufficient assets");

        shares = _convertToShares(assets, assetsBefore, totalSupply, Math.Rounding.Up);
        if (shares == 0) revert ZeroShares();

        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }

        _burn(owner, shares);
        ASSET.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external nonReentrant returns (uint256 assets_) {
        if (shares == 0) revert ZeroAmount();
        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();

        assets_ = _convertToAssets(shares, totalAssets(), totalSupply, Math.Rounding.Down);
        if (assets_ == 0) revert ZeroAmount();

        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }

        _burn(owner, shares);
        ASSET.safeTransfer(receiver, assets_);

        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _convertToShares(uint256 assets_, uint256 totalAssets_, uint256 supply_, Math.Rounding rounding)
        private
        pure
        returns (uint256)
    {
        return Math.mulDiv(assets_, supply_ + _VIRTUAL_SHARES, totalAssets_ + _VIRTUAL_ASSETS, rounding);
    }

    function _convertToAssets(uint256 shares_, uint256 totalAssets_, uint256 supply_, Math.Rounding rounding)
        private
        pure
        returns (uint256)
    {
        return Math.mulDiv(shares_, totalAssets_ + _VIRTUAL_ASSETS, supply_ + _VIRTUAL_SHARES, rounding);
    }

    function _mint(address to, uint256 amount) private {
        totalSupply += amount;
        unchecked {
            balanceOf[to] += amount;
        }
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) private {
        uint256 balance = balanceOf[from];
        if (balance < amount) revert InsufficientBalance();

        unchecked {
            balanceOf[from] = balance - amount;
            totalSupply -= amount;
        }
        emit Transfer(from, address(0), amount);
    }

    function _transfer(address from, address to, uint256 amount) private {
        if (from == address(0) || to == address(0)) revert ZeroAddress();

        uint256 balance = balanceOf[from];
        if (balance < amount) revert InsufficientBalance();

        unchecked {
            balanceOf[from] = balance - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _spendAllowance(address owner, address spender, uint256 amount) private {
        uint256 currentAllowance = allowance[owner][spender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) revert InsufficientAllowance();
            unchecked {
                allowance[owner][spender] = currentAllowance - amount;
            }
            emit Approval(owner, spender, allowance[owner][spender]);
        }
    }

    function _shareDecimals(address token) private view returns (uint8) {
        uint256 assetDecimals = 18;
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSignature("decimals()"));
        if (ok && data.length >= 32) {
            assembly {
                assetDecimals := mload(add(data, 32))
            }
        }

        if (assetDecimals <= 71) {
            // forge-lint: disable-next-line(unsafe-typecast)
            return uint8(assetDecimals + 6);
        }
        if (assetDecimals <= type(uint8).max) {
            // forge-lint: disable-next-line(unsafe-typecast)
            return uint8(assetDecimals);
        }
        return 18;
    }

    function _toHexString(address account) private pure returns (string memory) {
        bytes20 value = bytes20(account);
        bytes memory buffer = new bytes(42);
        buffer[0] = "0";
        buffer[1] = "x";

        for (uint256 i = 0; i < 20; ++i) {
            buffer[2 + i * 2] = _HEX_SYMBOLS[uint8(value[i]) >> 4];
            buffer[3 + i * 2] = _HEX_SYMBOLS[uint8(value[i]) & 0x0f];
        }

        return string(buffer);
    }
}
