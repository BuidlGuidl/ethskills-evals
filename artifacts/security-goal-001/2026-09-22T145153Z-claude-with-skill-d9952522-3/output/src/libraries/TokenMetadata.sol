// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title TokenMetadata
/// @notice Best-effort, non-reverting reads of optional ERC-20 metadata.
/// @dev Listing is permissionless, so the token being read is untrusted. Every read here is a
///      gas-capped static call with bounded return data: a token that reverts, returns garbage,
///      returns a `bytes32` symbol (MKR-style), or tries to return a multi-megabyte "return data
///      bomb" must not be able to make vault deployment revert or run out of gas.
library TokenMetadata {
    /// @dev Enough for any honest implementation, far too little to be used as a gas sink.
    uint256 private constant READ_GAS = 50_000;
    /// @dev ABI head (offset) + length + one word of string data.
    uint256 private constant MAX_RETURN = 96;
    /// @dev Symbols longer than this are treated as hostile and replaced by the address fallback.
    uint256 private constant MAX_SYMBOL_LEN = 16;

    /// @notice Returns `token.symbol()` if it is short and printable ASCII, otherwise a fallback
    ///         derived from the token address (e.g. "0xa0b8...eb48").
    function safeSymbol(address token) internal view returns (string memory) {
        bytes memory raw = _staticRead(token, abi.encodeWithSignature("symbol()"));

        if (raw.length >= 64) {
            // Standard `string` return: [offset][length][data...]. Validate rather than abi.decode,
            // because abi.decode reverts on malformed data and would brick the deployment.
            uint256 offset = _word(raw, 0);
            uint256 length = _word(raw, 32);
            if (offset == 32 && length != 0 && length <= MAX_SYMBOL_LEN && raw.length >= 64 + length) {
                bytes memory out = new bytes(length);
                for (uint256 i = 0; i < length; ++i) {
                    bytes1 c = raw[64 + i];
                    if (!_isPrintable(c)) return _addressFallback(token);
                    out[i] = c;
                }
                return string(out);
            }
        } else if (raw.length == 32) {
            // bytes32 symbol (pre-standard tokens such as MKR).
            bytes32 packed = bytes32(_word(raw, 0));
            uint256 len;
            while (len < 32 && packed[len] != 0) ++len;
            if (len != 0 && len <= MAX_SYMBOL_LEN) {
                bytes memory out = new bytes(len);
                for (uint256 i = 0; i < len; ++i) {
                    if (!_isPrintable(packed[i])) return _addressFallback(token);
                    out[i] = packed[i];
                }
                return string(out);
            }
        }

        return _addressFallback(token);
    }

    /// @notice Returns `token.decimals()`, or 18 if the token does not implement it sanely.
    /// @dev Only affects the display precision of the receipt token; all share math is unitless.
    function safeDecimals(address token) internal view returns (uint8) {
        bytes memory raw = _staticRead(token, abi.encodeWithSignature("decimals()"));
        if (raw.length < 32) return 18;
        uint256 value = _word(raw, 0);
        if (value > 36) return 18; // nonsense value; fall back rather than propagate it
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint8(value); // bounded by the check above
    }

    /// @dev Gas-capped static call that copies at most `MAX_RETURN` bytes of return data.
    function _staticRead(address token, bytes memory payload) private view returns (bytes memory out) {
        out = new bytes(MAX_RETURN);
        uint256 copied;
        assembly ("memory-safe") {
            let ok := staticcall(READ_GAS, token, add(payload, 0x20), mload(payload), 0, 0)
            if ok {
                copied := returndatasize()
                if gt(copied, MAX_RETURN) { copied := MAX_RETURN }
                returndatacopy(add(out, 0x20), 0, copied)
            }
        }
        assembly ("memory-safe") {
            mstore(out, copied)
        }
    }

    function _word(bytes memory data, uint256 at) private pure returns (uint256 value) {
        assembly ("memory-safe") {
            value := mload(add(add(data, 0x20), at))
        }
    }

    function _isPrintable(bytes1 c) private pure returns (bool) {
        return c >= 0x20 && c <= 0x7e;
    }

    function _addressFallback(address token) private pure returns (string memory) {
        bytes16 hexDigits = "0123456789abcdef";
        uint256 value = uint256(uint160(token));
        bytes memory out = new bytes(12); // "0x" + 4 leading + ".." + 4 trailing hex chars
        out[0] = "0";
        out[1] = "x";
        for (uint256 i = 0; i < 4; ++i) {
            out[2 + i] = hexDigits[(value >> (156 - 4 * i)) & 0xf];
        }
        out[6] = ".";
        out[7] = ".";
        for (uint256 i = 0; i < 4; ++i) {
            out[8 + i] = hexDigits[(value >> (12 - 4 * i)) & 0xf];
        }
        return string(out);
    }
}
