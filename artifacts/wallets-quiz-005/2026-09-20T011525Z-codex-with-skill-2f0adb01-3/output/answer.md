# EIP-7702 delegation status and revocation

## 1. Is the treasury EOA still delegated to BatchExecutor?

Yes, assuming the authorization tuple in last Tuesday's mined transaction was valid and named the BatchExecutor address.

The batch revert did not make the whole operation a no-op. In an EIP-7702 set-code transaction, the authorization list is processed before the normal execution/call portion of the transaction. Processing a valid authorization writes the delegation indicator into the authorizing account's code:

```text
0xef0100 || <authorized implementation address>
```

EIP-7702 also explicitly makes that delegation update non-atomic with the later call execution: if the transaction execution later fails or reverts, the already-processed delegation indicator is not rolled back.

So the sequence was:

1. The set-code transaction was mined.
2. The treasury EOA's valid authorization to BatchExecutor was processed.
3. The treasury account code was set to `0xef0100 || BatchExecutor`.
4. The later batch call reverted because an inner approval failed.
5. That revert did not undo step 3.

Since nothing else has been sent from the treasury EOA since then, and no later EIP-7702 authorization replaced or cleared the delegation, the account should still be delegated to BatchExecutor today.

Operationally, confirm this with `eth_getCode(treasuryEOA, "latest")`. A still-delegated account will return 23 bytes:

```text
0xef0100<20-byte BatchExecutor address>
```

After successful cleanup, `eth_getCode(treasuryEOA, "latest")` should return empty code, normally `0x`.

## 2. How do we get rid of the delegation?

Send a new EIP-7702 set-code transaction containing a fresh valid authorization from the treasury EOA whose authorized address is the zero address:

```text
address = 0x0000000000000000000000000000000000000000
```

That is the EIP-7702 clearing path. When a valid authorization tuple uses the zero address, the client does not write a new delegation indicator; it clears the account's code hash back to empty code.

Recommended self-sent cleanup transaction:

1. Let `N` be the treasury EOA's current transaction count/nonce at `latest`.
2. Have the treasury EOA sign an EIP-7702 authorization tuple for Ethereum mainnet:
   - `chain_id = 1`
   - `address = 0x0000000000000000000000000000000000000000`
   - `nonce = N + 1`
3. Send a type `0x04` EIP-7702 transaction from the treasury EOA with:
   - outer transaction nonce `N`
   - the zero-address authorization tuple above in `authorization_list`
   - `to = treasuryEOA` or another deliberately harmless non-null destination
   - `value = 0`
   - `data = 0x`
   - enough gas for the EIP-7702 intrinsic/auth cost
4. Wait for the transaction to be mined.
5. Verify `eth_getCode(treasuryEOA, "latest") == 0x`.

The `N + 1` authorization nonce in the self-sent case is important. EIP-7702 increments the outer transaction sender's nonce before processing the authorization list. If the treasury EOA is both the transaction sender and the authorizing account, the authorization is checked against the already-incremented nonce. The cleanup transaction will advance the treasury nonce twice in total: once for the outer transaction and once for the processed authorization.

Alternative sponsored cleanup:

1. Let `N` be the treasury EOA's current nonce at `latest`.
2. Have the treasury EOA sign the same zero-address authorization, but with `nonce = N`.
3. Have a separate sponsor/relayer account send the type `0x04` transaction carrying that authorization.
4. After inclusion, verify the treasury account code is empty.

In the sponsored case, the treasury is not the outer transaction sender, so its nonce is not pre-incremented before authorization processing. The authorization itself increments the treasury nonce once.

Do not rely on calling BatchExecutor, revoking token approvals, or sending a normal legacy/EIP-1559 transaction from the treasury to clear this. The delegation is account code state. It is removed only by replacing it with another valid EIP-7702 authorization or by using the zero-address EIP-7702 authorization to clear it.

Reference: EIP-7702, "Set Code for EOAs" - https://eips.ethereum.org/EIPS/eip-7702
