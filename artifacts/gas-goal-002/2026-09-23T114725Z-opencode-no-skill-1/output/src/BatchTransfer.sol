// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BatchTransfer
/// @notice Amortizes the 21,000-gas transaction intrinsic cost and per-tx L1 data
///         overhead across many ERC-20 payments in a single transaction.
///         Designed for a relayer that sends thousands of ERC-20 transfers/day.
///
/// Two funding modes:
///  - batchTransfer*:       tokens are pre-deposited in this contract (cheapest,
///                          plain `transfer`, no allowance SLOAD per payment).
///  - batchTransferFrom*:   pulls tokens from msg.sender via allowance.
///
/// Two encodings:
///  - ABI arrays (address[], uint256[])  -> 64 bytes/entry of calldata.
///  - packed bytes (address ++ uint96)   -> 29 bytes/entry of calldata.
///    uint96 max = ~7.9e28, safe for any payment amount on 6- or 18-decimal tokens.
contract BatchTransfer {
    address public owner;

    error NotOwner();
    error LengthMismatch();
    error BadPackedLength(uint256 length);
    error TransferFailed(address token, address to, uint256 amount);

    event Sweep(address indexed token, address indexed to, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Send `amounts[i]` of `token` to `recipients[i]`.
    ///         Tokens must already be held by this contract.
    function batchTransfer(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
        uint256 n = recipients.length;
        if (n != amounts.length) revert LengthMismatch();
        for (uint256 i; i < n; ++i) {
            _transfer(token, recipients[i], amounts[i]);
        }
    }

    /// @notice Gas-cheaper variant: calldata is `entries` encoded as
    ///         concat(recipient: bytes20, amount: uint96be) * n  (32 bytes/entry).
    ///         uint96 max = ~7.9e28 base units; safe for any realistic payment
    ///         on 6- or 18-decimal tokens.
    function batchTransferPacked(IERC20 token, bytes calldata entries) external {
        uint256 n = entries.length / 32;
        if (entries.length != n * 32) revert BadPackedLength(entries.length);
        for (uint256 i; i < n; ++i) {
            address to;
            uint96 amount;
            assembly {
                // Calldata layout: [4 selector][32 token][32 dataOffset][32 length][data...]
                // Absolute position of entries data = 4 + dataOffset + 32.
                let base := add(add(calldataload(36), 4), 32)
                let p := add(base, mul(i, 32))
                to := shr(96, calldataload(p))                 // first 20 bytes
                amount := shr(160, calldataload(add(p, 20)))   // next 12 bytes (uint96)
            }
            _transfer(token, to, amount);
        }
    }

    /// @notice Pull-based variant: transfers `amounts[i]` from msg.sender to recipients[i].
    ///         Requires msg.sender to have approved this contract (e.g. max approval, one time).
    function batchTransferFrom(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
        uint256 n = recipients.length;
        if (n != amounts.length) revert LengthMismatch();
        for (uint256 i; i < n; ++i) {
            if (!token.transferFrom(msg.sender, recipients[i], amounts[i])) {
                revert TransferFailed(address(token), recipients[i], amounts[i]);
            }
        }
    }

    /// @notice Recover tokens held by this contract back to the owner.
    function sweep(IERC20 token, uint256 amount, address to) external onlyOwner {
        if (!token.transfer(to, amount)) revert TransferFailed(address(token), to, amount);
        emit Sweep(address(token), to, amount);
    }

    function setOwner(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    function _transfer(IERC20 token, address to, uint256 amount) internal {
        if (!token.transfer(to, amount)) revert TransferFailed(address(token), to, amount);
    }
}
