# Privacy Review — Private Withdrawals Pool (1 ETH notes, Ethereum mainnet)

**Reviewed:** the shipped user flow, not the cryptography. Per the brief, the
circuit, nullifier scheme, and verifier are assumed correct.

**Verdict: do not print "withdrawals cannot be linked to deposits."**

As shipped, a chain observer links essentially *every* withdrawal to its
deposit with near-certainty, using nothing but public data and a block
explorer. The cryptography is not the weak point; the transaction that
carries the proof is. And even after that is fixed, the claim is
unconditionally false as worded — the honest claim is probabilistic and
bounded by the pool's size.

---

## 1. What is public no matter what

Three things leak by construction and cannot be engineered away:

- **Participation.** `deposit()` is a public transaction from Alice's wallet.
  Everyone can see Alice used the pool. Privacy here is about *which*
  withdrawal is hers, never about *whether* she participated.
- **Cardinality.** Deposit count, withdrawal count, timestamps, and the pool
  balance are public. The upper bound on anonymity is the number of deposits
  in the tree — no protocol change raises it.
- **The root you prove against.** `root` is a public input. It pins the
  withdrawer's note to the leaf set that existed at that root. Proving
  against an *old* root shrinks the candidate set to the leaves present then.

Anything marketing says has to be compatible with all three.

---

## 2. The critical break: the withdrawal is self-relayed

Step 2 of the flow: *"Alice opens the app, connects her wallet ... and calls
`withdraw(...)`."*

That transaction is signed and paid for by Alice's wallet. `msg.sender` /
`tx.origin` is Alice. The `recipient` field being a fresh, empty address is
irrelevant — the sender field is right next to it in the same transaction.

The attack, in full:

1. Fetch all `Withdrawal` events. For each, read the transaction's `from`.
2. Fetch all `Deposit` events. For each, read the transaction's `from`.
3. Intersect. If Alice deposited and withdrew from the same wallet, that is a
   direct, certain link — no heuristics, no probability.
4. The fresh `recipient` is now attributed to Alice. Watch it forever.

**Effective anonymity set for this flow: 1.**

This is not a corner case; it is the default path for every user. It also
does *collateral* damage: every self-relayed withdrawal that an observer can
attribute is removed from everyone else's candidate set. With a small pool,
a handful of self-relayed withdrawals collapses the anonymity set for the
*honest* users too, by elimination.

**Sub-case — Alice uses a different wallet to withdraw.** Barely better. That
wallet needs ETH for gas, which came from somewhere. Trace the funding edge:
it leads to Alice's main wallet, or to an exchange withdrawal under her KYC.
The link becomes one hop longer, not absent. There is no way for a user to
self-fund a "clean" gas wallet without creating that edge.

**Sub-case — deposits already made.** Everything above applies retroactively
and permanently. Deposits and withdrawals made under the current design
cannot be un-leaked by a later fix. Anyone who has already withdrawn is
deanonymized for good.

---

## 3. Everything else a competent observer gets

Ordered by how much they actually buy an attacker, assuming §2 is fixed.

### 3.1 Small anonymity set (severity: high, structural)
A three-person team's fresh mainnet pool will have tens of notes, not
thousands. If there are 40 deposits, the best case for a withdrawal is "one
of 40" — and that is *before* any deposits are excluded by the heuristics
below. Realistically the working set is single digits. "Cannot be linked" is
not a defensible description of 1-in-8.

The set also shrinks over time in the observer's favour: they accumulate
partial attributions and remove candidates permanently.

### 3.2 Root selection (severity: high, cheap to fix)
If the app proves against a cached or stale root — e.g. the root the client
saw during the deposit session, or a root pinned at page load an hour ago —
the observer reads `root` off the withdrawal, resolves it to a leaf count,
and discards every deposit made after it. Worst case, a user who deposits and
withdraws against the root created by their own deposit has published "my
note is one of the first N," and if N is small they have identified
themselves.

The client must always prove against the **newest root in the contract's
history buffer** (allowing a small reorg margin), and must never derive the
root from anything user-specific.

### 3.3 Timing and behavioural correlation (severity: medium-high)
- Deposit-to-withdraw delay distributions are analysable. "Weeks later" is
  good, but if users cluster (everyone withdraws at ~30 days because the UI
  suggests it, or on the day of a price move), the ordering of deposits and
  withdrawals correlates.
