# Privacy Review — Private Withdrawals Pool

**Scope:** product/operational privacy of the shipped user flow. Circuit soundness,
nullifier scheme and verifier correctness are treated as correct per the prior audit.
Nothing below is a cryptography finding — every finding is a leak *around* the proof.

---

## 1. Verdict

**Do not print "withdrawals cannot be linked to deposits."** As shipped, withdrawals are
linked to deposits *trivially and deterministically* — not statistically, not with
heuristics. A junior analyst with a block explorer can do it.

The reason is a single line in the flow description:

> Alice opens the app, **connects her wallet**, generates the membership proof in-browser,
> and calls `withdraw(proof, root, nullifierHash, recipient)`

`withdraw` is an Ethereum transaction. Its `from` field is public. Alice's depositing
wallet signs and pays for it. The ZK proof hides *which leaf* she spent; the transaction
envelope announces *who she is* in plaintext, one field over. The fresh recipient address
buys nothing — it just gets permanently tagged as Alice's the moment the transaction
lands.

The pool is currently a 1-ETH-denominated self-transfer with extra steps and a much worse
gas bill.

Even after this is fixed (§4), "cannot be linked" remains an absolute claim that no mixer
of this design can support. The achievable claim is *1-in-N*, and N is small, shrinking,
and user-controlled. Proposed replacement copy is in §6.

---

## 2. Adversary model

Three distinct observers. Marketing's claim, as written, implicitly covers all three.

| # | Observer | Capability |
|---|---|---|
| A | **Chain observer** | All blocks, all logs, all calldata, full history, unlimited time. Free. This is the baseline. |
| B | **Chain observer + public tagging** | Above, plus Etherscan labels, CEX deposit-address clusters, ENS, Arkham/Nansen-style attribution, published team addresses. Free-to-cheap. |
| C | **Infrastructure observer** | Above, plus the RPC provider / relayer / frontend host: IP addresses, request timing, `eth_call` patterns, wallet fingerprints. Not the chain — but it is the party your users' browsers talk to. |

Findings are ordered by what it costs the observer to run them.

---

## 3. What an observer can actually determine today

### L1 — `msg.sender` on `withdraw` is the depositor. *(Critical — defeats the entire product)*

Observer A trace, no heuristics required:

```
block 20,100,000  from 0xAlice   Pool.deposit()   value 1 ETH   commitment 0xc0ffee…
   … weeks pass …
block 20,240,000  from 0xAlice   Pool.withdraw(proof, root, nullifierHash, 0xFresh)
block 20,240,000  Pool → 0xFresh  1 ETH
```

Two rows, same `from`. The link is *direct*: deposit → withdrawal → recipient. Note what
this costs the observer beyond the link itself: `0xFresh` is now provably Alice-controlled
and is worse than a normal address, because it is a *flagged mixer output* attributable to
a named party. The product actively harms the user versus doing nothing.

This also collapses everyone else's anonymity set. Every self-withdrawal is a note the
observer can strike off the candidate list for all remaining users (see L2).

**A relayer is not optional in this design. It is the design.** Tornado shipped one on day
one for exactly this reason.

### L2 — Anonymity set is tiny, shrinking, and computable. *(High)*

The proof says "I am one of the commitments under root R." The set is not "everyone who
ever deposited." An observer computes the true candidate set as:

```
candidates = { deposits included in root R }
           − { deposits whose notes are already provably spent }
           − { deposits with publicly known owners (team/test/CEX-funded) }
           − { deposits made after the withdrawer's known activity window }
```

Consequences for a small pool:

- **Subtraction is monotone.** Each withdrawal permanently shrinks the set for everyone
  who withdraws later. Privacy decays over the pool's life; it does not accumulate.
- **The last withdrawal has an anonymity set of exactly 1.** If the pool drains, the final
  withdrawer is deanonymized by arithmetic. Second-to-last is 1-in-2.
- **Your own test deposits count against you.** Three founders doing eight test deposits in
  a twenty-deposit pool means real users hide in a crowd of twelve, not twenty.
- **Early users have the worst privacy and are never told.** The user who deposits into a
  6-note pool has ~1-in-6 at best, and the UI currently gives them no signal.

