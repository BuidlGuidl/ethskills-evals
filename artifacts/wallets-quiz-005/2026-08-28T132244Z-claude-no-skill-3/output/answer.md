# EIP-7702 delegation status of the treasury EOA

## Short answer

1. **Yes — the EOA is almost certainly still delegated to BatchExecutor.** The batch call
   reverting has no bearing on the delegation. Authorizations are applied *before* the
   execution frame starts, outside of it, so nothing the call does (including reverting)
   can undo them. Treat this as a live exposure, not a no-op.
2. **The only way to remove it is to send another EIP-7702 (type `0x04`) transaction
   carrying an authorization signed by that same EOA naming the zero address**
   (`0x0000000000000000000000000000000000000000`). There is no expiry, no automatic
   cleanup, and no ordinary transaction that clears it as a side effect.

---

## 1. Why the revert didn't undo anything

EIP-7702 defines the processing order for a `SetCode` transaction explicitly:

1. The transaction is validated and **the sender's nonce is incremented**.
2. **Each entry in `authorization_list` is processed**, in order. For each valid entry,
   the authority account's code field is set to the *delegation designator*
   `0xef0100 || <20-byte address>` (23 bytes total).
3. **Only then** does the top-level call execute.

Steps 2 and 3 are separate. The delegation is not a state change made *inside* the call
frame, so the frame's revert journal doesn't contain it. A `REVERT` (or an out-of-gas, or
any other exceptional halt) in the batch unwinds storage writes, balance transfers and
logs produced *within that frame* — it does not reach backwards into the transaction's
pre-execution phase. The transaction was mined and paid for; the authorization was
applied; the code pointer stuck.

This is the single most common misconception about 7702, and it is the opposite of the
intuition people carry over from `CREATE`/constructor semantics. "The transaction did
nothing" is only true of the batch, not of the account.

Secondary points that also do **not** clear a delegation:

- Sending subsequent ordinary transactions from the EOA (nonce increments are irrelevant).
- The delegate contract being decommissioned, selfdestructed, or left with no code. The
  EOA stores an *address*, not a code copy; if that address is later populated by anyone,
  the EOA executes whatever is there.
- Time. Delegations are permanent until explicitly overwritten.

### Why "almost certainly" and not "certainly"

An authorization tuple can be silently skipped without failing the transaction. If any of
the following held, the delegation was never set and you have nothing to revoke:

- `chain_id` was neither `1` nor `0`.
- The `nonce` in the tuple didn't equal the authority's account nonce at the moment the
  tuple was processed. **Note the self-sponsorship trap:** if the treasury EOA was also the
  *sender* of the transaction, its nonce was already incremented in step 1, so a valid
  authorization had to be signed with `nonce = tx_nonce + 1`. Signing with `tx_nonce` is a
  very common mistake and results in a silently ignored authorization.
- The signature was malformed (`s > secp256k1n/2`, `y_parity` outside `{0,1}`), or
  recovered to a different address.

So confirm empirically rather than reasoning about it. One RPC call settles it:

```bash
cast code <TREASURY_EOA> --rpc-url "$RPC"          # foundry
# or: eth_getCode(<TREASURY_EOA>, "latest")
```

- `0xef0100<batchexecutor address>` (23 bytes) → **still delegated**. Proceed to part 2.
- `0x` → the authorization never took effect; nothing to do.

If it returns a designator pointing at some address *other* than BatchExecutor, stop and
investigate — that means something was sent from this account that you don't know about.

**Also check other chains.** If the original authorization was signed with `chain_id = 0`
it is valid on *every* EIP-7702 chain at that nonce, and anyone holding a copy of the
signed tuple can replay it elsewhere. Run the same `eth_getCode` check on every chain
where that EOA holds assets, not just mainnet.

---

## 2. How to remove the delegation

### The mechanism

Send a **type `0x04` (`SetCode`) transaction** whose `authorization_list` contains a tuple
signed by the treasury EOA with:

