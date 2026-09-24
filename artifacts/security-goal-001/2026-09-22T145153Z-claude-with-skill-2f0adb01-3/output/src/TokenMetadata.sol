// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title TokenMetadata
/// @notice Defensive reads of the optional ERC-20 metadata fields.
/// @dev `name()`/`symbol()` are optional in ERC-20 and some mainnet tokens (MKR, SAI…)
///      return `bytes32` instead of `string`. Because listing is permissionless the token
///      is fully untrusted, so every read is a gas-capped staticcall with a bounded return
///      size and a fallback value; a token can never make listing revert or blow up gas.
library TokenMetadata {
    uint256 private constant GAS_CAP = 50_000;
    uint256 private constant MAX_RETURN_BYTES = 256;
    uint256 private constant MAX_STRING_BYTES = 32;

    function safeName(address token) internal view returns (string memory) {
        return _read(token, abi.encodeWithSignature("name()"), "Unknown Token");
    }

    function safeSymbol(address token) internal view returns (string memory) {
        return _read(token, abi.encodeWithSignature("symbol()"), "TKN");
    }

    function _read(address token, bytes memory payload, string memory fallbackValue)
        private
        view
        returns (string memory)
    {
        (bool ok, bytes memory data) = token.staticcall{gas: GAS_CAP}(payload);
        if (!ok || data.length == 0 || data.length > MAX_RETURN_BYTES) return fallbackValue;

        // bytes32-style metadata (non-standard but common on older tokens).
        if (data.length == 32) {
            bytes32 raw = abi.decode(data, (bytes32));
            if (raw == bytes32(0)) return fallbackValue;
            uint256 len;
            while (len < 32 && raw[len] != 0) len++;
            bytes memory out = new bytes(len);
            for (uint256 i; i < len; ++i) out[i] = raw[i];
            return string(out);
        }

        // Properly ABI-encoded string: offset (32) + length (32) + payload.
        if (data.length < 64) return fallbackValue;
        uint256 offset;
        uint256 strLen;
        assembly ("memory-safe") {
            offset := mload(add(data, 0x20))
            strLen := mload(add(data, 0x40))
        }
        if (offset != 32 || strLen == 0 || strLen > MAX_STRING_BYTES || 64 + strLen > data.length) {
            return fallbackValue;
        }

        bytes memory str = new bytes(strLen);
        for (uint256 i; i < strLen; ++i) str[i] = data[64 + i];
        return string(str);
    }
}
