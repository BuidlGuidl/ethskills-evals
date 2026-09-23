// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BatchTransfer
/// @notice Amortizes the 21,000-gas intrinsic cost and L1 envelope overhead of
///         ERC-20 payments across many recipients in a single transaction.
///
/// Usage (relayer):
///   1. Relayer EOA approves this contract once per token (type(uint256).max).
///   2. Relayer calls batchTransfer(token, recipients, amounts).
///      Tokens move relayer -> recipients via transferFrom; the contract
///      never holds funds between calls.
///
/// Safety:
///   - Owner-only entry. The batch is atomic: any failed transfer reverts
///     the whole call, so a bad recipient cannot strand partial payments.
///   - Only call with tokens the relayer trusts (a malicious token could
///     reenter; owner-only access plus trusted-token policy is the mitigation).
contract BatchTransfer {
    address public immutable owner;

    error NotOwner();
    error LengthMismatch();
    error EmptyBatch();

    constructor() {
        owner = msg.sender;
    }

    /// @param token      ERC-20 to move. Relayer must have approved this contract.
    /// @param recipients Parallel to amounts.
    /// @param amounts    Parallel to recipients.
    function batchTransfer(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        if (msg.sender != owner) revert NotOwner();
        uint256 n = recipients.length;
        if (n == 0) revert EmptyBatch();
        if (amounts.length != n) revert LengthMismatch();

        // One cold SLOAD of `owner`, then the loop is all warm token access:
        // the token contract is touched once per iteration, staying warm.
        address from = owner;
        for (uint256 i = 0; i < n; ++i) {
            // Forge the plan: a non-returning or false-returning token bubbles
            // up as a revert here, keeping the batch atomic.
            require(IERC20(token).transferFrom(from, recipients[i], amounts[i]), "transfer failed");
        }
    }
}
