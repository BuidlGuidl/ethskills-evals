# Upgrading existing EOAs in place: batching + session keys, same address, same key

## 1. Is this possible on mainnet today, and what makes it possible?

Yes. It has been live on Ethereum mainnet since **7 May 2025**, when the
**Pectra** upgrade (the paired Prague execution-layer / Electra consensus-layer
fork) activated at epoch 364032, around 10:05 UTC.

The mechanism is **EIP-7702 — "set code for EOAs"** — and the new transaction
type it introduces, **type `0x04`** (the "set-code" transaction). A type-`0x04`
transaction carries an `authorization_list`: a list of tuples
`(chain_id, address, nonce, y_parity, r, s)`. Each tuple is signed **by the EOA's
own private key** over `keccak256(0x05 ‖ rlp([chain_id, address, nonce]))`. When
the transaction is processed, the protocol recovers the signer ("the authority")
and writes a **delegation indicator** into that account's `code` field:

```
0xef0100 ‖ <20-byte implementation address>     // 23 bytes total
```

Three things matter about this:

- **The account does not change type.** It is still an EOA. Nothing is deployed
  at a new address; no contract is created; the address and the private key are
  untouched. The only thing that changed is that the account's previously-empty
  `code` field now holds a 23-byte pointer. The key still signs ordinary
  transactions from that account exactly as it did yesterday, and the account
  still pays for and originates its own transactions.
- **The pointer is resolved on call.** When anything *calls* the address, the
  EVM follows the `0xef0100` indicator, loads the code at the implementation
  address, and executes it **in the context of the EOA**: `address(this)` is the
  EOA, storage reads and writes hit the *EOA's* storage slots, and the balance
  spent is the EOA's balance. The implementation contract is a shared code
  template, not the account.
- **The authority signs its own authorization, but need not send it.** The
  type-`0x04` transaction can be submitted and paid for by a relayer or sponsor;
  only the authorization tuple has to be signed by the user's key. The
  authorization's `nonce` field must equal the authority's current account nonce,
  and applying it bumps that nonce by one. `chain_id = 0` makes an authorization
  valid on every chain; a specific chain id scopes it to one.

Because the address never changes, the ENS forward record, the reverse record,
every allowlist entry, every attestation, and the whole transaction history
continue to refer to the same account. There is nothing to migrate.

The `0xef` prefix is deliberate: EIP-3541 has banned contract code starting with
`0xef` since London, so a delegation indicator can never collide with real
deployed bytecode, and clients can recognise it in a single byte check.

## 2. What does the account point at after opt-in, and how does approve+swap run atomically?

After opting in, the user's account holds `0xef0100 ‖ IMPL`, where `IMPL` is the
address of a **delegate implementation contract** the team chooses — in practice
a smart-account implementation exposing a batch-execute entry point and a
pluggable validation layer. The common shapes in production are ERC-7821-style
minimal batch executors and ERC-7579 modular accounts; several vendor
implementations (modular account kernels, wallet-vendor delegators, Safe's 7702
module) are already deployed and audited on mainnet. The account "points at"
exactly one such implementation at a time.

The flow for the approve+swap:

1. The user signs an authorization tuple naming `IMPL`. This can be bundled into
   the *same* type-`0x04` transaction as the first batch: the
   `authorization_list` is applied **before** the transaction's own call frame
   executes, so a type-`0x04` transaction whose `to` is the signer's own address
   will already run the freshly delegated code. Opt-in and first batch are one
   transaction.
2. The transaction's calldata targets the implementation's batch entry point,
   e.g. `execute([{to: USDC, data: approve(router, amount)},
   {to: router, data: swap(...)}])`.
3. The delegated code runs *as the EOA*. Each inner call is a `CALL` made by the
   EOA, so `msg.sender` seen by the ERC-20 is the user's own address: the
   allowance is granted by the user's account, and the router pulls the user's
   own tokens.
4. Atomicity is just EVM transaction semantics. Both calls live in one
   transaction; the implementation bubbles up any inner revert, so either both
   the approve and the swap land or neither does. There is no window in which a
   dangling approval exists without the swap having executed.

**Session keys** come from the same place. Because the delegated code executes
against the EOA's own storage, the implementation can keep a registry of
authorized session keys in that storage — each entry scoped by expiry, spend
cap, allowed target contracts and selectors. A session key then signs a payload,
anyone relays it to the account, and the delegated validation logic checks the
signature against the registry instead of requiring the root key. That is the
"custom auth logic" requirement, and it lives entirely inside the user's
existing account.

