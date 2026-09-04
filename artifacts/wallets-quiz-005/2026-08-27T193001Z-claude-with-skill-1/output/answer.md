# EIP-7702 delegation on the treasury EOA — status and removal

## Short answers

1. **Yes. The EOA is still delegated to BatchExecutor.** The reverted batch call did not
   undo the delegation, and nothing since has replaced or cleared it.
2. **Removing it takes one new signed authorization from that same EOA**, naming the zero
   address, carried in a new type-0x04 transaction. Decommissioning the BatchExecutor
   contract does nothing to the delegation.

---

## 1. Why the delegation survived the revert

An EIP-7702 authorization is **not part of the call it accompanies**. A type-0x04
(`SET_CODE_TX_TYPE`) transaction is executed in two distinct steps:

1. **Authorization list processing.** Before any call frame is entered, each authorization
   tuple is validated (signature recovers to the authority, `chain_id` is 0 or the current
   chain, `nonce` matches the authority's current nonce) and applied. Applying it writes
   the delegation indicator `0xef0100 || <BatchExecutor address>` into the authority's
   `code` field and bumps the authority's nonce. This is a state change of the
   *transaction*, at the top level.
2. **The top-level call**, into the now-delegated account.

A `REVERT` — or any exceptional halt — in step 2 unwinds **only the state journal of that
call frame and its children**. It does not roll back step 1. So the inner approval that
failed took the batch's effects with it and left the delegation standing. The transaction
was mined and paid for; the delegation is part of what it paid for.

This is the general rule, not a quirk of this transaction: **the delegation is not scoped
to the transaction that set it.** It is a persistent property of the account, like code on
a contract, and it stays until something explicitly replaces or clears it.

### Positive evidence it applied here, rather than being skipped

An invalid authorization is silently skipped — the transaction still executes. So it is
worth checking that yours was not skipped. It was not, and the revert itself is the tell:

- If the authorization had been skipped, the top-level call would have landed on an EOA
  with **no code**. A call to a codeless account **succeeds** with empty returndata. There
  would have been no revert, and certainly no "one of the inner approvals failed."
- You observed a revert originating inside batch logic. That means BatchExecutor's code
  was executing *as* the EOA — which only happens if the delegation was applied.

### Why "days later" changes nothing

The delegation indicator has no expiry, no block-height scope, and no automatic teardown.
The only things that clear or change it are:

- a later valid authorization from the same EOA naming a different address (replaces it), or
- a later valid authorization naming `0x0000000000000000000000000000000000000000` (clears it).

You have stated that no further 7702 transactions and no authorizations of any kind have
been sent from that EOA. Therefore nothing has replaced or cleared it, and it is still in
effect right now.

### Verify before sign-off

Do not take this on reasoning alone — it is one RPC call:

```bash
cast code <TREASURY_EOA> --rpc-url <MAINNET_RPC>
```

- `0xef0100<batchexecutor address>` (23 bytes) → still delegated. Expected result.
- `0x` → not delegated.

---

## 2. What it takes to get rid of it

**Nothing you can do to the BatchExecutor contract removes the delegation.** Not pausing
it, not renouncing ownership, not `SELFDESTRUCT`. The EOA holds a *pointer to an address*,
not a copy of the code. Removal must be authorized by the EOA's key.

### The mechanism

Sign a new authorization tuple `(chain_id, address, nonce)` with:

- `address` = `0x0000000000000000000000000000000000000000` — the reserved value that clears
  the account's code and resets its code hash to the empty hash.
- `chain_id` = `1` (or `0`, which is valid on any chain — prefer `1` here, so a stray copy
  of the signature cannot be replayed elsewhere).
- `nonce` = the EOA's nonce **at the moment the authorization is processed** (see below).

Carry it in the `authorization_list` of a new type-0x04 transaction. The clearing happens
in the authorization-processing step, so **the transaction's actual call is irrelevant** —
it can be a zero-value, empty-calldata call to any address. Note that type-0x04
transactions cannot be contract creations, so `to` must be set to something.

### The nonce trap

This is the one place these transactions commonly fail, and the failure is silent — an
authorization with a wrong nonce is skipped, the transaction succeeds, and the delegation
is still there.

- **Self-sponsored** (the treasury EOA is also the transaction's `from`): the sender nonce
  is incremented *before* the authorization list is processed, so the authorization's nonce
  must be `current_nonce + 1`.
- **Sponsored by a different sender** (recommended here — see below): the authorization's
  nonce is simply the treasury EOA's `current_nonce`.

Also remember the reverted transaction already consumed a nonce increment for the
authorization, on top of the sender increment. Read the nonce live rather than deriving it:

```bash
cast nonce <TREASURY_EOA> --rpc-url <MAINNET_RPC>
```

### Concrete revocation

Sponsored form, with the treasury key signing only the authorization and a separate,
low-value account paying gas — this keeps the treasury key's signing surface to exactly one
tuple and lets you fund the gas without touching the treasury:

```bash
# 1. Treasury key signs an authorization clearing the delegation.
cast wallet sign-auth 0x0000000000000000000000000000000000000000 \
  --rpc-url $RPC --chain 1 \
  --nonce $(cast nonce $TREASURY_EOA --rpc-url $RPC) \
  <treasury signer flags>          # --ledger / --trezor / hardware or HSM signer

# 2. Any sponsor account broadcasts it. The call target is a no-op.
cast send $TREASURY_EOA --value 0 \
  --auth <signed-auth-from-step-1> \
  --rpc-url $RPC <sponsor signer flags>

# 3. Confirm.
cast code $TREASURY_EOA --rpc-url $RPC     # must print 0x
```

Step 3 is the acceptance criterion. Anything other than `0x` means the authorization was
skipped — re-read the nonce and repeat. Do not treat a mined transaction as success; the
whole point of the failure mode above is that it mines cleanly.

Before signing, confirm the gas cost and the fact that this transaction moves no funds
(`--value 0`, empty calldata) with whoever holds the treasury key. Price gas live.

### Two hazards while the delegation stands

**The treasury is running BatchExecutor's code right now.** As long as the pointer is set,
that contract's code *is* the EOA's code, and anyone can call the EOA at any BatchExecutor
entrypoint. If the critical bug you found is reachable without privileged access — an
unguarded `execute`, a missing caller check, a re-initializable owner — the treasury is
exposed today, not hypothetically. Treat revocation as urgent, and assume exposure since
the day the transaction was mined when you scope the incident. Note also that a 7702
account's storage is the **EOA's own** storage, so any state BatchExecutor wrote or could
write lives at the treasury address and outlives the delegation pointer; if the bug lets an
attacker seed that storage, clearing the pointer does not erase it. Review any storage the
contract writes before considering the account clean.

**Do not free the BatchExecutor address for redeployment.** If the address is ever occupied
by new code — a `CREATE2` redeploy to the same address, most plausibly — the EOA would
delegate to *that* code, whatever it is. Clear the delegation first; only then decommission.

### Order of operations for sign-off

1. `cast code` → confirm the delegation is present, and record it.
2. Assess the bug's reachability by an unprivileged caller; if reachable, treat the
   treasury as at risk and move funds out or revoke immediately.
3. Sign and broadcast the zero-address authorization.
4. `cast code` → `0x`. This is the sign-off artifact.
5. Only now decommission BatchExecutor, and keep its address permanently unoccupied.
