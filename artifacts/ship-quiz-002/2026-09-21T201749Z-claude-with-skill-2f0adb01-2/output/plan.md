# Architecture — Translator Marketplace

## The one decision everything else follows from

The ranking formula changes weekly. Onchain state is permanent and migrating it is
expensive. So **the contracts never learn what a "score" is.**

Contracts store *facts that must outlive us*: who funded how much USDC, which job was
accepted, which credential was attested by whom. Those facts are cheap to verify and
never need to change shape. Everything that interprets those facts — weights, decay
curves, penalties, the search index — lives offchain where a config change ships in an
afternoon.

A translator can prove "these 47 jobs and these 3 credentials are mine" from a public RPC
node with our API offline. They cannot prove "I rank #4" — and they shouldn't be able to,
because that number is our editorial opinion and we change it every week.

## Chain: Base

- Native Circle USDC (not bridged), which is the settlement asset.
- Escrow funding, delivery, and acceptance are three transactions per job — high
  frequency, low value each. Base makes that a rounding error.
- Smart wallets / account abstraction: translators are freelancers, not crypto users. We
  can sponsor gas on acceptance so they never touch a gas token.
- EAS (Ethereum Attestation Service) is deployed on Base, so credentials need no contract
  of ours at all.

One chain. No bridging, no multi-chain reputation reconciliation.

## Contracts: 1 of ours, 1 borrowed

### `JobEscrow.sol` (ours)

Holds USDC and records job outcomes. The whole contract, conceptually:

```solidity
struct Job {
    address client;
    address translator;
    uint96  amount;        // USDC, 6 decimals
    uint64  fundedAt;
    uint64  acceptedAt;
    bytes32 termsHash;     // keccak256 of the offchain job spec
    bytes32 deliverableHash;
    Status  status;        // Funded | Delivered | Accepted | Disputed | Refunded
}
mapping(bytes32 jobId => Job) public jobs;
```

Note what is *not* in that struct: language pair, word count, deadline, rate, category,
quality rating. All of that is in `termsHash` — a commitment to an offchain JSON doc
pinned to IPFS and emitted in the event. When product decides next month that jobs need a
"subject domain" field or a "rush" flag, we change a JSON schema, not a storage layout.
The commitment still verifies.

Functions, and who calls each:

| Function | Caller | Why they call it | If nobody calls it |
|---|---|---|---|
| `fundJob(jobId, translator, amount, termsHash, uri)` | Client | It's how work starts; no escrow, no translator | No job exists. Fine. |
| `submitDeliverable(jobId, deliverableHash, uri)` | Translator | Prerequisite to getting paid | No payment. Client refunds after timeout. |
| `acceptAndRelease(jobId)` | Client | Ends the job, releases USDC | **Failure mode** — see below |
| `autoRelease(jobId)` | Anyone, after `ACCEPTANCE_WINDOW` (14d) from delivery | Translator calls it to get paid | Only if translator abandons own money |
| `raiseDispute(jobId, reasonHash)` | Client or translator, before auto-release | Stops the clock | Auto-release proceeds |
| `resolveDispute(jobId, clientBps)` | Arbiter (Safe multisig) | Contractual duty | Funds stuck — bounded by a `DISPUTE_TIMEOUT` that splits 50/50 if the arbiter goes dark |
| `cancelBeforeDelivery(jobId)` | Client, or either party by mutual sig | Reclaim funds on a dead job | Funds sit until delivery timeout, then refundable |

The one real incentive hole is a client who is happy but never clicks Accept — passive
non-payment. `autoRelease` closes it: after the acceptance window the translator (or our
relayer, gas-sponsored) sweeps the payment themselves. Acceptance becomes the *fast* path,
not the *only* path. That single function is why this system doesn't need an admin crutch.

Events are the actual product surface:
`JobFunded`, `DeliverableSubmitted`, `JobAccepted`, `DisputeRaised`, `DisputeResolved`,
`JobRefunded` — each carrying `jobId`, both addresses, amount, and the relevant hash + URI.
Our indexer reads only events; it never calls a getter in a loop.

