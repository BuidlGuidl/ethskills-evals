# Smart accounts for existing EOAs, same address and key

## 1. Is this possible on mainnet today?

Yes, and it has been for over a year.

The mechanism is **EIP-7702**. It lets an account that already exists as an EOA
execute contract code without ever becoming a different kind of account. The EOA
signs an **authorization with its own private key** — carried in a new
transaction type, `0x04` — and that authorization writes a small **delegation
designator** into the account's code slot: the three-byte prefix `0xef0100`
followed by the address of an implementation contract. The account is still the
same account, controlled by the same key; it now simply has code.

It shipped in the **Pectra** network upgrade, live on Ethereum mainnet on
**2025-05-07**. Nothing here is a testnet-only or roadmap item — it is in the
protocol on mainnet now.

Crucially for this team: the address does not change, the private key does not
change, and therefore the ENS name and the full onchain history stay attached to
exactly the same account.

## 2. What does the account point at after opt-in, and how does approve+swap run
atomically?

After a user opts in, their account's code is the 23-byte designator
`0xef0100 || <implementation address>`. That is a pointer, not a copy of the
logic — the account "points at" whatever smart-account implementation the team
chose (a batching/session-key wallet contract). The user's balances, nonce,
ENS reverse record and history are untouched; the only thing added is this
delegation.

From then on, when anything calls the user's address, the EVM loads the code at
the implementation address and runs it **in the context of the user's own
account** — the implementation's storage and `msg.sender` for its outbound calls
are the user's address, not the implementation's.

So an approve + swap works like this: the app builds a batch of two calls —
`approve(router, amount)` on the ERC-20, then `swap(...)` on the router — and
submits it to the user's own address as a single call into the delegated
implementation (typically an `execute`-style batch entrypoint). The
implementation loops over the batch and issues both calls itself. Because both
happen inside one transaction, they either both succeed or the whole transaction
reverts — atomic by construction, with no window where the approval is live but
the swap hasn't landed. The token sees the approval coming from the user's
address, and the router sees the swap coming from the user's address, because it
*is* the user's address executing.

The same delegation is what enables session keys: the implementation can run any
custom authorization logic it likes — validating a signature from a scoped,
time-limited session key against rules held in the account's own storage — and
authorize a call on that basis instead of requiring the root key each time.
Gas sponsorship falls out of this too, since the type `0x04` transaction that
carries the batch can be submitted and paid for by someone other than the
account itself.

## 3. Does it revert to a plain EOA after one transaction?

No. **The delegation persists.** It is a property of the account's state, not a
per-transaction flag, and it does not expire, decay, or unwind when the batched
call finishes. Running one batched transaction changes nothing about it — the
account keeps its smart-account behavior indefinitely, across any number of
later transactions.

Changing or removing it requires an explicit, deliberate act: **a new
authorization signed by the account's own key.**

- To **change** the behavior, sign a new authorization naming a different
  implementation address. It overwrites the previous designator.
- To **remove** it and return to a plain EOA, sign an authorization delegating
  to the **zero address**. That clears the code from the account, and it behaves
  as an ordinary EOA again.

Either way, only the account's own key can do it, and nothing happens
automatically. This should be treated as a design fact, not a nuisance: the team
must ship a working "revoke" path, and must understand that a buggy or malicious
implementation stays authoritative over the account until it is explicitly
replaced or cleared.

## 4. Why the "fresh ERC-4337 wallet per user" proposal fails

ERC-4337 is a real, widely deployed standard and it does deliver batching,
sponsored gas and custom auth. But it delivers them **at a new address**: a
4337 account is a freshly deployed contract, and its address is determined by
the deployment (factory, implementation, salt), not by the user's existing key.
It is a different account that the old key merely controls.

That collides head-on with the stated constraint, in three ways:

- **The address changes.** Every integration, allowlist, counterparty record and
  bookmark keyed to the old address now points at the wrong account.
- **The ENS name does not follow automatically.** It has to be re-pointed to the
  new address, and the reverse record re-set from the new account — and the name
  is only as portable as its ownership; anything else the old address held has to
  be moved by hand too.
- **The history does not move at all.** A year of onchain activity is bound to
  the old address permanently. The new contract account starts empty, with no
  track record — which is precisely what the users' reputation, airdrop
  eligibility and any history-based checks rely on.

The proposal also implies exactly what was ruled out: a migration where every
user must actively move funds and assets across, with the attendant drop-off,
gas cost and risk of stranded balances.

EIP-7702 exists to avoid this trade. It gives the same capabilities to the
account the user already has, so there is no migration to run and nothing to
leave behind. Deploying new accounts is the right answer only when a brand-new
address is acceptable; here it is explicitly not.
