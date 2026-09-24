# Upgrading Existing EOAs In Place on Mainnet

## 1. Is it possible on mainnet now? What makes it possible?

**Yes.** It is live on Ethereum mainnet today (September 2026).

- **Mechanism:** **EIP-7702, "Set Code for EOAs"**. It adds a new transaction type, **type `0x04`** (the "set-code" transaction). This transaction carries an `authorization_list`. Each entry is a tuple `(chain_id, address, nonce, y_parity, r, s)` that the EOA's own private key signs. The entry says: "let my account run the code at `address`." The account is still an EOA. It keeps its key, address, balance, nonce, ENS name and history. It does not become a new account type. It just gains the ability to run contract code.
- **Network upgrade:** **Pectra** (Prague execution layer + Electra consensus layer).
- **Mainnet activation date:** **May 7, 2025** (epoch 364032, about 10:05 UTC).

Before Pectra, only a contract deployed at a new address could have code. EIP-7702 removes that limit for existing EOAs. That is why the "same address, same key" requirement can be met.

## 2. What does the account point at, and how does approve+swap run atomically?

**What the account points at:** after the set-code transaction is processed, the EOA's code field holds a 23-byte **delegation designator**:

```
0xef0100 || <20-byte delegate contract address>
```

- `0xef` is a prefix that no normal contract bytecode can start with (EIP-3541), so the network can recognize the designator reliably. `01 00` is the version marker.
- The delegate is a contract that is **already deployed** once and shared by many users, for example an audited smart-account implementation with `execute`/batching and session-key validation. No code is copied into the user's account. The account just **points at** that contract.
- When anything calls the EOA, the EVM follows the pointer. It loads the delegate's code and runs it **in the EOA's own context**. So `address(this)` is the user's address, storage is the user's storage, and the balance is the user's balance. It works like a `DELEGATECALL`.

**Approve + swap, atomically:**

1. The user (or a relayer or bundler for them) sends a transaction that calls the user's own address with something like `execute([ {token, 0, approve(router, amt)}, {router, 0, swap(...)} ])`.
2. The delegate's batching code runs as the user's address. It makes call #1 (`token.approve`), where `msg.sender` is the user's EOA, so the allowance belongs to the user's address. Then it makes call #2 (`router.swap`), where `msg.sender` is again the user's EOA, so the router pulls tokens from the user's address.
3. Both calls happen inside one transaction frame. If the swap reverts, the whole transaction reverts, including the approval. It is all or nothing, and no leftover allowance stays behind.

**Session keys / custom auth:** the delegate's validation logic can accept signatures from keys other than the root key, for example a session key limited to certain contracts, amounts or an expiry time. It keeps those rules in the EOA's own storage. It can also act as an ERC-4337 account, so bundlers and paymasters work with the same address. The original private key keeps full control no matter what.

The authorization and the first batch can go in the **same** type-`0x04` transaction. The authorization is applied first, then the call runs against the newly delegated code.

## 3. Does it revert to a plain EOA after one batched transaction?

**No. The delegation stays in place.** The delegation designator is written into the account's code field and remains there across any number of transactions. It is not a one-time or per-transaction setting. Every later call to the address keeps running the delegate's code until the user changes it.

**To change or remove it**, the EOA's private key must sign a **new EIP-7702 authorization**, and that authorization must be included in a later type-`0x04` transaction. Anyone can submit that transaction, including a relayer.
- **Change it:** authorize a different delegate address. The designator is overwritten to point at the new contract.
- **Remove it:** authorize **`address(0)`** (the zero address). The protocol then clears the code field and resets the code hash to empty. The account becomes a plain EOA again.
- The authorization must match the account's **current nonce** and either the right `chain_id` (1 for mainnet) or `chain_id = 0`, which means valid on any chain. Using the nonce makes each authorization single-use.

**Note on storage:** changing or clearing the delegation does **not** wipe the account's storage. Storage written by the old delegate stays. The next delegate must be storage-compatible, or the old storage must be cleaned up (for example with namespaced storage layouts like ERC-7201). The private key always stays the ultimate authority. It can still send normal transactions and re-delegate at any time, so the delegate contract cannot lock the user out. It can, however, act for the user while it is delegated, so only audited delegates should be used.

## 4. Why a fresh ERC-4337 wallet per user doesn't work

An ERC-4337 smart-contract wallet is a **new contract deployed at a new address**. It is deterministic (CREATE2) but different from the user's EOA address. Here is why that breaks the constraint:

- **The address changes.** The whole requirement is to keep the exact existing address. A new wallet is by definition a different account.
- **History does not move.** Transaction history, token-holder records, airdrop eligibility, reputation, attestations, NFT provenance, and allowlists all stay tied to the old address. You can transfer funds to a new address, but you cannot transfer history.
- **ENS and other tied things must be reconfigured by hand, and the old identity stays.** The ENS name would have to be re-pointed and its reverse record reset. Every counterparty, integration and allowlist that knows the old address would need updating. Anything sent to the old address later still lands on the old EOA.
- **The old key stays a separate, live account.** The user's EOA and key keep existing next to the new wallet. That is not "the same address and private key" gaining features. It is a second account.
- **Migration costs and risks.** Moving every token, NFT, position and approval one by one costs gas and effort, and it is easy to miss something. Some assets or positions may not be transferable at all.

EIP-7702 avoids all of this. The existing address itself gets smart-account behavior, and it can still use ERC-4337 infrastructure (bundlers, paymasters) by pointing at a 4337-compatible delegate. So the teammate's goals (batching, session keys, gas sponsorship) are all met without changing the address.
