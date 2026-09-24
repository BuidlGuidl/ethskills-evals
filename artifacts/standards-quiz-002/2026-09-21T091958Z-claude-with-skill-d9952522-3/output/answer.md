# Giving existing EOAs smart-account abilities on Ethereum mainnet

## 1. Is it possible on mainnet now, and what makes it possible?

**Yes.** It works on Ethereum mainnet today.

- **Mechanism:** **EIP-7702**, "set code for EOAs". It lets an existing externally owned account (EOA, a normal key-controlled address) run smart-contract code. The account does not become a new kind of account and does not move to a new address. It stays an EOA with the same private key, and it also runs code.
- **Network upgrade:** **Pectra** (Prague execution layer + Electra consensus layer).
- **Went live:** **7 May 2025** on Ethereum mainnet. As of September 2026 it has been in production for over a year. It is not a testnet feature or a roadmap item.

**Why it fits:** before Pectra, an address was either an EOA (a key, no code) or a contract (code, no key). The only way to get batching and custom login logic was a contract at a *different* address. EIP-7702 removes that split for one address. The owner's key authorizes code to run at the address the owner already has.

## 2. What does the account point at after opt-in, and how does approve+swap run atomically?

**Opt-in:** the user signs an **authorization** with their existing EOA key. It is a signed tuple of `(chain_id, implementation_address, nonce)`. The authorization goes on chain inside a new **type `0x04` transaction** ("set code" transaction), in its authorization list. Anyone can submit that transaction and pay its gas, for example the team's relayer. But only the EOA's own signature makes the authorization valid.

**What the account then points at:** the protocol writes a **delegation designator** into the account's code field:

```
0xef0100 || <20-byte implementation address>
```

This is a 23-byte pointer, not a copy of contract code. The implementation is a smart-account contract the team picks and has audited, for example one with `executeBatch` and session-key validation. The account's address, key, balance, token holdings, ENS name and history do not change. The only change is that the address now has a pointer to that implementation.

**How approve+swap runs atomically:**
1. A call reaches the user's address, e.g. `executeBatch([{token, approve(router, amt)}, {router, swap(...)}])`.
2. The EVM sees the `0xef0100` designator. It loads the implementation's code and runs it **in the context of the user's address** (similar to a delegatecall). Storage, balance and `address(this)` all belong to the user's account.
3. The implementation makes both inner calls. To the token contract and the router, `msg.sender` is **the user's own address**. So the approve is granted by the user and the swap takes funds from the user.
4. Both calls run inside one transaction. If the swap fails, the whole transaction reverts, including the approve. That is what makes it atomic.

**Session keys:** these follow the same pattern. The implementation checks signatures from session keys stored in the account's storage, with limits such as time, spend cap or allowed targets. The main EOA key can still sign directly as before. The team can also have a sponsor pay gas: the sponsor submits the transaction and the implementation verifies the user's or session key's signature. Note that the root EOA key keeps full control no matter what the implementation says. Session-key limits restrict session keys, not the main key.

## 3. After one batched transaction, does it revert to a plain EOA?

**No.** The delegation **stays in place**. It is not tied to one transaction and does not reset after the batched call finishes. The designator stays in the account's code field, so every later call to the address keeps running the implementation's code until the user changes it.

**To change or remove it**, the EOA must sign a **new EIP-7702 authorization with its own key**, submitted in another type `0x04` transaction:
- **Change:** authorize a different implementation address. The designator is overwritten to point at the new contract.
- **Remove:** authorize the **zero address** (`0x000…000`). The protocol then clears the designator, and the account's code goes back to empty, making it a plain EOA again.

Each authorization uses the account's current nonce, so an old signed authorization cannot be replayed once the nonce has moved on. One caveat: clearing or switching the delegation does **not** wipe the account's storage. Any state the old implementation wrote, such as session-key records, stays there. Implementations should use namespaced storage layouts, and switches should be planned with that in mind.

## 4. Why a fresh ERC-4337 wallet per user doesn't meet the constraint

An ERC-4337 smart wallet is a **newly deployed contract at a new address**, usually computed deterministically from a factory, owner and salt. It will never be the user's current EOA address. So:

- **The address changes.** The fixed requirement is that the *same* address survives. A move is exactly the migration that was ruled out.
- **History does not move.** A year of onchain history (transactions, NFTs, attestations, airdrop eligibility, protocol positions, reputation tied to the address) belongs to the old address. The new wallet starts empty. Moving assets is just new transfers, not the same history.
- **ENS has to be re-pointed.** The name would have to be moved or re-resolved to the new address, so it no longer describes the same account. Reverse resolution and anything that trusted the old address break.
- **The same key doesn't mean the same account.** The old key might become an owner or signer of the new wallet, but the *account* people know is still the old address. The old EOA also keeps existing as a separate plain account, so the user ends up with two accounts to manage.
- **It costs more for no benefit.** It needs a deploy per user, many asset transfers (each token and NFT, one by one), approvals to redo, and positions to unwind and reopen.

EIP-7702 gives the same abilities (batching, session keys, gas sponsorship) **at the user's existing address**. ERC-4337 still has a role: a 7702-delegated EOA can use a 4337-compatible implementation and route calls through bundlers and paymasters. But the account must be the delegated EOA, not a freshly deployed wallet.