- Withdrawals in the same block, or a few blocks apart, from a burst of
  activity are treated as one cluster by chain analysis.
- Time-of-day: a user who deposits at 03:00 UTC and withdraws at 03:00 UTC
  narrows themselves to the same timezone cohort.

### 3.4 Multi-note linkage (severity: high for anyone moving >1 ETH)
Fixed 1 ETH denominations mean 5 ETH = 5 deposits and 5 withdrawals. If the
5 deposits come from one address (they will — same wallet, sequential
nonces) and the 5 withdrawals happen in a burst, into 5 fresh addresses that
later merge, an observer matches the two clusters by size and timing. This
is the single most reliable heuristic against fixed-denomination pools after
the sender leak, and it defeats *any* amount of relayer hygiene.

### 3.5 Post-withdrawal address hygiene (severity: high, outside the protocol)
The fresh recipient is only clean until its first outgoing transaction. If it
later:
- consolidates into Alice's main wallet,
- sends to an exchange deposit address tied to her KYC,
- forwards the exact 1 ETH (minus gas) it received, or
- interacts with a contract Alice's main wallet also uses (same NFT mint,
  same DAO vote, same ENS resolver)

...the pool's guarantee is bypassed downstream. The protocol cannot prevent
this; the product can warn about it, and currently doesn't.

### 3.6 Network-level metadata (severity: high, invisible to chain analysis
but available to a small number of well-placed parties)
This is the leak teams most often miss because it is not onchain.

- **RPC provider.** In-browser proof generation means the client downloads
  the leaf set / deposit events from an RPC endpoint (Infura, Alchemy, your
  own node). That provider sees: the IP that connected the depositing wallet,
  and later the IP that pulled the tree and called
  `eth_sendRawTransaction` with the withdrawal. Same IP, same API key, same
  session cookie → link. Your default RPC provider can deanonymize the whole
  pool unilaterally, and so can anyone who subpoenas or breaches them.
- **Wallet-integrated RPC.** Connecting the wallet at withdraw time hands the
  wallet vendor the same correlation. There is no reason to connect a wallet
  to withdraw at all once relaying exists.
- **Filtered queries.** If the client ever queries "my deposit" by address or
  by commitment (a filtered `eth_getLogs`), it tells the RPC provider exactly
  which leaf the user cares about. The client must fetch the *entire* leaf
  set and search locally.
- **Frontend hosting.** Page analytics, error reporting (Sentry), fonts and
  scripts from a CDN, and the web server's own access logs each see
  deposit-time and withdraw-time visits from the same IP/browser
  fingerprint.
- **Mempool.** A withdrawal broadcast reveals the originating IP to peers
  running mempool surveillance before the transaction is even mined.

### 3.7 Transaction fingerprinting (severity: low-medium)
Gas limit, EIP-1559 `maxPriorityFeePerGas`, nonce patterns, and calldata
padding differ between wallet clients and configurations. These are weak
signals alone but are effective as tie-breakers once the set is small.

### 3.8 Recipient-binding / front-running (severity: not privacy, but check it)
Confirm that `recipient` (and, after the change below, `relayer` and `fee`)
are **constrained public inputs to the circuit**, not just calldata the
contract forwards. If they are not, a mempool watcher can copy a pending
proof, swap in their own recipient, and steal the 1 ETH. The audit covered
soundness of the verifier; make sure it covered this binding specifically.

---

## 4. What has to change

### P0 — required before any privacy claim at all

1. **Relaying. Remove the user's wallet from the withdrawal entirely.**
   - Contract: `withdraw(proof, root, nullifierHash, recipient, relayer, fee)`.
     Pay `fee` to `relayer` (or to `msg.sender`) and `1 ETH - fee` to
     `recipient`.
   - Circuit: `recipient`, `relayer`, and `fee` must be bound public inputs so
     no one can malleate them.
   - Client: no wallet connection on the withdraw path. The browser generates
     the proof and POSTs it to a relayer over HTTPS; the relayer submits and
     pays gas.
   - **Fix the fee to a single constant.** A user-adjustable fee is a
     fingerprint, and a fee that covers exact gas cost leaks the gas price at
     proof time.
   - Note the tradeoff honestly: the relayer learns `recipient` + your IP. It
     cannot steal funds and cannot see which deposit is yours, but it is a
     metadata trustee. Mitigate with several independent relayers, a
     user-selectable relayer list, and Tor-reachable endpoints. An
     ERC-4337 paymaster is an alternative shape with the same trust profile.
   - Until relaying exists, the self-withdraw path should be **disabled or
     behind an explicit "this will publicly link your deposit" interstitial**,
     not the default.

