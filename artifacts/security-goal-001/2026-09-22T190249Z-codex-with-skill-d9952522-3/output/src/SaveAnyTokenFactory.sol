// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TokenSavingsVault} from "./TokenSavingsVault.sol";

/// @notice Permissionless registry and deployer for one savings vault per ERC-20 asset.
contract SaveAnyTokenFactory {
    mapping(address asset => address vault) public vaultForAsset;

    address[] private _allVaults;

    error InvalidAsset(address asset);
    error VaultAlreadyExists(address asset, address vault);

    event VaultCreated(
        address indexed asset, address indexed vault, address indexed creator, string receiptName, string receiptSymbol
    );

    function createVault(IERC20 asset, string calldata receiptName, string calldata receiptSymbol)
        external
        returns (address vault)
    {
        address assetAddress = address(asset);
        if (assetAddress == address(0) || assetAddress.code.length == 0) {
            revert InvalidAsset(assetAddress);
        }

        address existingVault = vaultForAsset[assetAddress];
        if (existingVault != address(0)) {
            revert VaultAlreadyExists(assetAddress, existingVault);
        }

        vault = address(new TokenSavingsVault(asset, receiptName, receiptSymbol, address(this)));
        vaultForAsset[assetAddress] = vault;
        _allVaults.push(vault);

        emit VaultCreated(assetAddress, vault, msg.sender, receiptName, receiptSymbol);
    }

    function allVaultsLength() external view returns (uint256) {
        return _allVaults.length;
    }

    function allVaults(uint256 index) external view returns (address) {
        return _allVaults[index];
    }
}

