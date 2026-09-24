// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SaveAnyTokenVault} from "./SaveAnyTokenVault.sol";

contract SaveAnyTokenVaultFactory {
    mapping(address asset => address vault) public vaultForAsset;
    address[] private _allVaults;

    event VaultCreated(address indexed asset, address indexed vault, address indexed creator);

    error InvalidAsset();
    error VaultAlreadyExists(address vault);

    function createVault(address asset) external returns (address vault) {
        if (asset == address(0)) revert InvalidAsset();
        if (vaultForAsset[asset] != address(0)) revert VaultAlreadyExists(vaultForAsset[asset]);

        string memory name = "Save Any Token Vault Share";
        string memory symbol = "savTOKEN";

        vault = address(new SaveAnyTokenVault(IERC20(asset), address(this), name, symbol));
        vaultForAsset[asset] = vault;
        _allVaults.push(vault);

        emit VaultCreated(asset, vault, msg.sender);
    }

    function allVaults() external view returns (address[] memory) {
        return _allVaults;
    }

    function allVaultsLength() external view returns (uint256) {
        return _allVaults.length;
    }
}

