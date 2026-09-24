// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";
import {IERC20Metadata} from "./interfaces/IERC20Metadata.sol";
import {TokenVault} from "./TokenVault.sol";

contract TokenVaultFactory {
    uint256 private constant _MAX_NAME_LENGTH = 80;
    uint256 private constant _MAX_SYMBOL_LENGTH = 24;

    mapping(address asset => address vault) public vaultForAsset;
    address[] public allVaults;

    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol, uint8 decimals);

    error ZeroAddress();
    error AssetNotContract();
    error VaultAlreadyExists(address vault);
    error InvalidName();
    error InvalidSymbol();

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }

    function createVault(address asset, string calldata name, string calldata symbol) external returns (address vault) {
        if (asset == address(0)) {
            revert ZeroAddress();
        }
        if (asset.code.length == 0) {
            revert AssetNotContract();
        }

        address existingVault = vaultForAsset[asset];
        if (existingVault != address(0)) {
            revert VaultAlreadyExists(existingVault);
        }

        _validateMetadata(name, symbol);

        uint8 decimals = _readDecimals(asset);
        vault = address(new TokenVault(IERC20(asset), name, symbol, decimals));

        vaultForAsset[asset] = vault;
        allVaults.push(vault);

        emit VaultCreated(asset, vault, name, symbol, decimals);
    }

    function _validateMetadata(string calldata name, string calldata symbol) private pure {
        bytes calldata nameBytes = bytes(name);
        bytes calldata symbolBytes = bytes(symbol);

        if (nameBytes.length == 0 || nameBytes.length > _MAX_NAME_LENGTH) {
            revert InvalidName();
        }
        if (symbolBytes.length == 0 || symbolBytes.length > _MAX_SYMBOL_LENGTH) {
            revert InvalidSymbol();
        }
    }

    function _readDecimals(address asset) private view returns (uint8) {
        try IERC20Metadata(asset).decimals() returns (uint8 tokenDecimals) {
            return tokenDecimals;
        } catch {
            return 18;
        }
    }
}