A pool with a few dozen notes does not deliver anonymity in any meaningful sense. This is a
scale property, not an implementation bug — but shipping it silently is a product bug.

### L3 — Timing correlation. *(High)*

Deposit and withdrawal timestamps are public and precise to the block. Observer B:

- Withdrawals shortly after a deposit narrow the set hard — often to one candidate.
- Deposit and withdrawal in the same hour, day, or a repeated weekly cadence is a
  fingerprint even across many notes.
- Users are time-zone-shaped. A pool with international users leaks a lot from
  "withdrawals only ever happen 09:00–18:00 UTC+1."
- "Weeks later" in the described flow is genuinely helpful — but it is currently a user
  habit, not a product guarantee, and the UI does nothing to encourage it.

### L4 — Root selection leaks a deposit-time upper bound. *(Medium)*

The proof is public-input-bound to a specific root R. R corresponds to a known tree state
at a known block. Alice's commitment must already be in R, so the observer learns:
*her deposit happened at or before insertion #k*. If the client proves against a root
cached at note-creation time, or against anything but the newest accepted root, this
pins the deposit into a narrow window and can single it out.

Always prove against the **latest accepted root** at withdraw time. Accept a rolling window
of recent roots onchain (reorg/race tolerance), but have the client always pick the newest.

### L5 — Gas funding graph. *(High — this is where naive relayer fixes fail)*

Suppose L1 is "fixed" by telling users to withdraw from a burner. That burner needs gas.
Where does it come from?

- Funded from Alice's main wallet → the link is restored one hop out, and now it looks
  deliberate.
- Funded from a CEX withdrawal → the link is restored *with KYC attached*.
- Funded from another mixer note → burns a second note to spend the first.

There is no self-serve funding path that preserves the property. Gas must be paid by a
party unconnected to Alice — a relayer paid out of the withdrawn amount, or a sponsoring
paymaster. Anything else moves the leak, it does not remove it.

### L6 — `recipient` is not bound into the proof. *(Critical, security — and blocks the fix)*

From the signature `withdraw(proof, root, nullifierHash, recipient)`: unless `recipient` is
a **public input of the circuit**, the proof is valid for *any* recipient. Consequences:

1. **Theft.** Anyone watching the mempool copies `(proof, root, nullifierHash)`, substitutes
   their own address, and front-runs. The withdrawal is stolen with no cryptography broken.
2. **The relayer fix is impossible without it.** You cannot hand a proof to an untrusted
   relayer if the relayer can rewrite the payout address.

The audit covered membership and double-spend, which is a different question from *payload
binding*. Verify this explicitly against the circuit source: `recipient` — and, once
relaying exists, `relayer`, `fee`, and `refund` — must all be `pub` circuit inputs checked
by the contract against the call arguments. Bind them even if unused by the circuit logic;
inclusion as a public input is what makes the proof non-malleable.

### L7 — Post-withdrawal fund handling. *(High — outside your code, inside your promise)*

The fresh recipient is private only while it stays isolated. Users routinely destroy this
within days:

- Consolidating the 1 ETH back into the main wallet — the single most common failure.
- Sending to the same CEX **deposit address** they've used before (deposit addresses are
  per-account and are the strongest identity link on Ethereum).
- Paying gas for anything identity-linked: an ENS renewal, an NFT mint into a known
  collection, a token approval on a wallet already tagged.
- Sending to *another* recipient that later merges with a tagged address.

Fixed 1 ETH denominations make this worse, not better: an exact 1 ETH inflow followed by a
`1 ETH − gas` outflow is a conspicuous, easily-scanned pattern.

### L8 — Multi-note correlation. *(Medium–High)*

Anyone moving more than 1 ETH holds multiple notes. Observer B looks for:

- **Burst matching.** 5 deposits in one session, 5 withdrawals in one session, weeks apart —
  matched by count alone, regardless of which recipient is which.
- **Shared recipient.** Two withdrawals to the same address prove the same owner spent two
  notes and merges both candidate sets.
