// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title TokenMetadata
 * @notice Best-effort reads of `name()` / `symbol()` from an arbitrary ERC-20.
 *
 * @dev Listing is permissionless, so the underlying token is untrusted and may:
 *      - not implement `symbol()` / `name()` at all (they are optional in ERC-20),
 *      - return a `bytes32` instead of a `string` (MKR and other pre-standard tokens),
 *      - return deliberately malformed ABI data, or
 *      - return a megabyte-long string to make vault deployment revert on gas.
 *
 *      Every read here is therefore a `staticcall` with a gas cap, and the returned
 *      buffer is decoded by hand with explicit bounds checks instead of `abi.decode`,
 *      which would revert on malformed data and can be made to allocate unbounded
 *      memory. Anything unexpected falls back to a generic label derived from the
 *      token address. Metadata is cosmetic: it must never be able to block a listing.
 */
library TokenMetadata {
    /// @dev Enough for any honest implementation; caps grief from a hostile one.
    uint256 private constant GAS_CAP = 50_000;
    /// @dev Longest metadata string we are willing to copy into the vault's name/symbol.
    uint256 private constant MAX_LEN = 32;

    function safeSymbol(address token) internal view returns (string memory) {
        string memory s = _read(token, abi.encodeWithSignature("symbol()"));
        return bytes(s).length == 0 ? _shortHex(token) : s;
    }

    function safeName(address token) internal view returns (string memory) {
        string memory n = _read(token, abi.encodeWithSignature("name()"));
        return bytes(n).length == 0 ? _shortHex(token) : n;
    }

    /// @dev Returns "" whenever the token's answer is missing, oversized or malformed.
    function _read(address token, bytes memory callData) private view returns (string memory) {
        (bool ok, bytes memory data) = token.staticcall{gas: GAS_CAP}(callData);
        if (!ok) return "";

        // Case 1: `bytes32` symbol/name (non-standard but common in pre-ERC-20 tokens).
        if (data.length == 32) {
            // Safe: guarded by `data.length == 32` above.
            // forge-lint: disable-next-line(unsafe-typecast)
            bytes32 word = bytes32(data);
            uint256 len;
            while (len < 32 && word[len] != 0) len++;
            bytes memory out = new bytes(len);
            for (uint256 i; i < len; ++i) out[i] = word[i];
            return string(out);
        }

        // Case 2: properly ABI-encoded `string`. Validate the offset and length words
        // against the actual buffer before copying a single byte.
        if (data.length < 64) return "";
        uint256 offset;
        assembly ("memory-safe") {
            offset := mload(add(data, 0x20))
        }
        if (offset != 0x20) return "";

        uint256 strLen;
        assembly ("memory-safe") {
            strLen := mload(add(data, 0x40))
        }
        if (strLen == 0 || strLen > MAX_LEN || data.length < 0x40 + strLen) return "";

        bytes memory str = new bytes(strLen);
        for (uint256 i; i < strLen; ++i) {
            bytes1 c = data[0x40 + i];
            // Reject control characters and anything non-ASCII so a token cannot inject
            // newlines or invisible glyphs into a name that front ends will render.
            if (c < 0x20 || c > 0x7E) return "";
            str[i] = c;
        }
        return string(str);
    }

    /// @dev Fallback label: first four bytes of the token address, e.g. "6b175474".
    function _shortHex(address token) private pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes20 raw = bytes20(token);
        bytes memory out = new bytes(8);
        for (uint256 i; i < 4; ++i) {
            out[i * 2] = alphabet[uint8(raw[i]) >> 4];
            out[i * 2 + 1] = alphabet[uint8(raw[i]) & 0x0f];
        }
        return string(out);
    }
}
