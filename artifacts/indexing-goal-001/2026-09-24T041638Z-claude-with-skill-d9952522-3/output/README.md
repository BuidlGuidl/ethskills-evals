# Streak

A daily onchain check-in app for a community on Base. Members send one
transaction a day, optionally with a short public note. Three screens read that
history back: a global feed, a member profile (current streak + all-time total),
and a monthly leaderboard.

The contract will have months of check-ins behind it before the app launches, so
every screen is served from a **backfilled index of the contract's complete
history**, not from what happens after a page loads.

```
contracts/   Solidity (Foundry) — Streak.sol, tests, deploy script
indexer/     Ponder indexer — backfill + tail, Postgres, HTTP API (the read side)
client/      Typed read/write client the three screens call
scripts/     seed-local.sh — local anvil deployment with days of check-ins
```

## Architecture

### The write side

`contracts/src/Streak.sol` has exactly one state-changing function,
`checkIn(string note)`, and emits exactly one event:

```solidity
event CheckedIn(
    address indexed member,
    uint32  indexed day,        // UTC day index = timestamp / 86400
    uint32  streak,             // consecutive days, including this check-in
    uint32  total,              // member's all-time total, including this one
    bool    isNewMember,
    string  note
);
```

The contract is designed event-first: the event carries everything the read side
needs, so no consumer has to reconstruct state from storage or an archive node.
Two details matter downstream:

- **One check-in per member per UTC day is enforced onchain.** That makes
  "consecutive days" well defined and means the indexer never has to
  de-duplicate.
- **`streak` and `total` are computed onchain and emitted.** The indexer stores
  what the event says rather than re-deriving streaks from timestamps, so the
  contract and the app can never disagree.

Other state changes would be invisible to every indexer, frontend and explorer,
which is why there aren't any.

### The read side

Historical data comes from an indexer, never from a scan at request time. A
public RPC caps each `eth_getLogs` by block span and matched-log count, so
"months of check-ins" is thousands of paginated calls that grow with every block
and die on rate limits — per page load. Instead:

