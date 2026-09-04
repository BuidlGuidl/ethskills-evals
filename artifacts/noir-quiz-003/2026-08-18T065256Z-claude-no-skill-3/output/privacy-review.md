# Privacy Review — Private Withdrawals Pool (1 ETH notes, Ethereum mainnet)

**Scope:** what a chain observer can determine about *who withdrew*, given the flow as shipped.
**Assumed correct (per audit, not re-examined):** circuit membership proof, nullifier scheme,
verifier contract soundness.

**Verdict: do not print "withdrawals cannot be linked to deposits."**
As shipped, every withdrawal is linked to its deposit by a single field that anyone can read:
the `from` address of the withdraw transaction. This is not a subtle statistical attack. It is a
lookup. The ZK proof is doing its job and the product is throwing the result away.

Even after that is fixed, the claim as worded is unprovable — anonymity here is a *set size*, not a
binary property, and the set is small. Corrected copy is proposed in §5.

---

## 1. What the cryptography buys you, and what it doesn't

The circuit hides exactly one thing: **which** leaf in the tree the withdrawal corresponds to.

Everything else remains public and permanent:

- the full list of depositors (`from` of every `deposit()` call), with timestamps
- the full list of recipients, with timestamps and amounts
- the number of notes outstanding at any moment
- every withdraw transaction's sender, gas payer, nonce, gas params, and calldata

So the observer's job is not "break the ZK." It is "solve a bipartite matching between two public
lists." The proof removes the edges from the chain; the product puts them back.

**Threat model.** A "competent chain observer" is cheap here: an archive node, a spreadsheet, and
Etherscan-grade labeling. Everything in §2 costs approximately zero. Chainalysis/TRM-tier adversaries
add off-chain data (§3). No adversary in this document needs to break any cryptography.

---

## 2. On-chain findings (ranked)

### 2.1 — CRITICAL: Alice pays for her own withdrawal

> "Alice opens the app, connects her wallet, ... and calls `withdraw(...)`"

The withdraw transaction is signed by Alice's wallet — the same wallet that made the deposit. That
address is `tx.origin`, it is the gas payer, and it is in the transaction's `from` field forever.

An observer does:

```
for each withdraw tx W:
    depositor = W.from
    matching_deposit = first deposit() from that same address
```

Anonymity set: **1**. The fresh recipient address accomplishes nothing — it hides where the money
*went*, not who took it out. Alice has published "I withdrew" in the clearest possible terms and paid
gas to do it.

This single issue makes the pool's privacy guarantee approximately zero for any user following the
documented flow. It must be fixed before launch. Fix in §4.1.

> Sub-case, still broken: a user who "knows better" and submits from a second wallet. If that wallet
> was funded from her main wallet — or from the same CEX account, or from the same faucet/bridge —
> the funding transaction re-links it in one hop. There is no clean way for a user to self-fund an
> unlinked gas wallet without already having privacy. This is why relaying is structural, not a
> convenience feature.

### 2.2 — CRITICAL: anonymity set is small, knowable, and shrinking

Anonymity for a given withdrawal is bounded by:

```
N = (deposits inserted at or before the root used in the proof)
  − (deposits already withdrawn, i.e. spent nullifiers)
  − (deposits the adversary made themselves)
  − (deposits the adversary can attribute by other means)
```

Every term is publicly computable except the last, and the last only ever shrinks the set. For a
freshly launched pool from a three-person team, `N` is plausibly single digits for early users. At
`N = 1` the proof is decorative; at `N = 5` a "cannot be linked" claim is dishonest.

Two compounding effects:

- **Subtraction over time.** Each withdrawal permanently removes a note from every *other* user's
  future anonymity set. A pool that drains to empty retroactively resolves the entire matching:
  if all 12 deposits are eventually withdrawn and 11 links are known, the 12th is known too.
  Constraint-solving over the whole deposit/withdraw history is a small SAT/matching problem, not
  a research project.
- **Dust / flooding.** An adversary can deposit `k` notes themselves. The displayed pool size goes
  up; the *real* anonymity set of every honest user goes down by `k`, because the adversary knows
  which notes are theirs. Any anonymity-set number shown in the UI is an upper bound only.

### 2.3 — HIGH: the recipient address's future behavior

The recipient is fresh and empty. It is also, on arrival, an address with exactly one incoming
transaction of exactly 1 ETH from a known privacy pool — a loud, easily-indexed fingerprint. It
stays private only if it is never linked to Alice again. The common ways users destroy this within
days:

- sweeping the funds back to the main wallet, or to the same CEX deposit address used before
- funding the recipient with gas *from the main wallet* so it can move the money (extremely common —
  the fresh address has 1 ETH but users often top it up anyway, or spend from main to approve/bridge)
