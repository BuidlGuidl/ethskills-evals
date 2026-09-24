# Privacy Review: Withdrawal Unlinkability

**Question:** Can marketing say "withdrawals cannot be linked to deposits"?

**Short answer: No, not with the flow as shipped.** The cryptography is sound
(we take the audit as given), but the withdrawal transaction is **sent from
Alice's own wallet**, the same one that made the deposit. Anyone who reads the
chain sees that the depositor and the withdrawer are the same address. The
zero-knowledge proof hides which leaf Alice is spending. It does nothing about
who signs and pays for the transaction that carries the proof.

---

## 1. What a competent chain observer learns today

### 1.1 The fatal leak: `tx.from` on withdraw

Step 2 says Alice "connects her wallet … and calls `withdraw(...)`". So the
withdrawal transaction's sender (`tx.from` / `msg.sender`) is an EOA that
Alice controls, almost certainly the one she deposited from. An observer can:

1. List all `deposit()` senders (public: `tx.from` plus the commitment/leaf index).
2. List all `withdraw()` senders (public: `tx.from`, `recipient`, `nullifierHash`).
3. Join the two lists on address.

Result: **deposit → withdrawal → recipient is fully linked, with certainty,
using one SQL join.** The "fresh, empty" recipient only adds a hop. The
observer sees Alice's address send a tx that pays 1 ETH to the recipient.

Even if Alice uses a *different* wallet to send `withdraw()`, the problem
comes back one step earlier. The recipient is empty and can't pay gas, so
*some* funded account has to submit the tx, and that account got its ETH from
somewhere. If Alice funds a "burner" gas wallet from her main wallet or a KYC'd
exchange account, the observer follows that funding transfer instead. **As
long as the user pays her own gas, the product can't provide unlinkability.**
This is the main reason Tornado-style systems use relayers.

### 1.2 Secondary leaks that remain after fixing 1.1

These are statistical, not deterministic, but they matter a lot for a *small* pool.

| Leak | What the observer learns | Severity for us |
|---|---|---|
| **Anonymity set size** | A withdrawal can only be one of the deposits that were in the tree at the `root` it proves against, minus notes already withdrawn. With few deposits the set is tiny, and with 1 depositor it's zero. | **High.** A new, small pool is exactly where this bites. |
| **Timing correlation** | Deposit at T, withdrawal soon after, few other deposits in between → strong heuristic link. Unique cadence patterns (deposit Mon 9am, withdraw Mon 9am weeks later) also leak. | High while volume is low |
| **Count/amount patterns** | Fixed 1 ETH denominations help, but "deposit 7 notes in one day, 7 withdrawals to related recipients in one day" re-links them. | Medium |
| **Root selection** | The submitted `root` bounds when the deposit happened: the note must be in the tree *at that root*. If the client uses a stale or cached root, it narrows the candidate deposits. | Low–Medium, easy to fix |
| **Recipient behavior** | If the recipient later sends funds back to Alice's known address, to her KYC'd exchange deposit address, or interacts with the same contracts/ENS names, the link is recovered off-pool. | High in practice, user-driven |
| **Transaction fingerprints** | Gas price/priority-fee style, wallet software quirks, time-of-day, and calldata encoding differences can cluster txs to one user. | Low–Medium |
| **Network layer** | The wallet's RPC provider (e.g., Infura via MetaMask) and the public mempool see the IP address that broadcasts `withdraw()`. The same IP broadcast `deposit()`. | Medium: not onchain, but visible to RPC providers, mempool watchers, and subpoenas |
| **Our own frontend/backend** | Step 2 has Alice *connect her deposit wallet* to the app at withdraw time. Even if that wallet never signs the withdraw tx, our frontend, analytics, RPC endpoint, and WalletConnect relay can log "address X loaded the withdraw page and generated a proof at time T". We become the party who can de-anonymize users. | Medium–High (and a legal/subpoena liability for the team) |

---

## 2. Required product changes

Ordered by priority. Item 1 is a hard blocker for any unlinkability claim.