**`indexer/` is a [Ponder](https://ponder.sh) app.** On first run it backfills
every `CheckedIn` event from `STREAK_START_BLOCK` (the contract's deploy block)
into Postgres, then follows the chain head. The backfill is paid once; restarts
and redeploys reuse the same database.

`indexer/ponder.schema.ts` has four tables:

| table          | what it is                                                | serves                |
| -------------- | --------------------------------------------------------- | --------------------- |
| `check_in`     | one row per event, keyed by `seq` (`blockNumber*1e6+logIndex`) | feed, member history |
| `member`       | per-member all-time aggregates                            | profile, leaderboard rows |
| `member_month` | per-member × per-month counts, pre-aggregated             | monthly leaderboard   |
| `stats`        | community totals (single row)                             | header numbers        |

Aggregation, ranking and pagination are all offchain, in the index:

- **Feed** — `ORDER BY seq DESC` with keyset pagination on `seq`. Constant cost
  per page however deep into history the reader scrolls, unlike `OFFSET`.
- **Leaderboard** — a single indexed `ORDER BY` over `member_month` for one
  `YYYY-MM` bucket. The counts are incremented in the handler, so ranking never
  scans the check-in table.
- **Profile history** — `check_in` filtered by member, newest first.

### Current streak is a contract call, not an index read

A streak breaks by the passage of time — nobody sends a transaction to end one,
so there is no event to index. Present-tense numbers (`currentStreak`,
`longestStreak`, `total`, "already checked in today?") are what the chain returns
on request, so the profile screen reads them directly from
`Streak.profileOf(address)`, which applies today's date live. `client/src/profile.ts`
does that, batching many addresses into one **Multicall3** request
(`0xcA11bde05977b3631167028862bE2a173976CA11`, already wired into viem's Base
config) rather than N `eth_call`s.

The indexer also exposes a derived `currentStreak` on `GET /members/:address`,
computed against the current UTC day, so the whole profile screen can render in
one request; the contract view is the authoritative answer, and the one to use
right after a member checks in.

Note history, feeds, and anything that aggregates across members are the
indexer's job — the chain can't answer those on request.

### HTTP API

`indexer/src/api/index.ts`, served by the same process:

| route                     | screen                                             |
| ------------------------- | -------------------------------------------------- |
| `GET /feed`               | global feed. `?limit=50&cursor=<nextCursor>&member=0x…` |
| `GET /members/:address`   | profile: streak, total, this month, recent check-ins |
| `GET /leaderboard`        | top members this month. `?month=YYYY-MM&limit=25`  |
| `GET /stats`              | community totals                                   |
| `/graphql`                | auto-generated GraphQL over the whole schema       |
| `/ready`, `/health`       | Ponder's own readiness/liveness (`/ready` waits for the backfill) |

`client/` wraps these in a typed client (`StreakIndexer`) plus the write
(`checkIn`) and the live contract reads. A frontend imports only `client`.

## Running locally

Prerequisites: Node 22+, pnpm, [Foundry](https://getfoundry.sh).

```bash
pnpm install
```

### Contracts

```bash
cd contracts
forge install foundry-rs/forge-std    # populates lib/ (generated, not committed)
forge test -vvv                       # 9 tests: streaks, gaps, day boundaries, notes
```

### Local chain with seeded history

The fastest loop is a local anvil with history already on it — the same shape as
production, without waiting on a mainnet backfill:

```bash
anvil                     # terminal 1
./scripts/seed-local.sh   # terminal 2
```

The script deploys `Streak` and seeds six days of check-ins across three of
anvil's default accounts, with deliberately uneven patterns: one member checks in
every day, one breaks a streak mid-week, one only shows up on even days. That
gives all three screens something real to render. It prints the env vars to copy.

It also installs an `aggregate3`-compatible Multicall3 at
`0xcA11bde05977b3631167028862bE2a173976CA11` (from
`contracts/test/helpers/Multicall3Local.sol`) if nothing is there. Base has the
real Multicall3 at that address; a bare anvil has nothing, and viem's batched
contract reads fail against it.

### Indexer

```bash
cd indexer
cp .env.example .env.local
# paste the values seed-local.sh printed (or the mainnet deployment's)
pnpm dev
```

`ponder dev` uses a local PGlite store, so there is no database to install. It
serves the API at <http://localhost:42069>:

```bash
curl 'localhost:42069/feed?limit=5'
curl 'localhost:42069/leaderboard'
curl 'localhost:42069/members/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
```

Four things worth knowing:

- **`STREAK_START_BLOCK` must be the deploy block.** A later block silently drops
  history from the feed, the streaks and the leaderboard — the exact bug this
  architecture exists to avoid. Block `0` wastes hours of backfill on empty
  blocks. `ponder.config.ts` refuses to start without it.
- **Use a dedicated RPC** (Alchemy, QuickNode, Base's paid tier) for a mainnet
  backfill. `https://mainnet.base.org` will rate-limit a months-long sync.
- **On anvil, mine one block after the indexer starts** —
  `cast rpc evm_mine --rpc-url http://127.0.0.1:8545`. On a fresh local chain
  every block is unfinalized, so Ponder skips the historical sync and picks the
  history up through its realtime sync, which needs a new block to fire. Base's
  deploy block is long finalized, so this does not apply in production.
- **`ponder start` requires `--schema`**, unlike `ponder dev`. The Dockerfile
  passes one.

Editing a handler or the schema re-indexes from scratch in dev; that's expected,
and another reason the local loop runs against anvil rather than mainnet.

### Verifying the live contract reads

The profile screen's streak comes from the contract, not the index. Against the
seeded chain, `getLiveProfiles` returns `currentStreak` 6, 3 and 0 for the three
seeded members — the third is 0 because their last even-day check-in is now two
days old. Nothing was written to make that happen, which is precisely why it
can't be an indexed value.

## Deploying

### 1. Contract

```bash
cd contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base --broadcast --verify \
  --private-key $DEPLOYER_PRIVATE_KEY
```

Record **both** the address and the deploy block number the script logs — the
indexer needs both.

For a dry run, deploy to Base Sepolia first with `--rpc-url base_sepolia`.

### 2. Indexer (production home)

**The indexer runs as a long-lived `ponder start` process on Railway, backed by a
Railway Postgres instance in the same project.** It is a server, not a build
step: it must stay up to keep tailing the chain, and it must keep its database to
avoid re-running the backfill. `indexer/Dockerfile` is the deployment unit.

Railway setup (once):

1. Create a project, add a **Postgres** database.
2. Add a service from this repo with root directory `indexer/` (it picks up the
   Dockerfile).
3. Set variables: `PONDER_DATABASE_URL=${{Postgres.DATABASE_URL}}`,
   `STREAK_CHAIN=base`, `PONDER_RPC_URL_8453`, `STREAK_ADDRESS`,
   `STREAK_START_BLOCK`, `CORS_ORIGIN`.
4. Set the healthcheck path to `/ready` and give it a generous timeout — the
   first deploy has to finish the historical backfill before it is ready.
5. Expose the service; point the frontend's indexer base URL at it.

The Dockerfile starts Ponder with `--schema "$RAILWAY_DEPLOYMENT_ID"`, so each
deploy indexes into its own Postgres schema and the previous version keeps
serving traffic until the new one has caught up. Ponder then hands the live
schema over. Budget for the first backfill taking minutes to hours depending on
how much history exists, and keep the database on a volume-backed plan — dropping
it means paying for the whole backfill again.

Any equivalent host works (Fly.io, Render, ECS, a VM with systemd), as long as
all three things are true: a process supervised to stay running, a persistent
Postgres, and a healthcheck on `/ready`.

**Alternative: a subgraph.** The same event model indexes cleanly as a subgraph
if you'd rather not run a process. Note that The Graph's free hosted service was
sunset in June 2024: `graph deploy` puts you in Subgraph Studio, which is for
testing only, and you then have to **publish** the subgraph to the network to get
a production endpoint and query it with a Studio API key. Production queries are
metered — roughly 100K free per month, then about $2 per 100K (checked
2026-08-18; re-read the pricing page before budgeting). The monthly leaderboard
also wants pre-aggregated per-month entities in the mapping, exactly as
`member_month` does here. Ponder on Railway was chosen because the cost is a
predictable server plus database rather than per-query metering, and because
SQL/keyset pagination fits the leaderboard and feed better than GraphQL.

### 3. Frontend

Whatever renders the three screens imports `client/` and needs two values: the
indexer base URL and the contract address (plus a Base RPC URL for the live
profile reads and the check-in transaction).

```ts
import { StreakIndexer, createStreakClient, getLiveProfile, checkIn } from "streak-client";

const indexer = new StreakIndexer(process.env.INDEXER_URL!);
const rpc = createStreakClient(process.env.BASE_RPC_URL!);
const contract = process.env.STREAK_ADDRESS as `0x${string}`;

// Screen 1 — global feed, newest first, paginated back to the first day.
const { items, nextCursor } = await indexer.feed({ limit: 50 });

// Screen 2 — profile. Live streak/total from the contract, notes from the index.
const [live, history] = await Promise.all([
  getLiveProfile(rpc, contract, address),
  indexer.profile(address),
]);

// Screen 3 — this month's leaderboard.
const { items: top } = await indexer.leaderboard({ limit: 25 });

// The only write.
await checkIn(wallet, contract, "gm");
```

## Backfill and reorgs

- Ponder handles Base reorgs itself, reverting affected rows as the chain
  reorganises; the handler is a pure function of the event, so nothing else is
  needed.
- Changing the schema or a handler means a full re-index. Deploy it as a new
  `--schema` (as the Dockerfile does) so the old index serves until the new one
  catches up.
- The check-in table is the source of truth for history; `member`, `member_month`
  and `stats` are derived, so a re-index rebuilds them exactly.
