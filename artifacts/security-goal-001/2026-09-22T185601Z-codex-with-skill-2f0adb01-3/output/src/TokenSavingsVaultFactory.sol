// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

import {TokenSavingsVault} from "./TokenSavingsVault.sol";

/// @notice Permissionless registry and deployer for one savings vault per ERC-20 asset.
contract TokenSavingsVaultFactory {
    mapping(address asset => address vault) public vaultForAsset;
    address[] private _allVaults;

    event VaultCreated(address indexed asset, address indexed vault, address indexed creator, string name, string symbol);

    error ZeroAddress();
    error AssetHasNoCode(address asset);

    function createVault(address asset) external returns (address vault) {
        if (asset == address(0)) revert ZeroAddress();
        if (asset.code.length == 0) revert AssetHasNoCode(asset);

        vault = vaultForAsset[asset];
        if (vault != address(0)) {
            return vault;
        }

        (string memory name, string memory symbol) = _receiptMetadata(asset);
        vault = address(new TokenSavingsVault{salt: bytes32(uint256(uint160(asset)))}(IERC20(asset), name, symbol));

        vaultForAsset[asset] = vault;
        _allVaults.push(vault);

        emit VaultCreated(asset, vault, msg.sender, name, symbol);
    }

    function predictVault(address asset) external view returns (address) {
        (string memory name, string memory symbol) = _receiptMetadata(asset);
        bytes memory initCode = abi.encodePacked(
            type(TokenSavingsVault).creationCode,
            abi.encode(IERC20(asset), name, symbol)
        );
        return Create2.computeAddress(bytes32(uint256(uint160(asset))), keccak256(initCode));
    }

    function allVaultsLength() external view returns (uint256) {
        return _allVaults.length;
    }

    function allVaults(uint256 index) external view returns (address) {
        return _allVaults[index];
    }

    function _receiptMetadata(address asset) internal view returns (string memory name, string memory symbol) {
        string memory assetSymbol = _trySymbol(asset);

        if (bytes(assetSymbol).length == 0) {
            assetSymbol = _toHex(asset);
        }

        name = string.concat("Save ", assetSymbol, " Vault");
        symbol = string.concat("sv", assetSymbol);
    }

    function _trySymbol(address asset) internal view returns (string memory) {
        try IERC20Metadata(asset).symbol() returns (string memory symbol) {
            return symbol;
        } catch {
            return "";
        }
    }

    function _toHex(address account) internal pure returns (string memory) {
        bytes20 value = bytes20(account);
        bytes16 alphabet = "0123456789abcdef";
        bytes memory buffer = new bytes(42);
        buffer[0] = "0";
        buffer[1] = "x";

        for (uint256 i = 0; i < 20; ++i) {
            buffer[2 + i * 2] = alphabet[uint8(value[i] >> 4)];
            buffer[3 + i * 2] = alphabet[uint8(value[i] & 0x0f)];
        }

        return string(buffer);
    }
}