- **Downstream merge.** Five "independent" fresh addresses that all forward into one wallet
  are one user, retroactively.
- **Sequential nonces.** Multiple deposits from one wallet at consecutive nonces are
  self-evidently one batch.

### L9 — Transaction fingerprints. *(Medium)*

Beyond `from`, the envelope carries style:

- Gas limit and EIP-1559 `maxPriorityFeePerGas` values are wallet- and settings-specific;
  an unusual tip setting reused across deposit and withdrawal is a match.
- Nonce sequencing and account age.
- Direct-to-public-mempool submission exposes the originating node to peers; a private
  relay endpoint (or the relayer's own submission path) does not.

Individually weak. Combined with a set already reduced to a handful by L2/L3, frequently
decisive.

### L10 — Infrastructure-layer linkage. *(High vs. observer C; invisible onchain)*

Not a chain leak, but it falsifies the marketing claim just as completely:

- **RPC provider.** If the browser uses one default RPC endpoint for both deposit and
  withdrawal, that provider sees both requests from the same IP, plus the event-log queries
  used to rebuild the tree. It can link deposit to withdrawal *even if the chain cannot*.
  A `eth_getLogs` sweep of the pool's commitment events followed minutes later by an
  `eth_sendRawTransaction` of a withdrawal, same IP, is unambiguous.
- **Frontend host and analytics.** Any analytics, error reporting (Sentry et al.), or even
  a CDN access log on the withdraw page correlates by IP.
- **The relayer itself.** Whoever you add in §4 becomes observer C. It sees the recipient
  and the submitter's IP. It must be treated as untrusted: multiple independent relayers,
  no logging commitments you can't honour, and Tor/VPN guidance for users.
- **Local device.** The note in browser `localStorage`, keyed to your origin, is durable
  forensic evidence linking the user to the pool. Offer an encrypted note export/import
  and a real delete.

---

## 4. What has to change

Grouped by whether it is required for the claim, or merely required for the claim to be
*honest*.

### P0 — Required before any privacy claim can be made at all

1. **Break the `msg.sender` link. Remove the self-withdraw path from the UI entirely.**
   Two viable mechanisms:
   - **Relayer (Tornado model).** The client sends `(proof, root, nullifierHash, recipient,
     relayer, fee)` to a relayer over HTTPS; the relayer submits and pays gas, taking `fee`
     out of the 1 ETH. The user's wallet never signs anything at withdraw time — ideally is
     never connected on that page.
   - **ERC-4337 + paymaster.** A fresh smart account withdraws; a paymaster sponsors gas.
     Same binding requirements; more moving parts; better UX.

   Either way: the withdraw page should not need a wallet connection. If it asks for one,
   users will use their main wallet, because it is right there. Design the leak out — do not
   warn about it.

2. **Bind `recipient`, `relayer`, `fee` (and `refund` if you support it) as public circuit
   inputs**, checked by the contract against the call arguments (L6). Without this the
   relayer can steal, and without a relayer P0.1 is unachievable. This is a circuit change
   and needs a re-audit of the modified circuit and contract.

3. **Run ≥2 independent relayers, and let users pick or bring their own.** A single
   first-party relayer means your company can deanonymize every user, which makes the
   marketing claim false with respect to *you*. Publish the relayer's data-handling policy
   and actually implement it (no persistent request logs).

### P1 — Required for the claim to be honest rather than technically-arguable

4. **Surface the anonymity set in the UI, at deposit and at withdraw.** Compute the live
   set (deposits under the chosen root, minus spent nullifiers) and show it: *"Your
   withdrawal will be indistinguishable from 43 other deposits."* Below a threshold
   (suggest 20 — pick one and defend it), show a blocking interstitial, not a footnote.
   Users cannot reason about a property you don't display.

5. **Enforce timing hygiene by default (L3).** Recommend, and default to, waiting until
   *K new deposits* have entered after yours — a deposit-count condition is a far better
   privacy metric than elapsed time. Offer a randomized-delay scheduled withdrawal via the
   relayer. Consider a contract-level minimum delay; weigh against the UX and
   funds-availability cost, and decide explicitly.

6. **Always prove against the newest accepted root** (L4). Keep a rolling accepted-root
   window onchain for reorg tolerance, but never let the client prove against a root cached
   at note-creation time.

7. **Strip the withdraw path.** No analytics, no error reporting, no third-party scripts, no
   fonts/CDNs on that page. Let users set a custom RPC and default to a different provider
   than the deposit path uses. Document the Tor/VPN recommendation prominently (L10).

8. **Ship real post-withdrawal guidance** (L7) as a mandatory step in the flow, not a docs
   page: do not consolidate; do not send to a previously-used CEX deposit address; do not
   pay gas from this address for anything identity-linked; treat it as single-use.

9. **Multi-note discipline** (L8). If a user holds several notes, the client should default
   to staggering withdrawals across days, to distinct recipients, and should warn loudly
   before reusing a recipient.

### P2 — Hardening

10. **Encrypted note export/import**, replacing bare `localStorage` as the primary store;
    a real delete that clears it.
11. **Publish an honest privacy model** — this document's §5, in user-facing language,
    linked from the launch page.
12. **Exclude and disclose team/test deposits**, or seed the pool transparently so users
    can discount them from the set (L2).
13. **Legal review before launch.** A mainnet mixer carries regulatory exposure independent
    of its privacy properties, and the marketing copy is itself a legal artifact. This is
    for counsel, not for this review — but do not print the page before they see it.

---

## 5. What still leaks after everything above is fixed

Even with a relayer, bound recipient, a healthy pool and disciplined users, an observer
still learns all of the following. This is inherent to the design, not a backlog item:

- That a withdrawal occurred, in which block, for exactly 1 ETH.
- The recipient address, and everything it does afterwards, forever.
- That the withdrawer is one of the *N* unspent depositors under root R — with N computable
  by anyone, and typically far smaller than the total deposit count.
- The full deposit side. Deposits are public by construction: who deposited, when, how
  many notes. Only the *link* is hidden, and only to within 1-in-N.
- Whatever the relayer knows: recipient plus submitter IP.

Therefore: **the strongest true statement is 1-in-N unlinkability, with N disclosed.**
"Cannot be linked" is not a strong version of that claim — it is a different claim, and a
false one.

---

## 6. Proposed launch copy

Do not ship:

> ~~"Withdrawals cannot be linked to deposits."~~

Ship something in this shape (final wording is marketing's, accuracy is not):

> **Withdrawals are not linked to deposits onchain.** When you withdraw, the network sees
> only that the funds came from *someone* in the pool — currently **1 of N depositors**.
> Your privacy depends on the size of the pool, how long you wait, and what you do with
> the funds afterwards. [How this works →]

Non-negotiables for whatever wording lands:

- No absolutes: "cannot", "impossible", "untraceable", "anonymous" — all falsifiable, all
  invite a researcher to falsify them publicly at launch.
- Show live N on the page. A claim with a number in it is credible; one without is not.
- State that deposits are public. Users get this wrong constantly and act on the mistake.
- Name the user's responsibilities (timing, recipient handling) as part of the claim, not
  in a footnote.

A mixer that overclaims gets a hostile writeup within a week of launch. A mixer that states
1-in-N honestly, and shows the number, gets taken seriously.

---

## 7. Open questions

1. Is `recipient` currently a public input of the circuit (L6)? If not, the pool is
   drainable by mempool front-running today and this is P0-security, not P0-privacy.
2. What is the live pool size and the largest historical anonymity set? Everything in §4
   is differently urgent at 30 deposits versus 3,000.
3. Root-acceptance policy: rolling window of recent roots, or current-root-only? Which root
   does the client actually select at proof time?
4. Is there any first-party relayer today, or is self-withdrawal the only path? If a relayer
   exists but is optional, what fraction of withdrawals used it?
5. Which RPC provider does the frontend default to, and is it the same on the deposit and
   withdraw pages (L10)?
6. Are any analytics, error reporting, or CDN-hosted assets present on the withdraw page?
7. How many of the current deposits are team/test notes, and are those addresses public?
8. Is a contract-level minimum withdrawal delay acceptable to the product, given the
   funds-availability cost?
