// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20, IERC20Metadata} from "./IERC20.sol";
import {SaveTokenVault} from "./SaveTokenVault.sol";

contract SaveVaultFactory {
    error ZeroAddress();
    error VaultAlreadyExists(address vault);

    mapping(address => address) public vaultForAsset;
    address[] public allVaults;

    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol);

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }

    function createVault(IERC20 asset) external returns (SaveTokenVault vault) {
        address assetAddress = address(asset);
        if (assetAddress == address(0)) revert ZeroAddress();

        address existing = vaultForAsset[assetAddress];
        if (existing != address(0)) revert VaultAlreadyExists(existing);

        string memory assetSymbol = _readString(assetAddress, IERC20Metadata.symbol.selector, "TOKEN");
        uint8 assetDecimals = _readDecimals(assetAddress);
        string memory name = string.concat("Save ", assetSymbol, " Vault");
        string memory symbol = string.concat("sv", assetSymbol);

        vault = new SaveTokenVault(asset, name, symbol, assetDecimals);
        vaultForAsset[assetAddress] = address(vault);
        allVaults.push(address(vault));

        emit VaultCreated(assetAddress, address(vault), name, symbol);
    }

    function _readString(address token, bytes4 selector, string memory fallbackValue)
        private
        view
        returns (string memory)
    {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSelector(selector));
        if (!ok || data.length == 0) return fallbackValue;

        if (data.length == 32) {
            bytes32 raw = abi.decode(data, (bytes32));
            uint256 length;
            while (length < 32 && raw[length] != 0) {
                unchecked {
                    ++length;
                }
            }

            bytes memory out = new bytes(length);
            for (uint256 i; i < length;) {
                out[i] = raw[i];
                unchecked {
                    ++i;
                }
            }
            return string(out);
        }

        if (data.length >= 64) {
            uint256 offset;
            uint256 length;
            assembly {
                offset := mload(add(data, 0x20))
                length := mload(add(data, 0x40))
            }

            if (offset != 32 || length > data.length - 64) {
                return fallbackValue;
            }

            bytes memory out = new bytes(length);
            for (uint256 i; i < length;) {
                out[i] = data[64 + i];
                unchecked {
                    ++i;
                }
            }
            return string(out);
        }

        return fallbackValue;
    }

    function _readDecimals(address token) private view returns (uint8) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSelector(IERC20Metadata.decimals.selector));
        if (!ok || data.length < 32) return 18;

        uint256 decoded = abi.decode(data, (uint256));
        // casting to uint8 is safe because values above uint8.max return the fallback.
        // forge-lint: disable-next-line(unsafe-typecast)
        return decoded > type(uint8).max ? 18 : uint8(decoded);
    }
}
