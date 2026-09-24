# Upgrading existing EOAs in place on Ethereum mainnet

## 1. Is it possible on mainnet today? Yes.

- **Mechanism:** EIP-7702, "Set EOA account code". It lets an existing EOA (a normal account controlled by a private key) point at the code of a smart contract. The account keeps its address and key. It does not become a new kind of account and does not move anywhere.
- **Network upgrade:** **Pectra** (Prague on the execution layer + Electra on the consensus layer).
- **Mainnet activation:** **May 7, 2025** (epoch 364032, about 10:05 UTC). By September 2026 it has been live for well over a year and is supported by major wallets and account-abstraction tooling.

**Why it works:** EIP-7702 added a new transaction type, `0x04` ("set code transaction"). This transaction carries an `authorization_list`. Each entry is a tuple `(chain_id, address, nonce, y_parity, r, s)` signed by the EOA's own private key. When the transaction is processed, the protocol checks each signature and writes a small marker into the signer's account code. The account is still an EOA: the same key still controls it, and it can still send ordinary transactions. The difference is that calls to it now run contract logic.

## 2. What the account points at, and how approve+swap runs atomically

**What it points at:** once the authorization is processed, the EOA's code becomes a 23-byte **delegation designator**:

```
0xef0100 || <delegate contract address (20 bytes)>
```

`0xef` is a prefix that normal contract deployment can never produce, so a pointer can't be confused with real deployed code. The delegate is a single, already-deployed, audited smart-account implementation, for example a batch-executor/7702 account contract with session-key modules. Every user can point at the same shared implementation. Each EOA runs that code **in its own context**: its own storage, its own balance, and `address(this)` equal to the user's address. This works like `DELEGATECALL`, but applied to the whole account.

**How the approve+swap runs atomically:**
1. The user (or a relayer/bundler paying gas) sends a transaction whose target is the **user's own address**, calling something like `execute(Call[] calls)` on the delegated code.
2. Because the EOA now points at the delegate, the EVM loads the delegate's code and runs it as the user's account.
3. The batch function makes the calls in order: `token.approve(router, amt)`, then `router.swap(...)`. For both calls, `msg.sender` is the user's EOA address, so the token sees the approval as coming from the user, and the router pulls the tokens from the user.
4. Everything happens in one transaction. If the swap reverts, the whole call reverts and the approve is undone too. Either both happen or neither does.

The authorization and the first batched call can go in the same type-`0x04` transaction, so the user can opt in and swap in one step.

**Session keys / custom auth:** the delegate contract's validation logic decides who may trigger `execute`. That can be the EOA key itself, or a session key the user registered in the account's own storage with limits such as expiry, spend caps, or allowed targets/selectors. The same account can also serve as an ERC-4337 account, because 4337 EntryPoints and bundlers support 7702-delegated EOAs. That gives gas sponsorship (paymasters) and UserOp-based session-key flows, with the sender still being the original address.

## 3. Does it revert to a plain EOA after one transaction? No, it stays.

The delegation is **persistent**. It is not per-transaction. The `0xef0100 || delegate` code stays in the account's state after the batch finishes, and every later call to the address keeps running the delegate's logic. It stays until the user explicitly changes it. (An earlier proposal, EIP-3074, and some early 7702 drafts were per-transaction. The version that shipped in Pectra is not.)

**To change or remove it:** the EOA's private key must sign a **new EIP-7702 authorization**, and it must be included in a later type-`0x04` transaction. Anyone can submit that transaction, but only the key holder can sign the authorization.
- **To switch implementations:** sign an authorization pointing to a different delegate address. The account's code is overwritten with `0xef0100 || newDelegate`.
- **To remove it:** sign an authorization pointing to the **zero address** (`0x0000…0000`). The protocol then clears the account's code, and it behaves like a plain EOA again.

Each authorization must match the chain (`chain_id` = 1 for mainnet, or 0 for "any chain", which is risky) and the account's **current nonce**. Once used, it can't be replayed. Note: changing or removing the delegation does **not** clear the account's storage. Data left by the old delegate (e.g., session-key records) stays behind, so a new implementation should use its own separate storage layout (e.g., ERC-7201 namespaced storage) or clean up explicitly.

Security note: because the private key can always sign a new authorization, the original key keeps full control and can't be "rotated away." Session keys add capabilities but don't replace the root key. Users must also treat a 7702 authorization prompt as highly sensitive: delegating to a malicious contract gives it full control of the account.

## 4. Why "deploy a fresh ERC-4337 wallet and migrate" fails the constraint

A standard ERC-4337 smart-contract wallet is a **new contract deployed at a new address**. Its address comes from the factory (via CREATE2), not from the user's existing key. So:

- **Address changes.** The constraint says the address must survive, and migrating means it doesn't. Anything pointing at the old address (payment links, allowlists, airdrops, integrations, counterparties' address books) now points at the wrong place.
- **Onchain history stays behind.** Transaction history, reputation, NFT/POAP provenance, governance participation, and eligibility tied to the old address all belong to the old address. They can't be moved to a new one.
- **ENS can only be re-pointed, not kept.** You can transfer the name or change its resolver record, but the identity the name used to resolve to (and its reverse record/history) is the old address. The team explicitly ruled out moving users to a new address.
- **Funds must actually be moved.** That means many transfers per user (every token, NFT, LP position, and approval), gas costs, the risk of missing assets, and positions that can't be moved at all (non-transferable tokens, vesting contracts locked to the old address).
- **The old EOA is still there.** Its key still controls whatever is left behind, so you end up with two accounts, not one upgraded one.

EIP-7702 avoids all of this. The **same address** gets smart-account behavior (batching, session keys, and, if wanted, ERC-4337 compatibility through the delegate), with no migration. ERC-4337 is still useful here, but as a way to run and sponsor transactions for the delegated EOA, not as a reason to create a new account.
