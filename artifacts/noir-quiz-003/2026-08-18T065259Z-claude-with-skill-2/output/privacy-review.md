# Privacy Review — Private Withdrawals Pool

**Scope:** the shipped user flow, not the cryptography. Circuit soundness,
nullifier scheme, and verifier are taken as correct per the audit. Everything
below is about what leaks *around* the proof.

**Reviewed:** flow as described in `TASK.md`. No application code was available
in this workspace, so items marked **[verify]** are things I could not confirm
and you must check against the actual implementation.

---

## Verdict

**Do not print "withdrawals cannot be linked to deposits."**

As shipped the claim is not merely weak — it is false in the strongest possible
sense. Alice submits the withdrawal from the same wallet she deposited from, so
`msg.sender` on the withdraw transaction *is* the depositor. The link is
deterministic, requires no heuristics, no clustering, no statistics, and is
already visible in Etherscan's default UI. The ZK proof hides which leaf she
spent from everyone except the one observer who matters: the person reading the
transaction she signed.

The fresh recipient address does nothing here. It hides where the money goes to
someone who somehow missed the sender field. It does not hide who withdrew.

After fixing that (relayer / paymaster + burner submission), the claim still
cannot be made unconditionally. What you can honestly say is a *bounded*
statement — see [What marketing can actually say](#what-marketing-can-actually-say).

---

## Threat model

Three observers, in ascending capability. The marketing claim, unqualified,
implies you beat all three.

| # | Observer | Capability |
|---|----------|-----------|
| **O1** | Passive chain observer | Full node + archive. Sees every tx, sender, recipient, calldata, timestamp, gas price. Free. |
| **O2** | O1 + app infrastructure | Also sees RPC request logs, IPs, frontend analytics, relayer logs. Available to your RPC provider, your host, your relayer, or anyone who subpoenas them. |
| **O3** | O1 + active participation | Also deposits into the pool itself (sybil), runs a relayer, or watches the mempool. Cheap against a small fixed-denomination pool. |

---

## Part 1 — What an observer determines *today*

### 1.1 The full deposit→withdrawal link (O1, deterministic) — **P0**

```
Block N:      0xAlice  → pool.deposit()                    [commitment C]
Block N+~50k: 0xAlice  → pool.withdraw(π, root, nh, 0xFresh)
```

The withdraw transaction is signed by, and gas-paid by, `0xAlice`. An observer
filters the pool's `withdraw` calls, reads `tx.from`, and cross-references the
deposit list. Every withdrawal is attributed to a named depositor and to a payout
address, with certainty. This is a two-line indexer script.

Nothing else in this document matters until this is fixed.

### 1.2 Collateral damage to other users — **P0**

This is worse than a per-user problem. Every user who self-submits removes
themselves from *everyone else's* anonymity set. If your pool has 12 deposits and
9 users self-submitted their withdrawals, the three careful users are hiding in a
crowd of 3, not 12. Your least sophisticated users set the privacy ceiling for
your most sophisticated ones — so this cannot be left as a documentation warning
or an "advanced mode." It has to be the only path the product offers.

### 1.3 Public regardless of any fix

Even in the ideal deployment, O1 always learns:

- The complete list of depositor addresses and deposit times. Deposits are not
  anonymous and were never meant to be.
- That a withdrawal occurred, at time T, paying 1 ETH to address R.
- The size of the pool and therefore the maximum possible anonymity set.
- That the withdrawer is *some* member of the depositor set committed in the
  proven root.

"You are one of N depositors" is the entire product. Everything below is about
whether N is actually N.

---

## Part 2 — What still leaks after the `msg.sender` fix

Assume from here: burner wallet + relayer, no self-submission.

### 2.1 Gas funding of the burner (O1) — **P0**

A "fresh, empty address" cannot pay for its own first transaction. If the fix is
"use a burner wallet" without a relayer, the burner must be funded, and that
funding transaction is the link — you have added exactly one hop and lost nothing
else. Same for the recipient: if Alice later funds `0xFresh` with gas from a
linked address in order to move the 1 ETH, the link is restored.

This is why the fix is specifically a **relayer or ERC-4337 paymaster** — a third
party who pays gas and deducts the fee from the note itself — and not merely
"use a different wallet."

### 2.2 Anonymity-set size (O1) — **P0**

Privacy is `1/N`, and you describe the pool as small. At N=5 an observer has a 20%
prior on any given withdrawal before applying a single other heuristic; combined
with timing (2.4) that usually resolves to certainty. There is no cryptographic
fix — you buy N with adoption and with product rules that stop users from spending
it.

Note also that N is not "total deposits ever." It is the number of leaves in the
root you proved against, minus every depositor the observer has attributed by
other means (§1.2, §2.3, §2.7).

### 2.3 Root selection (O1) — **P0** **[verify]**

`withdraw` takes `root` as an argument, so the contract accepts a set of roots.
The root you choose is public and it names a *prefix* of the tree: your leaf must
be in it. Anything older than the newest accepted root shrinks your anonymity set
to the deposits made before that root.

The dangerous version of this is a natural implementation: the note stores the
root observed at deposit time (a common field in note schemas), and the withdrawal
proves against it. That root points almost exactly at Alice's own leaf — the
anonymity set collapses to the deposits present at the moment she deposited, and
in a small pool that can be a set of one.

**Check:** what root does the client select at proof time? It must be the newest
accepted root, always, refetched at proof time — never a cached or note-stored one.

**Tradeoff:** current-root-only is the tightest policy but makes withdrawals fail
whenever anyone deposits between proof generation and inclusion. Keep a bounded
recent-root window in the contract for liveness, and have the client always pick
the newest. The window is a liveness allowance, not a menu.

### 2.4 Timing correlation (O1) — **P1**

The weeks-long delay in your flow is genuinely good and should be preserved. But
in a low-traffic pool, timing is still often decisive: if only one deposit is
outstanding, any withdrawal is that depositor, regardless of delay. If deposits
arrive in bursts and withdrawals follow at a characteristic lag, pairs fall out.

Product-side mitigations: enforce a minimum delay, randomize the suggested
withdrawal window, and surface the current anonymity set so users don't withdraw
into an empty pool.

### 2.5 Downstream consolidation (O1) — **P1**

The recipient is fresh and clean for exactly as long as it stays untouched. The
moment the 1 ETH moves to Alice's main wallet, a CEX deposit address with her KYC
attached, or anything else in her cluster, the link is reconstructed one hop past
your protocol. This is outside your contract but not outside your product's
responsibility if you are claiming unlinkability.

Related and more damaging: **multiple notes to one recipient.** If Alice deposits
5 notes and withdraws all 5 to the same address, an observer sees a 5-ETH address
funded exclusively by the pool, and the candidate set collapses to depositors who
deposited exactly 5 times — usually one person. One fresh recipient per note,
spread over time. The product should generate these and refuse to reuse one.

### 2.6 Off-chain metadata (O2) — **P1**

The proof is generated in-browser and submitted through the user's wallet RPC.
That RPC provider saw the deposit transaction from Alice's IP weeks earlier and
now sees the withdrawal from the same IP. No chain analysis required. Same for
frontend analytics, error reporting, and your own logs.

Also **[verify]**: how does the client rebuild the tree? Full replay of
`CommitmentInserted` events is fine. If it instead queries your backend for a
specific `leafIndex`'s siblings, that backend learns exactly which leaf is about
to be spent, and holds the deanonymization for every user in one place.

### 2.7 Sybil deposits (O3) — **P1**

Against a fixed-denomination pool of a few dozen notes, an adversary deposits 20
notes of their own, waits, and now knows 20 of the leaves. Every other user's
anonymity set is reduced by 20. The capital is fully recoverable — they withdraw
it later — so the attack costs only gas and time. Small pools are structurally
cheap to hollow out this way, and you cannot detect it.

### 2.8 Fingerprinting (O1/O3) — **P2**

Distinctive gas-price settings, wallet-client quirks, identical odd values, and
round-number timing have all been used successfully to cluster mixer withdrawals
in practice — including against pools orders of magnitude larger than yours. A
relayer flattens most of this because the relayer, not the user, builds the
transaction. That is an additional argument for the relayer over the
fund-a-burner approach.

---

## Part 3 — One thing the audit's scope did not cover

### 3.1 Recipient binding — **P0, security not privacy** **[verify]**

The audit covered membership, the nullifier scheme, and verifier soundness. It
did not, as stated, cover whether `recipient` is bound into the proof.

If `recipient` is a bare calldata argument and *not* a public input to the
circuit, then the proof is valid for any recipient. Anyone watching the mempool —
including the relayer you are about to introduce — can copy the proof, swap in
their own address, and steal the note. The proof still verifies; the nullifier
still marks it spent; Alice gets nothing.

This is latent today because Alice submits her own transaction and front-running
her only redirects her own funds to the attacker (still a theft, but the surface
is one block). It becomes structural the moment you add a relayer, because the
relayer is *handed* a valid proof and asked to please use the right recipient.

**Required:** `recipient`, the relayer fee, and the relayer address must be public
inputs to the circuit, checked by the contract against the calldata. This is
exactly why Tornado's circuit has them. Confirm this before shipping the relayer,
not after.

---

## Part 4 — Required product changes

### P0 — the claim is false without these

1. **Withdrawals must not be submitted by the depositor's wallet.** Ship a relayer
   or an ERC-4337 paymaster that pays gas and takes its fee out of the 1 ETH note.
   Not an advanced option, not a warning banner — the default and, ideally, the
   only path. Self-submission should be removed from the UI or require typing a
   confirmation that says it is public.
2. **Bind `recipient` + fee + relayer address into the circuit as public inputs**
   (§3.1). Verify before shipping the relayer.
3. **Never fund a burner or recipient from a linked address.** With a relayer,
   nothing needs funding. If a "bring your own gas" path exists, remove it.
4. **Always prove against the newest accepted root**, refetched at proof time.
   Never a note-stored or cached root (§2.3).

### P1 — needed for the claim to mean anything

5. **Surface the live anonymity set** ("you are hiding among N deposits") and
   block or hard-warn below a threshold. N=5 should be a stop, not a note.
6. **Enforce a minimum deposit→withdraw delay** and randomize the suggested
   window.
7. **One fresh recipient per note.** Generate it in-app, refuse reuse, and warn
   explicitly against consolidating payouts or sending them onward to a known
   address.
8. **Relayer must not be your frontend host or your RPC provider,** must not log
   IPs or recipients, and should be documented as a trust assumption. A relayer
   that also served Alice's deposit page sees both ends.
9. **Strip telemetry from the withdrawal path.** No analytics, no error
   reporting, no server-side note storage. Ship a self-hostable frontend and
   let users point at their own RPC; document Tor/VPN as recommended, not
   optional-sounding.
10. **Rebuild the tree by full event replay client-side** (§2.6). No
    per-`leafIndex` server queries.

### P2 — hygiene

11. Discourage batch deposits from one wallet, and batch withdrawals entirely.
12. Let the relayer normalize gas parameters rather than passing user preferences
    through.
13. Publish the anonymity-set size and pool history openly. Users cannot reason
    about `1/N` if you hide N — and a competitor's chain analysis will publish it
    for you.

---

## What marketing can actually say

The unqualified claim never becomes true. Even a perfect deployment leaks the
depositor list, the withdrawal times, and `1/N`. The honest framing is bounded and
conditional, and it is still a good pitch:

> **Accurate:** "Withdrawals are cryptographically unlinkable to deposits: a
> withdrawal can be traced only to the set of all depositors, never to an
> individual one. Your privacy grows with the pool — the app shows your current
> anonymity set before every withdrawal."

> **Also fine:** "We never learn which deposit you are withdrawing, and neither
> does the chain."

Things that must not appear:

- "Cannot be linked" / "untraceable" / "anonymous" — unqualified, and false at
  any N.
- "Fully private" / "zero-knowledge means no one can tell" — conflates the
  circuit's guarantee with the system's.
- Any claim that implies protection from off-chain observers (§2.6) without the
  self-hosting and network caveats.

A false unqualified claim is also its own risk: users who believe "cannot be
linked" will consolidate payouts, reuse recipients, and withdraw into an empty
pool — the exact behaviors that deanonymize them. Overclaiming does not just
mislead them, it makes them less safe.

---

## Open questions

1. Is `recipient` currently a public input to the circuit? (§3.1 — blocks the
   relayer work.)
2. Which root does the client select at proof time — newest accepted, or the one
   stored in the note? (§2.3)
3. Does the contract accept a bounded root history or `currentRoot` only?
4. How does the client obtain Merkle siblings — full client-side event replay, or
   a backend query? (§2.6)
5. Are you willing to run a relayer yourselves, or use a third-party
   paymaster? This is a real operational and trust decision, not just an
   integration.
6. Current pool size and deposit rate? That number determines whether any of
   this is worth shipping yet, or whether the honest move is to delay launch
   until N is large enough to mean something.