- generating the recipient as account #2 of the **same seed phrase** in the same wallet extension.
  The seed isn't visible on-chain, but same-wallet accounts co-occur constantly: same dapp
  approvals, same session, both signing to the same contract within minutes, matching gas-price
  fingerprints, occasionally both as inputs to the same flow.
- using the recipient in any activity that carries identity (ENS, NFT mint tied to a social account,
  a bridge with KYC, a Safe co-signed with the main wallet)

You cannot control this in the contract, but the product currently gives zero guidance and the
default path (connect main wallet → get a payout address) actively encourages the co-location.

### 2.4 — MEDIUM: timing correlation

Deposits and withdrawals are timestamped. In a low-traffic pool, "deposit at T, sole withdrawal at
T + Δ" is often enough on its own, especially when:

- withdrawals cluster in a user's local waking hours (timezone leak across repeated use)
- a user deposits and withdraws in the same session, or within one block window
- a user makes several deposits and withdraws them in the same order they were deposited
- there is exactly one withdrawal in a multi-day window

Weeks of delay (as in the described flow) helps and is the right default, but only in proportion to
how many *other* deposits landed in that window. In a quiet pool, delay buys little.

### 2.5 — MEDIUM: the root chosen in the proof

`withdraw(proof, root, ...)` publishes which historical root the proof was made against. That root
pins the tree to a specific size, which means: **every deposit inserted after that root is excluded
from the anonymity set.**

Using the *latest* root is nearly free (the deposit must causally precede the withdrawal anyway).
Using a *stale* root is a real leak, and stale roots happen by accident:

- the root is cached at page load and used minutes/hours later
- the root was saved alongside the note at deposit time and reused at withdraw time — this is the
  worst case, since it narrows the set to deposits existing at Alice's own deposit moment, often
  a handful
- proof generation is slow in-browser and the client doesn't refresh before submitting

Client must fetch the newest root immediately before proving, and the contract's root history
window must be long enough that this doesn't cause reverts under load.

### 2.6 — MEDIUM: wallet and transaction fingerprinting

Even with a relayer in place, if a user ever self-submits anything related, the transaction carries:
gas-price/priority-fee strategy (wallet-specific and often user-specific), EIP-1559 vs legacy type,
nonce sequencing, calldata gas padding, the exact RPC's mempool propagation timing, and — if
submitted via a private orderflow endpoint — that endpoint's identity. These are weak signals alone
and strong in aggregate across repeated use by the same person.

### 2.7 — Verify: is `recipient` bound into the proof?

The audit covered membership, nullifier soundness, and verifier correctness. Those do **not**
imply that the public inputs are bound against tampering. If `recipient` (and, once added, `relayer`
and `fee`) is not a public input committed to by the proof, then any mempool observer can lift the
proof out of the pending transaction, resubmit it with their own `recipient`, and steal the note.

That is a theft bug, not a privacy bug, but it lives in the same function and it's cheap to confirm.
Please verify explicitly before launch. Same check for `fee` and `relayer` when §4.1 lands.

---

## 3. Off-chain findings

These fall outside "chain observer" but must be closed for marketing's claim to be defensible,
because they collapse the same link with less effort than any on-chain analysis.

### 3.1 — HIGH: RPC provider correlation

The app runs in the browser and talks to an RPC endpoint (Infura/Alchemy/your own node). That
provider sees, tied to an IP address:

- the `eth_call`s / log queries used to sync the Merkle tree
- `eth_sendRawTransaction` for both the deposit and, later, the withdrawal

Same IP, both events, timestamped. If MetaMask's default endpoint is used, the provider also
associates the account address with that IP. One provider — or one subpoena — deanonymizes the whole
pool, relayer or no relayer. Note this survives every on-chain fix in §4.

### 3.2 — HIGH: a single team-operated relayer is a new central deanonymization point

The fix in §4.1 is mandatory, but a lone relayer sees requester IP, recipient, and timing for every
withdrawal — i.e. it holds exactly the linkage the pool is supposed to destroy. It must not be a
single logging service run by the same three people who run the frontend.

### 3.3 — MEDIUM: frontend hosting, analytics, and note storage

Any analytics/error reporting (Sentry, GA, Vercel logs) on the withdrawal page correlates wallet
address, IP, and session across the deposit and withdraw visits. A privacy tool should ship with
none of it. Separately, notes stored in `localStorage` are a forensic link between the two events on
the same device/profile — acceptable, but should be a deliberate, documented choice with an
export/import path.

---

## 4. Required product changes

### 4.1 — Blocking: relayed withdrawals (fixes §2.1)

Add relayer support to the contract and make it the **only** default path in the UI.

- Extend the withdrawal's public inputs to `(root, nullifierHash, recipient, relayer, fee, refund)`,
  all bound into the proof so a relayer cannot rewrite `recipient` (see §2.7).
- The relayer submits and pays gas; its fee is deducted from the 1 ETH note; recipient receives
  `1 ETH − fee`.
