# EIP-7702 delegation status and revocation

Source checked: the canonical EIP-7702 specification at
https://eips.ethereum.org/EIPS/eip-7702.

## 1. Is the treasury EOA still delegated to BatchExecutor?

Yes, assuming the authorization tuple in last Tuesday's transaction was valid
and no later authorization has been processed for the treasury EOA.

In an EIP-7702 set-code transaction, the authorization list is processed before
the transaction's normal execution begins. For each valid authorization, the
client sets the authority account's code to the delegation indicator:

```text
0xef0100 || delegated_address
```

So the treasury EOA's code was set to:

```text
0xef0100 || BatchExecutor
```

The later batch call reverting does not undo that write. EIP-7702 explicitly
specifies that if transaction execution fails, including by revert, the
processed delegation indicators are not rolled back. The reverted inner
approval means the batch effects were reverted, but the EOA delegation created
by the authorization list remains.

Because you have sent no later EIP-7702 transaction and no later authorization
from that EOA, nothing has replaced or cleared the delegation. As of now, the
treasury EOA should still be delegated to BatchExecutor.

## 2. How do we get rid of the delegation?

Send another EIP-7702 set-code transaction containing a valid authorization
from the treasury EOA whose delegated `address` is the zero address:

```text
0x0000000000000000000000000000000000000000
```

That is the EIP-7702 revocation mechanism. When a valid authorization names the
zero address, the client does not write a new delegation indicator; it clears
the account code back to the empty code hash. After that transaction is mined,
the treasury EOA is no longer delegated to BatchExecutor.

The authorization must be signed by the treasury EOA and must use the correct
current nonce for the authority account:

- If the treasury EOA sends the revocation transaction itself, the outer
  transaction consumes the treasury nonce before the authorization list is
  checked. In that case, sign the authorization with `nonce = current treasury
  nonce + 1`, and send the outer transaction with `nonce = current treasury
  nonce`.
- If another account sponsors/sends the revocation transaction, the outer
  transaction does not increment the treasury EOA's nonce. In that case, sign
  the authorization with `nonce = current treasury nonce`.

Use `chain_id = 1` for Ethereum mainnet, or `chain_id = 0` only if you
intentionally want a chain-agnostic authorization. The transaction must include
at least that revocation authorization in its authorization list and enough gas
to be included. Its destination cannot be null; use a harmless destination and
calldata, commonly the treasury EOA itself or another known safe no-op target.

After mining, verify by reading the treasury EOA's code with `eth_getCode`.
Before revocation it should begin with `0xef0100` followed by the BatchExecutor
address. After revocation it should be empty code, i.e. `0x`.
