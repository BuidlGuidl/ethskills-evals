# Streak

A daily onchain check-in app for a community on Base. A member sends one
transaction a day, optionally with a short public note. That is the only write.

Three screens read from it:

| Screen | What it shows | Endpoint |
| --- | --- | --- |
| **Feed** | Most recent check-ins across everyone, newest first — who, when, note | `GET /feed` |
| **Profile** | A member's current streak and all-time total | `GET /members/:address` |
| **Leaderboard** | Top members this month by check-in count | `GET /leaderboard` |

All three cover the contract's **entire history**, from its first day — not just
what happens after a page is opened or a process is started.

```
contracts/          Foundry project: Streak.sol, tests, deploy + seed scripts
indexer/            Ponder app: backfills and tails the contract, serves the read API
```

---

## Architecture

```
  member wallet
        │ checkIn("gm")
        ▼
  ┌─────────────────────┐
  │  Streak.sol (Base)  │   enforces one-per-day, emits CheckedIn / MemberJoined
  └─────────┬───────────┘
            │ logs
            ▼
  ┌─────────────────────────────────────────────┐
  │  Ponder indexer (one long-running process)  │
  │   1. backfill  deploy block → chain head    │
  │   2. tail      new blocks, forever          │
  └─────────┬───────────────────────────────────┘
            │ writes
            ▼
  ┌─────────────────────┐
  │  Postgres           │   check_in, member, member_month, day_stat, global_stat
  └─────────┬───────────┘
            │ indexed reads (no RPC on the request path)
            ▼
  ┌─────────────────────┐
  │  HTTP API (Hono)    │   /feed  /members/:addr  /leaderboard  (+ /graphql, /sql)
  └─────────────────────┘
            ▲
       frontend
```

### Why an indexer, and not log scans

Every one of these screens is a question about the *past*: "the last 50
check-ins", "how many consecutive days", "who showed up most this month". By
launch the contract has months of history behind it, and that history only grows.

Answering any of those by calling `eth_getLogs` when a page loads does not work.
RPC providers cap each call by block range and by matched-log count, so a full
history scan is thousands of paginated calls — and one more of them every day the
app is alive. It is slow on the first page load, it gets slower forever, and it
fails on rate limits and timeouts. Replaying history from archive-node state
reads is the same mistake wearing a different hat.

So history is read exactly once, by a process built for it. Ponder backfills from
the deployment block into Postgres, then tails new blocks and appends to the same
tables. A page load is then an indexed query over local rows: **constant cost, no
RPC on the request path**, and identical results for a check-in from day 1 and one
from a minute ago.

### Why the contract emits what it does

An indexer can only see what the contract emits — a state change with no event is
invisible to every indexer, explorer and frontend that will ever look at it. So
`Streak.sol` is written event-first: `CheckedIn` carries the member's **complete
post-state** for that check-in (day index, resulting streak, resulting total), not
just "X checked in".

That means the read side never calls the contract to reconstruct anything. It
applies each event once, in order, during both backfill and live tail — which is
also what makes the backfill and the tail produce identical results.

`MemberJoined` fires only on an address's first ever check-in. That is a separate
event rather than a flag because "how many members do we have" and "who is new
today" would otherwise require counting distinct addresses at read time.

### Onchain vs offchain, deliberately

**Onchain** (`Streak.sol`) is only what must be enforced or is free alongside it:

- one check-in per member per day — the contract already stores `lastDay` to
  enforce this, so the streak counter comes almost free on the same slot;
