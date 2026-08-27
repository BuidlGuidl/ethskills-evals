# Streak

Daily onchain check-ins for a community on Base. A member sends one transaction a
day, optionally with a short public note. That transaction is the only write in
the product.

Three screens read that history back:

| Screen | What it shows | Served by |
| --- | --- | --- |
| **Feed** | Most recent check-ins across everyone, newest first: who, when, note | `GET /feed` |
| **Profile** | A member's current streak and all-time total | `GET /members/:address` |
| **Leaderboard** | Top members this month by check-in count | `GET /leaderboard` |

By launch the contract already has months of check-ins behind it, and all three
screens must reflect the record from the contract's first day. That single
requirement is what shapes the architecture below.

```
contracts/          Foundry project — Streak.sol, deploy script, tests
indexer/            Ponder project — backfills + tails Base, serves the read API
  ponder.config.ts    chain, contract address, backfill start block
  ponder.schema.ts    Postgres tables: check_in, member, member_month
  src/index.ts        event handler: one log in, three tables updated
  src/api/index.ts    the HTTP API behind the three screens
  abis/streakAbi.ts   Streak ABI (events + views)
```

## Architecture

### The write side: one contract, event-first

`contracts/src/Streak.sol` has exactly one state-changing function:

```solidity
function checkIn(string calldata note) external;
```

It enforces one check-in per member per **UTC day**, caps the note at 140 bytes,
and emits:

```solidity
event CheckedIn(
    address indexed member,   // who
    uint32  indexed day,      // UTC day index (unix / 86400)
    uint32  indexed month,    // UTC month key, YYYYMM
    uint64  timestamp,        // when
    uint32  streak,           // consecutive days, including this check-in
    uint32  total,            // the member's all-time total, including this one
    string  note              // the note (may be empty)
);
```

The event is designed backwards from the three screens: it carries every field
they need, so the indexer never has to call back into the contract to fill in a
row. A backfill is then a pure `eth_getLogs` sweep — no archive node, no
per-event `eth_call`, nothing that gets slower as the contract gets older. A
state change that emitted nothing, or that emitted only `(member)` and left the
streak to be reconstructed, would be invisible or expensive to every indexer,
frontend and explorer downstream.

`month` is emitted (rather than derived later) so the leaderboard can bucket rows
without the indexer and the contract ever disagreeing about which UTC month a
check-in fell in.

**What is deliberately *not* onchain:** ranking, ordering, pagination, monthly
totals. Those are offchain aggregations over history — cheap in Postgres,
absurd in storage. The contract keeps only the four `uint32`s it needs to
enforce the daily rule and to answer "what is this member's state right now"
(`profileOf`), which pack into a single storage slot.

### The read side: a Ponder indexer, not a block scan

Everything the app reads is historical: a feed over all past check-ins, a streak
built from a member's whole check-in sequence, a month's worth of counts ranked
across everyone. **None of it is fetched from an RPC at request time.**

Reading this history by scanning blocks would mean paginating `eth_getLogs`
across the contract's entire lifetime on every page load. Public RPCs cap those
calls by block span and matched-log count, so the sweep is thousands of requests
that grows with every block Base produces, and fails on rate limits and
timeouts long before it grows expensive. Rebuilding the same state from
archive-node `eth_call`s is the same mistake wearing a different hat.

