# Privacy Review: Private Withdrawals Pool (1 ETH notes, Ethereum mainnet)

**Scope:** What a competent chain observer can learn about who made a withdrawal, given the user flow as shipped. The cryptography (circuit, nullifier scheme, verifier) is **assumed correct**, as the auditor found. This review covers everything around it.

**Bottom line:** With the flow as shipped, **every withdrawal is linked to its deposit, and anyone can see it for free.** The ZK proof works, but the transaction that carries it is signed by the depositor's own wallet. Marketing's claim is **false today**. Even after the fix below, the claim is still too absolute to print as written.

---

## 1. The critical problem: the withdrawal is sent from the deposit wallet

Shipped flow, step 2: *"Alice opens the app, **connects her wallet**, … and calls `withdraw(...)`."*

Every Ethereum transaction publicly records its sender (`tx.from`, which the contract sees as `msg.sender`). So the chain shows:

```
tx A:  from 0xAlice  →  Pool.deposit(commitment)          value 1 ETH
tx B:  from 0xAlice  →  Pool.withdraw(proof, root, nf, 0xFresh)
                         └─ 1 ETH paid to 0xFresh
```

An observer does not need to break anything. They just group transactions by sender. The proof hides *which leaf* is being spent, but the sender field already tells them, and it also ties `0xFresh` to Alice. Using a fresh recipient does nothing here, because Alice's own address is signing the transaction that pays it.

This is not a rare mistake that only careless users make. **It is the default path in the product.** Every user who follows the UI gets linked.

### Why "just connect a different wallet" doesn't fix it

Someone has to pay gas for `withdraw()`. The fresh recipient holds 0 ETH, so it can't send the transaction itself. Whatever wallet does send it must have been funded from somewhere:

- Funded from Alice's main wallet → linked, one hop away.
- Funded from a CEX withdrawal → linked to Alice's KYC identity, and possibly visible through CEX hot-wallet patterns.
- Funded from another user of the pool → we've just rebuilt a relayer by hand, badly.

A fresh address that pays its own gas cannot be bootstrapped privately. That is why Tornado-style systems have relayers.

## 2. What an observer can determine, ranked by effort

