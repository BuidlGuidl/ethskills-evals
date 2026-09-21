# Upgrading existing EOAs in place on Ethereum mainnet

## 1. Is it possible on mainnet today? Yes.

- **Mechanism:** **EIP-7702, "Set Code for EOAs"**. It lets an existing EOA (a normal key-controlled account) point at contract code and run it. The account keeps its address and key. It does not turn into a new kind of account and does not move anywhere.
- **Network upgrade:** **Pectra** (Prague on the execution layer, Electra on the consensus layer).
- **Mainnet date:** **May 7, 2025**, at epoch 364032 (about 10:05 UTC). By September 2026 it has been live for more than a year, so it is a shipped mainnet feature, not a roadmap item.

How it works: EIP-7702 adds a new transaction type, **0x04** ("set code" transaction). The transaction carries an `authorization_list`. Each entry is a tuple `(chain_id, address, nonce, y_parity, r, s)`, signed by the EOA's own private key, that says "my account should run the code at `address`." Two details matter:
- The authorization is signed by the EOA itself. The transaction can be sent by the user or by someone else who pays the gas (a sponsor, or "relayer").
- The signature covers the EOA's current nonce, so it can't be replayed. It also covers a chain id; `0` means "valid on any chain", which you should avoid unless you really want it.

## 2. What the account points at, and how approve+swap runs atomically

Once the authorization is processed, the EOA's code slot is set to a 23-byte **delegation indicator**:

```
0xef0100 || <20-byte address of the delegate contract>
```

This is only a pointer, not a copy of the contract's bytecode. The delegate is a smart-account implementation the team picks, ideally an audited one. It would expose:
- `execute(Call[] calls)`, a batch function, and
- validation logic for session keys, e.g. "key K may call router R, up to X tokens, until time T". This could also be done through an ERC-4337 validation interface, since 7702 accounts work with the 4337 EntryPoint (v0.8+).

When a transaction or call targets the user's address, the EVM follows the pointer and runs the delegate's code **in the context of the user's account**. That means:
- `address(this)` is the user's own address, and so is `msg.sender` for any contract the account calls;
- storage and balance belong to the user's account, not the delegate.

Approve+swap flow:
1. The user (or a session key the delegate accepts) sends one transaction to their own address, calling `execute([...])`.
2. Call 1: `token.approve(router, amount)`. The token sees `msg.sender == userEOA`.
3. Call 2: `router.swap(...)`. The router pulls the tokens from `userEOA` using that approval.
4. Both calls happen inside one transaction frame. If the swap reverts, the whole transaction reverts, including the approval. So it is atomic.

Opting in and the first batch can even go in the **same** 0x04 transaction: the authorization list is processed before execution starts.

The private key still has full control the whole time. It can still sign ordinary transactions, and it can always re-delegate. Session keys are an extra way in, not a replacement for the key.

## 3. Does it revert to a plain EOA after one transaction? No.

The delegation is **persistent**. The `0xef0100 || address` indicator stays in the account's code until it is explicitly replaced. Transactions sent from the account (batched or not) don't clear it. Neither does time passing.

To change or remove it, the EOA's private key must sign a **new EIP-7702 authorization**, and it must be included in a later type-0x04 transaction (sent by the user or a sponsor), with the account's current nonce and a valid chain id:
- **To change it:** authorize a different delegate address. The indicator is overwritten to point at the new contract.
- **To remove it:** authorize the **zero address** (`0x0000…0000`). The protocol then clears the account's code and resets its code hash to empty, so it behaves as a plain EOA again.

Caveat: changing the delegate **does not wipe storage**. Anything the old delegate wrote (session-key registries, nonces) stays in the account's storage. So delegates should use namespaced storage layouts (e.g. ERC-7201), and migrations should clear or re-initialize state on purpose.

## 4. Why "deploy a fresh ERC-4337 wallet per user" fails the constraint

An ERC-4337 smart-contract wallet is a **new contract at a new address**, usually derived with CREATE2 from a factory, the owner key, and a salt. It is a different account from the user's EOA.
- **Address changes:** funds would have to be moved to the new address. Users, counterparties, and integrations that know the old address would now be pointing at the wrong account.
- **ENS doesn't carry over:** the name resolves to the old address. You'd have to change the resolver record (and maybe transfer the name), and the reverse record (address → name) belongs to the old address.
- **History doesn't move:** onchain history, reputation, airdrop eligibility, attestations, allowlists, NFTs, and token approvals are all tied to the old address. They can't be migrated; at most assets can be transferred one by one.
- **The old EOA stays a plain EOA** with the same key, so it gains no batching or session keys.

This is exactly the "migrate to a new account at a new address" option the constraints rule out. EIP-7702 is the tool built for this case: the same address and key get smart-account behavior in place. If the team wants 4337 infrastructure (bundlers that submit transactions, paymasters that pay gas), they can still use it **on top of** a 7702-delegated EOA. There is no need to create a new wallet address.