Instead, `indexer/` is a [Ponder](https://ponder.sh) app that:

1. **backfills once** from the contract's deploy block to the chain head, into
   Postgres, and
2. **tails new blocks** from there, applying reorgs, so the feed is live.

Screens query Postgres. Every endpoint is a single indexed query whose cost
depends on the page size, not on how long the contract has existed.

#### Tables (`indexer/ponder.schema.ts`)

- **`check_in`** — one row per `CheckedIn` log: member, note, timestamp, day,
  month, streak, total, block, tx hash. Backs the feed and a member's recent
  notes. Each row carries a monotonic `seq = blockNumber * 1e6 + logIndex`.
- **`member`** — rolled up as events are indexed: all-time total, streak as of
  the last check-in, longest streak, first/last check-in. Backs the profile.
- **`member_month`** — `(month, member)` → check-in count and best streak that
  month, incremented per event. Backs the leaderboard.

The two rollups mean neither the profile nor the leaderboard ever counts rows
across the full history; they read one row and one month-slice respectively.

#### Two details worth knowing

**Feed pagination is keyset, not `OFFSET`.** `GET /feed` orders by `seq DESC` and
takes `?cursor=` as `WHERE seq < cursor`. Page 200 costs the same as page 1, and
a check-in landing at the head while someone is scrolling can't shift a page
boundary and duplicate a row.

**A streak decays with no event to index.** The contract stores the streak *as of
the last check-in*; when a member goes quiet, nothing onchain fires to announce
that the streak broke. So `streakAtLastCheckIn` is stored raw and the live value
is computed at read time — `lastDay == today || lastDay == today - 1 ? streak : 0`
— in `liveStreak()` in `indexer/src/api/index.ts`, matching `Streak.currentStreak`
exactly. Any client that renders the stored number directly will show stale
streaks for members who stopped showing up.

### What does *not* need the indexer

"As of now" values are a contract call, not indexing work. One member's live
streak and total is `Streak.profileOf(address)` — a single `eth_call`. Many
members at once is one **Multicall3**
(`0xcA11bde05977b3631167028862bE2a173976CA11`, same address on Base) batch. Use
those when the UI wants pending-block truth — for instance to disable the
check-in button the instant a member's own transaction confirms, without waiting
for the indexer to catch up. Do not stand up an indexer to track a number the
chain will hand you on request; the indexer here exists for *history*, which the
chain will not.

## The read API

Base URL is the deployed indexer service. Responses are JSON.

```bash
# SCREEN 1 — global feed, newest first
curl "$STREAK_API/feed?limit=50"
curl "$STREAK_API/feed?limit=50&cursor=<nextCursor from the previous page>"
curl "$STREAK_API/feed?member=0xabc...&limit=20"     # one member's check-ins

# SCREEN 2 — profile
curl "$STREAK_API/members/0xabc...?recent=10"

# SCREEN 3 — leaderboard (defaults to the current UTC month)
curl "$STREAK_API/leaderboard?limit=25"
curl "$STREAK_API/leaderboard?month=202607&limit=25"

# extras
curl "$STREAK_API/stats"      # community totals, active today
curl "$STREAK_API/health"     # process is up (Ponder built-in)
curl "$STREAK_API/ready"      # historical backfill is complete (Ponder built-in)
```

Leaderboard ties are broken by who reached that count first in the month, so
ranks are stable between requests. `/graphql` is mounted over the same tables for ad-hoc queries and debugging.

Shapes:

```jsonc
// GET /feed
{
  "items": [{
    "id": "12345-0", "cursor": "12345000000", "member": "0xf39f…2266",
    "note": "shipped the docs", "timestamp": 1787097600, "day": 20684,
    "month": 202608, "streak": 6, "total": 6,
    "blockNumber": "12345", "transactionHash": "0x…"
  }],
  "nextCursor": "12344000000"   // null on the last page
}

// GET /members/:address
{
  "address": "0xf39f…2266", "currentStreak": 6, "longestStreak": 6,
  "totalCheckIns": 6, "checkInsThisMonth": 6, "checkedInToday": true,
  "firstCheckInAt": 1786665600, "lastCheckInAt": 1787097600,
  "lastNote": "gm", "recentCheckIns": [ /* feed items */ ]
}

// GET /leaderboard
{
  "month": 202608,
  "entries": [{
    "rank": 1, "member": "0xf39f…2266", "checkIns": 6,
    "bestStreakThisMonth": 6, "currentStreak": 6, "totalCheckIns": 6
  }]
}
```

Unknown addresses return a zeroed profile rather than a 404, so the profile
screen renders for a member who has never checked in.

## Where this runs in production

**The indexer is a long-running service, not a cron job or a serverless
function.** It holds a Postgres connection, keeps a websocket/poll loop on Base,
and serves the HTTP API from the same process.

The named production home for this repo is **Railway**: one service built from
`indexer/Dockerfile` (config in `indexer/railway.json`), started with

```
npx ponder start --schema $DATABASE_SCHEMA
```

plus a **Railway Postgres** instance in the same project, wired in as
`DATABASE_URL`. Health check is `/health`; the service restarts on failure and
resumes from the last indexed block — the completed backfill stays in Postgres,
so a restart is not a re-sync.

To deploy it:

```bash
railway init                       # or: railway link, into an existing project
railway add --database postgres    # provides DATABASE_URL
railway up --service streak-indexer
railway variables --set PONDER_RPC_URL_BASE=... \
                  --set STREAK_ADDRESS=0x... \
                  --set STREAK_START_BLOCK=... \
                  --set DATABASE_SCHEMA=streak_prod \
                  --set CHAIN_ID=8453
railway domain                     # public URL -> STREAK_API for the frontend
```

Any host that runs a container with a persistent Postgres works the same way —
Fly.io, Render, ECS, a VM with systemd. What matters, and what has to stay
decided, is that **the backfilled Postgres is durable and the process is
supervised**. If either is missing, the read side only ever worked on someone's
laptop.

Operational notes:

- **`DATABASE_SCHEMA` is required** by `ponder start`. Keeping it fixed
  (`streak_prod`) means redeploys reuse the existing indexed data. Setting it to
  something per-deploy (e.g. `$RAILWAY_DEPLOYMENT_ID`) gives blue-green deploys
  where the new version backfills into a fresh schema before taking traffic — at
  the cost of a full re-sync each deploy. Fixed is the right default here.
- **Use a paid/dedicated Base RPC.** The one-time historical backfill is the
  heaviest thing the process ever does; a public endpoint will rate-limit it.
  Steady-state tailing is light.
- **Scaling reads:** run one indexing service, and if the API gets hot, point
  additional read-only API replicas at the same Postgres.

### Alternatives, and why not

A **subgraph** would also work; the schema maps over cleanly. It is not the
default here because the operational story is worse for this app: The Graph's
free hosted service was sunset in June 2024, so there is no free public endpoint
to deploy to. `graph deploy` only puts a subgraph in **Subgraph Studio**, which
is for testing — you must then *publish* it to the network to get a production
endpoint, and query it with a Studio API key. Production queries are metered:
roughly 100K free per month, then about $2 per 100K (checked 2026-08-18 —
re-read the live pricing page before quoting a budget). Ponder also lets the
leaderboard and the live-streak decay stay plain SQL/TypeScript, and gives the
same one-command self-hosted deploy either way. Self-hosting a Graph Node is a
fine third option, but then the host, the store and the supervision are yours to
name just the same.

## Running it locally

Prerequisites: [Foundry](https://getfoundry.sh) and Node 20+.

### 1. Contracts

```bash
cd contracts
forge install          # forge-std, if lib/ is empty
forge build
forge test -vv         # 11 tests: daily rule, streak growth/reset/decay, month keys
```

Deploy to Base Sepolia (or Base mainnet with `--rpc-url $BASE_RPC_URL`):

```bash
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
export ETHERSCAN_API_KEY=...        # for --verify

forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --account <your-keystore-account> \
  --broadcast --verify
```

The script prints the two values the indexer needs: the deployed **address** and
the **deploy block**. The deploy block becomes `STREAK_START_BLOCK` — start there
and the backfill covers the contract's entire history by construction.

### 2. Indexer

```bash
cd indexer
npm install
cp .env.example .env       # fill in RPC URL, STREAK_ADDRESS, STREAK_START_BLOCK
npm run dev                # http://localhost:42069
```

`ponder dev` uses an embedded PGlite store under `.ponder/`, so no Postgres is
needed locally; set `DATABASE_URL` to use a real one. It hot-reloads on changes
to the schema or handlers, re-indexing as needed.

Check it is serving history:

```bash
curl "http://localhost:42069/feed?limit=5" | jq
curl "http://localhost:42069/leaderboard" | jq
```

### 3. End-to-end against a local chain

The full loop — contract, several days of check-ins, indexer, all three
endpoints — runs against Anvil without touching a testnet. Anvil's genesis
timestamp has to be backdated, because the contract only allows one check-in per
UTC day and you want more than one day of history:

```bash
# terminal 1 — a chain that starts 5 days ago
TODAY=$(( $(date -u +%s) / 86400 ))
anvil --chain-id 31337 --timestamp $(( (TODAY - 5) * 86400 + 39600 ))

# terminal 2
cd contracts
PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80  # anvil #0
forge create src/Streak.sol:Streak --rpc-url http://127.0.0.1:8545 \
  --private-key $PK --broadcast

# walk time forward a day at a time and check in
cast rpc evm_setNextBlockTimestamp $(( (TODAY - 4) * 86400 + 43200 )) \
  --rpc-url http://127.0.0.1:8545
cast send <address> "checkIn(string)" "gm" --private-key $PK \
  --rpc-url http://127.0.0.1:8545

# terminal 3 — index the history that now exists
cd indexer
PONDER_RPC_URL_BASE=http://127.0.0.1:8545 CHAIN_ID=31337 \
STREAK_ADDRESS=<address> STREAK_START_BLOCK=1 \
  npx ponder start --schema streak_local --port 42069
```

Then hit `/feed`, `/members/<addr>` and `/leaderboard`. Note that `ponder start`
requires `--schema` (or `DATABASE_SCHEMA`); `ponder dev` does not.

## Configuration reference

`indexer/.env` (see `.env.example`):

| Variable | Required | Notes |
| --- | --- | --- |
| `PONDER_RPC_URL_BASE` | yes | Base RPC. Dedicated endpoint recommended for the backfill. |
| `STREAK_ADDRESS` | yes | Deployed `Streak` contract. |
| `STREAK_START_BLOCK` | yes | The deploy block. Backfill starts here. |
| `CHAIN_ID` | no | `8453` Base, `84532` Base Sepolia, `31337` Anvil. Default `8453`. |
| `DATABASE_URL` | prod | Postgres. Omit locally to use embedded PGlite. |
| `DATABASE_SCHEMA` | prod | Required by `ponder start`. Keep fixed to reuse indexed data. |
| `PORT` | no | HTTP API port. Default `42069`. |

## Frontend notes

There is no UI in this repo — the three screens are thin renderings of the three
endpoints above. When you build it:

- **Feed:** `GET /feed`, then follow `nextCursor` for infinite scroll. Poll every
  ~10s for new items at the head (`seq > firstCursorSeen`), or subscribe over
  `/graphql`.
- **Profile:** `GET /members/:address` for history-backed numbers. Optionally
  overlay `Streak.profileOf` via a direct RPC read for instant post-transaction
  feedback.
- **Leaderboard:** `GET /leaderboard`. `month` is a `YYYYMM` integer, so previous
  months are a dropdown over the same endpoint.
- Render `currentStreak` from the API, never `streakAtLastCheckIn` from a raw
  table read — see the decay note above.
