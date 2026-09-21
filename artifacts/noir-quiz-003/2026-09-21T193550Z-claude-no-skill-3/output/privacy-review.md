# Privacy Review: "withdrawals cannot be linked to deposits"

**Verdict: do not print this claim.** As shipped, a chain observer can link
every withdrawal to its depositor without breaking any cryptography. They
just read the `from` field of the withdrawal transaction.

The zero-knowledge proof hides *which note* is being spent. It does nothing
about *who sends the transaction*. Right now the app has Alice send it from the
same wallet she deposited with.

---

## 1. What we are taking as given

Per the audit, we treat these as correct:

- The circuit proves membership of a committed note in an onchain root, and
  reveals nothing else about which leaf it is.
- The nullifier scheme stops double-spends, and `nullifierHash` can't be linked
  to a commitment.
- The verifier contract is sound, and `recipient` is bound to the proof, so a
  front-runner can't redirect the payout.

Everything below is a leak *around* the proof. The auditor was not asked to
look at any of it.

---

## 2. The fatal leak: Alice's wallet sends the withdrawal

Step 2 of the shipped flow is "connect her wallet … and call `withdraw(...)`".
That makes the withdrawal an ordinary Ethereum transaction signed by Alice's
wallet. So:

| Onchain field of the withdraw tx | Value |
|---|---|
| `from` / `tx.origin` / `msg.sender` | **Alice's wallet**, the same address that called `deposit()` |
| gas payer | Alice's wallet |
| nonce | continues Alice's wallet history |

The observer's "attack" is just:

```
for each Withdrawal event:
    depositor = tx.from
    # done: recipient is linked to depositor
```

The fresh `recipient` address doesn't help. The transaction that funds it is
signed by the depositor. Anyone with Etherscan can make this link. You don't
need to be a *competent* observer.

It gets worse. Because of this leak, every *other* withdrawal becomes easier to
de-anonymize. Each deposit linked this way drops out of everyone else's
anonymity set. In a small pool, a few careless users can unmask the careful
ones.

### The obvious workaround also fails

"Use a different wallet for the withdrawal" doesn't work either. That wallet
needs ETH for gas, and the recipient is fresh and empty by design, so it can't
pay its own gas. Wherever the gas ETH comes from becomes the link:

- Funded from Alice's main wallet: linked, one hop away.
- Funded from a KYC'd exchange withdrawal: linked to Alice's identity, off-chain.
- Funded from another privacy tool: this is the problem we're supposed to solve.

**The product has to take gas payment off the user.** That needs a protocol
change, not a UI tweak.

---

## 3. Required product changes (blocking for any unlinkability claim)

### 3.1 Relayer-submitted withdrawals, with fee bound in the proof

Withdrawals have to be sent by a third party, a relayer, that is paid out of
the withdrawn note:

```
withdraw(proof, root, nullifierHash, recipient, relayer, fee, refund)
    -> pays (1 ETH - fee) to recipient, fee to relayer
```

- **`relayer` and `fee` (and `refund`, if supported) must be public inputs
  bound by the circuit**, like `recipient` already is. If they aren't, the
  relayer or a mempool front-runner can copy the proof and raise the fee to
  1 ETH, or swap in their own relayer address.
- This changes the circuit's public inputs, so **the circuit and verifier
  need to be re-audited and the trusted setup (if any) redone**. The current
  audit doesn't cover it.
- The contract should enforce `fee <= denomination` and pay `relayer`, not
  `msg.sender`. Otherwise the fee goes to whoever happens to submit the
  transaction.
- The frontend has to talk to the relayer directly, without going through the
  wallet. The withdraw screen should **not ask for a wallet connection at
  all**. Removing that step is the most important UX change.
- Run more than one relayer, or publish a relayer registry, so a single
  operator doesn't see every withdrawal request. Each relayer still sees the
  IP address and timing of the requests it handles. (See 4.4.)

An alternative is an ERC-4337 flow where the recipient is a counterfactual
smart account and a paymaster is reimbursed from the payout. That is a bigger
build with the same need: fees bound in the proof or checked by the contract.
Recommendation: build the relayer. It's the proven pattern.

### 3.2 Don't let the frontend recreate the link off-chain

- If the app keeps a session, local account, analytics ID, or SIWE login
  across the deposit and withdraw screens, the operator (us) can link the two.
  So can a third-party analytics script or anyone who subpoenas us. Withdraw
  should be a fresh, stateless flow with no wallet, no cookies, and no
  analytics.
