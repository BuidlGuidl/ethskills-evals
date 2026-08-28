# Privacy Review — Fixed-Denomination Withdrawal Pool

**Scope:** linkability of withdrawals to deposits in the app as shipped.
**Assumed correct (per auditor, not re-examined):** circuit soundness, Merkle membership, nullifier scheme, verifier contract.
**Verdict:** the claim "withdrawals cannot be linked to deposits" is **false for the current flow** — not marginally, but completely. A chain observer with a laptop and a free RPC key can link essentially every withdrawal to its deposit. The cryptography is fine; the transaction that carries the proof leaks everything the proof hides.

---

## 1. The core misunderstanding

The circuit hides **which leaf** in the tree the proof is about. It does not hide **who sent the transaction containing the proof**.

`withdraw(proof, root, nullifierHash, recipient)` is an ordinary Ethereum transaction. It has a `msg.sender`, it is signed by an EOA, that EOA pays gas, and that fact is in the chain forever. In the shipped flow, Alice signs and pays for the withdrawal **from the same wallet she deposited with**.

So the observer never has to break anything. They read the `from` field.

```
Deposit  tx: from=0xAlice   → Deposit(commitment=C, leafIndex=17)
Withdraw tx: from=0xAlice   → Withdrawal(nullifierHash=N, to=0xFresh)
```

The zero-knowledge proof correctly refuses to say that leaf 17 is Alice's. The transaction envelope says it for free. The anonymity set is **1**.

Everything else in this document is a problem that remains *after* you fix this one.

---

## 2. Threat model

Three distinct adversaries; marketing's unqualified claim implicitly promises safety against all three.

| Adversary | Capabilities | Cost |
|---|---|---|
| **A. Chain observer** | Full node / Dune / Etherscan. Sees all txs, senders, timing, gas, downstream transfers. | ~$0 |
| **B. Network observer** | A, plus RPC provider logs, frontend hosting/analytics logs, mempool peering, IP↔request correlation. Includes Infura/Alchemy themselves, and anyone who can compel them. | Low, or free if they *are* the provider |
| **C. Participating adversary** | A, plus deposits into the pool themselves to shrink the anonymity set from the inside ("flooding"). | 1 ETH per note |

The rest of this review is written primarily against **A**, since that is the weakest adversary and the claim already fails against it. B and C are called out where they change the answer.

---

## 3. Findings

Ranked by severity. P0 = the claim is false until fixed. P1 = the claim is false in realistic conditions. P2 = degrades the guarantee or misleads users.

### P0-1 — Withdrawal is self-sent and self-funded  *(fatal, single-handedly voids the claim)*

**What the observer does:** join the set of deposit senders against the set of withdraw senders on address equality. Every user who withdraws from their own wallet is deanonymized in one query.

```sql
select d.tx_from as depositor, w.recipient, w.block_time
from   deposits d join withdrawals w on d.tx_from = w.tx_from
```

This does not degrade gracefully. It is not probabilistic. It is an exact join, and it also reveals the fresh recipient address, so the "fresh, empty address" buys nothing.

