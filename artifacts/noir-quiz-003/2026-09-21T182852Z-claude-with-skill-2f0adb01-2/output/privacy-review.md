# Privacy Review: Private Withdrawals Pool (1 ETH notes)

**Question:** Can we say "withdrawals cannot be linked to deposits" on the launch page?

**Short answer: No. Not with the flow we ship today.** The cryptography is fine (we're assuming the audit is correct). The product flow gives the link away anyway. In the default flow, anyone can match a withdrawal to its deposit by comparing one field on Etherscan. It takes no analysis and no heuristics.

---

## 1. The fatal leak: `msg.sender` on `withdraw()`

The shipped flow:

1. Alice connects **wallet W** and calls `deposit(commitment)`. The transaction is public: `from = W`.
2. Weeks later, Alice connects **wallet W again**, builds the proof, and calls `withdraw(proof, root, nullifierHash, recipient)`. The transaction is public: `from = W`.

The zero-knowledge proof hides *which leaf* in the tree is being spent. It does not hide *who sent the transaction*. Every Ethereum transaction has a signed, public `from` address, and that address also pays the gas. So an observer sees:

```
deposit()   from W   (+1 ETH into pool)
withdraw()  from W   → recipient R (fresh)
```

That links W to R directly. The fresh recipient address adds nothing, because the transaction that funds R is signed by the depositor. Our anonymity set is not "everyone in the tree". It is 1.

This isn't a rare edge case. It is the **happy path**: the UI tells users to connect a wallet to withdraw, and the only wallet most users have is the one they deposited from.

### Why "just use a different wallet" doesn't fix it on its own

The recipient R is fresh and empty, so it can't pay gas and can't send `withdraw()` itself. Whatever address sends the withdrawal needs ETH. If the user funds a second wallet W2 from W (or from their CEX account, or from anything linked to them), the link simply moves one hop:

```
W → (gas money) → W2 → withdraw() → R
```

Chain-analysis tools follow gas funding as a matter of routine. A fresh sender only helps if its gas money doesn't trace back to the depositor, and ordinary users have no way to arrange that. **So the product has to pay the gas for them.**

---

## 2. What has to change (required before the claim is even arguable)

### 2.1 Relayed withdrawals (required)

Users must be able to withdraw without signing or paying for the transaction from any address linked to them. Two standard designs:

- **Relayer:** the browser produces the proof and sends `(proof, root, nullifierHash, recipient, relayer, fee)` to a relayer over HTTPS. The relayer submits the transaction and pays the gas. The contract sends `1 ETH − fee` to `recipient` and `fee` to `relayer`. The transaction's `from` is the relayer, which it shares with every other relayed withdrawal.
- **ERC-4337 paymaster:** the withdrawal is a UserOperation from a fresh account. A paymaster pays the gas and is repaid out of the withdrawn amount. Same idea, different plumbing.

Either way, the withdraw screen **must not ask the user to connect a wallet.** It needs the note and a recipient address, nothing else. As long as "connect wallet" is part of the withdraw flow, users will send from their deposit wallet.

### 2.2 Bind recipient, relayer, and fee into the proof (check this with the auditor)

Once a third party submits the transaction, that party can change the calldata. If `recipient`, `relayer`, and `fee` are not **public inputs the circuit commits to**, a relayer or a mempool front-runner can swap in its own `recipient` and steal the withdrawal with the same valid proof. The audit covered membership, nullifiers, and the verifier. **Confirm that the audited circuit binds `recipient` (and, once added, `relayer`/`fee`) as public inputs.** Tornado does this by including them in the public signals; a dummy constraint such as `recipient * recipient` stops them from being optimized out. If they aren't bound, adding a relayer creates a theft bug, and the circuit plus verifier need re-auditing.

### 2.3 Remove the wallet from the withdraw UI and harden the frontend

Even when the transaction is relayed, **we** (and our RPC provider, analytics, and hosting) can still link Alice if the withdraw page sees her wallet address, her IP, or a stable browser ID in the same session as the note. Requirements:

- No wallet connection on the withdraw page.
- No third-party analytics or trackers on any page that handles notes.
- The proof is generated entirely client-side (it already is). The note must never be sent to our servers.
- Don't log IPs next to withdrawal requests on our relayer. Document this, and ideally support submission over Tor.
- Publish the frontend in a form users can verify (IPFS hash, reproducible build). A compromised or subpoenaed frontend can deanonymize everyone.

---

## 3. What a competent observer can still do after those fixes

A relayer removes the *deterministic* link. It does not make withdrawals "unlinkable". What remains is statistical, and it matters most for a **small, newly launched pool**.

| Leak | What the observer does | Severity for us at launch |
|---|---|---|
| **Anonymity set size** | A withdrawal hides only among the deposits made *before it* that haven't been spent yet. If the pool has 12 deposits, the best case is 1 in 12. | **High.** A small pool is the main weakness. |
| **Timing** | Deposit at 14:02, withdrawal at 14:40, with few deposits in between, means a very small effective set. People who withdraw soon after depositing are easy to match. | High |
| **Gas funding of the recipient** | R is empty. If Alice then funds R's gas from W (or from her CEX account) so she can use the ETH, R is linked to W again. | High (a user mistake, but a predictable one) |
| **Post-withdrawal behavior** | R sends to the same CEX deposit address as W, interacts with the same dapps, or consolidates with W. Standard clustering heuristics pick this up. | High (user behavior) |
| **Multi-note patterns** | "W deposited 7 × 1 ETH on Tuesday; R withdrew 7 × 1 ETH on Friday." Matching counts is trivial. | Medium–High |
| **Relayer choice / fee fingerprint** | Unusual relayers or fee settings split the set into smaller groups. | Low–Medium |
| **Gas price / tx fingerprints** | Wallet-specific gas-price or nonce habits, only if users bypass the relayer. | Low once relayed |
| **Offchain metadata** | IP addresses at the RPC, relayer, or frontend; browser fingerprints; our own logs. | Medium, and under our control |

The fixed 1 ETH denomination is a strength. Amounts reveal nothing, so keep it that way and don't add variable amounts.

---

## 4. Recommended product changes (priority order)

1. **Ship relayed withdrawals (relayer or 4337 paymaster) and remove wallet connection from the withdraw flow.** This is a hard blocker for any privacy claim.
2. **Confirm (or add and re-audit) that `recipient`/`relayer`/`fee` are bound as public inputs.** This is a hard blocker for shipping a relayer safely.
3. **Show the anonymity set in the UI:** "Your note is one of N unspent deposits since you deposited." Warn, or require confirmation, when N is small or when the user withdraws soon after depositing.
4. **Add withdrawal hygiene guidance in the UI:** don't fund the recipient from your deposit wallet or exchange account, don't send withdrawn funds back to linked addresses, and spread multi-note withdrawals out over time and across different recipients.
5. **Offchain hygiene:** no trackers, a no-logs relayer policy, Tor-friendly submission, and a verifiable frontend.
6. **Seed and grow the pool before promoting privacy.** Privacy comes from the crowd, not from the circuit.

---

## 5. What marketing can honestly say

- **Today (same wallet deposits and withdraws):** No privacy claim at all. Deposits and withdrawals are linked by `msg.sender` for anyone who looks. Printing "cannot be linked" would be false, and it would put users who rely on it at risk.
- **After §2 is shipped:** "withdrawals cannot be linked to deposits" is **still too strong**. Timing, set size, and user behavior leave statistical links, especially early on. Something closer to this is defensible:

  > "Withdrawals are cryptographically unlinkable from deposits: the proof reveals only that you own *some* unspent note in the pool. Your privacy grows with the number of deposits in the pool and depends on how you use your withdrawn funds — see our privacy guide."

  Link to a short privacy guide covering §3 and §4.4.

**Bottom line:** the auditor verified that the math hides the link. Our withdraw flow re-creates the link by having the depositor's own wallet sign the withdrawal. Fix the flow (relayer or paymaster, no wallet connection, recipient bound in the proof) before making any privacy claim. Even after that, word the claim in terms of the anonymity set rather than calling withdrawals absolutely unlinkable.
