# Privacy Review — Private Withdrawals Pool (1 ETH notes, Ethereum mainnet)

**Scope:** the shipped user flow, not the cryptography. Circuit soundness, nullifier
scheme, and verifier are taken as correct per the prior audit. Everything below is
about what leaks *around* the proof.

---

## Verdict

**Do not print "withdrawals cannot be linked to deposits." As shipped, every
withdrawal is linked to its deposit by a single public field: `msg.sender`.**

The ZK proof hides *which note* is being spent. The transaction that carries the
proof hides nothing. Alice deposits from wallet A and withdraws from wallet A, so
the anonymity set for her withdrawal is exactly one — herself. The fresh recipient
address does not help; `recipient` is a public calldata argument, so the observer
also learns that the new address belongs to A.

Net effect today: **the pool provides zero unlinkability**, and additionally burns
a fresh address for the user by publicly tagging it.

One change is mandatory (P0 below). Even after all fixes, the marketing claim still
needs rewording — unlinkability in this design is probabilistic and bounded by the
anonymity set, not absolute.

---

## What a competent observer actually determines today

No specialist tooling required. A single Etherscan session or a ~30-line script over
the contract's logs:

1. Index all `Deposit`/`CommitmentInserted` events → `(depositor, commitment, leafIndex, block)`.
2. Index all `withdraw` transactions → `(msg.sender, nullifierHash, recipient, block)`.
3. Join on sender address.

Output per user:

| Observable | Source | What it gives up |
|---|---|---|
| Alice deposited 1 ETH | `Deposit` tx from A | A is a pool participant |
| Alice withdrew | `withdraw` tx from A | A's deposit is now spent |
| Deposit↔withdrawal link | same `msg.sender` on both | **complete deanonymization** |
| Payout address R | `recipient` calldata | R is A's, and R holds 1 ETH of "mixed" funds |
| Holding period | block delta | behavioral profile |

Because A is the sender, the observer never has to guess. There is no ambiguity to
resolve, no statistics, no heuristic. If A's identity is known off-chain (exchange
withdrawal, ENS, prior donation, Twitter-linked address), the payout address R
inherits that identity permanently.

Second-order: R's onward spending is now tainted. Anything R touches later — a CEX
deposit address, an NFT mint, a consolidation back into A — extends the identified
cluster.

---

## Leak inventory, ranked

### P0 — Sender identity (fatal, breaks the entire product)

`withdraw()` is called from the depositing wallet. This is the whole ballgame. See above.

Note the sub-problem that makes the naive fix fail: "just tell users to withdraw from
a fresh wallet" does not work either, because a fresh wallet has no ETH for gas. The
user funds it from A (direct link), or from an exchange (KYC link), or from another
of their addresses (cluster link). **Gas payment is part of the privacy design, not
an afterthought.** A withdrawal path that requires the user to source gas themselves
leaks by construction.

### P0 — Is `recipient` bound into the proof?

Out of stated scope, but must be checked before the relayer fix (below) is even
possible, and it is a live theft risk today.

The audit confirmed membership soundness and nullifier soundness. That is **not** the
same as confirming that `recipient` is a public input constrained by the circuit. If
`recipient` is merely a contract argument and not part of the proof's public inputs,
then any observer watching the mempool can copy `(proof, root, nullifierHash)`, swap
in their own recipient, and pay a higher priority fee — stealing the note. The
nullifier check does not prevent this; it just means the victim's own tx reverts.

Confirm that the circuit's `pub` parameters include `recipient`, and — once relaying
is added — `relayer` and `fee` as well, all bound before the public-input array is
assembled. If they are not, this is a mainnet fund-loss bug independent of privacy.

### P1 — Anonymity set size

A "small pool" is the operative phrase. Unlinkability equals `1 / (plausible
candidates)`. Concretely, with 40 deposits and 30 withdrawals, a withdrawal narrows
to ~10 candidates before any other signal is applied — roughly 3.3 bits of privacy.
That is not a privacy guarantee; it is a shortlist.

Related, and often missed:

- **Elimination.** Every note is spent exactly once. Each externally-resolved link
  shrinks the set for everyone else. Drain the pool and the residual is solvable.
- **Last-note problem.** The final unspent deposit is identified with certainty when
  it is withdrawn.
- **Root choice.** A proof verifies against a specific root, which existed at a
  specific block. That bounds the deposit to *at or before* that block. Clients that
  prove against a cached or stale root leak a tighter bound than necessary. Always
  prove against the newest accepted root.

### P1 — Timing correlation

Deposit at 14:32, withdraw at 14:47, in a low-traffic pool, is a link even with a
perfect relayer. Also leaking: time-of-day clustering (a consistent 09:00–17:00
UTC-5 window fingerprints a timezone across both transactions), and a
deposit→withdraw delay that is stable per user.

### P1 — Multi-note behavior

Fixed 1 ETH denomination is the right call and removes amount fingerprinting *per
note*. It does not survive users moving more than 1 ETH:

- 5 deposits from A in one block, then 5 withdrawals to a single recipient R,
  is a matched pair of size-5 patterns. Common-recipient clustering is the single
  most effective mixer heuristic in practice.
