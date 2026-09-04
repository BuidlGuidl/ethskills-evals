# Giving existing EOAs batching and session keys — same address, same key

## 1. Is this possible on mainnet today?

Yes. The mechanism is **EIP-7702**, and it shipped in the **Pectra** upgrade, which
went live on Ethereum mainnet on **2025-05-07**.

EIP-7702 introduces a new transaction type (`0x04`) that carries a list of
*authorizations*. An EOA signs an authorization **with its own private key**,
naming an implementation contract. Processing that authorization writes a
**delegation designator** into the account's code field: the 23-byte value
`0xef0100 || <implementation address>`.

The important part for this team's constraint: the account is not replaced,
re-created, or converted into a different account type. It is still the same
EOA, at the same address, controlled by the same private key, with the same
nonce, balance, ENS reverse record and full transaction history. It has simply
gained a code pointer. The key still signs; nothing about the user's identity
onchain changes.

## 2. What does the account point at after opting in, and how does approve+swap
   become atomic?

After the authorization is included, `eth_getCode(userAddress)` returns
`0xef0100…` followed by the implementation contract's address. That's a pointer,
not a copy — no bytecode is duplicated into the account. Every user delegating
to the same implementation shares one deployed contract.

When anyone sends a call to the user's address, the EVM sees the delegation
designator, loads the implementation's code, and executes it **in the context of
the user's account**: `address(this)` is the user's address, storage reads and
writes hit the user's account storage, and `msg.sender` for any onward call is
the user's address.

So the approve+swap works like this. The implementation exposes a batch-execute
entry point — typically an array of `(target, value, calldata)` operations, e.g.
the ERC-5792 / ERC-7821-style `execute` shape that most of the deployed
implementations converged on. One call into the user's address with two
operations:

1. `USDC.approve(router, amount)`
2. `router.swapExactTokensForTokens(...)`

Both run inside a single top-level transaction, both with `msg.sender ==
userAddress`. The router sees the allowance the user's own account just granted,
and the tokens move from and to the user's own address. It's atomic in the
ordinary EVM sense — one transaction, one revert boundary: if the swap reverts,
the approve is rolled back with it, so there is no dangling allowance and no
window between the two steps.

Session keys come from the same place. Because the implementation's code now
executes as the account, the implementation defines what counts as valid
authorization — it can maintain a registry of session keys in the account's
storage, each scoped to a contract, selector, spend cap and expiry, and validate
a signature from one of those keys instead of requiring the root EOA key. The
root key remains the ultimate authority (it can always sign a new authorization
and swap or revoke the implementation), but day-to-day actions can be signed by
a delegated session key.

Two operational notes worth building around:

- The authorization can be sponsored. The type `0x04` transaction that carries
  the authorization does not have to be sent by the user — a relayer can submit
  it and pay the gas, so a user with an unfunded-for-gas balance can still opt
  in. The authorization itself is signed by the user's key; the outer
  transaction is signed by whoever pays.
- An authorization is bound to a chain id and a nonce. `chainId = 0` means
  "valid on any chain"; a specific chain id restricts it. Choose deliberately —
  a chain-agnostic authorization delegates the same address on every EVM chain.

## 3. Does it revert to a plain EOA after one batched transaction?

No. **The delegation persists.** It is account state, not transaction state.
Once written, the designator stays in the account indefinitely — across any
number of subsequent transactions, from any sender, until it is explicitly
changed. It does not expire, does not consume itself on use, and does not
auto-revert when the batched call finishes.

To change or remove it, the EOA must sign **another** authorization with its own
key, included in another type `0x04` transaction:

- **To change implementation:** authorize a different implementation address.
  The designator is overwritten to point at the new contract.
- **To remove it entirely:** authorize the **zero address**
  (`0x0000000000000000000000000000000000000000`). That clears the delegation and
  the account is a plain EOA again, code field empty.

Two consequences the team should design for. First, because the delegation
outlives any single transaction, the implementation contract is permanently
trusted with the account — its storage layout and upgrade path matter as much as
a wallet's. Migrating between implementations that use different storage layouts
can strand or misinterpret existing storage, so treat a change of implementation
as a real migration, not a config toggle. Second, revocation requires the root
key. If session keys are the only thing a user still has access to, they cannot
undelegate.

## 4. Why deploying a fresh ERC-4337 wallet per user fails the constraint

ERC-4337 is live and widely deployed, and it delivers the same *capabilities* —
batching, custom validation, session keys, gas sponsorship. That is not the
issue. The issue is that an ERC-4337 account is a **newly deployed contract at a
new address**. It is derived from a factory and the owner key via CREATE2; it is
by construction not the address the user already has.

That collides directly with every part of the stated requirement:

- **The address does not survive.** Users get a different address than the one
  they've used for a year. Anything that hardcoded, whitelisted, or airdropped to
  the old address keeps pointing at the old address.
- **The ENS name does not survive automatically.** The name would have to be
  transferred and its forward record re-pointed, and the reverse record set on
  the new contract account — a multi-step, multi-transaction operation the user
  must perform correctly, per user. Any name they don't own outright (a subname
  issued to them) may not be movable at all.
- **The history does not survive.** Onchain history is the record of an address.
  It cannot be transferred. The new account starts empty: no track record, and
  any reputation, allowlist position, POAP-style attestation, or protocol-side
  accounting keyed to the old address is left behind.
- **The migration itself is the cost.** Every user must be walked through moving
  every token, NFT and position across, paying gas and accepting the tail risk of
  a partial migration — for an outcome that is strictly worse than the one
  EIP-7702 gives for a single signature.

The one-line version: ERC-4337 gives an existing user a *second* account with
smart features; EIP-7702 gives their *existing* account smart features. The
requirement here is explicitly the second, so ERC-4337-with-migration is the
wrong tool.

Worth noting the two are not rivals in practice. A common production setup is to
delegate the EOA under EIP-7702 to an implementation that is also ERC-4337
compatible — so the account can be driven through the ERC-4337 bundler and
paymaster infrastructure for sponsored gas and userop-style flows, while still
being the user's original address. That gets the 4337 ecosystem without the
migration.
