// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TokenVault} from "./TokenVault.sol";

contract TokenVaultFactory {
    error ZeroAsset();
    error VaultAlreadyExists();

    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, address creator);

    mapping(address => address) public vaultForAsset;
    address[] public allVaults;

    function createVault(address asset, string calldata name, string calldata symbol)
        external
        returns (address vault)
    {
        if (asset == address(0)) revert ZeroAsset();
        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists();

        vault = address(new TokenVault(asset, name, symbol));
        vaultForAsset[asset] = vault;
        allVaults.push(vault);

        emit VaultCreated(asset, vault, name, symbol, msg.sender);
    }

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }
}

