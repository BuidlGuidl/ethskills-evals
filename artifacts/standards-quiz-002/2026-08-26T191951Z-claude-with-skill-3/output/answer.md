# Smart-account features on the EOAs users already have

## 1. Is this possible on mainnet today, and what makes it possible?

Yes. It has been possible on Ethereum mainnet since **7 May 2025**, when the
**Pectra** upgrade activated. The mechanism is **EIP-7702**, which introduces a
new transaction type (**type `0x04`**, the "set code" transaction) carrying a
list of **authorizations**.

The key property — and the reason this fits your constraint exactly — is that
an EOA signs the authorization **with its own private key**. The account is not
replaced, re-created, or converted into a different account type. It remains
the same externally-owned account, at the same address, controlled by the same
key, with its ENS name, balances, approvals, NFTs and full transaction history
intact. EIP-7702 simply gives that existing account the ability to have code
associated with it.

An authorization tuple commits to a chain id, a target implementation address,
and a nonce, and is signed by the EOA. Signing with chain id `0` makes the
authorization valid on every chain, which is worth being deliberate about: it
means the same signature can be replayed to install the delegation on other
networks.

## 2. What does the account point at after opting in, and how does approve+swap
   become atomic?

When a type `0x04` transaction containing the user's authorization is included,
the protocol writes a **delegation designator** into the account's code field:

```
0xef0100 || <implementation contract address>
```

That's 23 bytes — the three-byte `0xef0100` prefix followed by the 20-byte
address of the implementation. The account's code is *not* a copy of the
implementation; it is this short pointer to it.

From that point on, when anything calls the user's address, the EVM resolves
the pointer and **executes the implementation contract's code in the context of
the user's own account**. Storage reads and writes hit the user's account
storage, `address(this)` is the user's address, and token balances and
allowances that move are the user's own. The implementation is shared library
code; the state it operates on is per-user.

So the flow for the batch is:

1. The user signs one EIP-7702 authorization pointing their account at a batch
   executor implementation (a smart-account contract exposing something like
   `execute(Call[] calls)` — the ERC-7821 minimal batch-executor interface is
   the common shape, and it's what most 7702-ready wallet implementations use).
2. A single transaction calls the user's own address with a batch of two calls:
   `approve(router, amount)` on the ERC-20, then `swap(...)` on the router.
3. Because both calls happen inside one top-level transaction executing from
   the user's address, they are **atomic**: either the approve and the swap
   both land, or the whole transaction reverts and neither does. There is no
   window between them where a dangling allowance sits on the account, and no
   possibility of the approve succeeding while the swap fails.

Both onchain actions have `msg.sender == the user's own address`, so the
router, the token contract, and any indexer see the user's year-old address
doing the swap — not a new contract wallet acting on their behalf.

The **session keys** requirement is satisfied the same way. Authorization logic
lives in the implementation, so it can validate a signature from a scoped
session key (limited to certain selectors, targets, spend caps, or an expiry)
instead of requiring the root EOA key for every action. That validation runs
against storage held in the user's own account, so each user has their own
session-key set while all users share one implementation address.

The user also isn't stuck with the ordinary transaction flow: since calls are
dispatched by the implementation, a relayer can submit the type `0x04`
transaction and pay gas, letting the batch be sponsored while the user only
signs.

## 3. Does it revert to a plain EOA after one batched transaction?

**No.** The delegation **persists**. The designator is written into the
account's code field as ordinary account state — it is not scoped to a single
transaction and does not expire, wear off, or auto-clear when the batch
finishes. The account keeps behaving as a smart account for every subsequent
call, indefinitely, until the user changes it.

Two things, and only these, change it — and both require a **new type `0x04`
transaction carrying a fresh authorization signed by the same EOA key**:

- **Re-point it:** authorize a different implementation address. The new
  designator overwrites the old one, and the account starts executing the new
  implementation's code.
- **Remove it:** authorize the **zero address** (`0x0000…0000`). This clears the
  designator, the code field goes empty, and the account is a plain EOA again
  with nothing else about it altered.

Each new authorization must use the account's current nonce, which is what
prevents an old authorization from being replayed to reinstate a delegation the
user has since removed. Nothing a third party does can change or revoke the
delegation — only a signature from the account's own key can.

One consequence worth designing around: because the delegation sticks, the
implementation contract is permanently in the trust path for every user who
points at it. It should be immutable or governed conservatively, and audited on
that basis. Storage layout matters too — if you ever migrate users to a new
implementation, the new one inherits whatever the old one wrote into each
user's account storage, so layouts must be kept compatible.

## 4. Why the "fresh ERC-4337 wallet per user" proposal fails the constraint

ERC-4337 is real, live, and widely deployed, and it delivers batching, session
keys and sponsored gas perfectly well. But it delivers them **at a smart
contract account, which is a newly deployed contract at a new address**. That
is precisely the thing the requirements rule out.

Concretely, the teammate's plan breaks on:

- **The address changes.** The whole premise is that users keep the address
  they've held for a year. A 4337 wallet is a different account with a
  different address; nothing can make the existing EOA *become* it.
- **ENS must be re-pointed, and reverse resolution re-established.** The name
  would have to be transferred and its resolver record updated to the new
  address, and the reverse record re-set there. Anyone with the old address
  cached, or any contract with it hardcoded, is now pointing at the wrong
  place.
- **The history doesn't move.** Onchain history is attached to the address that
  produced it. A new account starts empty — no transaction record, no
  attestations, no reputation, nothing that references the old address as a
  counterparty. Assets can be transferred; provenance cannot.
- **It's a lossy, risky migration.** Every token balance, NFT, LP position,
  staking position, vesting/airdrop claim keyed to the old address, and every
  existing approval would need to be moved or re-created — user by user, paying
  gas, with each step a chance to strand assets or fall out of the funnel.
  Anything keyed to the old address by a third party (an airdrop allocation, a
  whitelist, a DAO membership) may simply not be transferable at all.

EIP-7702 exists specifically because this migration problem was the blocker for
account abstraction reaching users who already have EOAs. It gives the existing
account the same capabilities without moving anything.

The one place the teammate's instinct is still useful: 7702 and 4337 are not
competitors. An EOA can delegate to an implementation that is itself a
4337-compatible account, so it can be driven through the same bundler,
paymaster, and userop infrastructure — while still being the user's original
address. That's the way to keep the 4337 tooling investment without giving up
the address.

## Recommendation

Ship EIP-7702. It is the only option that satisfies "same address, same private
key, same ENS, same history" while providing atomic batching and custom auth,
and it has been available on mainnet since 7 May 2025.

Practical notes for the rollout:

- Pick a well-audited, immutable batch-executor / smart-account implementation
  rather than writing one. Whatever you deploy is load-bearing for every user
  forever.
- Decide deliberately whether authorizations are signed with the real chain id
  (mainnet only) or chain id `0` (replayable on every chain). For a mainnet-only
  consumer app, scope to mainnet.
- Build the "delegate to the zero address" path into the product from day one,
  so users have a clean way to return to a plain EOA.
- Users can opt in with a single signature, and the opt-in transaction can be
  sponsored — so onboarding costs them neither gas nor a migration.
