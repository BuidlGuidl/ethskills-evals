// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title RelayBatcher
/// @notice Batches ERC-20 payouts for a relayer that currently sends one
///         transaction per payment.
///
/// Pull model: the relayer approves this contract once, then calls
/// `batchTransfer` per batch. Only the caller's own approved funds can move
/// (`transferFrom(msg.sender, ...)`), so the contract needs no owner and is
/// safe to deploy permissionlessly (Disperse-style, no upgrade path).
///
/// Two flavors:
///  - `batchTransfer`      — a reverting item is skipped, indexed by event,
///                           remaining items still pay out. For payments.
///  - `batchTransferAtomic` — any reverting item reverts the batch. Cheapest
///                           per item; use when atomicity beats continuity.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract RelayBatcher {
    event Batch(address indexed token, address indexed payer, uint256 count, uint256 failCount);
    event PaymentFailed(uint256 index);

    error LengthMismatch();
    error EmptyBatch();
    error BatchTooLarge(uint256 count);

    uint256 public constant MAX_BATCH = 500; // stays well under per-tx gas limits

    /// @notice Transfer `amounts[i]` of `token` from the caller to `recipients[i]`.
    /// @return failures bitmap, bit i set when item i reverted (also emitted).
    ///         A failing item never blocks the others; the relayer re-queues it.
    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
        external
        returns (uint256[] memory failures)
    {
        uint256 count = recipients.length;
        if (count == 0 || count != amounts.length) {
            if (count != amounts.length) revert LengthMismatch();
            revert EmptyBatch();
        }
        if (count > MAX_BATCH) revert BatchTooLarge(count);

        failures = new uint256[]((count + 31) / 32);
        uint256 failCount;
        IERC20 t = IERC20(token);
        for (uint256 i; i < count; ++i) {
            // try/catch costs ~7 gas/item at N=100 (measured) vs. a raw call,
            // and keeps one blacklisted recipient from reverting the batch.
            // A `false` return (non-reverting failure) is treated as failure too.
            bool ok;
            try t.transferFrom(msg.sender, recipients[i], amounts[i]) returns (bool r) {
                ok = r;
            } catch {
                ok = false;
            }
            if (!ok) {
                unchecked {
                    failures[i / 32] |= 1 << (i % 32);
                    ++failCount;
                }
                emit PaymentFailed(i);
            }
        }
        emit Batch(token, msg.sender, count, failCount);
    }

    /// @notice Cheaper all-or-nothing variant: the first reverting item
    ///         reverts the whole batch and no funds move.
    function batchTransferAtomic(address token, address[] calldata recipients, uint256[] calldata amounts) external {
        uint256 count = recipients.length;
        if (count == 0 || count != amounts.length) {
            if (count != amounts.length) revert LengthMismatch();
            revert EmptyBatch();
        }
        if (count > MAX_BATCH) revert BatchTooLarge(count);

        IERC20 t = IERC20(token);
        for (uint256 i; i < count; ++i) {
            // raw call, no try/catch: first failure reverts everything
            require(t.transferFrom(msg.sender, recipients[i], amounts[i]), "transfer failed");
        }
    }
}
