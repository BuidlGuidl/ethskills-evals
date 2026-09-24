# Translator Marketplace — Architecture Plan

## 1. The shape of the problem

Two requirements pull in opposite directions:

- **Weekly tuning.** The ranking formula (completed jobs, disputes, response
  time, credentials, feedback) changes on a product cadence, not a protocol
  cadence.
- **Independent verification.** A translator must be able to prove which
  completed jobs and credential attestations are theirs even when our search
  API is down or we decide to stop serving them.

These only conflict if you put the *score* onchain. They don't conflict if you
put the *facts* onchain and compute the score offchain. The chain becomes the
translator's portable, censorship-resistant record of settled work and
credentials; our backend is a replaceable index over it.

So the boundary is:

| Onchain | Offchain |
| --- | --- |
| USDC escrow and release | Biography, work samples, profile media |
| Job settlement facts (funded, accepted, disputed, refunded) | Private client feedback (text and numeric) |
| Credential attestations (issuer, subject, schema, revocation) | Response time metrics |
| Commitment hashes for the job brief and the delivered translation | Ranking formula, weights, and sorted results |
| | Search index, filters, pagination |

Nothing that changes weekly touches contract storage.

## 2. What is stored in contracts

### 2.1 Custom contracts: one

**`TranslationEscrow.sol`** — the only custom contract in the MVP.

Per-job storage, keyed by `jobId` (a `bytes32` derived offchain):

```solidity
struct Job {
    address client;
    address translator;
    uint128 amount;         // USDC, 6 decimals
    uint64  fundedAt;
    uint64  deadline;       // auto-release / auto-refund boundary
    Status  status;         // Funded, Delivered, Accepted, Disputed, Refunded
    bytes32 briefHash;      // keccak256 of the client's job spec blob
    bytes32 deliveryHash;   // keccak256 of the delivered translation blob
}
```

Plus two small counters that settlement already needs anyway:

```solidity
mapping(address => uint32) public completedJobs;   // translator => accepted count
mapping(address => uint32) public disputedJobs;    // translator => disputes raised
```

Those counters are cheap, are incremented by state transitions that must run
regardless, and give a translator a *self-contained* onchain claim
("this address has 41 accepted jobs") without us maintaining a leaderboard.
They are **not** a score and nothing sorts on them onchain.

Events are the real product surface:

```solidity
event JobFunded(bytes32 indexed jobId, address indexed client,
                address indexed translator, uint128 amount,
                bytes32 briefHash, uint64 deadline);
event JobDelivered(bytes32 indexed jobId, address indexed translator,
                   bytes32 deliveryHash);
event JobAccepted(bytes32 indexed jobId, address indexed translator,
                  uint128 amount);          // payment released
event JobDisputed(bytes32 indexed jobId, address indexed raiser);
event JobRefunded(bytes32 indexed jobId, address indexed client,
                  uint128 amount);
```

Every fact the ranking consumes from the chain is in these events. Adding a
sixth ranking input next quarter means adding an offchain field, not a
migration.

### 2.2 Credentials: Ethereum Attestation Service, not a custom contract

Language credentials (ATA certification, NAATI, a university degree, an
in-house proficiency test) are issuer-signed claims about a subject. That is
exactly what **EAS** does, and it is already deployed and audited on our target
chain. We register one schema:

```
string  language        // BCP-47, e.g. "es-419"
string  credentialKind  // "ata" | "naati" | "degree" | "marketplace-test"
uint16  level
bytes32 evidenceHash    // hash of the certificate PDF / verification record
uint64  validUntil
```

The issuer attests, the translator is the subject, and revocation is EAS's
built-in path. Off-platform issuers can attest directly; for issuers who won't
touch a wallet we act as a delegated attester and say so in the UI, which is
weaker but still publicly auditable and revocable.

This is the single highest-leverage decision in the plan: credentials are the
part most likely to grow new fields, and EAS schemas are additive. A new
credential type is a new schema UID registered in a config file, not a deploy.

### 2.3 USDC: the canonical token, no wrapper

We hold no token of our own and deploy no fee-splitter. The marketplace fee is
taken as a basis-point cut inside `accept()` and sent to a treasury address in
the same transaction. A separate fee contract would add a trust boundary the
product does not need.

### 2.4 Private client feedback stays fully offchain

Feedback text and scores are private to the client and to us. Nothing about
them — not even a hash — goes onchain in the MVP. A commitment hash would let a
client later "prove" a review they never published and would create an
irreversible record of a private communication; neither serves the product.
Feedback influences ranking only through our index, and translators see the
aggregate, not the source.

If we later want verifiable reviews, the natural path is an EAS attestation
from the client's address referencing the `jobId`, opt-in per review. That is
additive and needs no change to the escrow.

## 3. What the search screen reads

