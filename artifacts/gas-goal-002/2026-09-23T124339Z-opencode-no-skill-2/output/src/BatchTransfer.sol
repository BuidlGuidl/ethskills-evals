// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal ERC-20 interface (bool-returning, e.g. USDC / OZ style).
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BatchTransfer
/// @notice Executes many ERC-20 payments in a single transaction to amortize
///         the 21,000-gas intrinsic cost, calldata overhead, and cold-slot costs
///         that a per-payment transaction would pay every time.
///
/// Flow:
///   1. Relayer wallet approves this contract for type(uint256).max on each token (once).
///      OpenZeppelin and USDC skip the allowance SSTORE write when allowance is max,
///      so transferFrom costs the same as a plain transfer thereafter.
///   2. Relayer calls batchTransfer() with tightly packed payment data:
///      packed = concat( [ to: 20 bytes | amount: 16 bytes (uint128) ] * n )
///      36 bytes per payment vs 68 bytes for a standard transfer() call.
contract BatchTransfer {
    address public immutable owner;

    uint256 internal constant RECORD_SIZE = 36; // 20-byte address + 16-byte uint128 amount

    error NotOwner();
    error BadLength();
    error TransferFailed(uint256 index);

    event BatchExecuted(address indexed token, address indexed from, uint256 count, uint256 total);

    constructor() {
        owner = msg.sender;
    }

    /// @param token  ERC-20 contract address.
    /// @param from   Payer wallet (must have approved this contract for max uint256).
    /// @param packed Concatenated (to:20 | amount:16) records, one per payment.
    function batchTransfer(address token, address from, bytes calldata packed) external {
        if (msg.sender != owner) revert NotOwner();

        uint256 len = packed.length;
        if (len == 0 || len % RECORD_SIZE != 0) revert BadLength();
        uint256 n = len / RECORD_SIZE;

        uint256 total;
        for (uint256 i; i < n; ++i) {
            address to;
            uint128 amount;
            assembly {
                let p := add(packed.offset, mul(i, RECORD_SIZE))
                to := shr(96, calldataload(p)) // first 20 bytes of the record
                amount := shr(128, calldataload(add(p, 20))) // next 16 bytes
            }
            total += amount;

            // Low-level call so non-standard tokens that return nothing (e.g. USDT) work too.
            (bool ok, bytes memory ret) = token.call(
                abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount)
            );
            if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed(i);
        }

        emit BatchExecuted(token, from, n, total);
    }

    /// @notice Recover ETH or tokens sent to this contract by mistake. Owner only.
    function rescue(address token, address to, uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        (bool ok, bytes memory ret) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "rescue failed");
    }

    receive() external payable {}
}
