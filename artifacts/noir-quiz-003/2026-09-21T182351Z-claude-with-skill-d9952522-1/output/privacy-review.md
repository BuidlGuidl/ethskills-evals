# Privacy Review: Private Withdrawals Pool

**Question:** Can we say "withdrawals cannot be linked to deposits"?

**Answer: No, not with the product as shipped.** Every withdrawal can be linked to its deposit, with certainty, by anyone who reads a block explorer. The cryptography is fine. The problem is who sends the withdrawal transaction. Even after the fix below, the most we can honestly claim is weaker than what marketing wrote.

Scope: I assume the circuit, nullifier scheme and verifier are correct, as the audit found. Everything below is about what surrounds them: transaction metadata, the size of the anonymity set, user behavior, and offchain infrastructure.

---

## 1. The blocking issue: Alice's wallet sends both transactions

As shipped:

| Tx | `from` (public) | What it reveals |
|---|---|---|
| `deposit(commitment)` | `0xAlice` | Alice deposited 1 ETH |
| `withdraw(proof, root, nullifierHash, recipient)` | `0xAlice` | Alice withdrew 1 ETH to `recipient` |

The zero-knowledge proof hides *which commitment* belongs to the nullifier. It cannot hide `msg.sender`, and `msg.sender` is part of every Ethereum transaction. An observer does not need to break anything. They filter `withdraw` calls by `from` address and match them against `deposit` calls from the same address.

This is worse than having no pool at all:

- **The "fresh" recipient becomes linked to Alice.** The withdrawal tx publicly records `0xAlice → withdraw → recipient 0xFresh`. Alice created that address so it would be unlinked, and the app ties it to her anyway, permanently.
- **Users think they are private when they are not**, so they will act on that belief.

### Why "just use a different wallet" doesn't fix it

The fresh recipient address has no ETH, so it cannot pay gas for its own withdrawal. Users who work around this will usually fund a burner from their main wallet, or from the same exchange account, and that link is just as visible. The privacy property has to come from the product. Users will not work around it correctly on their own.

### Required fix: the withdrawal must not be sent by the user

Pick one:

1. **Relayer (the standard Tornado-style design).** The browser generates the proof and sends it to a relayer over HTTPS. The relayer submits `withdraw()` from its own address and pays gas. The contract pays `fee` to the relayer and `1 ETH − fee` to the recipient.
2. **ERC-4337 with a paymaster.** The withdrawal is a UserOperation from a fresh smart account. A paymaster sponsors gas, paid back from the withdrawn amount. This gives the same property with more moving parts.

Either way, the **withdrawal flow must not ask the user to connect a wallet.** All it needs is the note (from local storage or pasted in) and a recipient address.

**This change touches the audited circuit and contract. Plan a re-review.** With a relayer, the proof has to bind `recipient`, `relayer` and `fee` as public inputs. Without that, a relayer or a mempool front-runner can swap in their own address or take the whole note as a "fee." If the current circuit only binds `recipient`, the audit covered a different statement than the one a relayer design needs. Also check:

- Enforce `fee < denomination` onchain. Pay the relayer only after `verify()` returns true and the nullifier is recorded.
- Keep public input order identical across the circuit's `pub` params, the prover's `publicInputs`, and the array the contract passes to `verify()`.
- Have more than one relayer, or at least let users pick or run their own. A single team-run relayer sees the IP address and timing of every withdrawal (see §4).

---

## 2. After the fix: what an observer can still learn

Fixing `msg.sender` removes the *certain* link. What remains is a *probabilistic* one, and for a small pool it can be strong.

### 2a. Anonymity set size

A withdrawal is hidden only among the deposits that could have produced it. Those are the leaves in the tree at the submitted `root`, minus deposits that are clearly already withdrawn or otherwise attributed. In a "small pool":

- With 5 deposits ever made, the best case is 1-in-5. Every withdrawal makes the remaining ones easier to attribute.
- At launch the set is tiny, and team or test deposits make up much of it.
- Users should be able to see the current set size before withdrawing. The UI should warn them when it is low (e.g. fewer than ~50 unspent deposits since theirs).

### 2b. The submitted root narrows the set

`root` is public. If the client submits the root from right after Alice's deposit, not the latest one, it proves her note is among the first *k* leaves. It also shows which historical root the client was synced to. **The client should always prove against the latest root**, rebuilt by replaying all insert events from the contract.

### 2c. Timing correlation

