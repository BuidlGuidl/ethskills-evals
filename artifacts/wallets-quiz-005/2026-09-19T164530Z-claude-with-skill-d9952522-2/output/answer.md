# EIP-7702 delegation status of the treasury EOA

## Short answers

1. **Yes — almost certainly still delegated to BatchExecutor**, and it will stay that way indefinitely. The revert of the batch did not undo it, the passage of time does not expire it, and decommissioning BatchExecutor does not remove it. Confirm on-chain in one call (below).
2. **Sign and submit a new EIP-7702 authorization for the EOA that delegates to the zero address** (`0x0000000000000000000000000000000000000000`). That is the only thing that clears it. Treat it as urgent, because the buggy code is live *at your treasury address* right now.

---

## 1. Is the EOA still delegated?

### How a type-4 (set-code) transaction is processed

EIP-7702 splits a type-4 transaction into two distinct phases:

1. **Authorization processing.** Before any execution starts, each tuple in `authorization_list` is checked (chain_id is 0 or 1, the nonce matches the authority's current nonce, the signature is valid, the authority has no code or already has a delegation designator). For each valid tuple the client writes the delegation designator `0xef0100 || <BatchExecutor address>` into the authority's code and increments the authority's nonce.
2. **Execution.** Then the transaction's call runs as normal.

A revert in phase 2 rolls back **only phase 2's state changes**. The code writes and nonce bumps from phase 1 are not part of the reverted call frame. The spec says so explicitly: the delegation indicators stay in place even if the transaction reverts. "The batch reverted, so it was a no-op" is the wrong mental model. The inner approvals were rolled back. The delegation was not.

There is also no expiry. A delegation designator is ordinary account code. It stays until another valid authorization overwrites it. Days, months, or years make no difference. You sent no further authorizations, so nothing has replaced it.

### Was the authorization actually valid? Your own revert is the evidence

The one way the delegation might *not* have been set is if the authorization tuple was invalid and skipped. The classic mistake is a nonce off-by-one: when the treasury EOA is **both the transaction sender and the authority**, the sender's nonce is incremented before authorizations are processed, so the authorization must be signed with `current_nonce + 1`. (viem calls this `executor: 'self'`.) An invalid tuple is skipped silently. The transaction is still included.

But the evidence says it was valid. The transaction "called into the batch" (the call targeted the EOA itself) and **the batch logic ran far enough for an inner approval to fail and revert**. A call to an address with no code does nothing and succeeds. It cannot revert partway through batch logic. So BatchExecutor code was executing at the EOA's address during that transaction, and that can only happen if the delegation was set in phase 1. And phase 1 survives the revert.

### Verify it rather than trust the reasoning

```bash
cast code <TREASURY_EOA> --rpc-url <mainnet-rpc>
# or: eth_getCode(<TREASURY_EOA>, "latest")
```

- `0xef0100` followed by the 20-byte BatchExecutor address (23 bytes total) means **delegated** (expected).
- `0x` means not delegated (the tuple was skipped for some reason).

Also check the transaction receipt/trace on a block explorer. Explorers show the authorization list and whether each tuple was applied. The EOA's nonce will also have gone up by 2 from that transaction (once as sender, once as authority) instead of 1.

### Why this matters now

While delegated, **anyone** can call the treasury address and it will run BatchExecutor's code in the treasury's context: its balance, its token holdings, its storage. The EOA's key is not needed for that path. Whatever the "critical bug" is, it is reachable at the treasury address today, not just at the decommissioned contract. Pausing or abandoning the BatchExecutor deployment does nothing to the code the EOA points to, unless the contract self-destructed (which since Cancun no longer removes code anyway).

---

## 2. How to remove the delegation

### The fix

Send a type-4 transaction carrying a new authorization signed by the treasury key:

| field | value |
|---|---|
| `chain_id` | `1` (mainnet; do **not** use 0, which is valid on every chain) |
| `address` | `0x0000000000000000000000000000000000000000` |
| `nonce` | the EOA's current nonce, **or current nonce + 1 if the treasury EOA itself sends the transaction** |

Per EIP-7702, delegating to the zero address is a special case. The client clears the account's code and resets its code hash to the empty hash, and the address is a plain EOA again.

Notes:

- **The authority does not have to be the sender.** A different funded account (or a relayer) can submit the type-4 tx carrying the treasury's signed tuple. That avoids the nonce+1 subtlety: sign with the current nonce, and submit from another account. The transaction's `to` / calldata can be trivial, e.g. a zero-value call to the sender itself. The authorization is applied whatever the call does.
- **An ordinary (non-7702) transaction from the EOA does NOT clear the delegation.** Neither does waiting, nor pausing, upgrading, or abandoning BatchExecutor. Only a new valid authorization changes the code.
- **Alternatively**, if you still want batching, point the new authorization at a fixed, audited delegate instead of the zero address. That also replaces the old delegation.
- **Afterwards, verify**: `cast code <TREASURY_EOA>` must return `0x`.

Example with Foundry (sender = a separate hot account, authority = treasury key held on its signer):

```bash
# sign the authorization with the treasury key (hardware wallet / signer as appropriate)
cast wallet sign-auth 0x0000000000000000000000000000000000000000 \
  --chain 1 --nonce <treasury_current_nonce> <treasury-signer-flags>
# submit it from another account
cast send <any-address> --auth <signed_auth> --rpc-url <mainnet-rpc> <sender-signer-flags>
```

(Keep the usual gate: review the tuple, sender, and gas cost before broadcasting.)

### Residual items for the security reviewer

1. **Storage is not cleared.** Clearing the delegation removes the code, not the account's storage. Any storage slots BatchExecutor wrote (in this or other transactions) stay in the EOA. That is harmless for a plain EOA, but it matters if you ever delegate to a different contract later (slot collisions, stale "initialized" flags). Choose a future delegate that uses namespaced storage (ERC-7201).
2. **Check whether the bug was exploited in the meantime.** The treasury has been exposed for days. Look for any incoming transactions or internal calls to the EOA since last Tuesday, outgoing token/ETH transfers, and new ERC-20/NFT approvals or Permit2 allowances granted *from* the EOA. If anything suspicious shows up, or can't be ruled out, move funds to a fresh, never-delegated address instead of relying only on clearing the delegation.
3. **Cross-chain replay.** Check the `chain_id` in the original authorization. If it was `0` (valid on every chain), anyone can replay it on any EVM chain that supports 7702 where the treasury address's nonce equals the signed nonce. That would delegate the same address to BatchExecutor's address on that chain, where it may hold arbitrary or no code. Check the EOA's code and nonce on the other chains you use. Clearing must be done per chain.
4. **Ordering.** Submit the clearing authorization *before* any other activity from the EOA. The signed nonce must match the account's nonce when it is included, and a clearing authorization that is skipped because of a nonce mismatch fails silently, just like the case discussed above. Confirm with `eth_getCode` afterwards; don't assume.

## Summary

- **Q1:** Yes. EIP-7702 authorizations are applied before execution and persist through an execution revert. Your revert inside the batch logic is itself proof that the delegation was live. Delegations don't expire. Confirm with `eth_getCode` (expect `0xef0100‖BatchExecutor`).
- **Q2:** Sign and submit a new authorization (chain_id 1, current nonce, or +1 if self-sent) delegating to `address(0)`. Verify the code is `0x` afterwards. Decommissioning the contract does not help. Do it now, and audit the account for exploitation since Tuesday.
