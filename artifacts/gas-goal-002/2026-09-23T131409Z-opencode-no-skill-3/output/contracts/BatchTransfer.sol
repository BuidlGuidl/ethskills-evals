// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BatchTransfer
/// @notice Amortizes the fixed per-transaction costs (21,000 gas intrinsic +
///         L1 data fee) across many ERC-20 transfers sent by the relayer.
///
/// Two entry points per token:
///   - batchTransfer: simple address[]/uint256[] arrays (easiest to call)
///   - batchPacked:   one 32-byte word per transfer [20-byte addr | uint96 amount]
///                    ~50% less calldata => ~50% lower L1 data fee per transfer
///
/// The relayer approves this contract once per token; each batch pulls funds
/// via transferFrom. Owner-only so nobody else can spend the allowance.
contract BatchTransfer {
    address public immutable owner;

    error NotOwner();
    error LengthMismatch(uint256 recipients, uint256 amounts);
    error BadPackedLength(uint256 length);
    error ZeroAddress();
    error TransferFailed(address token, address to, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Send `amounts[i]` of `token` to each `recipients[i]`.
    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyOwner
        returns (uint256 total)
    {
        uint256 n = recipients.length;
        if (n != amounts.length) revert LengthMismatch(n, amounts.length);
        for (uint256 i; i < n;) {
            address to = recipients[i];
            uint256 amount = amounts[i];
            if (to == address(0)) revert ZeroAddress();
            total += amount;
            _transfer(token, to, amount);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Calldata-optimized batch: `packed` is a concatenation of 32-byte
    ///         words, each holding [20-byte address | 12-byte uint96 amount].
    ///         uint96 supports up to ~7.9e28 base units per transfer (e.g.
    ///         7.9e22 USDC at 6 decimals) — far above any payment size.
    function batchPacked(address token, bytes calldata packed) external onlyOwner returns (uint256 total) {
        uint256 len = packed.length;
        if (len == 0 || len % 32 != 0) revert BadPackedLength(len);
        uint256 n = len / 32;
        for (uint256 i; i < n;) {
            uint256 word;
            assembly {
                word := calldataload(add(packed.offset, mul(i, 32)))
            }
            address to = address(uint160(word >> 96));
            uint96 amount = uint96(word);
            if (to == address(0)) revert ZeroAddress();
            total += amount;
            _transfer(token, to, amount);
            unchecked {
                ++i;
            }
        }
    }

    /// @dev Low-level call so non-standard tokens that omit the bool return
    ///      value (USDT-style) still work.
    function _transfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            token.call(abi.encodeCall(IERC20.transferFrom, (msg.sender, to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed(token, to, amount);
        }
    }
}
