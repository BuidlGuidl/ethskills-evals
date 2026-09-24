# EIP-7702 delegation status of the treasury EOA

## TL;DR

1. **Yes, almost certainly the EOA is still delegated to BatchExecutor right now.** The revert of the batch call did not undo the delegation. EIP-7702 delegations don't expire, and one stays in place until the account signs a new authorization that replaces it. Nothing has been signed since, so nothing has changed. Confirm it with a single `eth_getCode` call (below).
2. **To remove it, the EOA must sign a new EIP-7702 authorization that names the zero address** (`0x0000000000000000000000000000000000000000`). That authorization has to go on-chain inside a type-`0x04` (set-code) transaction. The steps are below. Decommissioning, pausing or self-destructing BatchExecutor does **not** remove the delegation. Neither does sending an ordinary transaction from the EOA.

Treat this as urgent. Until the delegation is cleared, anyone can call the treasury address and run BatchExecutor's code, including the critical bug, *as the treasury*, with its balances and token approvals.

---

## 1. Is the EOA still delegated?

### Why "the batch reverted, so nothing happened" is wrong

EIP-7702 splits a set-code (type `0x04`) transaction into two separate phases:

1. **Authorization processing.** Before any execution starts, the client goes through the `authorization_list`. For each valid tuple `(chain_id, address, nonce, y_parity, r, s)` it:
   - recovers the signer (the "authority"),
   - checks the chain id, the nonce and that the code is empty or already a delegation,
   - **writes the delegation indicator `0xef0100 || address` into the authority's code**, and
   - increments the authority's nonce.
2. **Execution.** Only after that does the transaction's own call run (here, the call into the batch).

The code writes from phase 1 are **not rolled back if phase 2 reverts.** The spec says so directly: the delegation stays in place even when the transaction's execution fails. A mined transaction that reverts still counts as a valid, included transaction. Its gas is paid, its nonces are consumed and its authorizations have taken effect. The only thing rolled back is the state changed by the call itself, which here means the inner approvals.

Delegations also have **no expiry**. The indicator stays in the account's code until another valid authorization from the same account overwrites it. You have signed no authorization since, so the state from last Tuesday is still the current state.

So if last Tuesday's authorization was valid, the EOA is delegated to BatchExecutor **today**.

### The one caveat: was the authorization actually valid?

An invalid authorization tuple is **skipped silently**. The transaction is still mined and still executes. Because your batch reverted anyway, a successful receipt can't tell you whether the delegation happened. The usual reasons an authorization is skipped:

- **Nonce off by one in a self-sponsored transaction.** The EOA was both the transaction sender and the authority. The sender's nonce is incremented *before* the authorization list is processed, so the authorization had to be signed with `nonce = tx.nonce + 1`. If it was signed with the same nonce as the transaction, it was skipped and no delegation exists.
- The wrong `chain_id` (not `1` and not `0`).
- A malformed signature, or `s` in the high half of the curve order.

Your description ("then called into the batch", with an inner approval failing) suggests the call actually ran BatchExecutor code in the EOA's context. If it did, the delegation was live during that transaction, and therefore it is still live now. That points strongly to "still delegated", but you should verify rather than assume.

### How to check definitively (takes a few seconds)

```bash
cast code <TREASURY_EOA> --rpc-url <mainnet RPC>
# or: eth_getCode(<TREASURY_EOA>, "latest")
```

- `0xef0100<20-byte BatchExecutor address>` (23 bytes) means **still delegated to BatchExecutor**.
- `0x` (empty) means not delegated. The authorization was skipped, or it was already cleared.

You can also inspect last Tuesday's transaction (`cast tx <hash>`) and compare `authorizationList[i].nonce` with the transaction's `nonce`. A valid self-sponsored authorization must have a value exactly 1 higher.

Also check **`chain_id` in the authorization you signed.** If it was `0`, the authorization is valid on *every* EVM chain. Anyone who has the signed tuple could submit it on any other chain where the EOA's nonce matches, and delegate your address there to whatever lives at the BatchExecutor address on that chain (it might be a different contract, or nothing at all). If you signed with `chain_id = 0`, run the same `eth_getCode` check on every chain where the treasury key is used, and clear those delegations too.

