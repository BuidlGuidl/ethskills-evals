// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TokenVault} from "./TokenVault.sol";

contract TokenVaultFactory {
    error ZeroAddress();
    error VaultAlreadyExists();

    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);

    mapping(address asset => address vault) public vaultForAsset;

    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
        if (asset == address(0)) revert ZeroAddress();
        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();

        vault = address(new TokenVault(asset, name, symbol));
        vaultForAsset[asset] = vault;

        emit VaultCreated(asset, vault, msg.sender, name, symbol);
    }
}

