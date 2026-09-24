// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {SaveTokenVault} from "./SaveTokenVault.sol";

/// @notice Permissionless factory for canonical Save Any Token vaults.
contract SaveTokenVaultFactory {
    using Strings for address;

    mapping(address asset => address vault) public vaultForAsset;
    address[] public allVaults;

    event VaultCreated(address indexed asset, address indexed vault);

    error AssetIsZero();
    error AssetIsNotContract(address asset);
    error VaultAlreadyExists(address asset, address vault);

    function createVault(IERC20 asset) external returns (SaveTokenVault vault) {
        address assetAddress = address(asset);

        if (assetAddress == address(0)) {
            revert AssetIsZero();
        }
        if (assetAddress.code.length == 0) {
            revert AssetIsNotContract(assetAddress);
        }

        address existing = vaultForAsset[assetAddress];
        if (existing != address(0)) {
            revert VaultAlreadyExists(assetAddress, existing);
        }

        string memory assetHex = assetAddress.toHexString();
        vault = new SaveTokenVault({
            asset_: asset,
            name_: string.concat("Save Any Token Vault ", assetHex),
            symbol_: string.concat("sat-", assetHex)
        });

        vaultForAsset[assetAddress] = address(vault);
        allVaults.push(address(vault));

        emit VaultCreated(assetAddress, address(vault));
    }

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }
}
