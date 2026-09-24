# EIP-7702 treasury delegation status

## 1. Is the EOA still delegated to BatchExecutor?

Yes. Assuming the authorization tuple in last Tuesday's mined Ethereum mainnet
transaction was valid, the treasury EOA is still delegated to `BatchExecutor`.

The important EIP-7702 ordering is:

1. The transaction's authorization list is processed before the normal execution
   payload.
2. A valid authorization writes the delegation indicator
   `0xef0100 || BatchExecutor` into the authority account's code.
3. If the later execution call reverts, the processed delegation is not rolled
   back.

So the failed batch was not a full no-op. The inner approval failure reverted the
batch call's execution effects, but it did not undo the earlier EIP-7702
delegation write. Because the treasury EOA has sent no later EIP-7702 transaction
and no later authorization, nothing has replaced or cleared that delegation.

Decommissioning `BatchExecutor` also does not clear the EOA. The account remains
an EIP-7702 delegated account pointing at that address until the treasury signs a
new valid authorization that overwrites or clears the delegation.

## 2. How do we get rid of the delegation?

Submit a new EIP-7702 type-4 transaction on Ethereum mainnet carrying a fresh
authorization from the treasury EOA whose delegate `address` is the null address:

```text
chain_id = 1
address  = 0x0000000000000000000000000000000000000000
nonce    = the treasury EOA nonce required at authorization-processing time
```

When that authorization is processed, EIP-7702 treats the null delegate address
as the special clear operation: it resets the authority account's code hash to
the empty-code hash instead of writing a new `0xef0100 || address` delegation
indicator. After it is mined, verify that `eth_getCode(treasuryEOA)` returns
`0x`.

Operationally, the least surprising way to do this is to have a separate gas
sponsor submit the type-4 transaction. In that case the treasury only signs the
authorization, and the authorization nonce should equal the treasury EOA's
current on-chain nonce at the time the transaction is processed.

If the treasury EOA itself is also the transaction sender, account for EIP-7702's
ordering: the sender nonce is incremented before the authorization list is
processed. If the treasury's current on-chain nonce is `N`, the transaction uses
sender nonce `N`, but the clearing authorization for that same treasury authority
must use nonce `N + 1`. Processing that authorization will then increment the
treasury nonce again.

Use an otherwise harmless execution payload, for example a zero-value call with
empty calldata to a benign EOA. The critical part is the signed authorization to
the null address. The old `BatchExecutor` does not need to cooperate, and simply
removing or disabling `BatchExecutor` is not a substitute for clearing the
delegation.

Reference: EIP-7702 specifies both that failed transaction execution does not
roll back processed delegation indicators and that `address =
0x0000000000000000000000000000000000000000` clears the account's code.
https://eips.ethereum.org/EIPS/eip-7702
