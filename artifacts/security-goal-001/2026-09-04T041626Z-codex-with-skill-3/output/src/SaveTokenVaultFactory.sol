// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SaveTokenVault} from "./SaveTokenVault.sol";

contract SaveTokenVaultFactory {
    error ZeroAssetAddress();
    error VaultAlreadyExists();

    event VaultCreated(
        address indexed asset, address indexed vault, address indexed creator, string name, string symbol
    );

    mapping(address asset => address vault) public vaultForAsset;
    mapping(address vault => bool isFactoryVault) public isFactoryVault;

    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
        if (asset == address(0)) {
            revert ZeroAssetAddress();
        }
        if (vaultForAsset[asset] != address(0)) {
            revert VaultAlreadyExists();
        }

        vault = address(new SaveTokenVault{salt: keccak256(abi.encode(asset))}(IERC20(asset), name, symbol));

        vaultForAsset[asset] = vault;
        isFactoryVault[vault] = true;

        emit VaultCreated(asset, vault, msg.sender, name, symbol);
    }
}