### 2.1 Blocker: take the user's wallet out of the withdraw transaction

**Add a relayer path, and make it the default:**

- The browser generates the proof and sends `(proof, root, nullifierHash,
  recipient, relayer, fee)` to a relayer over HTTPS. Ideally the browser does
  this over Tor, or at least without cookies or wallet context.
- The relayer submits `withdraw()` from **its own** address and pays gas. The
  contract pays `1 ETH - fee` to `recipient` and `fee` to `relayer`.
- **`relayer` and `fee` (and `recipient`) must be public inputs bound by the
  proof.** Otherwise a relayer or mempool front-runner can take the proof and
  change the recipient or raise the fee. **This changes the circuit and the
  verifier, so it needs a re-audit.** The current audit covers a circuit that
  (presumably) binds only `recipient`.
- Don't make the team the only relayer. A single team-run relayer sees every
  user's IP and timing, which just moves the linkage point to us. Support a
  permissionless relayer registry, or at minimum document the trust
  assumption.
- Alternative with the same effect: an ERC-4337 paymaster that sponsors gas
  for the fresh recipient's smart account, validates that the call is a
  well-formed `withdraw()`, and gets repaid from the withdrawal. The same
  public-input binding requirement applies.

A "self-relay" option can remain for advanced users. Label it clearly: *"The
address that submits this transaction is publicly visible. Do not use your
deposit wallet or any wallet funded from it."*

### 2.2 Do not connect a wallet on the withdraw screen

Withdrawal needs only the **note** (stored locally) plus the public tree data.
Remove the "connect wallet" step from the withdraw flow entirely. Fetch tree
data from a public endpoint or an indexer that doesn't receive user
identifiers. Strip analytics, and don't log IPs on the proof/relay endpoints.

### 2.3 Always prove against the latest root

The client should fetch the current root at proof time and use it. It should
never reuse a root cached from deposit time.

### 2.4 Protect users from small-anonymity-set withdrawals

- Show the **current anonymity set** (deposits since this note's deposit,
  minus withdrawals) before withdrawal. Warn or block below a threshold (e.g.,
  < 50–100).
- Warn if the note is younger than N hours/days, or if very few deposits
  happened after it.
- Encourage (don't force) random delays, and discourage withdrawing many notes
  at once to related recipients.

### 2.5 User guidance in the app

Short and in the flow, not buried in docs:

- Never send withdrawn funds back to your deposit address or to an exchange
  account tied to your identity.
- Don't fund the recipient address from a linked account before or after.
- Withdrawing right after depositing, in a small pool, provides little privacy.

---

## 3. What the launch page can honestly say

Even after all of section 2, "**cannot** be linked" is an absolute claim that
no pool of this design can guarantee. Unlinkability is probabilistic. It
depends on anonymity set size, which starts small at launch, and on user
behavior after withdrawal, which we don't control.

**Current flow:** no privacy claim is defensible. Withdrawals *are* trivially
linked to deposits.

**After 2.1–2.3 ship (re-audited):** suggested wording:

> "Withdrawals carry no onchain link to your deposit. The zero-knowledge proof
> shows only that *some* deposit in the pool is being spent, never which one.
> Your privacy grows with the number of deposits in the pool and depends on
> how you use withdrawn funds. [Learn more]"

The "Learn more" page should state the anonymity-set and timing caveats from
§1.2 directly.

---

## 4. Summary

| | As shipped | After required changes |
|---|---|---|
| Direct onchain deposit↔withdraw link | **Yes, via `tx.from`** | No |
| Link via gas funding | Yes (any self-paid gas) | No (relayer/paymaster pays) |
| Frontend/RPC can link | Yes (wallet connected at withdraw) | Minimized (no wallet, no logging) |
| Statistical linking (timing, small set) | Yes | Reduced; depends on pool volume and user behavior |
| "Cannot be linked" claim | **False** | Still overstated; use the qualified wording above |

The cryptography does its job. The leak is in the transaction plumbing around
it: who sends the transaction and who pays the gas. That's what has to change
before any privacy claim goes on the launch page.
