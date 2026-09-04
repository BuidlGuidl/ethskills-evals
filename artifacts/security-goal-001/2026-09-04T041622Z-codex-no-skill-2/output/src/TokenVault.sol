// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC20} from "./ERC20.sol";
import {IERC20, IERC20Metadata} from "./IERC20.sol";
import {SafeTransferLib} from "./SafeTransferLib.sol";

contract TokenVault is ERC20 {
    using SafeTransferLib for address;

    error ZeroAssets();
    error ZeroShares();
    error UnsupportedAssetBehavior();
    error VaultFundedBeforeSharesExist();

    address public immutable asset;
    address public immutable factory;

    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );

    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_)
        ERC20(name_, symbol_, decimals_)
    {
        asset = asset_;
        factory = msg.sender;
    }

    function totalAssets() public view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 cachedAssets = totalAssets();
        if (supply == 0 || cachedAssets == 0) {
            return assets;
        }
        return assets * supply / cachedAssets;
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
        uint256 cachedAssets = totalAssets();
        if (supply == 0 || cachedAssets == 0) {
            return assets;
        }
        return _mulDivUp(assets, supply, cachedAssets);
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        return convertToAssets(balanceOf[owner]);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        if (assets == 0) revert ZeroAssets();

        uint256 supply = totalSupply;
        uint256 cachedAssets = totalAssets();

        if (supply == 0 && cachedAssets != 0) {
            revert VaultFundedBeforeSharesExist();
        }

        shares = supply == 0 ? assets : assets * supply / cachedAssets;
        if (shares == 0) revert ZeroShares();

        asset.safeTransferFrom(msg.sender, address(this), assets);

        uint256 assetsAfter = totalAssets();
        if (assetsAfter != cachedAssets + assets) {
            revert UnsupportedAssetBehavior();
        }

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        if (assets == 0) revert ZeroAssets();

        uint256 supply = totalSupply;
        uint256 cachedAssets = totalAssets();
        shares = _mulDivUp(assets, supply, cachedAssets);
        if (shares == 0) revert ZeroShares();

        if (msg.sender != owner) {
            uint256 allowed = allowance[owner][msg.sender];
            if (allowed != type(uint256).max) {
                allowance[owner][msg.sender] = allowed - shares;
                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
            }
        }

        _burn(owner, shares);
        asset.safeTransfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        if (shares == 0) revert ZeroShares();

        if (msg.sender != owner) {
            uint256 allowed = allowance[owner][msg.sender];
            if (allowed != type(uint256).max) {
                allowance[owner][msg.sender] = allowed - shares;
                emit Approval(owner, msg.sender, allowance[owner][msg.sender]);
            }
        }

        assets = convertToAssets(shares);
        if (assets == 0) revert ZeroAssets();

        _burn(owner, shares);
        asset.safeTransfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
        result = x * y / denominator;
        if (x * y % denominator != 0) {
            unchecked {
                result += 1;
            }
        }
    }
}

contract TokenVaultFactory {
    error VaultAlreadyExists();
    error ZeroAsset();

    event VaultCreated(address indexed asset, address indexed vault);

    mapping(address asset => address vault) public vaultOf;

    function createVault(address asset) external returns (address vault) {
        if (asset == address(0)) revert ZeroAsset();
        if (vaultOf[asset] != address(0)) revert VaultAlreadyExists();

        string memory assetSymbol = _readSymbol(asset);
        string memory assetName = _readName(asset);
        uint8 assetDecimals = _readDecimals(asset);

        vault = address(
            new TokenVault{
                salt: bytes32(uint256(uint160(asset)))
            }(asset, string.concat("Save ", assetName), string.concat("sv", assetSymbol), assetDecimals)
        );

        vaultOf[asset] = vault;
        emit VaultCreated(asset, vault);
    }

    function predictVault(address asset) external view returns (address predicted) {
        bytes32 salt = bytes32(uint256(uint160(asset)));
        bytes memory creation = abi.encodePacked(
            type(TokenVault).creationCode,
            abi.encode(asset, string.concat("Save ", _readName(asset)), string.concat("sv", _readSymbol(asset)), _readDecimals(asset))
        );
        predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creation))))));
    }

    function _readName(address asset) internal view returns (string memory) {
        try IERC20Metadata(asset).name() returns (string memory value) {
            if (bytes(value).length != 0) return value;
        } catch {}
        return "Token";
    }

    function _readSymbol(address asset) internal view returns (string memory) {
        try IERC20Metadata(asset).symbol() returns (string memory value) {
            if (bytes(value).length != 0) return value;
        } catch {}
        return "TKN";
    }

    function _readDecimals(address asset) internal view returns (uint8) {
        try IERC20Metadata(asset).decimals() returns (uint8 value) {
            return value;
        } catch {}
        return 18;
    }
}
