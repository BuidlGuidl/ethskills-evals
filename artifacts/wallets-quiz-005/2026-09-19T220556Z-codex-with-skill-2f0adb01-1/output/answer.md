# EIP-7702 delegation status and cleanup

As of now, yes: the treasury EOA should still be delegated to `BatchExecutor`.

Reasoning:

- EIP-7702 authorizations are processed before the execution portion of the transaction.
- A valid authorization writes a delegation indicator into the authority account's code: `0xef0100 || delegated_address`.
- The EIP explicitly says that if transaction execution later fails, including a revert, the processed delegation indicators are not rolled back.
- EIP-7702 delegations are persistent. They remain until replaced by another valid authorization or explicitly cleared.
- You said nothing else has been sent from the EOA since: no later 7702 transaction and no later authorization. So nothing has replaced or cleared the delegation.

The transaction was therefore not a no-op. The inner batch effects were reverted, but the EIP-7702 delegation update was not.

You can confirm this on-chain with `eth_getCode(treasury_eoa)`. If it is still delegated, the code should be 23 bytes:

```text
0xef0100<20-byte BatchExecutor address>
```

## How to remove it

Send a new EIP-7702 set-code transaction containing a valid authorization from the treasury EOA whose authorization `address` field is the zero address:

```text
0x0000000000000000000000000000000000000000
```

Under EIP-7702, an authorization to the zero address is the special clearing case. It does not write `0xef0100 || address`; instead, it clears the account's code back to the empty code hash.

Operationally:

1. Build a type `0x04` EIP-7702 transaction on Ethereum mainnet with a non-empty `authorization_list`.
2. Include one authorization tuple signed by the treasury EOA:

```text
[chain_id, address, nonce, y_parity, r, s]
```

where:

- `chain_id` is `1` for Ethereum mainnet, unless you intentionally use `0` for chain-agnostic authorization.
- `address` is `0x0000000000000000000000000000000000000000`.
- `nonce` is the treasury EOA nonce at the moment the authorization tuple is processed.

3. Submit the transaction with enough gas for EIP-7702 authorization processing. The transaction must have a non-null destination, because EIP-7702 set-code transactions cannot be contract-creation transactions.
4. After it is mined, verify `eth_getCode(treasury_eoa)` returns `0x`.

Nonce detail:

- If a separate relayer/sponsor submits the clearing transaction, use the treasury EOA's current nonce in the authorization.
- If the treasury EOA itself submits the clearing transaction, the protocol increments the sender nonce before processing the authorization list. In that self-sponsored case, the clearing authorization must be signed over the treasury nonce after that outer transaction nonce increment. In practice, if the treasury's current nonce is `N` and it sends the cleanup transaction with outer transaction nonce `N`, the authorization tuple for the treasury should use nonce `N + 1`; after the tuple is processed, the treasury nonce becomes `N + 2`.

Reference: EIP-7702, "Set Code for EOAs", especially the behavior rules saying the authorization list is processed before execution, zero-address authorization clears code, and execution failure does not roll back processed delegation indicators: https://eips.ethereum.org/EIPS/eip-7702