If the team also wants bundler and paymaster infrastructure, the two approaches
compose rather than compete: an ERC-4337 EntryPoint (v0.8 onward) explicitly
supports 7702-delegated accounts, so the same delegated EOA can expose
`validateUserOp` and be driven as a UserOperation. Alternatively the team can
sponsor plain type-`0x04` transactions directly, since the relayer pays gas and
only the authorization needs the user's signature.

## 3. Does it revert to a plain EOA after one transaction?

**No.** The delegation is **persistent account state**, not a per-transaction
flag. The 23-byte indicator is written into the account's `code` field and stays
there across every subsequent block until it is explicitly changed. One batched
transaction, a thousand batched transactions, or none — the delegation is
unaffected. This is exactly what makes it usable as a durable account upgrade
rather than a one-shot trick.

To change or remove it, the account must sign **another EIP-7702 authorization**,
carried in a new type-`0x04` transaction:

- **To point at a different implementation** (upgrade, or switch vendors): sign
  an authorization naming the new implementation address. It overwrites the old
  indicator. An account has exactly one delegate at a time; there is no stacking.
- **To remove the delegation entirely** and return to a bare EOA: sign an
  authorization naming the **zero address** (`0x0000...0000`). The protocol
  treats this as the clear case and resets the account's code to empty.

In both cases the authorization's `nonce` must match the account's current
nonce, and the signature must come from the account's own key — nobody else can
re-delegate or clear it. The transaction carrying the authorization can still be
submitted and paid for by a relayer.

Two consequences worth designing around:

- **Storage is not cleared.** Removing or replacing a delegation wipes the code
  pointer, not the storage slots the old implementation wrote. Stale state — old
  session keys, old owner sets — remains and could be misread by a future
  implementation with a different storage layout. Use namespaced/ERC-7201-style
  storage, and clear sensitive state deliberately before re-delegating.
- **The root key is always supreme.** Since the key can re-delegate or clear at
  any time, session-key restrictions bind the session key, not the owner. The
  user's key remains a single point of compromise, and delegating to a malicious
  or buggy implementation can drain the account in one signature — so
  implementation choice and the opt-in UX are the security-critical surface here.

## 4. Why a fresh ERC-4337 wallet per user does not satisfy the constraint

The teammate's proposal fails on the one requirement that was stated as
non-negotiable: **the address must survive.** An ERC-4337 smart-contract account
is a genuinely new contract at a new address — determined by the factory,
implementation and salt via CREATE2 — controlled by an owner key. It is not the
user's account upgraded; it is a different account that the user's key happens to
control. Specifically:

- **The address changes.** Everything keyed on the address breaks by definition.
  The ENS name can be re-pointed to the new contract, but that is exactly the
  "migrate to a new address" outcome the team ruled out, and it silently breaks
  any third party that cached, hardcoded, or attested to the old address.
- **History does not move.** Onchain history is an immutable property of an
  address. A year of transactions, counterparty relationships, and any reputation
  or scoring derived from them stays with the old EOA. The new contract starts at
  zero.
- **Some things cannot move at all.** Soulbound and non-transferable tokens,
  POAPs, attestations bound to the subject address, allowlist and airdrop
  eligibility snapshots already taken against the old address, locked or vesting
  positions, and governance delegation history are either untransferable or would
  have to be re-earned.
- **The migration itself is expensive and unsafe.** It is a multi-transaction,
  non-atomic per-user process — transfer each ERC-20, each NFT, the ENS name and
  its resolver records, unwind and rebuild every position — paid for by the user,
  with partial-failure states in the middle and a permanent risk of assets later
  arriving at the abandoned address.
- **The old EOA does not go away.** It remains a live, fully functional EOA with
  the same private key. Anything sent to it afterwards is stranded until manually
  swept, so the team now supports two addresses per user indefinitely.

The core distinction: ERC-4337 is an *application-layer* standard that routes
operations to accounts that are already contracts — it never had a way to turn an
existing EOA into one, which is why it required new addresses. EIP-7702 is a
*protocol-layer* change that lets an existing EOA point at contract code while
remaining the same account. Only the second one satisfies "same address, same
private key, keep the ENS name and the history."

Notably, choosing 7702 does not mean giving up 4337 — a 7702-delegated EOA can
implement the 4337 account interface and be driven through EntryPoint v0.8 with
the usual bundlers and paymasters. So the team gets the 4337 tooling the
teammate wants, at the user's existing address.