---

## 2. How to remove the delegation

### What does NOT work

- **Killing, pausing or upgrading BatchExecutor.** The EOA's code is just a pointer to BatchExecutor's address, and BatchExecutor can't clear it. Since Cancun (EIP-6780), `SELFDESTRUCT` doesn't remove code from an existing contract anyway. Even if the target had no code, the EOA would still carry the delegation indicator.
- **Sending an ordinary transaction from the EOA.** Ordinary transactions from a delegated EOA are allowed and don't touch its code.
- **Waiting.** Delegations never expire.
- **Having anyone else revoke it.** Only a signature from the EOA's own key can change its delegation.

### What works: sign an authorization for the zero address

EIP-7702 has a special case for this. If an authorization's `address` is `0x0000000000000000000000000000000000000000`, the client **clears the account's code entirely** and resets its code hash to the empty hash. The account goes back to being a plain EOA.

Steps:

1. **Sign an authorization with the treasury key:**
   - `chain_id = 1`. Use Ethereum mainnet specifically, not `0`, so the signature can't be replayed on other chains.
   - `address = 0x0000000000000000000000000000000000000000`
   - `nonce` = the EOA's nonce **at the moment the authorization is processed**:
     - **Self-sponsored** (the EOA also sends the transaction): `nonce = current_nonce + 1`, because the transaction increments the nonce first.
     - **Sponsored** (another funded account sends the transaction): `nonce = current_nonce`.
2. **Include it in a type-`0x04` transaction** with a non-empty `authorization_list`. The transaction's `to`/`data` can be anything harmless. A zero-value call to the sender's own address or to the sponsor works. For example, with Foundry:
   ```bash
   # self-sponsored: cast works out the +1 nonce automatically when --auth is given a raw address
   cast send <ANY_HARMLESS_TARGET> --auth 0x0000000000000000000000000000000000000000 \
        --private-key <TREASURY_KEY> --rpc-url <mainnet RPC>
   ```
   With viem, use `signAuthorization({ contractAddress: zeroAddress, executor: 'self' })` and then send it with `authorizationList: [auth]`.
   The authorization is processed even if the outer call reverts. That's the same property that caused this situation, and now it works in your favour.
3. **Submit it privately.** Use Flashbots Protect or another private RPC, or a builder bundle. Your bug disclosure and a public cleanup transaction both tell observers that the treasury is exploitable. Private submission lowers the chance that someone front-runs the fix with an exploit.
4. **Verify:** `cast code <TREASURY_EOA>` must return `0x`. Also confirm on-chain that the EOA's nonce went up by the expected amount.
5. If you used `chain_id = 0` originally, **repeat steps 1–4 on every affected chain**, each time with that chain's own `chain_id` and nonce.

### Other things for the security review

- **Before clearing, and until clearing is confirmed, assume the bug is exploitable against the treasury.** Anyone can call the EOA's address and run BatchExecutor's code with `address(this) == treasury`. Check whether the bug allows arbitrary calls, transfers or approvals. If it does, move funds or revoke existing approvals in the **same** private bundle as the clearing transaction, or right after it.
- **Check for damage since Tuesday.** Look at all internal calls and token events involving the treasury address since the delegation transaction: incoming calls to the EOA, `Approval`/`Transfer` events and ETH outflows. The inner approvals from Tuesday's batch were rolled back, but calls made by third parties afterwards were not.
- **Storage is not cleared.** Clearing the delegation removes only the code. Any storage slots BatchExecutor wrote under the EOA's address (initialisation flags, nonces, owner or guardian slots) stay there. That's harmless while the account is a plain EOA. If you ever delegate the account to a different contract later, check for storage-layout collisions or stale "initialized" flags first.
- **Make sure no other signed authorization exists anywhere else.** Examples: one generated by a wallet UI, a relayer or a script and never broadcast. Any valid, unused authorization for BatchExecutor at a future nonce could still be submitted by whoever holds it. Clearing the delegation increments the nonce, which invalidates authorizations signed for lower nonces. Authorizations signed for future nonces, or with `chain_id = 0` on other chains, would still work.
