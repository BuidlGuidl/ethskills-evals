# EIP-7702 delegation after a reverted batch — is it still live, and how to clear it

**Short answer: yes, almost certainly still delegated. The revert did not undo it.**
Retiring the BatchExecutor contract does nothing to the delegation either. The only
way out is a second EIP-7702 transaction carrying a fresh authorization that names
the zero address.

Treat this as live exposure, not a paperwork item — see "Why this is urgent" below.

---

## 1. Is the EOA still delegated?

Yes.

### Why the revert is irrelevant

A type-0x04 (set-code) transaction has two distinct stages, and they are not in the
same failure domain:

1. **Authorization-list processing.** After the transaction's own validity checks and
   before the top-level call begins, the client walks `authorization_list`. For each
   valid tuple it recovers the authority, checks the chain id and the nonce, then
   writes the delegation indicator — the 23 bytes `0xef0100 || <delegate address>` —
   as that account's **code**, and bumps the authority's nonce.
2. **Execution.** Only then does the EVM enter the top-level call frame.

A `REVERT` unwinds state changes made *inside* the execution frame. The delegation
was written in stage 1, outside and before any frame. There is nothing for the revert
to roll back. The transaction was mined, so stage 1 committed. Two corroborating
details from the spec's design: invalid authorizations are *skipped*, not treated as
transaction failures, and the per-authorization gas is charged whether or not the call
later succeeds. The authorization is deliberately decoupled from the call's outcome.

So "the batch reverted" tells you nothing about the delegation, and "we wrote it off
as a no-op" is the wrong model. The transaction did exactly one thing successfully:
it re-pointed your treasury EOA's code at BatchExecutor.

### Why time and the contract's retirement are irrelevant

- The delegation indicator is **account state**, the same as a balance or a nonce. It
  has no expiry, no block-count decay, and no scope to the transaction that set it. It
  persists until something overwrites it.
- Nothing has been sent from the EOA since, and you say no other authorizations exist,
  so nothing has overwritten it. Days later it reads exactly as it did in that block.
- Decommissioning BatchExecutor does not help. The indicator stores an **address**, not
  code. Deleting or abandoning the contract at that address leaves the pointer intact;
  the EOA is still a delegated account, just one now pointing at (possibly) empty code.
  The delegate cannot remove its own delegation, and no action by the delegate contract
  can.

### The one thing worth verifying

The revert is not evidence either way, but there is a separate scenario in which there
would be nothing to revoke: the authorization tuple itself could have been **invalid**
and silently skipped — wrong `chain_id`, or a `nonce` that did not match the account's
nonce at processing time. That failure mode is silent by design and would look
identical from the receipt.

Settle it by reading the code at the address. This is definitive and takes one call:

```bash
cast code <TREASURY_EOA> --rpc-url <MAINNET_RPC>
```

- `0xef0100<20-byte address>` → delegated. Compare the trailing 20 bytes to
  BatchExecutor's address (case-insensitively).
- `0x` → not delegated; the authorization never landed and there is nothing to clear.

Equivalent raw call: `eth_getCode(address, "latest")`.

I don't have the EOA address or an RPC endpoint here, so I can't run this for you —
give me both and I will. Absent that, the reasoning above is what you should expect the
result to be: delegated.

---

## 2. How to remove the delegation

**Send a new EIP-7702 transaction containing an authorization from the treasury EOA
that names `0x0000000000000000000000000000000000000000`.** That is the only mechanism.
Assigning the zero address is the specified reset: the client clears the account's
code entirely rather than writing an indicator, and the account goes back to being a
plain EOA.

There is no revocation opcode, no expiry to wait out, no call you can make to
BatchExecutor, and no way to do it without a signature from the treasury key.

### The authorization tuple

Sign `(chain_id, address, nonce)` with the treasury key:

| Field | Value |
|---|---|
| `chain_id` | `1` (mainnet). Prefer `1` over the wildcard `0` — a `0` authorization is replayable on every chain, which is not something you want lying around, even for a revocation. |
| `address` | `0x0000000000000000000000000000000000000000` |
| `nonce` | The authority's account nonce **at the moment the tuple is processed** — see the trap below. |

### The nonce trap

This is where these transactions most often silently no-op. Note that the reverted
transaction already consumed one nonce for the authorization *and* one for the
transaction, so do not work from stale numbers — read the current nonce fresh.

- **Sponsored (a different EOA pays and sends the type-4 tx):** the treasury's nonce is
  untouched by the sponsor's transaction, so `auth.nonce = current nonce of the treasury EOA`.
- **Self-sent (the treasury EOA is also the transaction sender):** the transaction's own
  nonce is consumed first, then the authorization list is processed. So
  `auth.nonce = current nonce + 1`.

Get it wrong and the tuple is skipped in silence: the transaction mines, the receipt
looks fine, and the delegation is still there. Which is precisely the trap you already
walked into once.

### Procedure

1. Read the current nonce: `cast nonce <TREASURY_EOA> --rpc-url <RPC>`.
2. Sign the authorization for `0x0` with the treasury key, chain id `1`, nonce per the
   rule above. (`cast wallet sign-auth 0x0000000000000000000000000000000000000000
   --chain 1 --nonce <N> ...`, or your signer's 7702 equivalent — the treasury key must
   sign this itself; no other key can revoke on its behalf.)
3. Send a type-0x04 transaction carrying that authorization. The call payload can be
   inert — sending to the zero address or to the EOA itself with empty calldata is fine.
   **Do not route the call through BatchExecutor.** The delegation is applied before
   the call executes, so you do not need the call to do anything, and you do not want
   buggy code touching your account on the way out.
4. **Verify after mining.** `cast code <TREASURY_EOA>` must return `0x`. Do not trust
   the receipt's status — a `success` status would not have told you anything, and a
   revert would not have either. Only the code read is proof.

Sponsoring from a separate EOA is the cleaner option here: it keeps the nonce
arithmetic simple (no `+1`) and means the treasury key only ever produces one
signature, over an authorization, with no gas or transaction handling attached.

---

## Why this is urgent, and two things to do alongside

**The delegation is live right now.** While it stands, BatchExecutor's code executes
in your treasury EOA's context, with the EOA's balance and its token approvals, and
**anyone can call the EOA to trigger it** — a delegated account is callable by any
address on the network. If the "critical bug" you found is reachable by an arbitrary
caller (a missing owner check on the batch entrypoint is the classic shape here), your
treasury is exposed to anyone who reads the bytecode. The gap between now and the
revocation transaction is your window of exposure.

So: assess whether the bug is externally reachable before anything else. If it is, or
if you can't tell quickly, move the funds and revoke the outstanding ERC-20 approvals
first and treat the revocation as an incident response, not a sign-off checkbox.

Two follow-ups for the reviewer:

- **Clearing the delegation does not clear storage.** If BatchExecutor wrote to storage
  slots while running as the EOA, those slots stay in the account after the code is
  cleared. They are inert for a plain EOA, but if you ever delegate this same address
  to a *different* contract later, that contract inherits the leftover slots and may
  reinterpret them under its own layout — a real footgun for a wallet that expects a
  fresh account. Audit the slots before any future re-delegation, or use a fresh
  address for the replacement batcher.
- **Don't rely on the contract's address being dead.** The indicator points at an
  address, and it will keep pointing there. Revoke it; don't reason about who might
  occupy that address later.
