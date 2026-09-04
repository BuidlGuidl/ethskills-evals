# Batching and session keys on an existing EOA, keeping the same address

## 1. Is this possible on mainnet today, and what makes it possible?

Yes. It has been live on Ethereum mainnet since **7 May 2025**, when the
**Pectra** upgrade activated (the paired Prague execution-layer / Electra
consensus-layer fork).

The mechanism is **EIP-7702, "Set EOA account code"**. It introduces a new
transaction type, `0x04` (`SET_CODE_TX_TYPE`), which carries an
`authorization_list`. Each entry in that list is a tuple
`(chain_id, address, nonce)` signed by an EOA's own private key over
`keccak(MAGIC || rlp([chain_id, address, nonce]))` with `MAGIC = 0x05`. When the
transaction is processed, the protocol writes a 23-byte **delegation indicator**
into the signing account's code field:

```
0xef0100 || <20-byte address of the delegate contract>
```

The crucial property is what this is *not*. It is not a migration and not a new
account type. The account keeps:

- the same 20-byte address,
- the same secp256k1 private key, which retains full control and can still sign
  ordinary type-0/1/2/3 transactions,
- the same balance, the same nonce sequence, the same storage slots,
- and therefore the same ENS name, the same reverse record, and the same
  onchain history.

It is still an externally owned account. It has simply gained a code field.
Because the address never changes, nothing has to be moved and nothing has to be
re-pointed.

Two operational details worth knowing up front:

- **Someone else can pay.** The authorization signature and the transaction
  signature are independent. A relayer can submit the type-`0x04` transaction
  carrying the user's signed authorization tuple, so a user can opt in without
  spending gas, and even with a zero-ETH balance.
- **`chain_id = 0`** in the tuple makes the authorization valid on every chain
  that supports the feature; a specific chain ID pins it to one chain. Signing a
  delegation with `chain_id = 0` for a contract whose behaviour differs per chain
  is a known footgun, so most production setups pin the chain ID.

## 2. What does the account point at, and how does approve+swap run atomically?

After opting in, `EXTCODESIZE` of the user's address returns 23 and the code is
the `0xef0100 || delegate` pointer described above. The *delegate* is a normal,
already-deployed smart-account implementation — one shared contract that all
users of the app point at; nothing is deployed per user.

When anything calls the user's address, the EVM sees the `0xef0100` prefix,
resolves the pointer, loads the delegate's bytecode, and executes it **in the
context of the EOA**. Semantically it behaves like a permanent, protocol-level
`delegatecall`: throughout execution, `address(this)` is the user's address,
`msg.sender` for any outbound call is the user's address, `SLOAD`/`SSTORE` hit
the *user's* storage, and the ETH spent is the *user's* balance. The delegate
contract itself holds no user state.

The batched swap then works like this:

1. The client builds a call to a batch entrypoint on the delegate — in practice
   the ERC-7821 `execute` shape, taking an array of `(target, value, data)`
   calls:
   - call 1 → the ERC-20 token, `approve(router, amount)`
   - call 2 → the router, `swapExactTokensForTokens(...)` (or the equivalent)
2. That calldata is sent in **one** transaction whose `to` field is the user's
   own address (either signed by the user, or wrapped in a `UserOperation` and
   sent through an ERC-4337 EntryPoint if the app wants sponsorship/bundling).
3. The delegate's `execute` loop performs the two calls in sequence. Since
   `msg.sender` is the EOA itself, the ERC-20 records the allowance **from the
   user's own address**, and the router pulls **the user's own tokens**.

Atomicity is free here: it is a single transaction, so it is a single EVM
execution frame. Either both calls succeed and the whole thing commits, or any
revert unwinds the entire transaction — the allowance is never left dangling
without the swap. That closes the classic "approve landed, swap failed / got
front-run" gap.

**Session keys** come from the same place. Because the delegate's code now runs
as the account, it can define whatever authorization rules the team wants —
e.g. a `sessionKeys` mapping in the account's own storage recording a public
key, an expiry, a spend cap, and an allowlist of selectors and targets. A
validation function checks an incoming signature against that registry instead
of (or in addition to) requiring the root EOA key. The root key stays the
ultimate owner and can revoke any session at will. If the app wants gasless UX
and bundler infrastructure, the same delegate can expose the ERC-4337
`validateUserOp` interface, so the account participates in the 4337 mempool —
but at the user's original address rather than at a new contract wallet address.

## 3. Does it revert to a plain EOA after one transaction?

**No. The delegation is persistent state, not a per-transaction flag.**

The 23-byte pointer is written to the account's code field and stays there
across every subsequent block, exactly like deployed contract code, until it is
explicitly overwritten. Running one batched transaction changes nothing about
it; the account continues to behave as a smart account indefinitely.

To change or remove it, the account owner must **sign a new EIP-7702
authorization tuple** and get a new type-`0x04` transaction including it onchain:

- **To switch implementations:** sign a tuple naming a different delegate
  address. The code field is overwritten with a pointer to the new one. Note
  that the account's **storage is not cleared** by this — the old
  implementation's slots survive, so switching between delegates with
  incompatible storage layouts can corrupt the account. This is why real
  implementations use namespaced/ERC-7201-style storage.
- **To fully revert to a plain EOA:** sign a tuple whose `address` is the zero
  address, `0x0000000000000000000000000000000000000000`. That clears the code
  field entirely and the account is once again an ordinary EOA. Again, existing
  storage is not wiped.

Each authorization must use the account's current nonce and consumes it, so a
signed authorization cannot be replayed, and a fresh signature from the private
key is required for every change. There is no expiry and no automatic teardown —
whoever holds the key must act.

## 4. Why deploying a fresh ERC-4337 wallet per user fails the constraint

An ERC-4337 smart-contract account is a *newly deployed contract*, and its
address is determined by the deployment — typically `CREATE2` from a factory,
i.e. a hash of the factory address, salt, and init code. It is, by construction,
**a different address from the user's EOA**. That single fact breaks the stated
requirement, and the follow-on damage is not repairable by "just moving things":

- **The address changes.** The requirement was explicitly that the address and
  private key survive. A 4337 wallet is a different account controlled by a
  signer, not the same account upgraded.
- **The history does not move.** Balances and NFTs can be transferred; a
  year of transaction history, counterparty relationships, POAPs/attestations,
  airdrop and eligibility snapshots keyed to the old address, protocol-side
  positions and accrued reputation, and anything a third-party contract has
  hardcoded or recorded about that address, cannot. History is bound to the
  address, and there is no primitive that reassigns it.
- **ENS only partly moves, and the pain is external.** You can transfer the name
  and re-point the forward resolution and the reverse record to the new address,
  but every place the *old* address was published — hardcoded allowlists,
  multisig signer sets, off-chain records, other people's address books,
  contracts with an immutable owner field — still points at the abandoned EOA.
- **It is a migration with cost and risk.** Every user must sign and pay for a
  wallet deployment plus a series of asset transfers, and every transfer is an
  opportunity to lose funds, hit an approval that was granted to the old address,
  or strand a position. Users who never complete the flow end up split across two
  addresses.

EIP-7702 exists precisely to avoid all of this. It delivers the same two
capabilities the team wants — atomic batching and programmable authorization
such as session keys — without a new account. It is also not an
either/or with ERC-4337: the delegate an EOA points at can implement the 4337
account interface, so the team gets bundlers, paymasters and sponsored gas *and*
keeps every user on the address, key, ENS name, and history they already have.