- The Merkle path must be built from a **full download of the leaf set**, or
  something equally private. Don't fetch "the path for commitment X" from our
  API or from an RPC query that filters on the commitment. That sends the
  answer straight to the server.
- The note should be imported as a secret string. It must not be tied to a
  stored wallet address.

---

## 4. What a competent observer can still do after section 3 is fixed

Even with relayers, the claim "cannot be linked" is still false as an absolute
statement. The anonymity set is only as large as the plausible deposits. These
are the heuristics analysts actually run against Tornado-style pools:

### 4.1 Anonymity set size (the big one for a *small* pool)
A withdrawal can only come from deposits made before its `root`. If the pool
has 12 deposits, the best case is 1-in-12. Heuristics usually shrink that
further. At launch our set will be tiny. The claim has to be judged against
real pool size, not the design.

### 4.2 Timing correlation
- A withdrawal soon after a deposit, when few other deposits happened in
  between, is easy to link.
- Deposit and withdrawal at similar times of day or on similar weekdays point
  to the same person or timezone.
- **Stale roots:** the proof reveals which root it used. An old root means the
  deposit is among the leaves up to that root, and it hints at when the note
  was last synced. The frontend should always prove against the latest root.

### 4.3 Multi-note patterns
With fixed 1 ETH notes, someone moving 7 ETH makes 7 deposits and then 7
withdrawals. N deposits from one address followed by N withdrawals to one
recipient, or close together, stand out clearly. Mitigations: tell users in the
UI, send each withdrawal to a different recipient, and space withdrawals out
(with relayer-side delayed submission, if offered).

### 4.4 Network-level metadata (off-chain, but "competent observer" includes it)
- **RPC provider:** today the browser uses the wallet's RPC (often Infura or
  Alchemy by default). That provider sees Alice's IP address with the deposit,
  and the same IP address with the withdrawal proof. With relayers, the relayer
  sees the IP address instead. Recommendation: allow or suggest Tor, and don't
  send withdraw-time traffic through a provider that also saw the deposit.
- **Frontend host / CDN:** request logs link the same IP address to both
  flows.

### 4.5 Transaction fingerprinting
Before relayers, every withdrawal leaked Alice's wallet software through its
gas-price and priority-fee habits, and through its nonce history. Relayers
solve this, as long as a relayer's transactions look the same for every user.

### 4.6 What the recipient does afterwards
This is out of our control, but it's the most common way people de-anonymize
themselves. If the "fresh" recipient sends funds back to Alice's deposit
address, to an exchange account in her name, or to a contract she's known to
use, the link is back. The UI should warn about this plainly.

### 4.7 Deposit side
Deposits are public, and that's by design: everyone can see *that* Alice
deposited. The claim has to be read as "can't tell *which* withdrawal is
Alice's", not "no one knows Alice used the pool."

---

## 5. Summary

| Issue | Severity | Fix |
|---|---|---|
| Withdrawal sent by depositor's wallet (`tx.from`) | **Critical: total link, zero effort** | Relayer flow, no wallet on withdraw screen (3.1) |
| Gas funding of any alternative sender wallet | **Critical** | Same: relayer paid from the note |
| `relayer`/`fee` not bound in circuit | **Critical once relayers exist** (fund theft / griefing) | Add as public inputs, re-audit circuit + verifier |
| Frontend/session/API linking deposit↔withdraw | High | Stateless withdraw flow, full-leaf-set download, no analytics |
| Small anonymity set at launch | High | Be honest in copy; show live set size in UI |
| Timing / stale roots / multi-note patterns | Medium | Latest root by default, user guidance, optional delays |
| IP / RPC / CDN metadata | Medium | Tor-friendly, multiple relayers, minimal logging |
| Recipient's later behavior | User-dependent | UI warnings |

## 6. Recommended launch copy

"Cannot be linked" can't be promised by any pool of this design, and today it's
false in the most trivial way.

After section 3 ships (relayers + re-audit), something defensible would be:

> "Withdrawals are sent by a relayer and proven with zero-knowledge proofs, so
> the chain doesn't reveal which deposit a withdrawal came from. Your privacy
> depends on how many others use the pool and on how you use your funds
> afterward. [Privacy tips]"

**Until then, the launch page should make no unlinkability claim.** Otherwise
we'd be advertising privacy that any user of a block explorer can defeat. That
is a reputational problem, and possibly a legal one.
