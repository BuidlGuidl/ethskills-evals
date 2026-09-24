# EIP-7702 delegation after a reverted batch: is the treasury EOA still delegated?

## Short answer

1. **Yes, almost certainly.** The EOA is still delegated to BatchExecutor, and the
   delegation stays in place until you replace or clear it. The reverted batch call did not
   undo it, and time passing does not expire it. Confirm it with one RPC call (see below).
2. **To get rid of it, sign a new EIP-7702 authorization that delegates to the zero address**
   (`0x0000000000000000000000000000000000000000`) and get it included in a type-4
   transaction. Decommissioning, pausing or even self-destructing BatchExecutor does **not**
   remove the delegation. Do this urgently. While the delegation stands, anyone can call
   BatchExecutor's buggy code at your treasury's address, in your treasury's context.

---

## 1. Is the EOA still delegated?

### Why the revert didn't undo it

A type-4 (EIP-7702, "set code") transaction runs in two separate stages:

1. **Authorization processing.** Before any execution starts, the protocol walks the
   `authorization_list`. For each valid tuple `(chain_id, address, nonce, y_parity, r, s)` it
   increments the authority's nonce and writes the **delegation indicator**
   `0xef0100 || address` into the authority's code.
2. **Execution.** Only then does the transaction's actual call run. Here that was the batch
   call into your own address.

The spec says a revert in stage 2 does not roll back stage 1. The authorization's effects are
applied before execution and stay in place if execution reverts. That is deliberate: sponsors
and relayers need a delegation that can't be undone by a failing call. So "the transaction was
mined but the batch reverted" means: **the delegation was set, then the batch failed.** The
failed inner approval rolled back only the batch's own state changes.

### Why "days later" doesn't matter

A 7702 delegation is not scoped to one transaction and has no expiry. It is stored as the
account's code and stays there until one of these happens:

- another valid authorization from the same EOA points it somewhere else, or
- an authorization to the zero address clears it.

You say neither has happened: no transactions and no authorizations from that EOA since.
Nobody can clear the delegation for you, because it takes a signature from the EOA's key. So
the state today is the same as right after last Tuesday's transaction.

### The one caveat, and how to settle it

An authorization tuple that is **invalid** is skipped silently and the transaction still
executes. It can be invalid because of a wrong `chain_id`, a wrong `nonce` or a bad signature.
A common mistake when the EOA sends its own 7702 transaction is signing the authorization with
the account's current nonce instead of **current nonce + 1**. The sender's nonce is bumped
before the authorization list is processed. If that happened, no delegation was ever set, and
the batch may have reverted *because* your address had no code.

Don't argue it from the transaction; check the chain state directly:

```bash
cast code <TREASURY_EOA> --rpc-url <mainnet-rpc>
# or: eth_getCode(<TREASURY_EOA>, "latest")
```

- `0xef0100` followed by the 20-byte BatchExecutor address means **it is delegated** (the
  expected result).
- `0x` (empty) means the authorization was skipped, so there is nothing to revoke. Still
  follow the hygiene notes below.

You can also check the EOA's nonce. If the authorization was applied, last Tuesday's
transaction increased it by 2 (+1 for the transaction, +1 for the authorization), not by 1.

### Why this is urgent, not just paperwork

While the delegation stands, **any call to the treasury address runs BatchExecutor's code with
the treasury as `address(this)`**. It runs with the treasury's ETH balance and token
allowances, and with the treasury as `msg.sender` for any downstream call it makes. Whether an
attacker can use the critical bug depends on BatchExecutor's access control. If the bug is in
that access control, or in anything reachable without the EOA's signature, the treasury can be
drained right now. "Decommissioning" the contract (a pause flag, an admin switch, abandoning
the repo) doesn't help: those flags live in BatchExecutor's *own* storage, but a delegated
call reads and writes the *EOA's* storage. The code at the BatchExecutor address is what runs,
and it stays deployed.

---

## 2. How to remove the delegation

### What does NOT work

- Decommissioning, pausing or abandoning BatchExecutor. Its code stays on-chain, and the EOA's
  delegation indicator still points at it.
- Waiting. There is no expiry.
- Sending an ordinary (non-type-4) transaction from the EOA. This bumps the nonce but leaves
  the code as it is.

(A side effect of that nonce bump: it *does* invalidate any not-yet-used authorization signed
for the old nonce. See the hygiene notes.)

### What works: an authorization to the zero address

EIP-7702 defines a special case: if the authorization's `address` is `0x000…000`, the client
clears the account's code back to empty instead of writing `0xef0100 || 0x00…00`. That restores
the EOA to a plain EOA.

Steps:

