// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title BatchPayments
/// @notice Amortizes the 21,000-gas intrinsic cost and the per-transaction L1
///         data fee across many ERC-20 payments in a single transaction.
///
/// Usage: fund this contract with token inventory (or have the relayer
/// approve it and use batchTransferFrom), then call batchTransfer with up to
/// `maxBatch` recipients. Owner-only: the relayer wallet is the owner.
contract BatchPayments {
    address public owner;
    uint256 public maxBatch = 200;

    error NotOwner();
    error LengthMismatch();
    error EmptyBatch();
    error BatchTooLarge();
    error TransferFailed(address token, address to, uint256 amount);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setMaxBatch(uint256 newMax) external onlyOwner {
        maxBatch = newMax;
    }

    /// @notice Send `amounts[i]` of `token` to `recipients[i]` from this
    ///         contract's balance, in one transaction.
    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyOwner
    {
        uint256 n = recipients.length;
        if (n == 0) revert EmptyBatch();
        if (n != amounts.length) revert LengthMismatch();
        if (n > maxBatch) revert BatchTooLarge();

        for (uint256 i = 0; i < n; ++i) {
            _safeTransfer(token, recipients[i], amounts[i]);
        }
    }

    /// @notice Variant that pulls from the relayer's balance via allowance
    ///         instead of holding inventory on this contract.
    function batchTransferFrom(address token, address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyOwner
    {
        uint256 n = recipients.length;
        if (n == 0) revert EmptyBatch();
        if (n != amounts.length) revert LengthMismatch();
        if (n > maxBatch) revert BatchTooLarge();

        for (uint256 i = 0; i < n; ++i) {
            _safeTransferFrom(token, msg.sender, recipients[i], amounts[i]);
        }
    }

    /// @notice Recover tokens (e.g. rotate inventory back to the relayer).
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        _safeTransfer(token, to, amount);
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed(token, to, amount);
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed(token, to, amount);
    }
}
