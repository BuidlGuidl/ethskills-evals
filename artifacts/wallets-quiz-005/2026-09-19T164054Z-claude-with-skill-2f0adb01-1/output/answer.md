# EIP-7702 delegation status of the treasury EOA

## TL;DR

1. **Yes, almost certainly the EOA is still delegated to BatchExecutor right now.**
   The batch call reverting does **not** undo the delegation. EIP-7702 delegations
   persist until they are explicitly replaced. They don't expire and they aren't
   scoped to one transaction. Confirm this with one RPC call (see below).
2. **To remove it, send a new type-4 (0x04) transaction carrying an authorization
   signed by the EOA that delegates to the zero address (`0x0000…0000`).** This
   resets the account's code to empty. Treat it as an incident: while the
   delegation is live, BatchExecutor's critical bug is live on the treasury.

---

## 1. Is the EOA still delegated?

### Why "the tx reverted, so it was a no-op" is wrong

A type-4 transaction is processed in two separate phases (EIP-7702 spec):

1. **Authorization processing.** Before execution starts, the client walks the
   `authorization_list`. For each valid tuple `(chain_id, address, nonce, y, r, s)`,
   it recovers the signer (`authority`), checks the chain ID and the authority's
   current nonce, and then **writes the delegation indicator
   `0xef0100 || address` into the authority's code** and bumps the authority's
   nonce.
2. **Execution.** Only after that does the EVM run the transaction's `to`/`data`
   call. In your case that was the batch call into the (now delegated) EOA.

The spec says explicitly that the delegation writes **are not rolled back if
execution reverts**. A revert in phase 2 undoes only phase 2's state changes.
The code write from phase 1 stays, and so do the nonce increments and the gas
payment. "Transaction mined, inner call reverted" therefore means: the
delegation was installed and the batch did nothing.

### Why it is still in place days later