1. **Read the EOA's current nonce** `N` (`cast nonce <TREASURY_EOA>`).
2. **Sign an authorization with the treasury key** (offline or on the hardware wallet if you
   can):
   - `chain_id = 1` (mainnet). Don't use `0`: that makes it valid on every chain, and there's
     no reason to hand that out.
   - `address = 0x0000000000000000000000000000000000000000`
   - `nonce`:
     - `N + 1` if the **treasury EOA itself sends** the type-4 transaction, because its nonce
       is bumped to `N+1` before the authorization is checked.
     - `N` if a **different account sends** it (a sponsor or relayer, or another ops wallet).
       This is often simpler and avoids the off-by-one mistake. The sender pays gas. The
       authorization still needs only the treasury's signature.
3. **Submit a type-4 transaction** with that tuple in `authorization_list`. The destination
   and calldata can be trivial: for example a 0-value call to the sender itself, or to the
   treasury address with empty data. Don't call into BatchExecutor.
   - With foundry:
     `cast wallet sign-auth 0x0000000000000000000000000000000000000000 --private-key … --nonce <N or N+1> --chain 1`,
     then `cast send … --auth <signed-auth>`. You can also pass
     `--auth 0x0000000000000000000000000000000000000000` directly when the treasury sends it,
     and foundry picks the right nonce.
   - Viem: `signAuthorization({ contractAddress: zeroAddress, ... })` then `sendTransaction({ authorizationList: [auth], ... })`.
   - As with any transaction that touches the treasury: have a human review the transaction
     (chain id, authorization target = zero address, nonce, gas cost priced live) before it's
     signed.
4. **Verify:**
   - `cast code <TREASURY_EOA>` returns `0x`.
   - The nonce has moved as expected: +1 for the authorization, plus +1 more if the treasury
     was the sender.

   The first check proves the delegation is gone.
5. **Record it** for the reviewer: the revocation transaction hash, the block, and the
   `eth_getCode` result before and after.

(Delegating instead to a different, audited contract also replaces the BatchExecutor
delegation. But you asked to *get rid of* it, and the zero-address authorization is the clean
revocation.)

### Hygiene items to include in the sign-off

- **Leftover storage.** Clearing the code does **not** clear the EOA's storage. Any slots
  BatchExecutor wrote into the treasury account (initialized flags, owner slots, nonces,
  session keys) stay there. That's harmless while the account has no code. But if you ever
  delegate to another implementation, it will read those slots, so pick one that uses
  namespaced storage (ERC-7201) or clears or re-initializes explicitly. Note that last
  Tuesday's batch reverted, so it wrote nothing.
- **Approvals and state the batch might have left.** The batch reverted, so none of its inner
  approvals took effect. Still, check the treasury's existing token allowances (for example
  with revoke.cash or `allowance()` calls). The delegation window let BatchExecutor code act
  *as* the treasury, and anything it did while delegated would look like the treasury did it.
  Review the treasury's transaction and log history since last Tuesday for any calls *to* the
  treasury address that executed BatchExecutor code. Those are incoming calls from other
  accounts, not transactions "sent from" the EOA, so they're easy to miss. Look for internal
  transactions or token transfers where the treasury is the source.
- **Stray signed authorizations.** If any other BatchExecutor authorization was signed but
  never broadcast (drafts, retries, a relayer's queue), it is invalidated once the EOA's nonce
  moves past its `nonce`, and the revocation does move the nonce. Any authorization signed with
  `chain_id = 0` could be replayed on other EVM chains where the EOA has the same nonce. Check
  whether any exist and whether the treasury holds funds on those chains.
- **Key custody.** The key that could delegate the treasury to arbitrary code is effectively a
  single key with full authority over the treasury. Consider holding the principal behind a
  multisig threshold, with the EOA holding only an operating float.

## Summary for the reviewer

| Question | Answer |
|---|---|
| Still delegated? | Yes. The authorization is applied before execution and isn't reverted by the failed batch. It has no expiry, and nothing has cleared it. Confirm with `eth_getCode(EOA)` → `0xef0100‖BatchExecutor`. |
| Does decommissioning BatchExecutor help? | No. Its code stays on-chain and the EOA still points at it. The bug can be exploited at the treasury's address until the delegation is cleared. |
| How to remove it | The treasury key signs a 7702 authorization `{chain_id: 1, address: 0x0, nonce: N (sponsor sends) or N+1 (EOA sends)}`, included in a type-4 transaction. Verify `eth_getCode(EOA) == 0x`. |
| Leftovers | EOA storage stays in place; check allowances and incoming calls since Tuesday; unused authorizations are voided by the nonce bump; avoid `chain_id = 0`. |
