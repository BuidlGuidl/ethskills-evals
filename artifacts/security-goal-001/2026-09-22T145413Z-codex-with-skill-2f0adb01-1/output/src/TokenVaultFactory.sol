// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TokenVault} from "./TokenVault.sol";

contract TokenVaultFactory {
    mapping(address => address) public vaultOf;
    address[] public allVaults;

    error ZeroAddress();
    error AssetIsNotContract();
    error VaultAlreadyExists(address vault);
    error EmptyMetadata();

    event VaultCreated(
        address indexed asset, address indexed vault, address indexed listedBy, string name, string symbol
    );

    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
        if (asset == address(0)) revert ZeroAddress();
        if (asset.code.length == 0) revert AssetIsNotContract();
        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert EmptyMetadata();

        address existingVault = vaultOf[asset];
        if (existingVault != address(0)) revert VaultAlreadyExists(existingVault);

        vault = address(new TokenVault(asset, name, symbol, msg.sender));
        vaultOf[asset] = vault;
        allVaults.push(vault);

        emit VaultCreated(asset, vault, msg.sender, name, symbol);
    }

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }
}

