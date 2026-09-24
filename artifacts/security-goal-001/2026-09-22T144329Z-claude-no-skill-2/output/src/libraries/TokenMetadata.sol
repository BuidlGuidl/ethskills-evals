// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Best-effort, non-reverting reads of ERC-20 metadata.
/// @dev Listing is permissionless, so the factory must be able to inspect a
///      hostile token without the call reverting, returning garbage-length
///      data, or burning unbounded gas on a huge returndata blob.
library TokenMetadata {
    /// @dev Gas ceiling for a metadata staticcall. Bounds returndata copy cost.
    uint256 private constant PROBE_GAS = 50_000;
    /// @dev Longest symbol/name fragment we are willing to embed in a receipt token.
    uint256 private constant MAX_LEN = 16;

    /// @return ok whether the token exposes a usable `decimals()`
    /// @return decimals the reported value
    function tryDecimals(address token) internal view returns (bool ok, uint8 decimals) {
        (bool success, bytes memory data) = token.staticcall{gas: PROBE_GAS}(abi.encodeWithSignature("decimals()"));
        if (!success || data.length != 32) return (false, 0);
        uint256 raw = abi.decode(data, (uint256));
        if (raw > type(uint8).max) return (false, 0);
        return (true, uint8(raw));
    }

    /// @notice Reads `symbol()`, tolerating both `string` and legacy `bytes32` returns.
    /// @dev Falls back to `fallbackValue` when the token has no readable symbol.
    function symbolOr(address token, string memory fallbackValue) internal view returns (string memory) {
        return _stringOr(token, abi.encodeWithSignature("symbol()"), fallbackValue);
    }

    function nameOr(address token, string memory fallbackValue) internal view returns (string memory) {
        return _stringOr(token, abi.encodeWithSignature("name()"), fallbackValue);
    }

    function _stringOr(address token, bytes memory callData, string memory fallbackValue)
        private
        view
        returns (string memory)
    {
        (bool success, bytes memory data) = token.staticcall{gas: PROBE_GAS}(callData);
        if (!success || data.length == 0) return fallbackValue;

        // Legacy tokens (MKR and friends) return a raw bytes32.
        if (data.length == 32) {
            bytes32 word = abi.decode(data, (bytes32));
            if (word == bytes32(0)) return fallbackValue;
            uint256 len;
            while (len < 32 && word[len] != 0) len++;
            bytes memory out = new bytes(len);
            for (uint256 i; i < len; ++i) {
                out[i] = word[i];
            }
            return _sanitize(string(out), fallbackValue);
        }

        // ABI-encoded string. Decode by hand with explicit bounds checks so a
        // malformed offset/length cannot revert the listing transaction.
        if (data.length < 64) return fallbackValue;
        uint256 offset = abi.decode(data, (uint256));
        if (offset > data.length - 32 || offset % 32 != 0) return fallbackValue;
        uint256 strLen;
        assembly {
            strLen := mload(add(add(data, 0x20), offset))
        }
        if (strLen == 0 || strLen > data.length - offset - 32) return fallbackValue;
        uint256 copyLen = strLen > MAX_LEN ? MAX_LEN : strLen;
        bytes memory raw = new bytes(copyLen);
        for (uint256 i; i < copyLen; ++i) {
            raw[i] = data[offset + 32 + i];
        }
        return _sanitize(string(raw), fallbackValue);
    }

    /// @dev Truncates to MAX_LEN and strips bytes that would break a UI label.
    function _sanitize(string memory input, string memory fallbackValue) private pure returns (string memory) {
        bytes memory b = bytes(input);
        if (b.length == 0) return fallbackValue;
        uint256 len = b.length > MAX_LEN ? MAX_LEN : b.length;
        bytes memory out = new bytes(len);
        for (uint256 i; i < len; ++i) {
            uint8 c = uint8(b[i]);
            // printable ASCII only; anything else becomes '?'
            out[i] = (c >= 0x20 && c <= 0x7E) ? b[i] : bytes1("?");
        }
        return string(out);
    }
}