| field      | value                                        |
|------------|----------------------------------------------|
| `chain_id` | `1` (mainnet)                                |
| `address`  | `0x0000000000000000000000000000000000000000` |
| `nonce`    | the authority's nonce *as seen at processing time* — see below |
| signature  | signed by the treasury EOA's key             |

The zero address is special-cased by the EIP: instead of writing a designator, the client
**clears the account's code entirely**, restoring plain-EOA behaviour. Afterwards
`eth_getCode` returns `0x`.

There is no other route. In particular:

- A type-4 transaction **must** carry a non-empty `authorization_list` (an empty list makes
  the transaction invalid), so you cannot "reset" by sending a bare type-4.
- Calling any function on BatchExecutor cannot clear it — the designator lives in the
  EOA's account record, not in contract storage.
- Re-delegating to a safe contract (a no-op or a fixed implementation) is a valid
  alternative if you want the account to stay smart, but for decommissioning, zero is the
  right target.

### Getting the nonce right

This is the only place the operation can quietly fail.

- **Self-sponsored** (the treasury EOA sends the transaction *and* signs the
  authorization): the sender nonce increments first, so sign the authorization with
  `nonce = current_nonce + 1`.
- **Sponsored** (any other account pays gas and sends the transaction; the treasury EOA
  only signs the authorization tuple): sign with `nonce = current_nonce`.

Sponsorship is worth considering here — the treasury key only has to produce a 
signature over the tuple, never a whole transaction, which fits cold-storage or 
multi-approver signing flows.

The rest of the transaction is irrelevant to the revocation: `to` can be the EOA itself or
any address, `value = 0`, `data = 0x`. Keep it trivial so nothing else can revert.
(And if it *did* revert, the revocation would still apply — same asymmetry as part 1.)

Cost: an authorization has an intrinsic cost of 25,000 gas, refunded down to 12,500 when
the authority account already exists, so budget roughly 12.5k gas on top of the 21k base.

### Concrete commands (foundry — verify flags against your version)

Self-sponsored, one shot:

```bash
cast send "$EOA" \
  --auth 0x0000000000000000000000000000000000000000 \
  --private-key "$TREASURY_KEY" \
  --rpc-url "$RPC"
```

Passing a bare address to `--auth` alongside the sending key makes `cast` sign the tuple
and handle the `+1` nonce offset for the self-sponsored case.

Sponsored, splitting the signing from the sending:

```bash
# on the machine holding the treasury key
cast wallet sign-auth 0x0000000000000000000000000000000000000000 \
  --private-key "$TREASURY_KEY" --chain 1 --nonce "$CURRENT_NONCE"

# on the sponsor, with the signed tuple from above
cast send "$EOA" --auth "$SIGNED_AUTH" --private-key "$SPONSOR_KEY" --rpc-url "$RPC"
```

### Verify afterwards

```bash
cast code "$EOA" --rpc-url "$RPC"   # expect: 0x
```

Do not sign off on the strength of a successful transaction receipt alone — an invalid
authorization does not fail the transaction, it is skipped. `eth_getCode` returning `0x`
is the only proof.

---

## Two things to flag beyond the two questions

**Urgency.** While the delegation stands, *anyone* can call the treasury EOA's address and
execute BatchExecutor's code in the EOA's own context, with the EOA's balance, its token
balances and its storage. A known-critical bug in that contract is therefore reachable by
an unauthenticated third party right now, without the treasury key. This should be treated
as an active incident rather than a cleanup item: revoke immediately, and if the bug is
exploitable by an arbitrary caller, move assets out of the EOA first — revocation and
asset movement race against anyone watching mainnet for delegations to a contract whose
bug has become public.

**Storage residue.** Clearing the code does *not* clear the EOA's storage. Anything
BatchExecutor wrote into the account's slots persists after revocation and remains visible
to any contract you delegate to in the future. In this case the batch reverted, so its
storage writes were rolled back and there should be nothing there — but if you ever
re-delegate this account, audit its storage first rather than assuming a clean slate.