- The user's wallet is not needed at withdraw time at all. Ideally the withdrawal page does not
  request a wallet connection — the note file is the only input required. This removes an entire
  class of user error and is also the clearest signal to users that self-submitting is wrong.
- Use a fixed or coarsely-quantized fee schedule so payout amounts don't become a per-relayer or
  per-gas-price fingerprint.
- Support multiple independent relayers, chosen by the client (randomly, or by user selection), with
  a documented no-logs policy. Do not ship with exactly one, team-run relayer (§3.2).
- If self-submission is retained as an escape hatch, it must be behind an explicit interstitial that
  states plainly: *this publicly links your withdrawal to this wallet.* No default, no one-click.

### 4.2 — Blocking: stop making the absolute claim (fixes §2.2)

Show the honest number instead. In the withdraw UI, before confirming:

- current anonymity set size, computed as unspent notes at the root being used
- an explicit statement that this is an **upper bound** (adversary-owned deposits reduce it, §2.2)
- a warning below some threshold (e.g. `N < 20`) recommending waiting for more deposits
- optionally, a launch-phase minimum: refuse or strongly discourage withdrawal while `N` is tiny

This is also the honest fix for the marketing problem: the guarantee is quantitative, so publish the
quantity.

### 4.3 — Blocking: always prove against the newest root (fixes §2.5)

Refresh the root immediately before proof generation; never persist a root with the note; never
reuse a page-load-time root. Confirm the contract's root history window is large enough that a
freshly-fetched root can't go stale during proving + inclusion under mainnet load.

### 4.4 — Required: recipient hygiene, enforced by the product (mitigates §2.3)

- Generate the recipient key **outside the connected wallet's seed**, in-app, and hand it to the
  user as an exportable key — do not suggest "make a new account in MetaMask."
- Warn explicitly, at withdraw time, against: sweeping to the main wallet, funding the recipient
  from the main wallet, and sending to the same CEX deposit address used before.
- Consider defaulting the recipient to a destination that isn't a bare EOA under the same person's
  operational control (e.g. a CEX deposit address the user creates fresh, or an onward transfer) —
  but document the tradeoff, since CEX deposits reintroduce KYC linkage of a different kind.

### 4.5 — Required: randomized delay guidance (mitigates §2.4)

Default the UI toward waiting, show how many deposits have landed since the user's own, and
discourage same-session deposit→withdraw. Do not present "withdraw now" as the primary action after
depositing.

### 4.6 — Required: close the RPC/analytics channels (fixes §3.1, §3.3)

- Ship zero analytics and zero error reporting on the deposit and withdraw pages.
- Do not use a single default RPC across both flows. Options, roughly in order of strength: let the
  user configure their own node; route through the relayer for reads; document Tor/VPN use
  prominently and test that the app works over it.
- Publish the frontend as a reproducible static build (IPFS + pinned hash) so users aren't forced
  through your host.
- Whatever you cannot fix here, state in the docs. "Your RPC provider can link your deposit and
  withdrawal unless you use your own node" is a sentence users can act on.

### 4.7 — Confirm: proof-input binding (§2.7)

Verify `recipient`/`relayer`/`fee` are committed public inputs. Cheap to check, catastrophic if not.

---

## 5. What marketing can actually say

Not defensible:
- ~~"Withdrawals cannot be linked to deposits."~~
- ~~"Fully private" / "untraceable" / "anonymous."~~

Defensible after §4.1–§4.3 ship:

> **"The protocol does not reveal which deposit a withdrawal came from. Your withdrawal is hidden
> among the pool's other unspent deposits — currently N. Privacy grows with the size of the pool,
> and depends on how you handle your payout address."**

Supporting line, honestly stated:

> "We can't prove a negative for you: if you reuse your payout address, fund it from your main
> wallet, or withdraw when the pool is nearly empty, the link can be reconstructed. The app shows
> your anonymity set before every withdrawal."

The distinction that matters: the protocol makes no *cryptographic* link; users and infrastructure
can still create *behavioral* and *metadata* links. Say that, and the claim survives scrutiny —
including from the researchers who will absolutely run this analysis on your pool in week one and
publish it.

---

## 6. Open questions

1. Does the current `withdraw` bind `recipient` into the proof's public inputs? (§2.7 — blocking to answer)
2. How many roots does the contract retain, and does the client refresh before proving? (§2.5)
3. Are note secrets derived deterministically from a wallet signature? If so, withdrawal implicitly
   requires the deposit wallet to be connected — which fights §4.1 — and a signature over that same
   message on a phishing site leaks the note. If yes, this needs its own review.
4. Is a relayer in scope for launch? If not, launch has no privacy story and the copy must say so.
5. Expected pool size at launch, and are you willing to gate withdrawals below a minimum `N`?
6. Who operates the relayer(s), and what is the retention policy for request logs?
