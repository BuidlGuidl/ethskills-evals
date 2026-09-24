# EIP-7702 delegation status and removal

## 1. Is the treasury EOA still delegated?

Yes. The treasury EOA should be treated as still delegated to `BatchExecutor`.

Reasoning:

- In EIP-7702, the authorization list is processed before the transaction's normal execution.
- A valid authorization writes a delegation indicator into the authorizing EOA's code: `0xef0100 || delegate_address`.
- That delegation is persistent. It is not scoped to the one transaction that carried the authorization.
- If the later execution phase of the transaction reverts, the delegation write is not rolled back.
- Here, the treasury EOA signed a valid authorization naming `BatchExecutor`, the transaction was mined, and no later authorization replaced or cleared it.

So the failed batch call did not make the transaction a full no-op for delegation purposes. The inner approval failure may have reverted the batch work, but it did not undo the EIP-7702 delegation.

Decommissioning `BatchExecutor` also does not remove the delegation from the EOA. The EOA remains delegated until the EOA signs a new valid authorization that replaces or clears the delegation.

## 2. How to get rid of the delegation

Submit a new EIP-7702 set-code transaction containing a fresh authorization from the treasury EOA that delegates to the zero address:

```text
address = 0x0000000000000000000000000000000000000000
```

For EIP-7702, authorizing the zero address is the explicit clear operation. When that authorization is processed, the account's code is reset to empty code instead of being set to another `0xef0100 || address` delegation indicator.

Use Ethereum mainnet chain id `1` for the authorization unless you intentionally want a cross-chain authorization using chain id `0`.

The important nonce detail:

- If a relayer or another account submits the type-4 transaction, the treasury EOA's authorization nonce must equal the treasury EOA's current nonce at the time the authorization is processed.
- If the treasury EOA itself submits the type-4 transaction, the transaction sender nonce is incremented before the authorization list is processed. In that case, the signed authorization for the treasury EOA must use the treasury EOA nonce after that sender-nonce increment.

After the clearing transaction is mined, verify that the treasury EOA's code is empty, not `0xef0100 || BatchExecutor`.

Do not rely on the buggy `BatchExecutor` being disabled, paused, abandoned, or decommissioned. The delegation lives on the EOA and must be explicitly cleared by this new signed 7702 authorization.

One final caveat: clearing the delegation clears the EOA's code/delegation indicator. It does not automatically erase any storage that may have been written while code was executing in the EOA's context.
