# EIP-7702 delegation status of the treasury EOA

## Short answers

1. **Yes, almost certainly the EOA is still delegated to BatchExecutor right now.** The batch call reverting did not undo the delegation, and time passing does not undo it either. Nothing you have done since would have cleared it. Confirm this on-chain; the check is below.
2. **To remove it, the EOA must sign a new EIP-7702 authorization that names the zero address (`0x0000000000000000000000000000000000000000`).** That authorization then has to be included in a mined type-4 (`0x04`) transaction. Decommissioning, pausing, or self-destructing BatchExecutor does **not** remove the delegation. Treat this as urgent: while the delegation stands, the buggy code runs *as your treasury account*.

---

## 1. Is the EOA still delegated?

### How a 7702 transaction is processed

A type-4 (set-code) transaction runs in two phases:

1. **Processing the authorization list.** For each authorization tuple `(chain_id, address, nonce, y_parity, r, s)`, the client recovers the signer (the "authority"). It checks the chain id and checks that the authority's nonce equals the tuple's `nonce`. If both checks pass, it:
   - writes the delegation indicator `0xef0100 || address` into the authority's code, and
   - increments the authority's nonce.
2. **Executing the transaction's call.** Only after phase 1 does the EVM run the transaction's `to`/`data` (here, the call into the batch).

Phase 1 is not part of the execution that reverted. EIP-7702 says the delegation set by a valid authorization is **not rolled back if the execution later reverts**. So when "one of the inner approvals failed" and the batch reverted:

- **Rolled back:** every state change made *inside the batch call*. None of the inner approvals, including the ones that "succeeded" before the failing one, are in effect.
- **Not rolled back:** the code set on the EOA (the delegation to BatchExecutor), the EOA's nonce increments, and the gas fee.

The transaction was "mined but reverted", so it was a no-op only for the batch's effects. It was **not** a no-op for the account. The account's code changed from empty to `0xef0100 || <BatchExecutor address>`.

### Why "days later" changes nothing

A 7702 delegation has no expiry and is not tied to the transaction that set it. It is persistent account state, like a balance. There are only two ways it changes:

- a later valid authorization from the same EOA replaces it with a different address, or
- a later valid authorization clears it by naming the zero address.

You say nothing has been sent from the EOA since, and it has signed no authorizations of any kind. Neither event can have happened. Two other things that do **not** clear it:

- Taking BatchExecutor out of service off-chain.
- Even `SELFDESTRUCT`-ing or otherwise disabling the contract. The EOA's code is just a pointer. Post-Cancun, `SELFDESTRUCT` doesn't remove code from a pre-existing contract anyway, and the pointer would stay even if it did.

### The one caveat, and how to verify

The authorization would have been **silently skipped**, with the transaction still mined, if its checks had failed. That covers a wrong chain id or a wrong nonce. A common mistake: when the EOA is both the transaction sender *and* the authority, its nonce is incremented for the transaction first. So the authorization must carry `current_nonce + 1`. Most tooling (viem, ethers, cast) handles this, but it is the one way the EOA might *not* be delegated. So verify rather than assume:

```bash
cast code <TREASURY_EOA> --rpc-url <mainnet-rpc>
# or JSON-RPC: eth_getCode(<TREASURY_EOA>, "latest")
```

- `0x` → not delegated. The authorization was skipped; nothing to clean up, apart from the chain-id point below.
- `0xef0100` followed by the 20-byte BatchExecutor address (23 bytes total) → **still delegated**. This is the expected result.

Etherscan also shows the delegation on the address page, and the original transaction's "Authorization List" tab shows whether the authorization was applied.

### Why it matters

While the delegation stands, any call to the treasury address runs BatchExecutor's code in the EOA's context, with the EOA's balance, token holdings, and storage. That includes calls from third parties, not just your own. If the "critical bug" involves missing access control on `execute`, a mis-checked signature, an unprotected initializer, or similar, **anyone can exploit it against the treasury right now**. The private key still works as normal, and the EOA can still send ordinary transactions, but it is no longer the *only* thing that can act for the account.

---

