// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 surface. Deliberately declared with a bool return so
///         we can tolerate tokens (USDT-style) that return nothing.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BatchTransfer
/// @notice Pulls a single ERC-20 from one funded payer and fans it out to many
///         recipients in one transaction.
/// @dev    Deployed for a relayer that currently sends one `transfer` tx per
///         payout. The payer keeps custody: this contract never holds a balance
///         and only moves tokens the payer has explicitly approved. Approve it
///         for a bounded amount and top the allowance up, rather than approving
///         unlimited.
contract BatchTransfer {
    /// @notice The only address allowed to spend the payer's allowance.
    address public immutable relayer;

    error NotRelayer();
    error LengthMismatch();
    error EmptyBatch();
    error TransferFailed(uint256 index);

    constructor(address relayer_) {
        relayer = relayer_;
    }

    /// @notice Send `amounts[i]` of `token` from the caller to `recipients[i]`.
    /// @dev    Tokens move directly payer -> recipient, so the contract is never
    ///         a custodian and a revert anywhere rolls the whole batch back.
    function batchTransfer(
        IERC20 token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        if (msg.sender != relayer) revert NotRelayer();
        uint256 n = recipients.length;
        if (n != amounts.length) revert LengthMismatch();
        if (n == 0) revert EmptyBatch();

        for (uint256 i; i < n;) {
            _pull(token, recipients[i], amounts[i], i);
            unchecked { ++i; }
        }
    }

    /// @notice Same as `batchTransfer` but every recipient gets `amount`.
    /// @dev    Saves 32 bytes of calldata per recipient when payouts are uniform.
    function batchTransferSameAmount(
        IERC20 token,
        address[] calldata recipients,
        uint256 amount
    ) external {
        if (msg.sender != relayer) revert NotRelayer();
        uint256 n = recipients.length;
        if (n == 0) revert EmptyBatch();

        for (uint256 i; i < n;) {
            _pull(token, recipients[i], amount, i);
            unchecked { ++i; }
        }
    }

    /// @dev Accepts both bool-returning and void-returning ERC-20s.
    function _pull(IERC20 token, address to, uint256 amount, uint256 index) private {
        (bool ok, bytes memory ret) = address(token).call(
            abi.encodeCall(IERC20.transferFrom, (msg.sender, to, amount))
        );
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) {
            revert TransferFailed(index);
        }
    }
}
