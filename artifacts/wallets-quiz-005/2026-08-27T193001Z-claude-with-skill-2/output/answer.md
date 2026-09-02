# EIP-7702 delegation status of the treasury EOA

**Short answer: yes, the EOA is almost certainly still delegated to BatchExecutor, and it will
stay that way forever until you send a new authorization that clears it. The revert did not undo
it, and decommissioning BatchExecutor will not undo it either.**

Note on scope: this answer is derived from the EIP-7702 / Pectra state rules, not from a live
mainnet query — the EOA address was not provided and this environment has no mainnet RPC
configured. The single command that settles it empirically is in "Step 0" below; run it before
sign-off.

---

## 1. Is the EOA still delegated?

Yes. Four independent reasons, in order of importance:

### 1.1 The authorization is applied *outside* the revertible call frame

A type-`0x04` (SetCode) transaction is processed in two distinct stages:

1. **Pre-execution.** The sender's nonce is bumped, gas is paid for, and then **each entry in
   `authorizationList` is validated and applied**. Applying one means writing the delegation
   indicator — the 23 bytes `0xef0100 ‖ <delegate address>` — as the authority account's code.
2. **Execution.** The top-level call frame is entered (`to`, `value`, `data`).

A `REVERT` unwinds the state changes made *inside* the call frame it propagates out of. The
authorization list was never inside that frame. It sits in the same category as the nonce
increment and the gas payment: part of the transaction, not part of the call, and therefore not
rolled back when the call fails. The transaction was mined, so stage 1 ran to completion.

This is the specific trap you fell into: **"the call reverted" and "the transaction was a no-op"
are not the same statement for a 7702 transaction.** The call reverted; the transaction still
changed your account's code.

### 1.2 A delegation is not scoped to the transaction that set it

There is no expiry, no TTL, no per-transaction activation, and no "the authorization was consumed"
semantics. The delegation indicator is ordinary account code. Once written it is a permanent
property of the account, and the only thing that changes it is a subsequent valid authorization
naming a different address (replace) or the zero address (clear).

### 1.3 "Nothing has been sent since" is the reason it is *still* there, not evidence it is gone

Because only a new authorization can change the delegation, a period of total inactivity is
exactly the condition under which the delegation survives untouched. The reviewer should read
"no further 7702 transactions, no authorizations of any kind" as *confirming* the delegation is
still live.

### 1.4 Decommissioning BatchExecutor does nothing

The delegation indicator stores an **address**, not code. Whatever you do to the contract at that
address, the EOA keeps pointing at it:

- If you leave the contract deployed, the EOA keeps executing the buggy code.
- If the code at that address is removed, calls into the EOA execute *empty* code and succeed as
  silent no-ops — which is arguably worse, because integrations will read success from an account
  that is doing nothing.
- If that address is ever repopulated (e.g. a `CREATE2` redeploy to the same address), your EOA
  immediately executes whatever lands there, with no further action or signature from you.

The delegation is a property of your account. It has to be removed from your account.

### 1.5 Corroborating evidence from the failure itself

The batch call *reverting* is positive evidence that the delegation took effect. If the
authorization had been skipped, the EOA would have had empty code, and a call into an account with
empty code cannot revert — it returns success with empty returndata. Something executed and
rejected the inner approval. That something was BatchExecutor's code running in your EOA's context.

### 1.6 The only scenario where it is *not* delegated

An invalid authorization is **silently skipped** — the transaction still succeeds, which is why
this failure mode is easy to miss. An entry is skipped if `chain_id` is neither `1` nor `0`, if
the signature's `s` value is in the upper half of the curve order, if the recovered authority is
not the treasury EOA, or if `nonce` did not match the EOA's nonce at the moment of processing
(the classic case: the EOA sponsored its own transaction and the tuple used `nonce` instead of
`nonce + 1`). Given §1.5, this is unlikely here — but it costs one RPC call to be certain, so
don't reason about it, check it.

---

## 2. Removing the delegation

### The mechanism

You must sign and land a **new EIP-7702 authorization naming the zero address**:

```
(chain_id, address, nonce, y_parity, r, s)
       ^         ^        ^
       1    0x00..00   see below
```

signed by the treasury key over `keccak256(0x05 ‖ rlp([chain_id, address, nonce]))`, and carried
in the `authorizationList` of a type-`0x04` transaction. `address = 0x0` is special-cased: instead
of writing a delegation indicator, it clears the account's code to empty, returning it to a plain
EOA.

Delegating to a "safe" or no-op contract instead is **not** equivalent — it leaves a delegation
standing and defers the problem. Use the zero address.

### Parameter choices

