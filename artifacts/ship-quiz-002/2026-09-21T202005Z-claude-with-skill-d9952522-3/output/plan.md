# Translator Marketplace — Architecture Plan

## 1. The slice we are shipping

A client funds a translation job in USDC, a translator delivers, the client
accepts, and the translator is paid. Every completed job and every language
credential is independently provable from chain data. Profiles, samples,
private feedback, search, and the ranking formula live offchain and can change
any day of the week without touching a contract.

**One custom contract.** Credentials reuse a deployed protocol (EAS). Nothing
else needs its own trust boundary.

## 2. Onchain / offchain boundary

The rule applied throughout: something goes onchain only if it is custody of
value, or a commitment a translator must be able to prove *without us*.
Everything else — anything we expect to restate, retune, or keep private — is
offchain.

### Onchain (`TranslationEscrow`, one contract)

Per job, in storage:

| Field | Type | Why it must be onchain |
| --- | --- | --- |
| `client` | `address` | refund destination |
| `translator` | `address` | payout destination |
| `amount` | `uint96` | USDC held in custody |
| `deliveredAt` | `uint64` | starts the review window / auto-release clock |
| `state` | `enum` | Funded, Delivered, Disputed, Closed |
| `specHash` | `bytes32` | hash of the agreed job spec (source text, language pair, deadline, price) |
| `deliveryHash` | `bytes32` | hash of the delivered translation |

Global storage: `usdc`, `arbiter`, `reviewWindow`, `feeBps`, `feeRecipient`,
`owner`. That is the whole state. Note what is **not** there: no score, no
counters, no per-translator arrays, no leaderboard, no profile pointer.

Events are the durable public record:

```
JobFunded(uint256 indexed jobId, address indexed client, address indexed translator,
          uint256 amount, bytes32 specHash, uint64 deadline)
Delivered(uint256 indexed jobId, bytes32 deliveryHash)
Accepted(uint256 indexed jobId, uint256 paidToTranslator, uint256 fee)
AutoReleased(uint256 indexed jobId, uint256 paidToTranslator, uint256 fee)
Disputed(uint256 indexed jobId, address indexed raisedBy)
Resolved(uint256 indexed jobId, uint256 toTranslator, uint256 toClient)
Cancelled(uint256 indexed jobId, uint256 refunded)
```

### Onchain (reused, zero custom code): credentials via EAS

Language credentials are attestations, not marketplace state. We use the
Ethereum Attestation Service predeploys on Base — verified live against Base
mainnet while writing this plan:

| Contract | Address | Checked |
| --- | --- | --- |
| EAS | `0x4200000000000000000000000000000000000021` | `version()` → `1.0.1` |
| SchemaRegistry | `0x4200000000000000000000000000000000000020` | `version()` → `1.0.1` |
| USDC (Circle-issued, native Base) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `symbol()` → `USDC`, `decimals()` → `6` |

Re-confirm all three against Circle's and EAS's official docs at deploy time;
never copy an address from a plan document into a script without that check.

One schema, registered once (no deployment, no migration to change how we
*use* it):

```
string credential, string languagePair, string issuer, bytes32 evidenceHash, uint64 validUntil
```

Attester is the issuing body if it is onchain, otherwise our verification desk
attesting "we checked this certificate" — a claim about our own review, signed
by an address anyone can filter on. Recipient is the translator. Revocation is
EAS-native, so a lapsed or fraudulent credential is revoked, not deleted.

### Offchain (Postgres + object storage + search index)

Biographies, headshots, work samples, language pairs offered, rates,
availability, response-time measurements from our messaging system, private
client feedback, moderation state, the search index, and the ranking formula.

Private feedback gets **no onchain footprint at all — not even a hash**. A
commitment hash would leak the existence, count, and timing of a client's
feedback permanently and irreversibly, and buy nothing: the party who would
want to prove its contents is the marketplace, and the party it is private
from is the translator. Keep it in the database under normal access control
and deletion policy.

