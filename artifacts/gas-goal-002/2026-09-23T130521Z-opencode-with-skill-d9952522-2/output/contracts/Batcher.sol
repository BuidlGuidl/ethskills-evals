// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title Batcher — amortizes the 21,000-gas tx intrinsic and the fixed L1
/// data overhead across many ERC-20 transfers in one transaction.
/// @dev Pull-based: this contract never custodies funds. The relayer EOA owns
///      it and grants it a token allowance once (one-time ~46k gas approval).
///      Each batch pulls transferFrom(owner, recipient[i], amount[i]).
contract Batcher {
    address public immutable owner;

    error NotOwner();
    error LengthMismatch();
    error EmptyBatch();
    error TransferFailed(uint256 index);

    constructor() {
        owner = msg.sender;
    }

    /// @param token   ERC-20 to move (e.g. USDC). Not safe for fee-on-transfer
    ///                or rebasing tokens — amounts are taken as exact.
    /// @param to      Recipients.
    /// @param amounts Exact amounts, parallel to `to`.
    function batchTransfer(address token, address[] calldata to, uint256[] calldata amounts) external {
        if (msg.sender != owner) revert NotOwner();
        if (to.length != amounts.length) revert LengthMismatch();
        if (to.length == 0) revert EmptyBatch();

        for (uint256 i; i < to.length; ++i) {
            // Low-level call so both bool-returning (USDC) and non-returning
            // (USDT-style) tokens work.
            (bool ok, bytes memory ret) =
                token.call(abi.encodeCall(IERC20.transferFrom, (owner, to[i], amounts[i])));
            if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed(i);
        }
    }
}
