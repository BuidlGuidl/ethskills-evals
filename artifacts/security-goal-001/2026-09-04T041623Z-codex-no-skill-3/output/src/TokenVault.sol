// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

library SafeTransferLib {
    error TransferFailed();
    error TransferFromFailed();

    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFromFailed();
        }
    }
}

contract TokenVault {
    using SafeTransferLib for IERC20;

    error ZeroAddress();
    error ZeroAssets();
    error ZeroShares();
    error InsufficientAllowance();
    error InsufficientBalance();

    event Deposit(address indexed caller, address indexed owner, address indexed receiver, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    IERC20 public immutable ASSET;
    address public immutable FACTORY;
    string public name;
    string public symbol;
    uint8 public immutable DECIMALS;

    uint256 public totalSupply;

    mapping(address account => uint256 balance) public balanceOf;
    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;

    constructor(address asset_, string memory name_, string memory symbol_) {
        if (asset_ == address(0)) revert ZeroAddress();

        ASSET = IERC20(asset_);
        FACTORY = msg.sender;
        name = name_;
        symbol = symbol_;
        DECIMALS = _readDecimals(asset_);
    }

    function totalAssets() public view returns (uint256) {
        return ASSET.balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 assetsInVault = totalAssets();

        if (supply == 0 || assetsInVault == 0) {
            return assets;
        }

        return assets * supply / assetsInVault;
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply;
        if (supply == 0) {
            return shares;
        }

        return shares * totalAssets() / supply;
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }

    function previewWithdraw(uint256 assets) external view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 assetsInVault = totalAssets();

        if (supply == 0 || assetsInVault == 0) {
            return assets;
        }

        return _mulDivUp(assets, supply, assetsInVault);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        if (receiver == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAssets();

        uint256 assetsBefore = totalAssets();
        ASSET.safeTransferFrom(msg.sender, address(this), assets);
        uint256 receivedAssets = totalAssets() - assetsBefore;
        if (receivedAssets == 0) revert ZeroAssets();

        shares = _convertToShares(receivedAssets, assetsBefore, totalSupply);
        if (shares == 0) revert ZeroShares();

        _mint(receiver, shares);
        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
    }

    function mint(uint256 shares, address receiver) external returns (uint256 assets) {
        if (receiver == address(0)) revert ZeroAddress();
        if (shares == 0) revert ZeroShares();

        uint256 supply = totalSupply;
        uint256 assetsBefore = totalAssets();
        assets = supply == 0 || assetsBefore == 0 ? shares : _mulDivUp(shares, assetsBefore, supply);
        if (assets == 0) revert ZeroAssets();

        ASSET.safeTransferFrom(msg.sender, address(this), assets);
        uint256 receivedAssets = totalAssets() - assetsBefore;
        if (receivedAssets < assets) {
            revert ZeroAssets();
        }

        _mint(receiver, shares);
        emit Deposit(msg.sender, msg.sender, receiver, receivedAssets, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAssets();

        uint256 supply = totalSupply;
        uint256 assetsInVault = totalAssets();
        shares = supply == 0 || assetsInVault == 0 ? assets : _mulDivUp(assets, supply, assetsInVault);
        if (shares == 0) revert ZeroShares();

        _spendAllowanceIfNeeded(owner, msg.sender, shares);
        _burn(owner, shares);

        ASSET.safeTransfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        if (receiver == address(0) || owner == address(0)) revert ZeroAddress();
        if (shares == 0) revert ZeroShares();

        _spendAllowanceIfNeeded(owner, msg.sender, shares);
        assets = convertToAssets(shares);
        if (assets == 0) revert ZeroAssets();

        _burn(owner, shares);
        ASSET.safeTransfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
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
        _spendAllowanceIfNeeded(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();

        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) revert InsufficientBalance();

        unchecked {
            balanceOf[from] = fromBalance - amount;
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
        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) revert InsufficientBalance();

        unchecked {
            balanceOf[from] = fromBalance - amount;
            totalSupply -= amount;
        }

        emit Transfer(from, address(0), amount);
    }

    function _spendAllowanceIfNeeded(address owner, address spender, uint256 amount) internal {
        if (owner == spender) {
            return;
        }

        uint256 currentAllowance = allowance[owner][spender];
        if (currentAllowance < amount) revert InsufficientAllowance();

        if (currentAllowance != type(uint256).max) {
            unchecked {
                allowance[owner][spender] = currentAllowance - amount;
            }
            emit Approval(owner, spender, allowance[owner][spender]);
        }
    }

    function _convertToShares(uint256 assets, uint256 assetsBefore, uint256 supply) internal pure returns (uint256) {
        if (supply == 0 || assetsBefore == 0) {
            return assets;
        }

        return assets * supply / assetsBefore;
    }

    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
        return denominator == 0 ? 0 : (x * y + denominator - 1) / denominator;
    }

    function _readDecimals(address asset_) internal view returns (uint8 value) {
        (bool ok, bytes memory data) = asset_.staticcall(abi.encodeWithSignature("decimals()"));
        if (!ok || data.length < 32) {
            return 18;
        }

        value = abi.decode(data, (uint8));
    }
}
