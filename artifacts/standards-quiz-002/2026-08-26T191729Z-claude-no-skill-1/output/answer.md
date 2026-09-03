# Upgrading existing EOAs in place: batching + session keys without changing addresses

## 1. Is this possible on mainnet today, and what makes it possible?

**Yes.** The mechanism is **EIP-7702 ("Set EOA account code")**, which shipped in the
**Pectra** upgrade (the paired Prague execution-layer / Electra consensus-layer fork).
Pectra activated on **Ethereum mainnet on 7 May 2025** (epoch 364032, ~10:05 UTC). It has
been live for roughly a year and a half, so this is production behavior, not a roadmap item.

What EIP-7702 changes is small but decisive: it makes the `code` field of an
externally-owned account writable by the account's own key. Before Pectra, an account was
permanently either an EOA (key, nonce, balance, *empty code*) or a contract (code, no key).
EIP-7702 breaks that split. An EOA can now carry code **without ceasing to be an EOA** — it
keeps the same address, the same private key, the same nonce sequence, the same balance, the
same ENS reverse/forward records, and the same onchain history. There is no redeployment, no
migration, no new address. The account is not converted into a "smart contract account" in
the ERC-4337 sense; it is an EOA that has *delegated* what happens when it is called.

The delivery vehicle is a new transaction type, **type `0x04` (set-code transaction)**. It
carries an `authorization_list`, where each entry is a tuple `(chain_id, address, nonce)`
**signed by the EOA's own private key**. That signature is the only authority required — no
one can install code on an account they don't hold the key for. The signed authorization can
be relayed and paid for by someone else, so the team can sponsor the opt-in and a user with
zero ETH can still upgrade. A `chain_id` of `0` makes the authorization valid on every chain
that honors it; a specific `chain_id` pins it to mainnet only. The `nonce` field binds the
authorization to a point in the account's history so it cannot be replayed later.

## 2. What does the account point at after opt-in, and how does approve+swap run atomically?

**After opt-in the account's code field holds a 23-byte delegation indicator: the three-byte
prefix `0xef0100` followed by the 20-byte address of a delegate contract.** That is the
entire content of the account's code — the account does not receive a copy of the
implementation, it stores a pointer to it.

From then on, whenever the account is called, the EVM sees the `0xef0100` prefix, resolves
the pointer, loads the delegate's bytecode, and **executes it in the context of the user's
own account**. Inside that execution:

- `address(this)` is the user's address,
- `msg.sender` semantics, balance, and **storage** all belong to the user's account, not the
  delegate,
- token balances and approvals held by the address remain exactly where they were.

The delegate is a shared, already-deployed implementation — every user in the app points at
the same one. It is a library of behavior, not a per-user wallet. (Because storage is the
*user's*, well-built delegates use namespaced storage slots so that re-delegating to a
different implementation later doesn't collide with leftover state.)

The delegate exposes a batch-execution entrypoint — conventionally an `execute` function
taking a list of `(target, value, calldata)` calls, gated so that only the account itself or
an authorized key may invoke it. The approve+swap then works like this:

1. The user (or a relayer with a signed payload) sends one transaction **to the user's own
   address**, calling `execute([...])`.
2. Call 1 in the batch: `approve(router, amount)` on the ERC-20 — and because the code runs
   as the user's account, the approval is granted *by the user's address*, exactly as it
   would be from a normal EOA transaction.
3. Call 2 in the batch: `swap(...)` on the router, also `msg.sender == user`. The router sees
   the allowance that call 1 just set.
4. Both calls live inside a single transaction. If the swap reverts, the whole transaction
   reverts, including the approve. There is no window in which a dangling allowance exists,
   and no possibility of the approve landing while the swap doesn't. That is the atomicity
   the team wants.

The very first batch can be done in one shot: a single type-`0x04` transaction can carry the
authorization *and* a call into the freshly delegated account, so the user's first upgraded
action is also their opt-in.

**Session keys** fall out of the same property. Because a call to the account now executes
contract logic, the delegate can implement arbitrary validation: register a secondary key
with a scope (allowed target contracts, allowed selectors, spend caps, an expiry), and let
that key authorize batches by signature without the root key being present. The app's backend
can hold or relay such a key and submit user actions. If the team also wants gasless
relaying over a shared infrastructure rather than their own relayer, the delegate can be an
**ERC-4337-compatible account implementation** — the current EntryPoint explicitly supports
7702-delegated EOAs, so the account can be driven through the account-abstraction mempool and
paymasters *while still being the user's original address*. 7702 and 4337 are complementary
here; 4337 is only incompatible with the constraint when used the way described in question 4.

One caveat worth stating to the team plainly: the root private key is still the root
authority over the account. It can always sign a plain transaction that moves funds, and it
can always re-delegate. Session-key policies constrain the session key, not the owner key.

## 3. Does the delegation revert after one transaction?

**No. It is persistent state, not a per-transaction flag.** The `0xef0100 || address` pointer
is written into the account's `code` field in the state trie and stays there indefinitely —
across that transaction, across every later transaction, across restarts, across forks. One
batched transaction changes nothing about it. This is the intended design: the user opts in
once and the account keeps its new behavior.

To change or remove it, **the account's own key must sign a new EIP-7702 authorization** (in
a new type-`0x04` transaction) — there is no other way, and no expiry:

- **To re-point it** (upgrade to a different implementation, switch wallet vendors): sign an
  authorization naming the new delegate address. The code field is overwritten with a pointer
  to the new contract. Note that the account's *storage is not cleared* by this — the new
  implementation inherits whatever the old one wrote, which is why namespaced storage matters.
- **To remove it entirely and go back to a plain EOA**: sign an authorization naming the
  **zero address** (`0x0000...0000`). This clears the code field to empty, and the account is
  once again an ordinary EOA with no code. Again, prior storage written under the old
  delegation is not wiped by this step.

Each authorization must use a valid, current nonce for the account, so old authorizations
can't be dredged up and replayed to silently re-delegate someone later.

## 4. Why deploying a fresh ERC-4337 wallet per user fails the constraint

ERC-4337 is account abstraction implemented **entirely above the protocol** — it does not and
cannot modify an existing account. A 4337 account is an ordinary smart contract that must be
*deployed*, and a deployed contract's address is derived from its deployer and salt (or
deployer and nonce). It is, by construction, **a different address from the user's EOA**.
There is no deployment path that lands a contract at an address that already has a nonce and
a balance from a year of EOA use.

So the teammate's plan is not an upgrade — it is a migration to a new account, and it breaks
every element of the stated requirement:

- **The address changes.** The requirement is explicitly that the address survive. It doesn't.
- **The private key relationship changes.** The user's key becomes an *owner/signer key
  controlling a separate contract*, not the key that *is* the account.
- **ENS must be moved, and moving it isn't free or complete.** The name's registrant/controller
  and its forward resolution record have to be transferred and re-pointed to the new address,
  each requiring transactions and each a chance to be done wrong. The reverse record must be
  re-set from the new account. Any third party that cached or hardcoded the old resolution, and
  anyone who resolves the old address, now sees a mismatch.
- **History does not move at all.** Onchain history is a property of an address. Transaction
  history, attestations, POAPs/NFTs bound to the address, reputation and airdrop eligibility
  scored on the old address, allowlists and KYC records maintained by counterparties keyed to
  that address, DAO voting history and delegations — none of it transfers. Transferable assets
  can be re-sent one by one (a long, error-prone, gas-consuming per-user exercise, with tokens
  that are soulbound or non-transferable simply lost); *history itself is not transferable in
  principle*.
- **It's an active migration burden.** Every user must be persuaded to move funds, re-approve
  every protocol they use, and update anything that references them — the exact user-facing
  cost the team ruled out.

The distinction in one line: **ERC-4337 gives you a new account with smart-account powers;
EIP-7702 gives smart-account powers to the account you already have.** Only the second one
satisfies "same address, same key, same ENS, same history."

If the team wants 4337's infrastructure — bundlers, paymasters, sponsored gas — they don't
have to choose. Delegate the existing EOA (via 7702) to a 4337-compatible account
implementation. The account then speaks the account-abstraction protocol and can be driven
through the shared mempool, while remaining the user's original, funded, ENS-named address.
That is the recommended path.