**The search screen reads our API. It does not read the chain.**

A ranked, filtered, paginated browse experience over language pairs, price
bands, availability, and a weekly-changing score is a search problem. Serving
it from contract storage would mean onchain sorting, onchain pagination, and a
migration every time we reweight — the failure mode this plan exists to avoid.

```
GET /api/search?from=en&to=ja&specialty=legal&page=1
→ [{ handle, bio, samples, languages, score, completedJobs,
     disputeRate, medianResponseMinutes, credentials[], verifyUrl }]
```

Behind it:

- **Postgres** — profiles, bios, samples, private feedback, response-time
  metrics, computed scores.
- **Indexer** (Ponder or a subgraph) — tails `TranslationEscrow` events and EAS
  attestations for our schema UID, writes settled facts into Postgres.
- **Search** — Postgres full-text + trigram for the MVP; Typesense later if
  facets demand it. Not a chain concern either way.

The indexer is a pure function of chain state. If Postgres is lost, it rebuilds
from the chain plus our private feedback backup. If *we* are lost, the chain
half survives without us — which is the point of the next section.

## 4. How ranking is produced

Entirely offchain, in a scheduled job, as derived data.

```
score = w1 * log1p(completedJobs)          # from JobAccepted events
      + w2 * credentialWeight(attestations) # from EAS, discounted by issuer tier
      + w3 * responsivenessPercentile       # from our messaging logs
      + w4 * feedbackBayesianMean           # private, shrunk toward prior
      - w5 * disputeRate                    # from JobDisputed / JobAccepted
      - w6 * recencyDecay(lastAcceptedAt)
```

Operationally:

1. Weights live in a versioned config row (`ranking_config`), not in code and
   not in a contract.
2. A nightly job recomputes scores; a weight change is a config write plus a
   recompute — no deploy, no migration, no user action.
3. Every score row stores the `config_version` that produced it, so a bad tune
   is a one-row rollback and we can explain any historical ranking.
4. Ties break on recency, then on a stable hash of the translator id, so
   pagination is deterministic.

Anti-gaming lives here too, where it can iterate: self-dealing detection
(client and translator funded from the same source), minimum job value before a
completion counts, per-client caps on how much one relationship can lift a
score. None of that belongs in an escrow contract, and all of it will change.

## 5. How verification works without contract migrations

The guarantee we offer a translator: **"Your settled work and your credentials
are yours, provable from the chain, whether or not our API answers."**

### 5.1 The verification path

Each translator's profile links to a **proof page** whose entire input is their
wallet address:

1. Read `JobAccepted` logs on `TranslationEscrow` filtered by
   `translator == 0xabc…` → every completed job, with amount, timestamp, and
   `deliveryHash`.
2. Read EAS attestations where `recipient == 0xabc…` and `schema == <uid>`,
   filtered to non-revoked and unexpired → every live credential, with issuer.
3. Optionally hash the translator's stored delivery file and compare it to the
   onchain `deliveryHash` → proof that *this* file is what was accepted and
   paid for.

The proof page is a static client-side bundle that talks to a public RPC. We
host it, but it has no dependency on our backend, and we publish it plus a
~60-line standalone script so anyone can reproduce the result. A third party
verifies a translator's record with a block explorer and the EAS explorer
alone.

### 5.2 What is deliberately *not* verifiable

Being honest about this is part of the design:

- **The score is not verifiable and should not be.** It is our editorial
  judgment, it changes weekly, and pretending otherwise by anchoring it onchain
  would buy a proof of a number that is meaningless a week later.
- **Response time and private feedback are not verifiable.** They come from
  systems only we observe. We surface them as our claims, labeled as such, next
  to the chain-backed facts which are labeled differently.

The UI draws the line visibly: a "Verified onchain" badge on completed jobs and
credentials, no badge on score, responsiveness, or feedback.

### 5.3 Why this survives product iteration

The contract stores settlement facts, which are true forever. The index stores
interpretations, which change weekly. Adding a ranking input, reweighting,
launching a new credential type, changing anti-gaming rules, redesigning
search — none of them touch `TranslationEscrow`. The only changes that would
require a contract migration are changes to how money settles, which is the
correct thing to make expensive.

## 6. State transitions

