// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Minimal ERC-20 surface. Return data is handled manually below because
/// several widely-used tokens (USDT and friends) return nothing at all.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title BatchTransfer
 * @notice Dispatches many ERC-20 payouts from a single relayer transaction.
 *
 * @dev SECURITY MODEL
 *
 * Every token movement is `transferFrom(msg.sender, recipient, amount)`. The `from`
 * address is *never* a user-supplied parameter. That is the whole security argument:
 * this contract can only ever move the balance of whoever is calling it, so the
 * allowance the relayer grants here cannot be spent by anybody else. A third party
 * calling these functions can only spend their own tokens.
 *
 * Consequences worth being explicit about:
 *  - The contract is permissionless by design. It needs no owner, no pause, and no
 *    access control, which is also why it holds no privileged state to steal.
 *  - It never holds custody. Tokens go relayer -> recipient directly, so a bug here
 *    cannot strand a balance inside the contract.
 *  - Fee-on-transfer and rebasing tokens are out of scope: recipients receive
 *    whatever the token chooses to deliver. Do not use this for such tokens.
 */
contract BatchTransfer {
    /// @dev recipients.length != amounts.length in the unpacked entrypoint.
    error LengthMismatch();
    /// @dev Packed payload was not a whole number of 32-byte (address,uint96) words.
    error MalformedPayload();
    /// @dev Nothing to do. Reverting beats silently burning the relayer's base fee.
    error EmptyBatch();
    /// @dev The token rejected the transfer. `index` is the entry that failed.
    error TransferFailed(uint256 index);

    /**
     * @notice Pay out `amounts[i]` of `token` to `recipients[i]`, pulled from the caller.
     * @dev The readable entrypoint. Prefer {batchTransferPacked} in production; it is
     *      the same logic over a denser calldata encoding.
     */
    function batchTransfer(IERC20 token, address[] calldata recipients, uint256[] calldata amounts)
        external
    {
        uint256 n = recipients.length;
        if (n != amounts.length) revert LengthMismatch();
        if (n == 0) revert EmptyBatch();

        address payer = msg.sender;
        for (uint256 i; i < n;) {
            _transferFrom(token, payer, recipients[i], amounts[i], i);
            unchecked { ++i; }
        }
    }

    /**
     * @notice Same as {batchTransfer}, over a packed payload.
     * @param payload Concatenated 32-byte words, each one a 20-byte recipient address
     *        followed by a 12-byte (uint96) amount, both big-endian.
     *
     * @dev Halves the per-recipient calldata versus two dynamic arrays (32 bytes rather
     *      than 64) and removes the ABI bounds checks from the hot loop.
     *
     *      uint96 caps a single payout at ~7.9e28 base units. For a 6-decimal token like
     *      USDC that is ~7.9e22 whole tokens, so the ceiling is unreachable in practice.
     *      Callers MUST still validate it off-chain: an amount that overflows uint96
     *      would silently truncate into the adjacent address, so the encoder in
     *      `relayer/encode.mjs` rejects anything that does not round-trip.
     */
    function batchTransferPacked(IERC20 token, bytes calldata payload) external {
        uint256 len = payload.length;
        if (len == 0) revert EmptyBatch();
        if (len % 32 != 0) revert MalformedPayload();

        address payer = msg.sender;
        uint256 n = len / 32;

        for (uint256 i; i < n;) {
            uint256 word;
            assembly {
                word := calldataload(add(payload.offset, mul(i, 32)))
            }
            // Top 20 bytes are the address, bottom 12 are the amount.
            address to = address(uint160(word >> 96));
            uint256 amount = word & 0xffffffffffffffffffffffff;

            _transferFrom(token, payer, to, amount, i);
            unchecked { ++i; }
        }
    }

    /**
     * @dev `transferFrom` with tolerant return-data decoding: treat empty return data as
     *      success (non-compliant tokens), otherwise require a truthy word. Bubbling a
     *      revert as {TransferFailed} keeps the failing index visible, which matters when
     *      one bad recipient in a batch of 250 takes the whole transaction down.
     */
    function _transferFrom(IERC20 token, address from, address to, uint256 amount, uint256 index)
        private
    {
        (bool ok, bytes memory ret) = address(token).call(
            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
        );
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) {
            revert TransferFailed(index);
        }
    }
}