Implementation notes: `SafeERC20` throughout, USDC is 6 decimals (never hardcode 18),
checks-effects-interactions on every release path, `ReentrancyGuard`, no upgrade proxy
(the state is deliberately dumb enough that we won't need one), arbiter is a Safe from day
one, and a `pause()` that blocks *new* funding only — never the release or refund paths,
so a pause can't be used to hold anyone's money hostage.

### Credentials: EAS, no contract written

A language credential is exactly an attestation: issuer X says translator Y holds
certification Z, revocably. That's EAS's job. We register a schema in the EAS
SchemaRegistry — `(bytes32 credentialHash, string issuerRef, uint64 validUntil)` — and
certification bodies (or we, as a "verified by marketplace" issuer of last resort) attest
directly to the translator's address.

Why this matters for iteration: schema evolution in EAS is *additive*. Need a new
credential type next quarter? Register schema v2. Old attestations remain valid and
verifiable. No migration, no redeploy, no contract of ours to maintain — and the
attestations survive us entirely, since EAS is not our infrastructure.

## Explicitly offchain

| Data | Where | Why not onchain |
|---|---|---|
| Biographies, work samples | Postgres + S3/IPFS | Mutable profile content; no trust boundary |
| **Private client feedback** | Postgres, encrypted at rest | It's private. A hash onchain leaks nothing useful but does leak *that* feedback exists, its timing, and its count — enough to deanonymize a small client pool. Not worth it. |
| Response time | Derived from our messaging logs | We're the only observer; an onchain number would be our unverifiable claim wearing a trustless costume |
| Ranking scores & weights | Versioned config in git + search index | The entire point |
| Search index | Typesense/Elasticsearch | Contracts are not a query engine |

## How ranking is produced

```
Base (events) --> Ponder indexer --> Postgres (onchain_facts)
                                          |
private feedback, response times ---------+--> scoring worker --> search index
                                          |         ^
EAS attestations -------------------------+         |
                                          weights.yaml (git, versioned)
```

The scoring worker runs on a schedule and on every relevant event. It reads onchain facts
(accepted jobs, USDC volume, dispute outcomes, live attestations) plus offchain signals
(feedback, response time) and writes a flat document per translator into the search index.

`weights.yaml` is a plain versioned file: coefficients, recency half-life, dispute penalty
curve, credential multipliers. Tuning is a PR, a review, and a redeploy of a worker —
tens of minutes, fully reversible, with a recorded `scoring_version` stamped on every
document so we can A/B two formulas and attribute results. Nothing about that loop touches
a contract, and nothing about it requires a migration. That is the property you asked for,
and it exists *because* we refused to put the score onchain.

**Sybil caveat, stated plainly:** onchain facts are provable but not inherently honest. A
translator can fund their own jobs from a second wallet and mint "completed work." So the
formula must count *distinct funded clients*, weight by client account history and USDC
volume, and lean on credential attestations from real issuers — verifiability and
sybil-resistance are different properties and the contract only gives us the first.

## What the search screen reads

**Our search API only. Zero RPC calls, zero contract reads.** One query returns ranked
results with name, languages, price, blurb, credential badges, job count, rating.
Sub-100ms, paginated, filterable, cacheable at the edge. Putting a chain read in the hot
path of a search screen would make the slowest, least reliable component of the system
also the most frequently hit.

Each result carries a `verifiedAt` block number and the counts it claims — so the moment a
user cares enough to check, they have the handle to check with.

## Verification, and why it's genuinely useful

Verification is a **separate, deliberately boring path** from search.

1. **Profile "Verify" panel.** Reads the indexer for a list of that translator's accepted
   jobs and live attestations, with a direct Basescan link per transaction. Falls back to a
   public RPC (`eth_getLogs` filtered by translator address) if our indexer is down.

2. **Proof bundle export.** The translator downloads a JSON containing chain id, contract
   address, EAS schema UIDs, each job's `{jobId, txHash, blockNumber, amount, termsHash}`
   plus the *preimage* of each `termsHash`, and each attestation UID. Anyone re-hashes the
   preimages, checks them against the chain, and confirms the whole work history — the
   amounts, the counterparties, the timestamps, the credentials — with no cooperation from
   us.

3. **Static verifier.** A single-page app pinned to IPFS that takes a proof bundle and a
   public RPC URL and validates it. It has no backend. If our company evaporates, a
   translator's history is still portable and checkable, which is the actual thing that
   makes onchain worth its cost here.

What verification deliberately does *not* cover: the ranking, the private feedback, and the
response times. Those are our product, not our promises, and pretending otherwise by
committing scores onchain would trade weekly iteration for a trustlessness we can't
actually deliver.

## Build order

1. `JobEscrow.sol` + Foundry tests — unit, fuzz the dispute split math, fork-test against
   real Base USDC. Slither. Fresh-context audit before mainnet.
2. Ponder indexer + Postgres schema.
3. Scoring worker + `weights.yaml` + search index.
4. Frontend: job flow (approve → fund → deliver → accept), search screen, Verify panel.
5. EAS schema registration + issuer onboarding.
6. Deploy, verify on Basescan, arbiter → Safe, static verifier → IPFS.