- Deposit then withdraw within minutes or hours, while few other deposits happened in between: likely linkable.
- Recurring patterns, e.g. deposits every Friday and withdrawals every Monday: linkable over time.
- "Weeks later" as in the flow above is good practice. The app should encourage it, not just allow it.

### 2d. Amount and count correlation

Fixed 1 ETH notes are the right choice. Linkage comes back through counts:
- Alice deposits 7 notes in one block, and 7 withdrawals to one recipient (or in one burst) follow. That links them.
- Deposit amounts that line up with a known wallet's balance, such as "withdrew exactly the 3 ETH she moved out of Coinbase," narrow things further.

### 2e. What the recipient does next

The pool only protects the hop through the pool. Observers watch what the recipient address does next. If `0xFresh` sends funds back to `0xAlice`, to the same exchange deposit address, to the same ENS name or NFT, or interacts with her known contracts, the link is re-established. The contract can't prevent this, but the product can warn about it.

### 2f. Transaction fingerprinting (mostly fixed by a relayer)

If users submit their own txs: gas price and priority-fee habits, wallet-specific calldata or gas-limit patterns, nonce behavior, and submission timezone all identify them. Having a relayer submit uniformly removes most of this.

---

## 3. What the chain alone *cannot* determine (after the fix)

Assuming the relayer fix, a sound circuit, and a pool-scoped nullifier:
- The proof does not reveal which leaf was spent.
- The `nullifierHash` cannot be linked to a commitment without the note's secret.
- Commitments cannot be brute-forced, provided the note preimage includes random `nullifier` and `secret` fields (worth confirming, since it is cheap to check).

This is the part the audit covered, and it is the only part marketing's sentence is actually true of.

---

## 4. Offchain leaks (not visible onchain, but real)

A "competent chain observer" may also be an RPC provider, a hosting provider, an analytics vendor, or us.

- **Wallet connection at withdraw time.** Today the frontend, WalletConnect relay, and any analytics see `0xAlice` connect and then trigger a withdrawal. Remove wallet connection from the withdraw flow entirely.
- **RPC queries.** Watch for per-note lookups, like "is nullifier X spent?", "what's the leaf index of commitment C?", or `eth_call`s keyed on the user's note. Sent to Infura or Alchemy from the user's IP, these tie the IP to a specific note. Fetch all insert events and all nullifier events in bulk, and do the matching locally.
- **Frontend and analytics.** Server logs, Sentry, and product analytics that record wallet addresses, IPs, or withdraw events create a deposit↔withdraw link in *our* database, which can be subpoenaed or breached. Ship the withdraw page with no third-party analytics. Don't log IPs next to withdrawal events.
- **Relayer.** It sees the user's IP, the recipient, and the timing. Say this in the docs, support Tor, and allow alternate relayers.
- **Note storage.** A note in `localStorage` is readable by any XSS on our origin, and by anyone who gets at the device. Losing the note means losing the funds, and leaking it means losing the funds *and* the privacy. Offer an explicit backup or export, and harden the CSP.

---

## 5. Required changes (checklist)

**Must-do before any unlinkability claim:**
1. [ ] Withdrawals submitted by a relayer or a 4337 paymaster, never from the user's wallet.
2. [ ] Withdraw flow requires **no wallet connection**.
3. [ ] Proof binds `recipient`, `relayer`, `fee` as public inputs, with `fee < 1 ETH` enforced onchain. **Re-audit** the modified circuit and contract.
4. [ ] Client always proves against the latest root, rebuilt from contract events.
5. [ ] No per-note RPC lookups. Bulk-fetch events and match locally.
6. [ ] No analytics or IP logging on the withdraw path.

**Strongly recommended:**
7. [ ] Show the anonymity set size, and warn when it is small or when withdrawing soon after depositing.
8. [ ] UI guidance: wait, spread multiple notes out over time, and never send withdrawn funds back to linked addresses.
9. [ ] Multiple or independent relayers, and Tor-friendly access.
10. [ ] Seed launch messaging with the fact that privacy grows with the pool. Don't promise it on day one.

---

## 6. Suggested launch copy

"Cannot be linked" is an absolute claim that no pool of this kind can make. It is false for the current product, and still overstated after the fixes, because of set size, timing, and user behavior. Suggested wording once items 1–6 ship:

> "Withdrawals carry no onchain link to your deposit. Your privacy grows with the number of people using the pool — the longer you wait and the larger the pool, the stronger it gets."

Until item 1 ships, the page should make **no privacy claim at all**. Right now the product links every withdrawal to its depositor, and it also links the depositor to the address they created to stay private.
