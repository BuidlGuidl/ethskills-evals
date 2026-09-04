// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SaveTokenVault} from "./SaveTokenVault.sol";

contract SaveTokenVaultFactory {
    error ZeroAssetAddress();
    error EmptyMetadata();
    error VaultAlreadyExists(address asset, address vault);

    event VaultCreated(
        address indexed asset,
        address indexed vault,
        address indexed creator,
        string shareName,
        string shareSymbol
    );

    mapping(address asset => address vault) public vaultForAsset;
    mapping(address asset => address creator) public vaultCreatorForAsset;
    address[] private _allVaults;

    function createVault(address asset, string calldata shareName, string calldata shareSymbol)
        external
        returns (address vault)
    {
        if (asset == address(0)) {
            revert ZeroAssetAddress();
        }
        if (bytes(shareName).length == 0 || bytes(shareSymbol).length == 0) {
            revert EmptyMetadata();
        }

        address existingVault = vaultForAsset[asset];
        if (existingVault != address(0)) {
            revert VaultAlreadyExists(asset, existingVault);
        }

        vault = address(new SaveTokenVault(IERC20(asset), shareName, shareSymbol));
        vaultForAsset[asset] = vault;
        vaultCreatorForAsset[asset] = msg.sender;
        _allVaults.push(vault);

        emit VaultCreated(asset, vault, msg.sender, shareName, shareSymbol);
    }

    function totalVaults() external view returns (uint256) {
        return _allVaults.length;
    }

    function allVaults(uint256 index) external view returns (address vault) {
        return _allVaults[index];
    }
}

