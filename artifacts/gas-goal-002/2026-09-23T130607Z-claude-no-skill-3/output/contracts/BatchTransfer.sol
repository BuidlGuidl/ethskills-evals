// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title BatchTransfer
/// @notice Batches many ERC-20 payouts into a single transaction.
///
/// Payouts are passed as tightly packed calldata: one 32-byte word per payout,
/// `address recipient (20 bytes) || uint96 amount (12 bytes)`. That is the same
/// 32 bytes a plain ABI-encoded `address` argument would occupy on its own, so
/// the amount rides along for free. uint96 holds ~7.9e28, which is 7.9e22 USDC
/// at 6 decimals -- far beyond any payout we will ever make.
///
/// Two custody models are supported:
///   * `payoutFrom` pulls from the relayer wallet via `transferFrom`. The relayer
///     keeps custody; this contract only needs an allowance.
///   * `payout` spends a float held by this contract via `transfer`. Cheaper,
///     because it avoids touching an allowance slot per payout, but the float
///     lives here.
contract BatchTransfer {
    /// @dev Caller is not an authorised relayer.
    error NotRelayer();
    /// @dev A token call returned false or reverted. `index` is the payout that failed.
    error TransferFailed(uint256 index);
    /// @dev Payout blob length is not a multiple of 32 bytes.
    error MalformedPayouts();
    /// @dev Caller is not the owner.
    error NotOwner();
    /// @dev `token` has no code. A bare call to an address with no code succeeds
    /// with empty returndata, which would otherwise look like a void-returning
    /// ERC-20 succeeding -- every payout would silently do nothing.
    error NotAContract();

    event RelayerSet(address indexed relayer, bool allowed);
    event OwnerSet(address indexed owner);
    event OwnerTransferStarted(address indexed pendingOwner);

    address public owner;
    /// @dev Ownership moves in two steps: a typo in `transferOwnership` would
    /// otherwise hand away the right to sweep the float and set relayers.
    address public pendingOwner;
    mapping(address => bool) public isRelayer;

    constructor(address owner_, address relayer_) {
        owner = owner_;
        isRelayer[relayer_] = true;
        emit OwnerSet(owner_);
        emit RelayerSet(relayer_, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setRelayer(address relayer, bool allowed) external onlyOwner {
        isRelayer[relayer] = allowed;
        emit RelayerSet(relayer, allowed);
    }

    /// @notice Step 1 of 2: nominate a new owner. Pass address(0) to cancel.
    function transferOwnership(address owner_) external onlyOwner {
        pendingOwner = owner_;
        emit OwnerTransferStarted(owner_);
    }

    /// @notice Step 2 of 2: the nominee claims ownership.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnerSet(msg.sender);
    }

    /// @notice Sweep tokens out of the contract float (recovery / wind-down).
    function sweep(address token, address to, uint256 amount) external onlyOwner {
        if (token.code.length == 0) revert NotAContract();
        _call(token, abi.encodeWithSelector(0xa9059cbb, to, amount), 0);
    }

    /// @notice Pay out from a float held by this contract.
    /// @param token   ERC-20 to pay out.
    /// @param payouts Packed `address || uint96` words, 32 bytes each.
    function payout(address token, bytes calldata payouts) external {
        if (!isRelayer[msg.sender]) revert NotRelayer();
        _run(token, payouts, address(0));
    }

    /// @notice Pay out by pulling from `from` (normally the relayer wallet).
    /// @dev `from` must have approved this contract for the total.
    function payoutFrom(address token, address from, bytes calldata payouts) external {
        if (!isRelayer[msg.sender]) revert NotRelayer();
        _run(token, payouts, from);
    }

    function _run(address token, bytes calldata payouts, address from) private {
        if (payouts.length % 32 != 0) revert MalformedPayouts();
        uint256 n = payouts.length / 32;
        // Checked once per batch, not per payout, so the cost is negligible.
        if (n != 0 && token.code.length == 0) revert NotAContract();

        for (uint256 i = 0; i < n; ++i) {
            uint256 word;
            assembly ("memory-safe") {
                word := calldataload(add(payouts.offset, mul(i, 32)))
            }
            // forge-lint: disable-next-line(unsafe-typecast)
            address to = address(uint160(word >> 96)); // high 20 bytes are the recipient
            // forge-lint: disable-next-line(unsafe-typecast)
            uint256 amount = uint96(word); // low 12 bytes are the amount by construction

            bytes memory data = from == address(0)
                ? abi.encodeWithSelector(0xa9059cbb, to, amount) // transfer(address,uint256)
                : abi.encodeWithSelector(0x23b872dd, from, to, amount); // transferFrom
            _call(token, data, i);
        }
    }

    /// @dev ERC-20 call tolerating both bool-returning and void tokens.
    function _call(address token, bytes memory data, uint256 index) private {
        bool ok;
        bool truthy;
        assembly ("memory-safe") {
            ok := call(gas(), token, 0, add(data, 0x20), mload(data), 0, 32)
            switch returndatasize()
            case 0 { truthy := 1 }
            default { truthy := and(eq(returndatasize(), 32), eq(mload(0), 1)) }
        }
        if (!ok || !truthy) revert TransferFailed(index);
    }
}
