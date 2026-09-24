# EIP-7702 Delegation Status and Cleanup

## Short answer

1. Yes, assuming the authorization tuple was valid and was processed, the treasury EOA is still delegated to `BatchExecutor`.
2. To remove the delegation, submit a new EIP-7702 set-code transaction carrying a valid authorization from the treasury EOA whose delegated `address` is the zero address:

   `0x0000000000000000000000000000000000000000`

That zero-address authorization clears the EOA's code hash back to the empty-code hash, restoring it to an undelegated EOA.

## Reasoning

EIP-7702 authorizations are not scoped to the success of the later contract call. The protocol processes the transaction's `authorization_list` before the execution portion of the transaction begins. For each valid tuple, it writes the authority account's code to the delegation indicator:

`0xef0100 || delegated_address`

The EIP then explicitly says that if the transaction execution later fails, including by revert, the processed delegation indicators are not rolled back.

So the failed batch call did not make the earlier authorization a no-op. The batch's internal state changes were reverted, but the protocol-level delegation write had already happened and survived the revert. Since nothing else has been sent from the treasury EOA since then, and no later authorization overwrote or cleared the delegation, the EOA remains delegated to `BatchExecutor`.

A direct on-chain check should show this as well: `eth_getCode(treasuryEOA, "latest")` should return 23 bytes equal to:

`0xef0100` + `BatchExecutor_address`

If it returns `0x`, the account is already clear. If it returns `0xef0100...` pointing at `BatchExecutor`, it is still delegated there.

## Exact cleanup transaction

Create and broadcast an EIP-7702 type-4 transaction with a non-empty authorization list containing a tuple signed by the treasury EOA:

`[chain_id, zero_address, authorization_nonce, y_parity, r, s]`

Use:

- `chain_id = 1` for Ethereum mainnet, unless you intentionally want a cross-chain authorization with `chain_id = 0`.
- `address = 0x0000000000000000000000000000000000000000`.
- `authorization_nonce =` the treasury EOA nonce at the moment the authorization tuple is processed.

The nonce detail depends on who sends the cleanup transaction:

- If a relayer or other account sends the transaction, sign the authorization with the treasury EOA's current nonce.
- If the treasury EOA sends the transaction itself, the outer transaction nonce is consumed before the authorization list is processed. In that case, if the treasury EOA's current nonce is `N`, send the outer transaction with nonce `N` and sign the clearing authorization with nonce `N + 1`.

The transaction must have a non-null destination. For a self-sent cleanup, a simple call with empty calldata to the treasury EOA itself is a reasonable no-op pattern: the authorization list clears the code first, then the call to the now-empty EOA does nothing.

After the cleanup is mined, verify with `eth_getCode(treasuryEOA, "latest")`. The expected result is `0x`.

Sources: EIP-7702 specification, especially the authorization-list processing order, zero-address clearing rule, and non-rollback-on-revert rule: https://eips.ethereum.org/EIPS/eip-7702