Response time likewise stays offchain. It is measured from our own message
timestamps; putting it onchain would be publishing a number only we can
attest to, with none of the trust benefit and all of the rigidity.

## 3. State transitions

Contracts have no scheduler. Every transition below has a caller who wants it
to happen, and a defined outcome if nobody shows up. This table goes in the
README verbatim.

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `fundJob(jobId, translator, amount, deadline, specHash)` | client | job does not exist until funded; this is how work starts | no job, no funds moved |
| `deliver(jobId, deliveryHash)` | translator | starts the review clock that leads to their payment | job sits Funded until `deadline`, then client can `cancel` for a full refund |
| `accept(jobId)` | client | releases the translation for use, ends their exposure, and is the honest path | auto-release covers it (below) |
| `autoRelease(jobId)` | permissionless, but in practice the translator | translator receives the money — the caller *is* the beneficiary | funds stay claimable forever; no deadline on claiming |
| `dispute(jobId)` | client, within `reviewWindow` | only way to stop auto-release of their money | review window expires and payment auto-releases |
| `resolve(jobId, toTranslator)` | arbiter | contractual duty; disputes are a paid service line | funds are frozen — see the bound below |
| `cancel(jobId)` | client, only while Funded and past `deadline` | recovers their own USDC from a no-show | funds stay refundable forever |

Two properties worth stating explicitly:

- **The happy path needs no operator.** `accept` and `autoRelease` are both
  participant-driven. We can run a convenience bot that calls `autoRelease` for
  translators, but if that bot dies the translator calls it themselves from the
  dApp and is paid. Automation is never the only liveness path.
- **Arbiter power is bounded.** `resolve` can only split `amount` between
  `client` and `translator` — it cannot redirect funds elsewhere, cannot touch
  a job that is not Disputed, and cannot act before a dispute is raised. It is
  also bounded in time: if the arbiter does not resolve within
  `arbiterWindow` (14 days), either party may call `autoRelease` and the
  original accept-path split executes. A frozen dispute resolves itself rather
  than becoming a hostage situation. Arbiter is a 3-of-5 multisig at launch;
  replacing it is an owner call, not a migration.

`owner` can change `arbiter`, `feeBps` (hard-capped at 500 bps in code),
`feeRecipient`, and `reviewWindow` (bounded 1–30 days). It **cannot** move
escrowed funds, pause payouts, or rewrite a job. There is no upgrade proxy: an
escrow that can be rewritten underneath a funded job is not an escrow. A v2
ships as a new deployment; open v1 jobs settle under v1 forever.

## 4. What the search screen reads

The search screen reads our API, and nothing else. One request:

```
GET /api/search?pair=es-en&domain=legal&available=true&sort=relevance
  → [{ handle, bio, samples[], languagePairs[], credentials[],
        completedJobs, disputeRate, medianResponseHours, score, rank }]
```

It is served from Postgres + an inverted index (Typesense/Elasticsearch). It
does not touch an RPC node, a subgraph, or a wallet. Search is a read-heavy
browse surface with filters, pagination, typo tolerance, and facets — chain
state is the wrong substrate for it, and a ranked list in contract storage
would be a weekly migration disguised as a feature.

The wallet is required for exactly two actions: funding a job and accepting a
delivery. Browsing works logged out.

## 5. How ranking is produced

A pipeline, entirely offchain, rebuilt continuously:

```
Base logs ──indexer──► jobs table ─┐
EAS attestations ─────────────────┤
in-app message timestamps ────────┼──► feature table (per translator) ──► score() ──► search index
private client feedback ──────────┘         (weights in config)
```

1. **Indexer** tails `TranslationEscrow` events and EAS `Attested`/`Revoked`
   for our schema UID, and writes a `jobs` table and a `credentials` table.
   These are caches of chain state — droppable and fully rebuildable by a
   replay from the deploy block.
