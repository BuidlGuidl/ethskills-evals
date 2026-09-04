// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Optional batching primitive for a relayer-funded ERC-20 treasury.
/// @dev The source must approve this contract. Every call is atomic: one bad
/// recipient or token failure reverts the whole batch. Simulate and cap batch
/// size off-chain before sending it.
contract BatchERC20Relayer {
    address public immutable relayer;

    error NotRelayer();
    error ZeroRelayer();
    error LengthMismatch();
    error TransferFailed(uint256 index);

    constructor(address relayer_) {
        if (relayer_ == address(0)) revert ZeroRelayer();
        relayer = relayer_;
    }

    function batchTransferFrom(
        address token,
        address source,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        if (msg.sender != relayer) revert NotRelayer();
        if (recipients.length != amounts.length) revert LengthMismatch();

        for (uint256 i; i < recipients.length; ++i) {
            (bool ok, bytes memory result) = token.call(
                abi.encodeWithSelector(0x23b872dd, source, recipients[i], amounts[i])
            );
            if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
                revert TransferFailed(i);
            }
        }
    }
}