| Field | Value | Why |
|---|---|---|
| `chain_id` | `1` | Scopes the revocation to mainnet. `0` means "valid on every chain" — never use it for a signature you are not deliberately replaying. |
| `address` | `0x0000000000000000000000000000000000000000` | Clears code rather than re-delegating. |
| `nonce` | see below | The one thing that is easy to get wrong. |

**Nonce rule.** The tuple's `nonce` must equal the treasury EOA's account nonce *at the moment the
authorization is processed*.

- **Sponsored (a different EOA sends the transaction) → `nonce` = the treasury's current nonce.**
- **Self-sponsored (the treasury EOA sends it) → `nonce` = current nonce + 1**, because the
  sender's own nonce is incremented in stage 1 before the authorization list is read.

Get this wrong and the entry is skipped, the transaction succeeds anyway, and you will believe you
revoked something you did not.

### Recommended procedure: sponsor it from a separate EOA

Have an ordinary hot EOA (funded with a few dollars of ETH) send the transaction. The treasury key
then only ever produces one offline signature — the authorization tuple — and never signs another
*transaction* while the buggy code is live. It also needs no ETH, and the nonce arithmetic is the
simple case.

**Step 0 — confirm the current state.**

```bash
cast code <TREASURY_EOA> --rpc-url <MAINNET_RPC>
```

- `0xef0100<40 hex chars>` (23 bytes) → delegated; the trailing 20 bytes are the delegate. Confirm
  they are BatchExecutor.
- `0x` → not delegated (the authorization was invalid and skipped, per §1.6); nothing to do, but
  work out which validity rule you broke.

**Step 1 — freeze treasury outbound activity.** The authorization is nonce-bound. If any other
transaction from the treasury lands first, the nonce moves and your revocation is silently skipped.

**Step 2 — record the nonce.**

```bash
cast nonce <TREASURY_EOA> --rpc-url <MAINNET_RPC>
```

**Step 3 — sign the revocation authorization with the treasury key.** With Foundry, roughly:

```bash
# --nonce = the value from step 2 (sponsored case: no +1)
cast wallet sign-auth 0x0000000000000000000000000000000000000000 \
  --chain 1 --nonce <NONCE_FROM_STEP_2> \
  --ledger   # or --private-key / --keystore, per your custody setup
```

Verify the exact flag names against your installed `cast` version (`cast wallet sign-auth --help`);
the semantics above are what matters. Equivalent in viem: `signAuthorization({ address: zeroAddress })`,
and if the treasury signs *and* sends, pass `executor: 'self'` so viem applies the `+1`.

**Hardware-wallet caveat:** support for signing 7702 authorization tuples varies by device, firmware,
and Ethereum-app version. If the treasury key lives on a Ledger/Trezor, confirm the device can
actually produce this signature *before* you build the plan around it — this is the most common
place a revocation stalls.

**Step 4 — send the type-4 transaction from the sponsor.**

```bash
cast send <SPONSOR_ADDRESS> --value 0 \
  --auth <SIGNED_AUTH_FROM_STEP_3> \
  --rpc-url <MAINNET_RPC> --ledger   # sponsor's key
```

A type-4 transaction must have a `to` (it cannot be a contract creation) and must carry at least
one authorization. The call target is irrelevant to the revocation — point it at the sponsor itself
with zero value and empty calldata. Do **not** point it at the treasury EOA; there is no reason to
call into that account.

**Gas:** ~21,000 base + ~12,500 for the authorization (25,000 `PER_EMPTY_ACCOUNT_COST` with a
12,500 refund because the authority account already exists) + calldata. Budget ~50,000 and price it
live at send time.

**Step 5 — verify.** Re-run step 0. It must return exactly `0x`. Do not sign off on a receipt
status of `1`; a successful transaction with a skipped authorization looks identical to a
successful revocation from the receipt alone. `cast code` is the only proof.

---

## 3. Two things the reviewer should also weigh

**This is live, permissionlessly reachable, and it is an incident, not a cleanup.** Until step 5
passes, anyone on mainnet can call your treasury EOA and execute BatchExecutor's code in the
treasury's own context — its ETH balance, its storage, and every ERC-20 allowance the treasury
holds or has been granted. "We wrote it off as a no-op" has been false for days. Triage urgency by
whether the critical bug is externally triggerable and whether it can move value; if it can, revoke
before you finish reading the rest of the review.

**Clearing the delegation does not clear storage.** If BatchExecutor wrote to the EOA's storage
slots, those slots persist after the code is cleared. They are inert while the account has no code
— but they reappear under any future delegation. If you ever delegate this EOA to a replacement
batch contract, audit the leftover slots against the new contract's storage layout first, or use a
fresh address.