2. **Feature table**, one row per translator, refreshed on indexer write and
   nightly: `completed_jobs`, `disputes_raised`, `disputes_lost`,
   `volume_usdc`, `median_response_hours`, `credential_count`,
   `credential_tier`, `feedback_mean`, `feedback_count`, `recency_decay`.
3. **`score()`** is a pure function of that row, with weights in a versioned
   config file (`ranking/weights.v7.yaml`), not in code and not in a contract.
4. **Reindex** writes `score` into the search index.

Tuning the formula weekly is: edit a YAML file, run the scorer over the
feature table, swap the index alias. Minutes, reversible, A/B-testable by
serving `weights.v7` to half the traffic. No deploy, no contract call, no
migration, no historical data loss — the features are raw facts, so a new
formula is recomputed over the full history rather than applied going forward.

The contract deliberately stores none of this. Storing `completedJobs` onchain
would be a counter settlement does not need, and the moment the formula wanted
"completed jobs weighted by value in the last 180 days" the counter would be
useless anyway. The events already carry amount and timestamp; every
definition we might want is derivable from them.

## 6. Verification without migration

This is the load-bearing claim, so here is the concrete path. If our API is
down, acquired, hostile, or simply wrong, a translator proves their record
with public tools:

**Completed jobs.** Filter `Accepted` and `AutoReleased` logs, join to
`JobFunded` on `jobId`, keep those where `translator == 0xMe`. Every job's
counterparty, amount, and settlement timestamp is there. Nothing is gated on
us — these logs are on Base and mirrored by every archive node, block
explorer, and subgraph provider.

```bash
cast logs --from-block $DEPLOY_BLOCK \
  'JobFunded(uint256,address,address,uint256,bytes32,uint64)' \
  null null $MY_ADDRESS --rpc-url https://mainnet.base.org
```

**Credentials.** EAS's own explorer (and any EAS-aware wallet) lists
attestations by recipient, showing schema, attester, `evidenceHash`, and
revocation status — for a marketplace-independent protocol we did not write.

**Job content.** `specHash` and `deliveryHash` let a translator prove the
delivered file matches what settled: hash the file they kept, compare to the
log. This is what makes "I did this job" mean something specific rather than
"a payment happened."

We ship `scripts/export-record.ts` — a standalone script taking only an RPC URL
and an address, emitting a signed-by-nobody, verifiable-by-anyone JSON record.
It depends on no service of ours.

**Why this does not constrain iteration.** The onchain surface is *facts about
settled value*: who paid whom, how much, when, against which content hash, and
who attested to which credential. Those facts do not change when our product
opinions change. Everything that we expect to churn — the weights, the feature
definitions, the filters, the feedback model, the profile schema, the search UI
— reads those facts downstream. The line is drawn so that a year of weekly
ranking experiments touches zero contract code, while a translator's proof of
their 200 completed jobs survives us shutting down.

The one thing that would force a contract change is changing settlement itself
(a milestone split, a subscription retainer, a different token). That is
correct: that *is* a change to custody, and it should cost a deployment.

## 7. Chain: Base

Measured on Base mainnet while writing this plan (2026-09-21):

```
cast base-fee   → 5,162,424 wei  (~0.0052 gwei)
cast gas-price  → 6,154,759 wei  (~0.0062 gwei)
```

A fund-job transaction (USDC `transferFrom` + escrow write, ~120k gas) costs on
the order of a tenth of a cent. That matters here specifically: translation
jobs are frequently $30–$200, and per-job escrow is only viable if the escrow
overhead is invisible against the job value. This is a cost measurement, not a
memory — rerun both commands before committing to the target.

Beyond cost, the product fit:

- **Native Circle USDC** (verified above), not a bridged wrapper. Clients fund
  from Coinbase directly; there is no bridge risk sitting under the escrow.
- **EAS is a predeploy.** Our entire credential system is zero custom code
  because of where we deploy.
