// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title TokenMetadata
/// @notice Defensive readers for the optional ERC-20 metadata methods.
/// @dev Listing is permissionless, so the underlying token is untrusted. `name()`/`symbol()` may be
///      missing, may return a `bytes32` (MKR and other pre-EIP-20-final tokens), may return a
///      megabyte-long string, or may revert / consume all forwarded gas. Every read here is a
///      gas-capped staticcall whose return data is parsed with explicit bounds checks, never with
///      `abi.decode` (which reverts on malformed data and would make the token unlistable).
library TokenMetadata {
    /// @dev Upper bound on characters copied out of the token's response.
    uint256 internal constant MAX_STRING_BYTES = 48;
    /// @dev Gas cap for each metadata staticcall. Enough for an SLOAD-backed getter, not enough to
    ///      let a hostile token grief the caller with an expensive loop.
    uint256 internal constant METADATA_GAS = 60_000;

    function readName(address token) internal view returns (string memory) {
        return _readString(token, abi.encodeWithSignature("name()"), "Unknown Token");
    }

    function readSymbol(address token) internal view returns (string memory) {
        return _readString(token, abi.encodeWithSignature("symbol()"), "TKN");
    }

    /// @notice Reads `decimals()`, defaulting to 18 when absent or implausible.
    /// @dev Only used for the receipt token's display decimals; it is never used in share math, so a
    ///      lying token cannot corrupt accounting.
    function readDecimals(address token) internal view returns (uint8) {
        (bool ok, bytes memory data) =
            token.staticcall{gas: METADATA_GAS}(abi.encodeWithSignature("decimals()"));
        if (ok && data.length == 32) {
            uint256 d = uint256(bytes32(data));
            if (d <= 36) return uint8(d);
        }
        return 18;
    }

    function _readString(address token, bytes memory callData, string memory fallbackValue)
        private
        view
        returns (string memory)
    {
        (bool ok, bytes memory data) = token.staticcall{gas: METADATA_GAS}(callData);
        if (!ok || data.length == 0) return fallbackValue;

        // bytes32-style metadata: a single word, not an ABI-encoded string.
        if (data.length == 32) {
            bytes32 raw = bytes32(data);
            if (raw == bytes32(0)) return fallbackValue;
            uint256 n;
            while (n < 32 && raw[n] != 0) n++;
            bytes memory word = new bytes(n);
            for (uint256 i; i < n; ++i) {
                word[i] = raw[i];
            }
            return string(word);
        }

        // ABI-encoded string: [offset][length][payload]. Bounds-check every field by hand.
        if (data.length < 64) return fallbackValue;
        uint256 offset = uint256(bytes32(data));
        if (offset != 32) return fallbackValue;
        uint256 len;
        assembly ("memory-safe") {
            len := mload(add(data, 0x40))
        }
        if (len == 0 || len > data.length - 64) return fallbackValue;
        if (len > MAX_STRING_BYTES) len = MAX_STRING_BYTES;

        bytes memory out = new bytes(len);
        for (uint256 i; i < len; ++i) {
            out[i] = data[64 + i];
        }
        return string(out);
    }
}