2. **Always prove against the newest available root** (with a reorg margin).
   Never cache a root across sessions. Never derive it from the user's own
   deposit.

3. **Fetch the whole leaf set; search locally.** No address-filtered or
   commitment-filtered RPC queries, ever, on either path.

4. **Split the RPC/network context between deposit and withdrawal.** Different
   endpoint, no shared API key or session, and in-app guidance (ideally
   enforcement) to use Tor/VPN for the withdrawal. Strip analytics, error
   reporting, and third-party assets from the app entirely — at minimum from
   the withdrawal page. Ship an IPFS build and document running it locally.

5. **Show the real number.** The UI must display the current anonymity set
   ("your withdrawal will be indistinguishable from N deposits") and block or
   hard-warn below a threshold. If the honest number today is 12, users
   deserve to see 12.

### P1 — required for the claim to mean much

6. **Randomized delay guidance, enforced in the UI.** Suggest a random wait
   drawn from a wide distribution rather than a fixed "wait 1 week" that
   everyone follows identically.
7. **Anti-clustering for multi-note users.** Detect that a user holds k notes
   and refuse to withdraw them in one session; stagger over days, to
   unrelated recipients, and warn that consolidating them later undoes
   everything.
8. **Post-withdrawal hygiene, in-product.** Explicit warning at withdraw time:
   do not send to an exchange, do not merge with your main wallet, do not
   forward the round amount.
9. **Deposit-side guidance.** Depositing directly from a KYC'd exchange
   withdrawal is common and makes the depositor's identity known from the
   start. It doesn't break the pool but it raises the stakes of every other
   leak.

### P2 — worth doing

10. Publish a written threat model and the measured anonymity set on the site,
    updated live. It is a better trust signal than an absolute claim, and it
    is the thing that stays true.
11. Consider whether fixed 1 ETH notes are the right denomination given §3.4;
    multiple denominations reduce note-count clustering but fragment the
    anonymity set. Measure before changing.

### Also flag (not privacy, but a launch blocker)
Deploying a mixer on Ethereum mainnet carries real regulatory exposure post-
Tornado sanctions, including for a three-person team operating a relayer and
a frontend. Get legal review before marketing anything.

---

## 5. What marketing can actually say

Not: *"withdrawals cannot be linked to deposits."* That is false today
(§2) and will still be an overstatement after every fix, because privacy here
is a set-size property, not a binary.

Defensible alternatives, once P0 ships:

- "Withdrawals reveal nothing about which deposit they came from, beyond the
  set of all N deposits in the pool. Current set size: N." *(true, and
  quantified)*
- "The pool never reveals the link between a deposit and a withdrawal. Your
  own network and wallet habits still can — see our privacy guide."
  *(honest about where the remaining risk lives)*

Both require the anonymity set to actually be large enough to be worth
saying. At launch, with a new pool, it will not be. Consider saying so and
letting the number grow.

---

## 6. Bottom line

| | Status |
|---|---|
| Cryptography | Sound (per audit) |
| Withdrawal transaction | **Broken — self-relayed, links sender to deposit** |
| Root selection | Unknown, likely leaky — verify |
| Network / RPC metadata | Broken — same client, same provider, both sides |
| Anonymity set at launch | Too small to make claims about |
| Downstream address hygiene | Unaddressed in product |
| Marketing claim as written | Not true now; not true even after fixes |

The single highest-value change is the relayer. Without it nothing else
matters; with it, everything else becomes worth doing.

---

## Unresolved questions

1. Are `recipient`, and any future `relayer`/`fee`, constrained public inputs
   in the circuit today, or only contract calldata?
2. Which root does the client currently select, and is it cached across
   sessions?
3. Does the client query deposits by address/commitment filter, or download
   the full leaf set?
4. Are there deposits/withdrawals on mainnet already? If so, they are
   permanently linked and those users need to be told.
5. Will the team run the relayer, and are you prepared for the legal exposure
   of doing so — or is a third-party/decentralized relayer set in scope?
6. What is the actual current deposit count?
