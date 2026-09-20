# EIP-7702 treasury delegation status

Current date: Saturday, September 19, 2026. "Last Tuesday" was September 15, 2026.

## 1. Is the EOA still delegated to BatchExecutor?

Yes, assuming the EIP-7702 authorization was valid and was applied in the mined transaction described.

The failed batch execution does not make the delegation a no-op. In an EIP-7702 transaction, the authorization list is processed as account state: the EOA's code is set to a delegation designator pointing at the authorized contract. That delegation is persistent. It is not scoped to only the call made by that transaction.

So even if the transaction's execution path called the BatchExecutor and the batch reverted because an inner approval failed, the EOA can still remain delegated. The execution revert does not automatically clear the authorization. Because you say nothing else has been sent from that EOA since then -- no further 7702 transactions and no replacement or clearing authorization -- there has been no later action that would remove or replace the BatchExecutor delegation.

A direct on-chain check should show the EOA's code as an EIP-7702 delegation designator, `0xef0100 || <BatchExecutor address>`, rather than empty code. The absence of later transactions is what makes the answer "still delegated" rather than "maybe already replaced."

Decommissioning or avoiding the BatchExecutor contract also does not clear the EOA's delegation. The delegation lives on the EOA's account state until the EOA signs and submits a new authorization that changes it.

## 2. How do we get rid of the delegation?

Send a new EIP-7702 transaction that includes a fresh authorization from the treasury EOA which clears the delegation. Concretely, the treasury EOA must sign an authorization tuple for Ethereum mainnet using the EOA's current nonce and the zero address as the authorized address:

```text
authorized address = 0x0000000000000000000000000000000000000000
```

Then submit a transaction carrying that authorization. Once mined, the EOA's delegated code should be cleared, and `eth_getCode(<treasury EOA>)` should return empty code, `0x`.

Operationally:

1. Build a new EIP-7702 authorization for chain ID 1.
2. Use the treasury EOA's current nonce for the authorization.
3. Set the authorization target/address to the zero address to clear the delegation.
4. Have the treasury EOA sign it.
5. Submit a transaction carrying that authorization and wait for it to be mined.
6. Verify the EOA's code is `0x`.

Do not rely on the old BatchExecutor reverting, being deprecated, paused, self-destructed, or ignored. None of those removes the EOA's delegation. The fix is an explicit clearing authorization from the EOA.
