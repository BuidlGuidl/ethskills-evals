# EIP-7702 delegation status of the treasury EOA

## Short answer

1. **Yes — the EOA is almost certainly still delegated to BatchExecutor.** The
   revert of the batch call did not undo the delegation. Setting the delegation
   is not part of the transaction's execution frame, so it is not rolled back by
   a revert inside that frame. The delegation is persistent account state and
   stays in place indefinitely until it is explicitly overwritten or cleared.
2. **To remove it you must send another EIP-7702 (type `0x04`) transaction**
   carrying an authorization signed by that same EOA that names the **zero
   address** `0x0000000000000000000000000000000000000000`. That is the only way
   to clear a delegation; there is no "expiry", no revoke opcode, and no way for
   the delegate contract to remove it on the account's behalf.

Treat this as urgent: for the last several days the EOA has been executing
BatchExecutor's (buggy) code for *anyone* who calls the EOA's address.

---

## 1. Why the revert did not undo the delegation

EIP-7702 defines a new transaction type (`0x04`, `SetCodeTransaction`) that
carries an `authorization_list`. Each tuple is
`(chain_id, address, nonce, y_parity, r, s)`, signed by the *authority* (your
treasury EOA) over `keccak256(MAGIC(0x05) || rlp([chain_id, address, nonce]))`.

The order of operations inside a type-`0x04` transaction is:

1. Intrinsic checks, sender nonce increment, gas is bought.
2. **The authorization list is processed.** For each valid tuple, the
   authority's account code is set to the 23-byte *delegation indicator*
   `0xef0100 || address`, and the authority's nonce is incremented.
3. **Only then** does the top-level call from `tx.origin` to `tx.to` execute.

Step 3 is the only part inside a revertible execution frame. A `REVERT` (or any
exception) in the batch call unwinds the state journal *for that frame* — the
approvals, transfers, and any storage writes it made — but step 2 already
happened outside of and before it. The delegation write survives, and the
transaction is still included and still pays gas. This is a deliberate property
of the spec, not a bug in your tooling: "the delegation is set even if the
transaction execution fails."

The same is true of the nonce bumps. If the EOA sponsored its own transaction,
its nonce went up by **two** that day: once as the transaction sender, once as
the authority of the authorization.

The only ways the delegation would *not* be in place today are:

- The authorization tuple was **invalid** and was silently skipped (invalid
  tuples do not fail the transaction, they are just ignored). It is skipped if
  `chain_id` was neither `0` nor `1`, if the tuple's `nonce` did not equal the
  authority's nonce at the moment it was processed, if `s > secp256k1n/2`, or
  if the recovered authority is a contract account (has non-delegation code).
  The classic self-sponsorship footgun lives here: when the EOA is *both* the
  sender and the authority, the sender nonce is incremented first, so the
  authorization must be signed with `nonce + 1`. Signing it with the "current"
  nonce makes the tuple invalid and it is dropped without any visible error.
- A later transaction overwrote or cleared it — which you have ruled out.

So: unless the tuple was invalid in the first place, the delegation is live.

### Verify before you act (do not take the above on faith)

```bash
cast code <EOA> --rpc-url $ETH_RPC_URL
# 0x                                                       -> not delegated
# 0xef0100<20-byte address>                                -> delegated to that address
```

or `eth_getCode(EOA, "latest")` via raw JSON-RPC. If the result is
`0xef0100` followed by BatchExecutor's address, question 1 is answered "yes"
definitively. Also worth pulling the original transaction receipt and confirming
the `authorizationList` tuple was accepted (compare the tuple's `nonce` against
the account nonce at that block).

**Also check other chains.** If the tuple was signed with `chain_id = 0` it is
valid on *every* EIP-7702 chain, and anyone who saw it on mainnet can replay it
elsewhere. Run the same `eth_getCode` check on every chain where that address
holds value.

---

## 2. How to remove the delegation

### The mechanism

Send a new type-`0x04` transaction whose `authorization_list` contains a tuple
signed by the treasury EOA with `address = 0x0000000000000000000000000000000000000000`.
When the authority's delegation target is the zero address, the account's code
is **reset to empty** and the account becomes a plain EOA again.

There is no other route. Notably:

- `SELFDESTRUCT`-ing or otherwise disabling BatchExecutor does **not** clear the
  delegation. The indicator stores an *address*, not code; the EOA would keep
  pointing at a now-empty address. (That is at least inert, but it is not clean,
  and the address could be re-populated via `CREATE2` if the deployer allows it.)
- The delegate contract cannot revoke on the account's behalf, because the
  delegation only changes via a signed authorization tuple.
- Sending a normal type-2 transaction from the EOA does nothing to it.

### Exact tuple to sign

| field | value |
|---|---|
| `chain_id` | `1` (mainnet). **Do not use `0`** — a `0` here would make the revocation replayable everywhere, which is harmless in itself but is a habit worth not having. If you *also* need to clear delegations on other chains, sign a separate tuple per chain. |
| `address` | `0x0000000000000000000000000000000000000000` |
| `nonce` | the treasury EOA's account nonce **at the moment the tuple is processed** — see the self-sponsorship note below |
| `y_parity, r, s` | secp256k1 signature by the EOA over `keccak256(0x05 ‖ rlp([chain_id, address, nonce]))`, with `s` in the lower half of the curve order |

**The nonce rule, spelled out:**

- **Self-sponsored** (the treasury EOA is also the transaction sender): the
  sender nonce is bumped before the authorization list is processed, so sign the
  tuple with `current_nonce + 1`. Get this wrong and the transaction mines, you
  pay gas, and the delegation is still there — exactly the failure mode you are
  cleaning up after.
- **Sponsored** (some other funded account sends the transaction): sign the
  tuple with the treasury EOA's `current_nonce`. This is the safer shape if the
  treasury EOA is low on ETH or you want the key used only to sign the tuple.

### Transaction envelope

- `type: 0x04`, `authorization_list: [<the tuple above>]` (must be non-empty).
- `to` **must not be null** — type-`0x04` transactions cannot be contract
  creations. Use something harmless: the EOA's own address, or the sponsor's
  address, with `value: 0` and `data: 0x`. Calling into the EOA is safe here
  because the delegation has already been cleared by the time the call executes,
  so there is no code left to run.
- Gas: budget the usual 21,000 intrinsic plus the per-authorization cost
  (`PER_EMPTY_ACCOUNT_COST` = 25,000, refunded down to `PER_AUTH_BASE_COST` =
  12,500 because the authority account already exists). ~50,000 gas limit is
  ample.

### With `cast` (Foundry)

```bash
# sponsored form: sponsor pays, treasury key only signs the tuple
cast send <ANY_HARMLESS_TO> \
  --auth 0x0000000000000000000000000000000000000000 \
  --private-key $TREASURY_KEY \
  --rpc-url $ETH_RPC_URL
```

`cast` handles the nonce arithmetic for the self-sponsored case, but **verify
the tuple's nonce in the signed payload before broadcasting** rather than
trusting the tool. Then confirm:

```bash
cast code <EOA> --rpc-url $ETH_RPC_URL   # must print 0x
```

If it does not print exactly `0x`, the revocation did not take — re-check the
tuple's nonce and chain id.

---

## 3. Two things the revocation does *not* fix

These are outside the two questions asked, but your reviewer will want them on
the record:

1. **Storage written into the EOA is not erased.** Clearing the delegation
   removes the code pointer only. Any storage slots BatchExecutor wrote in the
   EOA's account (initialization flags, owner slots, nonce counters) stay there
   forever. If you later delegate the same EOA to a *different* implementation
   whose storage layout overlaps, that contract will boot up reading
   BatchExecutor's leftovers — a live "already initialized" / stale-owner class
   of bug. Use a namespaced (ERC-7201) layout for whatever you delegate to next,
   or delegate a fresh EOA.
2. **The exposure window is already open and stays open until you land the
   revocation.** While delegated, the EOA *is* BatchExecutor for every caller:
   anyone can call the treasury address and run that code with the treasury's
   balance, approvals, and storage. Given a known critical bug in it, the right
   sequence is (a) send the revocation now, at a gas price that gets it in the
   next block or two, and (b) independently audit the EOA for activity since
   last Tuesday — inbound calls, token approvals granted, transfers out — over
   the whole window, not just the original transaction. If the bug is
   exploitable without any prerequisite setup, consider sweeping the assets to a
   fresh address as well, and treat that as the higher priority of the two.