- Even split across 5 recipients, if they are all funded/spent together later, they
  re-merge into one cluster.

### P2 — Network layer and frontend

The chain observer is not the only observer, and these leaks defeat the relayer fix
if left alone:

- **RPC provider.** MetaMask's default RPC sees the deposit and the withdrawal from
  the same IP. So does any Alchemy/Infura key you ship. That operator can do the join
  you removed from chain.
- **Targeted tree queries.** If the frontend finds `leafIndex` by querying an indexer
  or subgraph filtered on Alice's specific commitment, that query links her session to
  her note directly. Rebuild the tree by replaying *all* insert events, or serve a
  full snapshot.
- **Telemetry.** Analytics, Sentry, wallet-connect session data, and error reporting
  on the withdraw path all carry correlatable session identity.
- **Mempool.** Broadcasting through a node that logs sender IPs, or a private relay
  that does, reintroduces the link off-chain.
- **Wallet fingerprint.** Gas-limit padding, priority-fee habits, and nonce patterns
  differ by wallet software and by user, and are visible on both transactions.

### P2 — Device / note storage

Notes in `localStorage` are readable by anyone with device access and by any XSS on
the origin. Not a chain-observer issue, but it is the practical failure mode for real
users, and losing the note means the funds are unrecoverable.

---

## What has to change

Mandatory before the claim is defensible:

1. **Remove the depositing wallet from the withdrawal path entirely.**
   - Ship a **relayer**: the user's browser generates the proof and posts it to a
     relayer, which submits the tx and pays gas. The user never signs a withdrawal.
     `recipient`, `relayer`, and `fee` must be public inputs bound into the proof
     (see P0 above), or the relayer can redirect the payout.
   - Alternative: ERC-4337 with a paymaster that sponsors the withdrawal UserOp.
     Same binding requirement; note the bundler/paymaster becomes the trusted party.
   - **The withdrawal page should not require a wallet connection at all.** Note in,
     proof out, relayer submits. If there is no connected wallet, there is no
     `msg.sender` mistake to make.
2. **Make the mistake unmakeable, not just documented.** If self-submission is kept
   as a fallback, the UI must check the sender against the depositor set and block
   it, with an explicit warning. Do not rely on a docs page.
3. **Decentralize the relayer, or the link just moves.** A single relayer sees
   `(recipient, IP, timing)` for every withdrawal — one subpoena or one log file
   undoes the design. Ship multiple independent relayers, let the user pick, publish
   a no-logs policy you can actually keep, and support self-hosting.

Strongly recommended:

4. **Surface the anonymity set in the UI.** "You are 1 of N" on the withdraw screen,
   with a hard warning below a threshold. Users cannot reason about privacy they
   cannot see. Consider gating the marketing claim on N reaching a stated floor.
5. **Enforce a delay.** A contract-level minimum block delta between the root a note
   was inserted under and its withdrawal is cheap and blunt-effective. Layer a
   randomized recommended wait in the UI on top.
6. **Guide post-withdrawal behavior in-product**, at the moment of withdrawal:
   one recipient per note; do not consolidate; do not send straight to a KYC exchange;
   space multi-note withdrawals across hours or days. Ideally the UI refuses to reuse
   a recipient address it has already seen.
7. **Network hygiene as a default, not advice.** Separate RPC endpoints (or a
   user-supplied one) for the withdraw flow, no telemetry on that path, full event
   replay for the tree mirror, Tor/VPN guidance shown inline.
8. **Always prove against the newest accepted root**, and keep a rolling `knownRoots`
   window so proofs don't race new deposits.

---

## What marketing can honestly say

Not defensible, at any point:
- ~~"Withdrawals cannot be linked to deposits."~~
- ~~"Anonymous."~~ / ~~"Untraceable."~~

Defensible **after** the P0 fixes ship:

> "Withdrawals reveal no on-chain link to your deposit. Your privacy depends on how
> many notes are in the pool and on how you handle the funds afterwards — the app
> shows you both."

Or shorter:

> "No on-chain link between your deposit and your withdrawal."

The qualifier is not legal throat-clearing. It is the actual security model: this
design provides *k*-anonymity within the pool, and *k* is a number that changes daily
and that the user's own behavior can collapse to 1. Claims of absolute unlinkability
in this product category also draw regulatory attention out of proportion to their
accuracy — worth a look from whoever handles that before launch copy is final.

---

## Unresolved questions

1. Is `recipient` a bound public input in the circuit today? (Blocks the relayer work
   and is a standalone fund-loss risk.)
2. Current deposit count and unspent-note count on mainnet — what is *k* right now?
3. Is anything already deployed and holding user funds, or is this pre-launch? Changes
   whether P0 is a fix or a migration.
4. Relayer: build, use an existing network, or 4337 paymaster? Determines whether
   `fee`/`relayer` circuit changes force a redeploy of the verifier and pool.
5. Is the pool contract upgradeable? A minimum-delay check and any circuit change
   both require a redeploy otherwise — and a redeploy splits the anonymity set.
6. How does the frontend currently resolve `leafIndex` — full event replay or a
   targeted indexer query?