**Fix (required):** the withdrawal transaction must not originate from any address the user's identity touches.
- **Relayer** (Tornado's approach): client submits `(proof, root, nullifierHash, recipient, relayerAddress, fee)` to a relayer over HTTPS; the relayer sends the tx and pays gas, taking `fee` out of the 1 ETH. The fee must be **inside the proof's public inputs** so a malicious relayer cannot rewrite recipient or fee. Confirm with the auditor that `recipient`, `relayer`, and `fee` are bound into the proof — if they are only calldata, a relayer can front-run and steal.
- **Or ERC-4337 + paymaster**, with the same requirement: the bundler/paymaster path must not be funded by, or traceable to, the depositor.
- **Or self-relay from a pre-funded, unlinked EOA** — only viable if that EOA's own funding is unlinked, which just moves the problem (see P0-2). Do not offer this as the default; at most an expert-mode option with an explicit warning.

**Also required:** the UI must make self-relaying *hard*, not just discouraged. If "withdraw from my connected wallet" is a one-click default, most users will click it.

---

### P0-2 — The fresh recipient address cannot pay its own gas

Even with a relayer, `0xFresh` receives 1 ETH minus fee and then has to *do something*. The two things users actually do:

1. Send gas to `0xFresh` from their main wallet so it can transact → **restores the link**, worse than before because it is now an explicit transfer.
2. Sweep from `0xFresh` back to their main wallet or to a CEX deposit address already KYC'd to them → **restores the link**, and hands it to the exchange too.

Since the note is a whole 1 ETH, `0xFresh` has funds and can pay its own gas — but only if the user never funds it externally. This is a UX property, not a cryptographic one, and users get it wrong.

**Fix:**
- Never generate or suggest funding of the recipient from the connected wallet. Actively detect it: if the connected wallet has ever sent to the entered recipient, block with an explanation.
- Warn at withdrawal time, in the flow (not in docs): "Anything you send from or to this address later can undo your privacy. Do not fund it from your main wallet. Do not consolidate it back."
- Consider defaulting the recipient to an address the app cannot associate with the session at all (user pastes it; no wallet-derived defaults, no "use my other account" picker).

---

### P0-3 — The withdrawal page connects the user's wallet

Connecting a wallet on the withdraw screen means the frontend — and its host, its analytics, and its RPC provider — observes `(mainAddress, recipientAddress, noteCommitment, IP)` **in one session**. Adversary B gets the mapping directly, no chain analysis required. This holds even after P0-1 and P0-2 are fixed.

Proof generation needs the Merkle path and the note. It does **not** need a connected wallet.

**Fix:** withdrawal requires **no wallet connection**. Paste note → fetch tree → prove in browser → hand the proof to a relayer. If a connected wallet is architecturally required somewhere, it must not be the depositing one, and that must be enforced, not advised.

---

### P1-1 — The anonymity set is small, and it is publicly countable

The proof hides *which* unspent deposit is being withdrawn. That is a guarantee of the form "one of *k*". Everyone can compute *k*:

```
k = (deposits with leafIndex ≤ index(root used)) − (withdrawals already made)
```

At launch, *k* is near zero. With three team members and a handful of early users, `k = 3` means a 33% guess; `k = 1` means certainty. An observer who deposits *n* of the pool's notes themselves (adversary C) subtracts their own from *k* — flooding a small pool is cheap and reduces users to a set of 1–2.

**Fix:**
- Display live anonymity-set size in the withdraw UI ("your withdrawal is indistinguishable from N other unspent deposits"), computed the same way an attacker would.
- Below a threshold (suggest **k < 20**, decide with the team), warn hard; below a smaller threshold, consider refusing the default flow.
- Accept that a small pool cannot deliver the marketing claim regardless of engineering. This is a liquidity problem, not a code problem.

---

### P1-2 — The `root` argument leaks an upper bound on deposit position

`root` is a public input, chosen by the client. It commits to a specific tree state, so the observer learns the deposit is at a leaf index **≤ the index at which that root was current**. A stale or cached root — e.g. one snapshotted around the time of the user's own deposit, or a root pinned by an old frontend build — can narrow the set to a handful of leaves, or to one.

**Fix:** always prove against the **most recent root** available (within the contract's historical-root window), fetched at proof time, never cached from deposit time. Add a client-side assertion: refuse to build a proof against a root more than X roots behind head. Verify how many historical roots the contract accepts — a large window is good for liveness and bad for privacy if clients use it lazily.

---

### P1-3 — Timing correlation

Deposits and withdrawals are timestamped. In a low-traffic pool, "the only deposit in the last 48h" and "the only withdrawal since" is a match without any address overlap. Weeks of delay (as in the described flow) helps a lot; same-day withdrawal helps not at all.

**Fix:**
- Guidance in-product: wait, and don't withdraw at a time that correlates with an event tied to you.
- Do not auto-withdraw, do not offer "withdraw as soon as it's safe" scheduling, do not batch a user's withdrawal right after their deposit.
- Note this is unfixable in code — it is bounded by pool traffic.

---

### P1-4 — Multi-note users leak through structure

A user needing 5 ETH deposits 5 notes and later withdraws 5. Distinctive patterns that recombine the identity:
- Five deposits in one block or one session from one address.
- Five withdrawals to the **same** recipient → those five notes are now provably one user, and the deposit-side cluster of five is an obvious match.
- Five withdrawals in a tight time window, even to different recipients.
- Downstream: `0xFresh` later moves exactly 4.9x ETH — an amount only reachable by ~5 notes.

**Fix:** distinct recipient per note (enforce, don't suggest — reject a recipient already used by this session), spread withdrawals over time, and say plainly in the UI that withdrawing many notes at once is self-defeating.

---

### P1-5 — Nullifier / note-status lookups leak before the withdrawal happens

Any "is my note still valid?" or "check note status" feature that calls `isSpent(nullifierHash)` — or that subscribes to events filtered on the user's commitment — tells the RPC provider and anyone on the path exactly which note this IP/browser holds, **before** and independently of the withdrawal. It also creates a pre-withdrawal timing signal.

**Fix:** compute note status locally from a full download of the spent-nullifier set / commitment set (or a large chunk of it), never from a targeted query. Same rule for fetching the Merkle path: fetch the whole tree or a wide range, never `getLeaf(myIndex)`.

---

### P2-1 — RPC, frontend, and mempool metadata

Same browser, same IP, same RPC key for deposit and withdrawal → adversary B links them regardless of every fix above. Additionally: the default MetaMask RPC, the frontend's analytics/error reporting (Sentry breadcrumbs routinely capture addresses), CDN and hosting logs, and mempool propagation from the user's node.

**Fix:**
- No analytics or error reporting on the withdraw path that can capture addresses, notes, commitments, or nullifiers. Audit what your error reporter serializes today.
- Ship an IPFS/self-host build and document Tor usage; do not claim Tor is unnecessary.
- Relayer submission should use a private mempool where practical, and the relayer must not log request IPs alongside recipients. **The relayer is now a trusted party for network-level privacy** — say so out loud. Multiple independent relayers, user-selectable, reduce but do not eliminate this.

### P2-2 — Fee and gas fingerprints

A distinctive relayer fee, an unusual gas price, or a unique gas-limit value can fingerprint a client build or a specific relayer, partitioning users into small buckets. Keep fee schedules uniform across users; do not let advanced users hand-tune gas on the withdraw path.

### P2-3 — Local note storage

Out of the chain-observer threat model, but in the product's promise: "saves her note locally" means localStorage or a downloaded file. Cloud-synced downloads folders, browser profile sync, and shared machines all leak notes. A leaked note is total loss of both funds and privacy. Encrypt at rest with a user passphrase and be explicit that cloud backup of the note file is a privacy decision, not just a durability one.

### P2-4 — Downstream taint

Independent of linkability: pool-sourced funds are increasingly flagged by exchanges and screening providers. A user who withdraws privately and then deposits to a KYC'd exchange may be deanonymized by that exchange and may have funds frozen. This is not a bug, but it must not be omitted from user-facing claims.

---

## 4. Required product changes

Blocking the marketing claim:

- [ ] **Relayer or paymaster path for withdrawals; self-send is not the default.** Confirm `recipient`, `relayer`, and `fee` are bound as public inputs to the proof.
- [ ] **No wallet connection on the withdraw flow.**
- [ ] **Latest-root enforcement** at proof time; reject stale roots client-side.
- [ ] **Live anonymity-set display + hard warning below threshold.**
- [ ] **Recipient hygiene enforcement:** reject a recipient the connected/depositing wallet has ever interacted with; reject recipient reuse across notes in a session.
- [ ] **No targeted RPC queries** for nullifier status or Merkle path.
- [ ] **Strip address-capturing analytics/error reporting** from the withdraw path.

Strongly recommended:

- [ ] In-flow privacy guidance: delay before withdrawing, don't sweep to your main wallet, don't fund the recipient, one recipient per note.
- [ ] Multiple relayers, user-selectable; documented relayer no-log policy.
- [ ] Self-hostable / IPFS build; Tor documented as supported.
- [ ] Encrypted note export.

---

## 5. What marketing can and cannot say

**Cannot ship (false as written, and false even after every fix):**
> "Withdrawals cannot be linked to deposits."

It is an absolute claim about an anonymity-set guarantee. The set is finite, publicly countable, and can be shrunk by a funded adversary. Today it is a claim about a system where the withdrawal is signed by the depositor.

**Defensible, after the P0 and P1 fixes land:**
> "Your withdrawal is cryptographically indistinguishable from every other unspent deposit in the pool. The app shows you how large that set is before you withdraw. Privacy depends on that number — and on you: don't reuse addresses, don't move funds back to the wallet you deposited from, and don't withdraw right after depositing."

**Also acceptable, shorter:**
> "Withdrawals reveal nothing about which deposit they came from — as long as the pool has other unspent deposits and you follow the on-screen guidance."

The honest framing is that the pool provides **anonymity among a measurable set**, not unlinkability. That is what the cryptography actually delivers, and it is a real and marketable property. Overclaiming here is also a legal exposure question, not only an engineering one — users make custody and disclosure decisions based on the launch page.

---

## 6. Residual risk after all fixes

Even with everything above done:

- **Small-pool statistics.** Low *k* is fatal and nothing in the code fixes it. Only usage does.
- **Global passive network adversary** correlating deposit and withdrawal sessions by IP/timing — reduced by Tor and relayers, not eliminated.
- **Relayer trust** for network-level metadata.
- **User error** — the dominant real-world failure mode, and largely outside your control once funds leave the pool.
- **Long-horizon clustering** as the withdrawn ETH moves and mixes with the user's other activity.

---

## 7. Open questions for the team

1. Are `recipient`, `relayer`, and `fee` public inputs bound into the proof, or plain calldata? (Determines whether a relayer can steal or redirect.)
2. How many historical roots does the contract accept, and what does the client currently pass?
3. Does the frontend today make any per-note RPC call (nullifier check, single-leaf fetch)?
4. What does the error reporter serialize on the withdraw path?
5. Relayer: run in-house, third-party, or both? What is the logging policy, and who can compel it?
6. What anonymity-set floor are we willing to warn or block at — and are we willing to hold the launch until the pool clears it?