A 7702 delegation has no expiry. It is ordinary account state (the account's
code field) and stays there until another valid authorization from the same
EOA overwrites it. You say nothing has been sent from the EOA and no other
authorization has been signed. Nothing has replaced it, so it is still active.
(Someone else could have relayed a different authorization for you only if you
had signed one. You haven't.)

### The one caveat: was the authorization actually valid?

An invalid authorization tuple is **skipped silently**, and the transaction still
executes. The most common way this happens is a nonce off-by-one when the
**EOA is both the tx sender and the authority**. The sender's nonce is
incremented before authorizations are processed, so the authorization must be
signed with `nonce = tx.nonce + 1`. If your tooling signed it with `tx.nonce`,
the authorization was ignored. The batch then called a code-less EOA, and your
"revert" may have had a different cause.

Given the description ("the transaction carried that authorization and then
called into the batch… one of the inner approvals failed"), BatchExecutor code
was running, which means the delegation was applied. Don't rely on inference,
though. Check it:

```bash
cast code <TREASURY_EOA> --rpc-url $MAINNET_RPC
# or: eth_getCode(<TREASURY_EOA>, "latest")
```

- `0xef0100<20-byte BatchExecutor address>` (23 bytes): **still delegated**.
- `0x`: not delegated (the authorization never applied, or it has been cleared).

You can also check the receipt/trace of last Tuesday's tx, and see that the
EOA's nonce went up by 2 in that tx (1 for the tx, 1 for the authorization)
rather than by 1.

### What this means for security

While delegated, **any external caller can call the treasury EOA and it will
run BatchExecutor's code in the EOA's context**, with the EOA's balance,
token approvals and storage. If the critical bug can be reached by an arbitrary
caller (unprotected `execute`, bad signature/auth check, initializer that anyone
can call, etc.), the treasury can be drained right now without the private key.
"Decommissioning" BatchExecutor (pausing, abandoning, even self-destructing the
deployment) does **not** help. The EOA points at the code by address, and
post-Cancun `SELFDESTRUCT` doesn't remove code anyway. The fix has to happen
on the EOA.

The private key also still works normally. Delegation doesn't disable ECDSA
signing, so the key can still send transactions and sign a new authorization.

---

## 2. How to remove the delegation

### The mechanism

EIP-7702 defines the reset case: if an authorization's `address` is the **zero
address** (`0x0000000000000000000000000000000000000000`), the client does **not**
write `0xef0100||0x00…00`. It **clears the account's code** (code hash is reset
to the empty hash), so the account goes back to being a plain EOA.

Removal is therefore a new EIP-7702 transaction. A normal transaction can't
change the code field, and neither can "stopping using" the contract.

### Steps

1. **Read the current state**
   - `eth_getCode(EOA)` → confirm `0xef0100…BatchExecutor`.
   - `eth_getTransactionCount(EOA, "latest")` → call this `N`. Also check `pending`
     so you don't collide with anything in flight.

2. **Sign a revocation authorization with the treasury key**
   - `chain_id = 1` (mainnet). Don't use `0`: a chain-0 authorization is valid on
     every chain.
   - `address = 0x0000000000000000000000000000000000000000`
   - `nonce`:
     - if **the treasury EOA itself sends** the type-4 tx: `nonce = N + 1`
       (the tx consumes `N` before authorizations are processed);
     - if **a different account (relayer/ops wallet) sends** it: `nonce = N`.
   - The signature is over `keccak256(0x05 || rlp([chain_id, address, nonce]))`.

   Example with Foundry, self-sent (cast handles the nonce offset when the
   signer is also the sender):
   ```bash
   cast send <TREASURY_EOA> \
     --auth 0x0000000000000000000000000000000000000000 \
     --private-key $TREASURY_KEY --rpc-url $MAINNET_RPC
   ```
   With viem:
   ```ts
   const auth = await walletClient.signAuthorization({
     account: treasury,
     contractAddress: zeroAddress,
     executor: 'self',          // sets nonce = N + 1
   });
   await walletClient.sendTransaction({
     account: treasury,
     authorizationList: [auth],
     to: treasury.address,      // any target; plain no-op to self is fine
     data: '0x',
   });
   ```

3. **Send it as a type-4 transaction** with that single tuple in
   `authorization_list`. The `to`/`data` don't matter. A 0-value, empty-calldata
   call is fine, and **the call reverting would not undo the reset** (the same
   rule that got you here). Avoid a `to`/`data` that calls into BatchExecutor
   logic. Send through a private mempool / protected RPC (e.g. Flashbots Protect)
   if you think the bug could be front-run.

4. **Verify**
   - `eth_getCode(EOA)` returns `0x`.
   - The EOA's nonce rose by 2 if self-sent (tx + authorization) or by 1 if relayed.
   - If you get `0xef0100…` back, the tuple was skipped as invalid. The usual
     cause is a wrong nonce or chain ID. Re-read the nonce and redo it.

### Things to do alongside the reset

- **Order of operations if the bug can be exploited by anyone:** consider sending
  the revocation *and* moving funds to a fresh, never-delegated address/Safe in
  the same effort. At minimum, don't wait. Every block with the delegation live is
  exposure.
- **Storage is not cleared.** Resetting code does not wipe the storage slots
  BatchExecutor wrote in the EOA's context (initializer flags, owners, nonces,
  etc.). That's harmless while the account has no code, but it matters if you
  ever delegate this EOA to another implementation that uses overlapping slots
  (ERC-7201 namespaced storage helps). Many teams retire the address instead.
- **Review approvals made while delegated.** The batch reverted, so its approvals
  didn't happen. But check for any token approvals or permits that name or were
  granted *by* the EOA during the delegated period, and revoke them if needed.
- **Check other chains.** If the original authorization used `chain_id = 0`, it
  was valid on any EVM chain where the EOA's nonce matched at the time. Run
  `eth_getCode` on the EOA on the other chains you use, and revoke there as well
  (with the chain-specific `chain_id`).
- **Process fix:** a mined transaction with a reverted inner call is **not** a no-op
  under EIP-7702. Post-tx checks for any type-4 transaction should include
  `eth_getCode` on the authority.

## Answers for sign-off

1. **Still delegated?** Yes. The authorization was applied before execution,
   the revert only rolled back the batch call, and 7702 delegations persist until
   replaced. Nothing has replaced it. Confirm with `eth_getCode(EOA)` →
   `0xef0100<BatchExecutor>`.
2. **How to remove it?** Have the EOA sign an EIP-7702 authorization to
   `address(0)` with `chain_id = 1` and the correct nonce (`N+1` if self-sent,
   `N` if relayed). Include it in a type-4 transaction, then verify that
   `eth_getCode(EOA) == 0x`. Do it urgently, since the vulnerable code is live on
   the treasury until then, and consider moving funds at the same time.
