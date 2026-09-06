// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import {SaveTokenVault} from "./SaveTokenVault.sol";

/// @notice Permissionless registry and deployer for single-asset savings vaults.
contract SaveTokenVaultFactory {
    error ZeroAsset();
    error VaultAlreadyExists(address asset, address vault);

    event VaultCreated(
        address indexed asset,
        address indexed vault,
        address indexed listingOperator,
        string shareName,
        string shareSymbol
    );

    mapping(address asset => address vault) public vaultForAsset;
    address[] public allVaults;

    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
        external
        returns (address vault)
    {
        if (asset == address(0)) revert ZeroAsset();

        address existingVault = vaultForAsset[asset];
        if (existingVault != address(0)) revert VaultAlreadyExists(asset, existingVault);

        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol, msg.sender));
        vaultForAsset[asset] = vault;
        allVaults.push(vault);

        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
    }

    function vaultCount() external view returns (uint256) {
        return allVaults.length;
    }
}