Every fund-moving path is self-serve or permissionless, and no path depends on
us running a cron job.

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `fundJob(jobId, translator, amount, briefHash, deadline)` | client | job doesn't exist until funded; translator won't start without escrow | no job, no risk to anyone |
| `submitDelivery(jobId, deliveryHash)` | translator | starts the acceptance clock; required to get paid | job sits Funded until `deadline`, then client can refund |
| `accept(jobId)` | client | releases payment, closes the job, protects their own reputation as a payer | after `acceptanceWindow` past delivery, translator calls `claimAfterTimeout` |
| `claimAfterTimeout(jobId)` | translator | receives the escrowed USDC | funds stay claimable in escrow indefinitely; no one else can take them |
| `dispute(jobId)` | client or translator | freezes the timeout and routes to arbitration | the timeout path runs and the translator is paid |
| `resolveDispute(jobId, clientBps)` | arbiter role | is paid to arbitrate (fee from the escrowed amount) | job stays Disputed; both parties can jointly call `settleMutual` to exit without the arbiter |
| `refund(jobId)` | client, only after `deadline` with no delivery | recovers their own USDC | funds stay refundable indefinitely |
| `settleMutual(jobId, clientBps)` | client and translator (2-of-2) | both escape a stuck dispute without arbiter fees | falls back to `resolveDispute` |
| `attest(...)` (EAS) | credential issuer | publishes a claim they want public; we may sponsor gas | translator has no onchain credential, profile still works |
| `revoke(...)` (EAS) | credential issuer | removes a claim they no longer stand behind | stale credential remains; our index can still down-weight it offchain |

Two properties worth stating explicitly:

- **No function can strand funds.** Every terminal state has a caller who
  directly receives the money, and every waiting state has a timeout that some
  party benefits from triggering.
- **The arbiter cannot take funds.** `resolveDispute` only splits between the
  two existing parties (plus a bounded arbitration fee); it has no path to an
  arbitrary address. The arbiter role starts as a marketplace multisig and is
  designed to be swappable for Kleros later without touching the escrow's
  money-movement logic.

This table goes in the README verbatim.

## 7. Chain and deployment

### 7.1 Target: Base mainnet

One chain for the first release, chosen for product fit:

- **Native USDC.** Circle issues canonical USDC on Base. Clients fund jobs from
  Coinbase, and Coinbase→Base withdrawals are free and instant — our clients are
  small businesses and agencies, not DeFi users, and the on-ramp is the single
  biggest conversion risk in the funnel.
- **EAS is a predeploy**, so credentials need no custom contract and no bridge.
- **Fees are low enough that we can sponsor them.** An escrow release is a
  few cents at current Base fees, which makes gas sponsorship via a paymaster
  affordable for every write path — translators never need ETH.
- **Smart-wallet support.** Coinbase Smart Wallet passkeys let a translator hold
  a real, provable address without ever seeing a seed phrase, which is what
  makes the "prove your record without us" guarantee usable by a non-crypto
  professional.

Measure actual Base fees before finalizing the paymaster budget rather than
relying on remembered numbers.

### 7.2 Addresses

Resolve and pin both before deploying; do not copy from memory:

- **USDC on Base** — from Circle's official documentation.
- **EAS `SchemaRegistry` and `EAS` on Base** — from the EAS docs' deployed
  contracts page (OP-Stack predeploys).

Both get hardcoded as immutables in the constructor and asserted in a
fork test.

### 7.3 Deployment runbook

Lives in the README before the MVP is considered shippable, and contains:

- Required env vars: `BASE_RPC_URL`, `BASESCAN_API_KEY`, `DEPLOYER_KEY`,
  `TREASURY_ADDRESS`, `ARBITER_MULTISIG`, `USDC_ADDRESS`, `EAS_ADDRESS`.
- Exact `forge script … --broadcast --verify` invocation and the
  `forge verify-contract` fallback.
- Schema registration: the one-time `SchemaRegistry.register` call and the
  resulting schema UID written into the indexer config.
- **Ownership:** the deployer transfers the `arbiter` and `treasury` roles to a
  Safe multisig as the final deploy step; the script reverts if either is still
  an EOA.
- **Post-deploy smoke transaction:** fund a $1 job, submit a delivery hash,
  accept it, and confirm the USDC landed with the treasury cut taken — then
  confirm the indexer picked up all three events and the proof page renders the
  completed job from chain data alone.

### 7.4 Testing

- Unit tests for every escrow state transition, including the timeout and
  mutual-settlement paths and the "arbiter cannot reach an arbitrary address"
  invariant.
- **Fork tests against Base** for the USDC and EAS integrations — real token
  decimals, real transfer semantics, real attestation and revocation.
- An indexer replay test: wipe Postgres, replay from the deploy block, assert
  the rebuilt completed-job counts match the onchain counters.
- An independent reviewer walks the finished vertical slice (fund → deliver →
  accept → indexed → ranked → proof page) before launch.

## 8. Scope boundary for v1

**In:** escrow with disputes, EAS credentials, indexer, search with a tunable
offchain score, standalone proof page.

**Out (and each is additive, needing no contract change):** onchain reviews,
milestone or partial payments, subscription retainers, a governance token,
translator staking or bonds, cross-chain funding, Kleros arbitration.

One custom contract. Two audited external protocols. Everything that iterates
weekly lives where iteration is free.
