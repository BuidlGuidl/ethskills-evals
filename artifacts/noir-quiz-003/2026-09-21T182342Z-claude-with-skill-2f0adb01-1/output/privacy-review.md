# Privacy Review: Private-Withdrawals Pool (1 ETH notes, Ethereum mainnet)

**Question:** Can we say "withdrawals cannot be linked to deposits"?

**Answer: No, not with the flow we shipped.** A chain observer can link every withdrawal to its deposit without breaking any cryptography. They only need to read the `from` field of the transaction. The circuit, nullifier scheme, and verifier can all be correct and it makes no difference, because the wallet that deposits is the same wallet that withdraws.

Scope: this review assumes the audited parts are correct (Merkle membership proof, nullifier uniqueness, verifier soundness). Everything below is about what happens around the proof.

---

## 1. What an observer learns today

This is Alice's flow as shipped, from the point of view of anyone reading the chain (Etherscan, Dune, Arkham, Chainalysis, or one person with an archive node):

| Step | Public onchain data |
|---|---|
| `deposit()` | `from = 0xAlice`, `value = 1 ETH`, the commitment, the leaf index, the new root |
| `withdraw(...)` | **`from = 0xAlice`**, gas paid by `0xAlice`, `nullifierHash`, `root`, `recipient = 0xFresh`, 1 ETH moves from the pool to `0xFresh` |

The attack takes two steps:

1. Collect the set of pool depositors (every `deposit()` sender).
2. For each `withdraw()`, check whether `tx.from` is in that set. Here it always is.

The result:

- **Alice's withdrawal is linked to Alice's deposit.** If she made more than one deposit, the observer knows it was one of hers, which is the same thing for attribution purposes.
- **The "fresh" recipient is linked to Alice.** Her wallet sent the transaction that paid it, so `0xFresh` is now publicly labeled as Alice's. A fresh address helps nothing when you sign the payout transaction with your known address.
- **Why "connect your wallet" at withdrawal is the root cause:** `0xFresh` is empty, so it cannot pay gas for its own withdrawal. Any wallet Alice uses to send the withdrawal must already hold ETH, and that ETH came from somewhere traceable. Unless someone else pays the gas, the user ends up signing from an identified account. That is exactly what the product tells her to do.

The ZK proof hides *which leaf* is being spent. `msg.sender` then reveals the owner anyway. Anonymity is currently 1-in-1 for every user.

### It also hurts users who do everything right

Suppose a careful user withdraws through some other channel. Every deposit that was already linked by a same-wallet withdrawal can be removed from the candidate set. If most users follow the default flow, the effective anonymity set for the careful user shrinks to the few deposits that are still unexplained. The shipped UX weakens privacy for everyone, not only for the people who use it.

### Already-linked withdrawals stay linked

If any real withdrawals have gone through this flow, those links are permanent. A later product fix cannot undo them. Those users should be told.

---

## 2. Required changes before the claim can hold, even approximately

### 2.1 The withdrawal must not be sent or paid for by the depositor (blocking)

- **Add a relayer, or an ERC-4337 paymaster.** The user produces the proof in the browser and hands `(proof, root, nullifierHash, recipient, relayer, fee)` to a relayer. The relayer submits the transaction and pays gas. The contract pays `1 ETH - fee` to `recipient` and `fee` to `relayer`. The recipient can then be empty, which is the point.
- **Remove "connect wallet" from the withdrawal flow entirely.** The withdraw page needs no wallet: it only needs the note, the public event log, and a relayer endpoint. As long as a wallet connects there, (a) users will keep sending the transaction themselves, and (b) our frontend, analytics, and the wallet's RPC provider see "address X is withdrawing now."
- If we allow self-submission at all (for example, as a fallback when relayers are down), the UI must block it or strongly warn when the sending address has any history, especially history with the pool.

### 2.2 Bind recipient, relayer, and fee into the proof (blocking; confirm with the auditor)

The audit summary we received covers membership, nullifier, and verifier soundness. It does **not** say that `recipient` is a public input of the circuit. `withdraw(proof, root, nullifierHash, recipient)` takes `recipient` as a plain argument.

- If `recipient` is not constrained by the proof, anyone who sees the pending transaction (a relayer, a mempool searcher, a builder) can copy the proof, swap in their own recipient, and front-run to take the 1 ETH. Today this risk is partly hidden because users submit their own transactions. It becomes critical once relayers exist, because we would be giving proofs to third parties by design.
- `recipient`, `relayer`, and `fee` (and ideally `chainId` and the pool address) must be public inputs that the circuit constrains. They must also appear in the contract's `publicInputs` array in the same order as the circuit's `pub` parameters. Ask the auditor to confirm this explicitly. If they are not bound, this is a circuit and verifier change plus a redeploy.

### 2.3 The contract must not depend on `msg.sender` in `withdraw`

`withdraw` must not use `msg.sender` for authorization, payout, or refunds, and must not record it in events. Payment goes to the proof-bound `recipient` and `relayer` only.

### 2.4 Leaks through the frontend, RPC, and indexer

A "chain observer" is not the only adversary. The parties that run our infrastructure can link much more easily:

- **Tree data:** the client must rebuild the Merkle path from the **full** `deposit` event log (or a full, cacheable snapshot of it). Asking any server "give me the path for leaf *i*" tells that server which deposit is being spent. The same goes for a request that includes the commitment or the note.
- **The note never leaves the browser.** Proving is already done client-side. Keep it that way: no remote proving, no telemetry or error reporting that captures witness inputs.
- **RPC provider:** the RPC endpoint the page uses (Infura, Alchemy, a wallet's default) sees the IP address plus timing. Recommend or support a custom RPC, and don't combine withdrawal reads with anything tied to the user's identity.
- **Relayer:** the relayer sees the requester's IP and the recipient. Allow several independent relayers, document what they log, and make Tor-friendly access possible.
- **Analytics:** no third-party analytics or session replay on the withdraw page.

### 2.5 Standardize the fee

If users can choose any fee, a distinctive value (for example 0.0137 ETH) becomes a fingerprint that can match other activity. Use a fixed fee schedule, or a small set of fee tiers set by the relayer.

---

## 3. What stays observable after all of the above

With 2.1–2.5 in place, the design reaches the standard Tornado-style privacy level. That standard is "hidden among the other deposits," not "cannot be linked." These leaks remain, and some of them are serious for a small pool:

1. **Anonymity set size.** A withdrawal is hidden only among deposits made before the root it proves against. A new pool run by a three-person team may have tens of deposits at launch, and the first withdrawers will be in very small sets. With 5 deposits, "unlinkable" means "1-in-5 at best."
2. **Timing correlation.** Deposit at 14:02, withdrawal at 14:40 with only one deposit in between: the observer has a strong guess. The same applies to distinctive patterns, like depositing 7 notes and then withdrawing 7 notes to related recipients in a burst.
3. **Root choice.** The `root` in each withdrawal shows which tree state the user proved against, and therefore an upper bound on their leaf index. An old root (allowed if we accept a root history) rules out every later deposit. The client should always prove against the latest root.
4. **Pool-level counts.** Fixed 1 ETH notes are good: amount is not a side channel for each note. Aggregate behavior still leaks, though. If one address deposits 10 ETH and 10 withdrawals of the same size appear shortly after, that pattern is visible.
5. **What users do after withdrawing.** If `0xFresh` sends funds back to Alice's main wallet, the same exchange deposit address, or the same counterparty, the link comes back. This is outside our contract but inside our product's promise.
6. **Gas and funding behavior outside the relayer.** Anyone who later tops up `0xFresh` from an identified wallet links it.
7. **Network-level observers.** IP-level observation of RPC and relayer traffic is outside what chain analysis sees, but it is real for the parties operating that infrastructure.

None of these break the cryptography. All of them are used routinely in chain analysis of mixers.

---

## 4. Launch recommendations

- **Don't launch withdrawals, or at least don't advertise privacy, until 2.1–2.3 ship.** In the current flow the privacy claim is false for 100% of users.
- **Show the anonymity set in the UI.** Before a user withdraws, display "your withdrawal is hidden among N deposits." Warn when N is small, or when the user's own deposit is very recent relative to N.
- **Encourage waiting, and batch the guidance.** Tell users that waiting for more deposits and avoiding round-trip patterns improves their privacy.
- **Seed the pool carefully.** Team-seeded deposits do enlarge the set, but the team knows which notes are its own. For outside observers that is honest cover. For anyone who trusts the team to be the adversary, it is not.
- **Notify users whose withdrawals were already linked.**
- **Compliance is separate from this review.** Operating relayers for a mainnet mixing pool has legal and sanctions exposure (see the Tornado Cash history). Get counsel before running relayers or promoting privacy.

---

## 5. What marketing can say

"Withdrawals cannot be linked to deposits" is an absolute claim. It is false today, and it will still be too strong after the fixes, because timing, set size, and user behavior can link withdrawals without breaking any cryptography. No deployed mixer can honestly make that claim.

Suggested wording once 2.1–2.3 have shipped:

> "Zero-knowledge proofs hide which deposit a withdrawal came from. Withdrawals are submitted through a relayer, so your deposit wallet never touches your withdrawal. Your privacy grows with the number of deposits in the pool. The app shows you how large your anonymity set is before you withdraw."

Until then, the page should make no unlinkability claim.

---

## Summary

| Issue | Severity | Fix |
|---|---|---|
| Same wallet deposits and withdraws: `tx.from` links every withdrawal | **Critical, privacy completely lost** | Relayer or paymaster, no wallet connection on withdraw |
| Fresh recipient is funded by a transaction from the depositor | **Critical** (same root cause) | Same as above |
| `recipient` / `relayer` / `fee` possibly not bound in the proof | **Critical once relayers exist** (proofs can be stolen by front-running) | Make them public circuit inputs; get auditor confirmation |
| Merkle path fetched per leaf from a server, or note sent off-device | High (if present) | Client rebuilds the full tree locally |
| Small anonymity set at launch | High for early users | Show set size, warn, encourage waiting |
| Timing, root choice, fee fingerprint, behavior after withdrawal | Medium | Always use latest root, fixed fees, user guidance |
| RPC, relayer, and analytics metadata | Medium | Multiple relayers, custom RPC, no analytics on withdraw page |