- **Smart Wallet / passkeys.** Our clients are translation buyers, not DeFi
  users. Passkey accounts plus sponsored gas for `accept` mean a client never
  sees a seed phrase, and Base's account-abstraction infrastructure is the most
  mature path to that today.
- **Fiat on-ramp** into the same account that funds the escrow.

Ethereum L1 is priced wrong for $50 jobs. Other L2s would work technically;
Base wins on the USDC-issuance plus EAS plus onboarding combination, not on
"L1 is expensive."

## 8. Build order

1. `TranslationEscrow.sol` — ~200 lines, `SafeERC20`, ReentrancyGuard, custom
   errors. USDC's 6 decimals and its upgradeable-proxy nature are both handled
   by treating it as a plain ERC-20 through `SafeERC20`.
2. Foundry tests: full state machine, every revert path, fee math and rounding,
   the arbiter bound, auto-release timing. **Fork tests against Base mainnet**
   for the real USDC and real EAS — mocks would not catch USDC's proxy
   behavior or EAS's schema validation.
3. Indexer + `jobs`/`credentials` tables + replay-from-genesis command.
4. Feature table + `score()` + weights config + reindex job.
5. Search API and screen (offchain only, no wallet).
6. Job flow UI: fund → deliver → accept, with `autoRelease` exposed to the
   translator as a visible "claim payment" button — never hidden behind a bot.
7. `scripts/export-record.ts`.
8. Independent pre-launch review of the finished slice before mainnet.

## 9. Deployment runbook (goes in README)

Required environment:

```bash
BASE_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=...
DEPLOYER_KEY=...              # hardware wallet / --ledger preferred
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
ARBITER=0x...                 # 3-of-5 dispute multisig
FEE_RECIPIENT=0x...           # treasury multisig
OWNER=0x...                   # 3-of-5 owner multisig — NOT the deployer EOA
```

Deploy to Base Sepolia first, run the full flow, then mainnet:

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_RPC_URL --broadcast --verify \
  --etherscan-api-key $BASESCAN_API_KEY -vvvv
```

The deploy script sets `owner` to `$OWNER` in the constructor — ownership never
sits on the deployer EOA, not even briefly.

Register the credential schema once:

```bash
cast send 0x4200000000000000000000000000000000000020 \
  "register(string,address,bool)" \
  "string credential,string languagePair,string issuer,bytes32 evidenceHash,uint64 validUntil" \
  0x0000000000000000000000000000000000000000 true \
  --rpc-url $BASE_RPC_URL --account deployer
```

Record the returned schema UID and the escrow's deploy block in
`deployments/base-mainnet.json`; the indexer reads both.

**Post-deploy verification — a real $1 job, end to end:**

```bash
ESCROW=0x...
cast send $USDC "approve(address,uint256)" $ESCROW 1000000 --rpc-url $BASE_RPC_URL --account client
cast send $ESCROW "fundJob(uint256,address,uint256,uint64,bytes32)" \
  1 $TRANSLATOR 1000000 $(($(date +%s)+86400)) $(cast keccak "smoke test spec") \
  --rpc-url $BASE_RPC_URL --account client
cast send $ESCROW "deliver(uint256,bytes32)" 1 $(cast keccak "smoke test delivery") \
  --rpc-url $BASE_RPC_URL --account translator
cast send $ESCROW "accept(uint256)" 1 --rpc-url $BASE_RPC_URL --account client
cast call $USDC "balanceOf(address)(uint256)" $TRANSLATOR --rpc-url $BASE_RPC_URL
```

Then confirm the loop closes offchain: the indexer picked up `Accepted`, the
translator's `completed_jobs` incremented, and the search index reflects the
new score. Launch is not done until USDC moved *and* the number on the search
screen moved because of it.

Checklist before announcing: contract verified on Basescan, owner and arbiter
are the intended multisigs (`cast call` them, don't trust the deploy log), fee
cap enforced in code, indexer replay tested from a wiped database, and
`export-record.ts` verified against an RPC endpoint that is not ours.
