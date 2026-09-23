// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BatchPay
/// @notice Batches many ERC-20 payouts into a single Base transaction.
///
/// The relayer currently sends one `transfer()` per payment. Each of those pays
/// the 21,000 gas intrinsic cost, a fresh signature, and its own share of the
/// per-transaction L1 data overhead. Batching amortises all three across the
/// whole batch; only the token's own storage writes remain per-recipient.
///
/// Payments are encoded as packed 32-byte words rather than ABI arrays:
///
///     [ recipient (20 bytes) | amount (12 bytes, uint96) ]
///
/// An ABI-encoded `(address[],uint256[])` pair costs 64 calldata bytes per
/// payment and carries two length words plus two offset words. The packed form
/// costs 32, and because the high bytes of an ABI-encoded address are zeros
/// that the token's own calldata is not, packing also removes the mostly-zero
/// padding that inflates the L1 data fee. uint96 holds 7.9e28 units, which is
/// 79 trillion USDC at 6 decimals — far beyond any payment this app sends.
contract BatchPay {
    /// @notice Token payouts are denominated in. Immutable: one BatchPay per token.
    address public immutable token;

    /// @notice Account the funds are pulled from (the treasury / relayer wallet).
    address public immutable funder;

    /// @notice Addresses permitted to submit batches.
    mapping(address => bool) public isRelayer;

    address public owner;

    error NotOwner();
    error NotRelayer();
    error BadCalldata();
    error TransferFailed(uint256 index);

    event RelayerSet(address indexed relayer, bool allowed);
    event OwnerSet(address indexed newOwner);
    event BatchPaid(address indexed relayer, uint256 count, uint256 total);

    constructor(address _token, address _funder, address _owner) {
        token = _token;
        funder = _funder;
        owner = _owner;
        emit OwnerSet(_owner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setRelayer(address relayer, bool allowed) external onlyOwner {
        isRelayer[relayer] = allowed;
        emit RelayerSet(relayer, allowed);
    }

    function setOwner(address newOwner) external onlyOwner {
        owner = newOwner;
        emit OwnerSet(newOwner);
    }

    /// @notice Pay a batch of packed (recipient, amount) entries.
    /// @param payments Concatenated 32-byte words, each `address << 96 | uint96 amount`.
    ///
    /// @dev The batch is atomic: if any single transfer fails the whole call
    /// reverts. That keeps the on-chain record consistent with the ledger, but
    /// it does mean one bad recipient (a USDC-blacklisted address, say) blocks
    /// the batch. The relayer is expected to catch the revert, bisect on the
    /// reported index, and re-send without the offending entry.
    function pay(bytes calldata payments) external returns (uint256 total) {
        if (!isRelayer[msg.sender]) revert NotRelayer();
        uint256 len = payments.length;
        if (len == 0 || len % 32 != 0) revert BadCalldata();

        uint256 count = len / 32;
        address _token = token;
        address _funder = funder;

        for (uint256 i = 0; i < count; ++i) {
            uint256 word;
            assembly {
                word := calldataload(add(payments.offset, mul(i, 32)))
            }
            address to = address(uint160(word >> 96));
            uint256 amount = word & type(uint96).max;

            _transferFrom(_token, _funder, to, amount, i);
            total += amount;
        }

        emit BatchPaid(msg.sender, count, total);
    }

    /// @dev `transferFrom` that tolerates both bool-returning and void ERC-20s.
    /// Hand-rolled to avoid the memory expansion and extra copying that a
    /// SafeERC20-style wrapper does on every one of these calls.
    function _transferFrom(address _token, address from, address to, uint256 amount, uint256 index)
        private
    {
        bool ok;
        assembly {
            let p := mload(0x40)
            // transferFrom(address,address,uint256)
            mstore(p, 0x23b872dd00000000000000000000000000000000000000000000000000000000)
            mstore(add(p, 0x04), from)
            mstore(add(p, 0x24), to)
            mstore(add(p, 0x44), amount)

            ok := call(gas(), _token, 0, p, 0x64, 0x00, 0x20)
            if ok {
                // Accept: no return data, or a single word equal to 1.
                switch returndatasize()
                case 0 { ok := 1 }
                default { ok := and(gt(returndatasize(), 31), eq(mload(0x00), 1)) }
            }
        }
        if (!ok) revert TransferFailed(index);
    }
}
