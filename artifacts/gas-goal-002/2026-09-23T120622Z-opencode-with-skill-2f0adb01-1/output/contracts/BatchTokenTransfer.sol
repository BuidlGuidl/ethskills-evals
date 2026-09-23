// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/// @title BatchTokenTransfer
/// @notice Batches many ERC-20 payments into one transaction. The relayer EOA
///         approves this contract once per token (standard approve), then calls
///         batchTransfer. Each 21,000-gas transaction-intrinsic cost is amortized
///         across the whole batch instead of being paid per payment.
/// @dev A failing recipient (e.g. blacklisted on USDC, zero-amount edge cases in
///      weird tokens) is skipped via try/catch and reported in `Failed`, so one
///      bad payment cannot revert the rest of the batch.
contract BatchTokenTransfer {
    event Failed(address indexed token, address indexed to, uint256 amount);

    /// @param token      ERC-20 to move.
    /// @param recipients Destination addresses.
    /// @param amounts    Amounts, same order as `recipients`.
    /// @return succeeded How many payments went through.
    function batchTransfer(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external returns (uint256 succeeded) {
        uint256 len = recipients.length;
        require(len == amounts.length, "BatchTokenTransfer: length mismatch");
        require(len > 0, "BatchTokenTransfer: empty batch");

        for (uint256 i = 0; i < len; i++) {
            address to = recipients[i];
            uint256 amount = amounts[i];
            try IERC20Minimal(token).transferFrom(msg.sender, to, amount) returns (bool ok) {
                if (ok) {
                    succeeded++;
                } else {
                    emit Failed(token, to, amount);
                }
            } catch {
                emit Failed(token, to, amount);
            }
        }
    }
}
