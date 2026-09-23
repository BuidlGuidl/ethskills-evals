// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BatchTransfer
/// @notice Fans out many ERC-20 payments in a single transaction.
///         The relayer approves this contract once per token (type(uint256).max),
///         then each batch does one transferFrom per recipient.
///         Amortizes the 21,000-gas intrinsic cost and per-tx L1 data overhead
///         across all payments in the batch.
contract BatchTransfer {
    error LengthMismatch();
    error TransferFailed(address token, address to, uint256 amount);

    /// @notice Send `amounts[i]` of `token` from msg.sender to `tos[i]` for all i.
    /// @dev Reverts the whole batch if any leg fails. Keep batches small enough
    ///      that a bad recipient (e.g. blocked address on USDC) is cheap to isolate.
    function batchTransfer(address token, address[] calldata tos, uint256[] calldata amounts) external {
        uint256 n = tos.length;
        if (n != amounts.length) revert LengthMismatch();
        for (uint256 i; i < n;) {
            (bool ok, bytes memory ret) =
                token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, msg.sender, tos[i], amounts[i]));
            if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) {
                revert TransferFailed(token, tos[i], amounts[i]);
            }
            unchecked {
                ++i;
            }
        }
    }
}
