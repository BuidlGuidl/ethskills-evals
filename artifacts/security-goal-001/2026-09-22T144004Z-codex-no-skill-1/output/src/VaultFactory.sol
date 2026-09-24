// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TokenVault} from "./TokenVault.sol";

contract VaultFactory {
    mapping(address asset => address vault) public vaultForAsset;
    address[] public allVaults;

    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);

    error ZeroAddress();
    error NotAContract();

    function createVault(address asset) external returns (address vault) {
        if (asset == address(0)) revert ZeroAddress();
        if (asset.code.length == 0) revert NotAContract();

        vault = vaultForAsset[asset];
        if (vault != address(0)) {
            return vault;
        }

        vault = address(new TokenVault{salt: bytes32(uint256(uint160(asset)))}(asset));
        vaultForAsset[asset] = vault;
        allVaults.push(vault);

        emit VaultCreated(asset, vault, msg.sender);
    }

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }
}

