# EIP-7702 delegation status and cleanup

## Short answer

Yes. Assuming the authorization tuple in last Tuesday's mainnet transaction was valid, the treasury EOA is still delegated to `BatchExecutor` right now.

The reverted batch call did not undo the delegation. Under EIP-7702, the authorization list is processed before the transaction's execution call. The EIP also explicitly says that if transaction execution later fails or reverts, the processed delegation indicators are not rolled back. Since nothing else has been sent from the treasury EOA since then, and no later authorization has overwritten or cleared the delegation, the account's code should still be the 23-byte delegation indicator:

```text
0xef0100 || <BatchExecutor address>
```

That means calls to the treasury EOA will resolve and execute `BatchExecutor`'s code in the treasury account's context until the delegation is changed or cleared.

Primary reference: [EIP-7702, "Set Code for EOAs"](https://eips.ethereum.org/EIPS/eip-7702), specifies that each valid authorization sets the authority account code to `0xef0100 || address`; if `address` is zero, the account code is cleared; and execution failure does not roll back processed delegation indicators.

## How to remove it

Send a new EIP-7702 set-code transaction containing a valid authorization from the treasury EOA whose delegation address is the zero address:

```text
chain_id = 1
address  = 0x0000000000000000000000000000000000000000
nonce    = the treasury authority nonce expected at authorization-processing time
```

The treasury signs the EIP-7702 authorization message for:

```text
keccak256(0x05 || rlp([chain_id, address, nonce]))
```

When that authorization is processed, EIP-7702 says the zero address does not write another delegation indicator; it resets the account code hash to the empty-code hash. After the clearing transaction is mined, `eth_getCode(treasury, "latest")` should return `0x`.

## Nonce detail

Be careful with the nonce used in the clearing authorization.

Let `N` be the treasury EOA's current transaction count after the reverted 7702 transaction and with no later transactions pending.

If a different funded account relays the cleanup transaction, use:

```text
authorization.nonce = N
```

The relayer pays for and sends the outer transaction; the treasury nonce is only checked and then incremented during authorization processing.

If the treasury EOA itself sends the cleanup transaction, use:

```text
outer_transaction.nonce = N
authorization.nonce    = N + 1
```

This is because EIP-7702 processes the authorization list after incrementing the outer transaction sender's nonce. Since the treasury is both the sender and the authority in that case, the authorization check sees the treasury nonce as `N + 1`, not `N`. After the clearing authorization is processed, the treasury nonce will increment again.

## Recommended verification

Before cleanup:

```text
eth_getCode(treasury, "latest") == 0xef0100 || <BatchExecutor address>
```

After the clearing transaction is mined:

```text
eth_getCode(treasury, "latest") == 0x
```

Do not treat the old revert status as evidence that the delegation was a no-op. The batch's state changes reverted, but the EIP-7702 delegation write happened earlier and persisted.