## 2. How to remove the delegation

### The fix: delegate to the zero address

Per EIP-7702, if an authorization's `address` is `0x0000000000000000000000000000000000000000`, the client does not write a delegation indicator. Instead it **resets the account's code to empty**, and the account becomes a plain EOA again.

Steps:

1. **Read the current nonce** of the EOA: `cast nonce <TREASURY_EOA>`.
2. **Sign an authorization with the treasury key** containing:
   - `chain_id = 1` (mainnet). Do **not** use `0`, which is valid on every chain.
   - `address = 0x0000000000000000000000000000000000000000`
   - `nonce`:
     - = the EOA's current nonce, **if a different account sends the transaction**;
     - = current nonce **+ 1**, if the treasury EOA sends the transaction itself (its nonce is bumped for the transaction before authorizations are processed).
3. **Include the authorization in a type-4 transaction** and get it mined. The transaction's call can be anything harmless, for example a zero-value call to the EOA itself or to any address. The call's success is irrelevant, as part 1 explained. What matters is that the authorization is valid.

   Example with Foundry, the EOA paying its own gas:
   ```bash
   cast send <TREASURY_EOA> --auth 0x0000000000000000000000000000000000000000 \
     --private-key/--ledger ... --rpc-url <mainnet-rpc>
   ```
   (`cast` computes the self-sponsored nonce `+1` for you.) viem equivalent: `signAuthorization({ contractAddress: zeroAddress, executor: 'self' })`, then send it in `authorizationList`.

   Follow your normal treasury signing gate. Review the chain id, the zero address, the nonce, and the gas cost before a human approves the signature.
4. **Verify:** `cast code <TREASURY_EOA>` must now return `0x`. Until it does, assume the delegation is live. The authorization may have been skipped because of a nonce or chain mismatch, and that failure is silent.

### Things the reviewer should also check

- **Chain id of the original authorization.** If the original authorization used `chain_id = 0`, it is valid on *every* EVM chain that supports 7702. On any chain where the EOA's nonce still matches, anyone can replay it and delegate the EOA to whatever lives at the BatchExecutor address there, which may be nothing or may be different code. If it was `chain_id = 0`, check the EOA on the other chains you care about. On each chain where the EOA has activity or funds, burn that nonce or set a zero-address delegation. On mainnet the original authorization cannot be replayed: its nonce was consumed.
- **Storage is not cleared.** Clearing the delegation resets code only. Any storage BatchExecutor wrote into the EOA's storage (owner slots, nonces, initialized flags) stays. It is harmless while the account has no code. If you ever delegate this EOA to a different contract, check for storage-layout collisions or use an implementation with namespaced storage (ERC-7201).
- **Nothing from the reverted batch needs revoking.** The inner approvals were rolled back with the revert. Still, check for approvals or other state that anyone else may have created *through* the delegated code since Tuesday: token allowances from the EOA, balance changes, and incoming calls to the EOA in the explorer's internal-transaction view.
- **If the bug is actively exploitable and clearing will take time** (hardware or multisig approval to sign a 7702 authorization), consider moving the funds to a clean address first. Moving funds is an ordinary transaction and does not need an authorization. Then clear the delegation.
- **Front-running is not a concern for the fix.** Only the EOA's key can produce an authorization for it, and anyone may relay a valid authorization. The same property is the risk if the key is ever exposed: a leaked key can re-delegate the account to anything.

## Summary

| Question | Answer |
|---|---|
| Did the batch revert undo the delegation? | No. Authorizations are applied before execution and are not rolled back. |
| Does it expire or lapse after days? | No. It persists until replaced or cleared. |
| Does decommissioning BatchExecutor help? | No. The EOA's code still points at it. |
| Still delegated now? | Yes, unless the original authorization was silently invalid. Confirm with `eth_getCode` (`0xef0100…`). |
| How to remove it? | Have the EOA sign a 7702 authorization for `address = 0x000…000` with `chain_id = 1` and the correct nonce (+1 if self-sent). Get it mined in a type-4 transaction, then confirm `eth_getCode` returns `0x`. |