| # | Leak | Effort for observer | Present today? |
|---|------|---------------------|----------------|
| 1 | `tx.from` of withdraw = depositor | None: group by sender | **Yes, every withdrawal** |
| 2 | Gas-funding trail of whatever account submits the withdrawal | Trivial: one hop of tracing | Yes, as soon as users try to work around #1 |
| 3 | Small anonymity set | Low | Yes, at launch |
| 4 | Timing and amount-pattern correlation | Low to medium | Yes |
| 5 | What the recipient does afterward | Low to medium | Up to the user, but the product can help |
| 6 | Offchain metadata (RPC, frontend, analytics, IP) | Needs access to those logs (subpoena, breach, or it's our own server) | Likely |
| 7 | Transaction fingerprinting (gas settings, wallet software, submission time of day) | Medium | Yes |

### 3. Anonymity set size

Even when everything else is perfect, the proof only says "the withdrawer owns one of the unspent deposits in the tree as of `root`." Privacy is at most **1-in-N**, and in practice smaller:

- **N at launch is small.** A new pool with a few dozen deposits gives weak privacy. Three people from our team testing on mainnet is a set of 3.
- **The root narrows the set.** `root` is public and identifies a tree state. Deposits inserted after that root can't be the source. Clients should always prove against the latest root. Proving against an old root, for example one cached at deposit time, shrinks the set to the deposits made before it.
- **Spent notes are eliminated.** As deposits get linked through leaks #1, #2, #4 and #5, they drop out of the set. De-anonymizing careless users shrinks the set for careful ones.

### 4. Timing and pattern correlation

- A deposit followed by a withdrawal shortly after, while few other deposits happened in between, is easy to match.
- An address that deposits *k* notes, followed by *k* withdrawals to recipients that later consolidate, can be matched by count.
- Distinctive time-of-day habits, custom gas-price or priority-fee values, and the same wallet software's nonce or gas-limit habits can all fingerprint a user across the two transactions.

### 5. Recipient behavior after withdrawal

The recipient is "fresh" only until it's used. Common ways users link themselves:

- Sending funds from `0xFresh` back to their known address, or to the **same CEX deposit address** they use elsewhere.
- Merging several withdrawals into one address.
- Using the same ENS name, NFT, airdrop claim, or dapp login they used from their main wallet.

We can't stop this, but the UI can warn about it.

### 6. Offchain metadata

- **Wallet connection at withdraw time.** Connecting the depositor's wallet tells our frontend, and any analytics or wallet-connect relay in the page, which address is withdrawing. Remove it (see §7).
- **RPC provider.** The user's wallet RPC (often Infura or Alchemy by default) sees their IP along with the deposit transaction, and later the withdraw submission or the relayer call. Anyone holding those logs can correlate the two without looking at the chain.
- **Merkle path source.** In-browser proving is good. If the client fetches its Merkle path from *our* backend by `leafIndex` or commitment, though, our backend learns which deposit is being withdrawn. The client should rebuild the tree locally from `Deposit`/insert events, or download the whole leaf set.
- **Relayer.** Once we add one (§7), the relayer sees the requester's IP and the withdrawal. It can't learn the deposit from the proof, but IP plus timing correlates with the RPC logs above.
- **Frontend hosting and analytics.** Every third-party script on the withdraw page is a potential log of IP → withdrawal.

## 7. What has to change for the claim to hold

### Required (without these, the claim is false)

1. **Remove "connect wallet" from the withdraw flow entirely.** Withdrawal should need only the saved note and a recipient address. No wallet connection, no signature from the depositor's key.

2. **Submit withdrawals through a relayer, or an ERC-4337 paymaster.**
   - The relayer sends the transaction and pays gas. The contract pays the relayer a `fee` out of the 1 ETH, and pays `recipient` 1 ETH minus `fee`.
   - `tx.from` is then the relayer, which is the same for every user.
   - Run more than one relayer, or allow third-party relayers, so one operator isn't a single point of censorship and logging.
   - Keep self-submission as an option for advanced users, with a clear warning that the submitting account's funding history must not lead back to them.

3. **The proof must bind `recipient`, `relayer`, and `fee`.** This is the one item that touches the audited scope, so **please confirm it with the auditor.** The flow described has `recipient` as a withdraw argument, but the audit summary only mentions membership and the nullifier. If `recipient` (and, once relayers exist, `relayer` and `fee`) are not public inputs constrained in the circuit, a relayer or anyone watching the mempool can take a valid proof and swap in their own recipient. That's a theft bug, not a privacy bug, but going to a relayer model makes it urgent. Tornado-style designs include these values as public inputs and tie them in with a trivial constraint (for example, squaring each one) so the verifier checks them.

4. **Always prove against the latest known root**, so the anonymity set is as large as possible.

### Strongly recommended (these narrow leaks #3–#7)

5. **Show the anonymity set in the UI**: the number of deposits since theirs and the number of unspent deposits. Warn when it's small, and suggest waiting.
6. **Build the tree client-side** from onchain events. Never ask a server for a path keyed by the user's leaf.
7. **Strip third-party analytics from the app.** Let users set their own RPC endpoint, and document using Tor or a VPN for relayer requests.
8. **Standardize the relayer fee** (fixed or on a coarse grid) so the fee amount doesn't fingerprint users.
9. **Add post-withdrawal guidance**: don't send funds back to known addresses or to the same CEX deposit address, don't merge withdrawals, and wait before withdrawing.
10. **Seed the anonymity set before promoting privacy.** Don't advertise privacy while N is tiny. Team test deposits and withdrawals are trivially linkable and shouldn't count toward it.

## 8. Recommended launch copy

"Withdrawals cannot be linked to deposits" is an absolute claim. No mixer can guarantee it, because it depends on pool size and on user behavior we don't control. Even after items 1–4 ship, a more accurate version would be:

> **Withdrawals are cryptographically unlinkable to deposits.** When you withdraw, the proof reveals only that you own *one of* the pool's unspent deposits, not which one. Withdrawals are submitted through a relayer, so your deposit wallet never appears in the withdrawal. Your privacy grows with the number of deposits in the pool and depends on how you use your funds afterward. See our privacy guide.

**Until items 1–3 ship, do not publish any privacy claim.** Today the accurate description is "withdrawals are linked to deposits by the sender address."

A separate item that isn't about privacy mechanics: a mainnet mixing pool has regulatory and sanctions exposure (see the Tornado Cash history). Get legal review before launch, alongside this review.