- `canCheckIn(address)` and `liveStreak(address)` — plain "as of now" reads for
  gating the check-in button. These are direct contract calls (batch them through
  [Multicall3](https://github.com/mds1/multicall) at `0xcA11bde05977b3631167028862bE2a173976CA11`
  if you need several at once). **Do not** query the indexer for these; current
  state is not indexing work.

**Offchain** (the indexer) is everything that ranks, aggregates or paginates:
the feed and its cursors, the monthly leaderboard, per-day activity. None of it
belongs in contract storage — it would cost gas on every write to maintain a
ranking that only the UI reads.

### The day boundary

The contract buckets time into day indices, `(unixSeconds + dayOffsetSeconds) / 86400`,
and emits that index on every check-in. Two consequences worth knowing:

- A "day" is a calendar day, not 24 hours. Checking in at 23:00 and again at 01:00
  is a 2-day streak; checking in at 01:00 and again at 23:00 the same day is
  rejected.
- `dayOffsetSeconds` is immutable, fixed at deploy. Pass `0` for UTC midnight, or
  e.g. `-18000` to roll the day over at 00:00 EST. **The indexer's
  `DAY_OFFSET_SECONDS` must match it**, or the read side's "today" and "this
  month" will disagree with the chain's.

The indexer never re-derives a day from a timestamp; it reuses the index the
contract emitted, so the two can't drift.

### The one subtlety: streaks decay silently

A streak *continuing* emits an event. A streak *breaking* does not — it is the
absence of a transaction, and nothing onchain ever records it. So the
`currentStreak` stored per member is only true as of that member's last check-in.

Both read paths apply the decay at read time — `liveStreak()` in
`indexer/src/days.ts` and, for direct contract reads, `Streak.liveStreak()`. Skip
this and every lapsed member's profile shows a frozen streak forever.

### Schema

| Table | Grain | Backs |
| --- | --- | --- |
| `check_in` | one row per check-in | the feed, a member's history |
| `member` | one row per member | profiles, all-time boards |
| `member_month` | member × month | the monthly leaderboard |
| `day_stat` | one row per day | activity charts, "who showed up today" |
| `global_stat` | single row | community totals |

`member_month` is the load-bearing one. Counting a month's check-ins by scanning
`check_in` would work fine on launch day and get slower every month. Incrementing
a counter as events arrive keeps the leaderboard a single indexed range scan no
matter how long the history gets — and keeps every *past* month queryable at the
same cost, not just the current one.

### Feed pagination

The feed paginates on a keyset cursor, `ordinal = blockNumber << 16 | logIndex`,
not on `OFFSET` and not on `timestamp`:

- **Not `OFFSET`** — deep scrollback would get slower the longer the history gets,
  and rows would shift under the reader whenever a new check-in lands mid-scroll.
- **Not `timestamp`** — Base block timestamps are second-resolution and several
  check-ins share a block, so timestamps tie and ties paginate unstably.

`?before=<cursor>` walks older; `?after=<cursor>` fetches only what is new, which
is what a live feed should poll with.

---

## API

Served by the indexer process on `:42069`.

```
GET /feed?limit=50&before=<cursor>      global feed, newest first
GET /feed?limit=50&after=<cursor>       only check-ins newer than cursor (polling)
GET /members/:address?limit=30          profile: streak, total, recent notes
GET /leaderboard?month=YYYY-MM&limit=25 leaderboard (defaults to this month)
GET /stats                              community totals + last 30 days of activity
GET /freshness                          how far behind the chain the read side is
GET /graphql                            auto-generated, for anything not above
GET /ready | /health | /metrics         Ponder's own sync state (reserved)
```

`limit` is capped at 100 everywhere. `/ready` returns 200 only once the
historical backfill has finished — point your load balancer at it so traffic
never hits a half-indexed API.

---

## Running it locally

Needs [Foundry](https://getfoundry.sh) and Node 20+. No Postgres required —
Ponder falls back to PGlite on local disk for development.

A fresh chain has no history, which is the one thing this app is about. So the
local setup seeds some: `seed-local.sh` starts anvil with a **backdated clock**
and replays 90 days of check-ins across 5 members, with deliberate gaps so
streaks actually break and the leaderboard is not a tie.

```bash
# 1. Contracts: fetch forge-std (lib/ is not committed), build, test, and seed a
#    local chain with 90 days of history.
cd contracts
forge install foundry-rs/forge-std
forge test
./script/seed-local.sh            # starts anvil, deploys, seeds; DAYS=30 for a shorter run
```

It prints the two values the indexer needs:

```
Put these in indexer/.env.local:
  STREAK_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
  STREAK_START_BLOCK=1
```

```bash
# 2. Indexer: point it at that chain and start.
cd ../indexer
npm install
cp .env.example .env.local        # then paste in the two values above,
                                  # plus PONDER_RPC_URL=http://127.0.0.1:8545 and CHAIN_ID=31337
npm run dev -- --schema streak_local
```

Ponder backfills the seeded history, then tails. Once it reports ready:

```bash
curl 'localhost:42069/feed?limit=5'
curl 'localhost:42069/leaderboard'
curl 'localhost:42069/members/0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
curl 'localhost:42069/stats'
```

To watch the live tail, send another check-in (anvil only mines on demand, so
nudge it):

```bash
cast send $STREAK_ADDRESS "checkIn(string)" "gm" --rpc-url http://127.0.0.1:8545 \
  --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
cast rpc --rpc-url http://127.0.0.1:8545 evm_mine
```

It appears at the top of `/feed` within a couple of seconds, with the streak
incremented.

If you change the contract, regenerate the ABI the indexer compiles against:

```bash
cd contracts && forge build && cd ../indexer && npm run abi
```

---

## Deploying

### 1. The contract

```bash
cd contracts
export DAY_OFFSET_SECONDS=0          # 0 = days roll over at 00:00 UTC. Immutable.
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_RPC_URL \
  --private-key $DEPLOYER_KEY \
  --broadcast --verify --etherscan-api-key $BASESCAN_API_KEY
```

It prints:

```
  STREAK_ADDRESS   = 0x...
  STREAK_START_BLOCK = 12345678
```

**Write the start block down.** It is the one value that cannot be recovered by
guessing later: the indexer backfills from it, so a number later than the true
deployment block silently and permanently truncates history — streaks come out
short and the leaderboard is wrong, with no error anywhere. (If you lose it, find
the contract-creation block on Basescan.) A number that is too early only wastes
scan time, so err early if you must.

### 2. The indexer — where it actually runs

**The indexer runs as one always-on container on [Railway](https://railway.app),
with Railway Postgres attached, started by `npx ponder start --schema $DATABASE_SCHEMA`
(`indexer/Dockerfile` + `indexer/railway.json`).** Any host that runs a persistent
container with a managed Postgres works the same way — Render, Fly.io, ECS, a VM
with systemd. What is not negotiable:

- **It is a server, not a job.** It must stay up. Do not run it on a cron or a
  serverless function — it holds the tail of the chain.
- **The database must be managed and durable.** PGlite is local-disk only; it is
  for development. Losing the volume means re-running the entire backfill.
- **Exactly one replica per schema.** Two writers on one schema corrupt it. Scale
  reads by putting a cache in front, not by adding replicas.

Deploy:

```bash
cd indexer
railway up
```

with these variables set on the service:

```
PONDER_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
STREAK_ADDRESS=0x...
STREAK_START_BLOCK=12345678
CHAIN_ID=8453
DAY_OFFSET_SECONDS=0            # must equal the contract's immutable value
DATABASE_URL=${{Postgres.DATABASE_URL}}
DATABASE_SCHEMA=streak_v1       # bump on each deploy, see below
CORS_ORIGIN=https://your-frontend.example
```

Use a **paid RPC**. The first boot replays months of blocks; a public endpoint
will rate-limit you into a very long sync.

**Zero-downtime redeploys.** Ponder indexes into a named Postgres schema. Bump
`DATABASE_SCHEMA` (`streak_v1` → `streak_v2`) when you deploy a change to the
schema or the handlers: the new container backfills into the new schema while the
old one keeps serving, and `/ready` flips only when it has caught up. Drop the old
schema once traffic has moved. Deploying a handler change *into the same schema*
means serving partially-reindexed data while it catches up.

**Watch `/freshness`.** `behindSeconds` is how far the newest indexed check-in
lags wall clock. It should sit within a few seconds of the chain head; a
climbing value means the tail has stalled (usually the RPC).

### 3. Frontend

Point it at the indexer's URL. Use `/feed`, `/members/:address` and
`/leaderboard` for the three screens, and `/graphql` for anything else. For the
check-in button's enabled state, call `Streak.canCheckIn(address)` on the
contract directly — that is current state, not history, and it should not wait on
the indexer.

---

## An alternative: The Graph

Ponder was chosen here because it is one container and one Postgres you already
know how to operate. A subgraph is a reasonable substitute, with one thing to
plan for: **deploying is not publishing**, and the free hosted service was sunset
in June 2024, so there is no free public endpoint to deploy to.

```bash
graph deploy <slug>     # → Subgraph Studio. Rate-limited, for testing only.
```

To get a production endpoint you publish the subgraph from Studio to the network
and query it with a Studio API key. Queries are metered — roughly 100K free per
month, then about $2 per 100K (as of 2026-08; check the live pricing page before
budgeting). Self-hosting a Graph Node is the third option, but then the host, the
Postgres, the IPFS node and the process supervision are all yours, which is
strictly more to operate than the Ponder container above.

---

## Contract reference

`Streak.sol`

| | |
| --- | --- |
| `checkIn(string note)` | The only write. Reverts `AlreadyCheckedInToday` on a repeat, `NoteTooLong` above 140 bytes. |
| `canCheckIn(address)` | Whether they can check in right now. |
| `liveStreak(address)` | Current streak, with the missed-day decay applied. |
| `members(address)` | `(lastDay, currentStreak, longestStreak, total)`. |
| `currentDay()` / `dayOf(ts)` | Day-index math, using this contract's offset. |

Events: `CheckedIn(member, day, timestamp, currentStreak, totalCheckIns, note)`,
`MemberJoined(member, day, timestamp)`, `StreakRecord(member, day, length)`.

There is no owner, no pause and no upgrade path. Notes are capped at 140 bytes and
are **public and permanent** — they are calldata on a public chain.

## Tests

```bash
cd contracts && forge test
```

Covers streak continuation and breaking, the calendar-day (not 24-hour) boundary,
note limits, day-offset shifts, and the decay of `liveStreak` without a
transaction. The fuzz test `testFuzz_EventStateMatchesStorage` drives random
check-in gaps and asserts the emitted event equals the contract's own storage on
every single check-in — because the read side is rebuilt from those events, so if
they ever disagreed the whole read side would be wrong.
