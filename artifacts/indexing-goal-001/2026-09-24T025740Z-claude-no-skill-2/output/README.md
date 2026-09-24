# Streak

A daily onchain check-in book for a community on Base. Members send one check-in
transaction per day, optionally with a short public note. That is the only write
the product has.

This repo contains the two halves a developer needs:

| Path        | What it is                                                                          |
| ----------- | ----------------------------------------------------------------------------------- |
| `contracts/` | The `Streak` contract (Foundry), its tests, and deploy/check-in scripts.             |
| `indexer/`   | The read side: a [Ponder](https://ponder.sh) app that indexes the contract's entire event history into Postgres and serves the JSON API behind the three screens. |
| `scripts/`   | `seed-local.sh` — spins two months of back-dated check-ins onto a local anvil node.  |

---

## Architecture

### The shape of the problem

The three screens are not "what happened since I opened the page" questions:

- **Global feed** — every member's check-ins, newest first, paged backwards
  through the whole history.
- **Profile** — current streak (consecutive days) and all-time total for one
  member.
- **Monthly leaderboard** — members ranked by check-ins within a calendar month,
  for this month and for every month before it.

Two of those are cross-member, sorted, paginated and aggregated. The contract
cannot answer them: Solidity mappings are not enumerable, so no view function can
sort members by "check-ins in September" or return the 200 most recent check-ins
across everyone. Only the profile screen maps onto contract state — and `Streak`
does expose it via `profileOf()` — but that is one of three screens.

Reading the log directly from an RPC at page load does not work either. By launch
the contract has months of history, which is hundreds of thousands of Base blocks;
providers cap `eth_getLogs` at a few thousand blocks and a few thousand results
per call, so a "load the feed" click becomes hundreds of sequential RPC round
trips, repeated for every visitor, with no way to sort, group by month, or page.

So the read side is an **indexer**: it reads the log once, keeps derived tables,
and answers every screen from indexed SQL.

### How it fits together

```
            checkIn(note)
  member ─────────────────▶ Streak.sol (Base)
                                │  emits CheckedIn(member, day, timestamp, streak, total, note)
                                ▼
                           event log  ◀── the canonical, complete history
                                │
                   backfill from deploy block, then follow the chain tip
                                ▼
                        Ponder indexer  ──▶  Postgres
                          src/index.ts        check_in      (feed)
                                              member        (profile)
                                              member_month  (leaderboard)
                                              day_activity  (calendar)
                                              stats
                                │
                        src/api/*.ts (Hono)
                                ▼
                    GET /api/feed  /api/members/:address  /api/leaderboard
                       (+ auto-generated GraphQL at /graphql)
```

**The whole history is covered by construction.** `STREAK_START_BLOCK` is the
contract's deployment block. On first run Ponder backfills from that block to the
chain tip — replaying every `CheckedIn` event that has ever been emitted through
the indexing function — and only then reports `/ready` and starts serving. After
the backfill it follows new blocks (with reorg handling: on a reorg it rolls the
derived tables back to the common ancestor and reapplies). There is no "start
watching from now" mode anywhere in the read path; a query issued one second after
startup sees the contract's first ever day.

If you change the indexing logic or the schema, Ponder re-runs the backfill from
scratch into a fresh database schema, so the tables are always a pure function of
the full log. Cached RPC responses make re-runs much faster than the first one.

### Contract design

`contracts/src/Streak.sol`, one external write:

```solidity
function checkIn(string calldata note) external returns (uint32 day, uint32 streak);
```

- **Days are UTC.** Day index = `block.timestamp / 86400`. A second check-in in
  the same UTC day reverts with `AlreadyCheckedIn`. Notes are capped at 140 bytes.
- **Streak rule.** If the previous check-in was yesterday, the streak increments;
  otherwise it restarts at 1. A streak stays alive through the whole day after the
  last check-in — check in yesterday and your streak is intact today until
  midnight UTC; skip a full day and it's gone.
- **Stored state is the minimum needed to enforce the rule** (`lastDay`,
  `firstDay`, `streak`, `longestStreak`, `total` per member, packed into one slot,
  plus two global counters). `profileOf()` / `currentStreakOf()` read it directly,
  so a profile can also be rendered straight from the chain with no indexer.
- **The note is emitted, never stored.** Nothing onchain reads it; the feed is an
  offchain view. Event data costs 8 gas/byte versus 20,000+ for storage.
- **`CheckedIn` carries the derived numbers** (`day`, `timestamp`, `streak`,
  `total`) rather than just the address. The indexer therefore never has to call
  the contract or reconstruct per-member state from scratch — the log alone is
  enough to rebuild every table, which is what keeps re-indexing cheap and makes
  the history verifiable from logs alone.

A stored `streak` goes stale the moment a member misses a day (nothing runs
onchain to zero it). Both read paths handle that identically: the contract's
`currentStreakOf()` compares `lastDay` against today, and the API does the same
with `liveStreak()` in `indexer/src/lib/time.ts`.

### Indexer data model

One indexing function — `indexer/src/index.ts`, on `Streak:CheckedIn` — maintains:

| Table          | Grain                     | Serves                                                    |
| -------------- | ------------------------- | --------------------------------------------------------- |
| `check_in`     | one row per event, all time | the global feed and any member's timeline                 |
| `member`       | one row per address       | profile headline numbers (streak, longest, total, first/last) |
| `member_month` | (member, YYYYMM)          | the leaderboard, for any month in history                 |
| `day_activity` | (member, day)             | profile activity calendar                                 |
| `stats`        | single row                | community totals                                          |

Aggregates are maintained incrementally as events are replayed, so no request
scans the event table: the leaderboard is one indexed range scan over
`member_month`, a profile is one primary-key read.

`check_in.id` is `blockNumber-logIndex`, zero padded, so it sorts in exact chain
order as text. The feed pages by keyset (`WHERE id < cursor ORDER BY id DESC`)
rather than `OFFSET`, which keeps page 40 of a year-old feed as cheap as page 1.

### API

Ponder serves on `:42069`. Purpose-built endpoints back the three screens; the
auto-generated GraphQL endpoint is there for ad-hoc queries.

**Feed** — `GET /api/feed`

```
?limit=50        page size (max 100)
?cursor=<id>     keyset cursor: items strictly older than this id
?member=0x…      restrict to one member (the profile timeline)
?since=<id>      items newer than this id — what a live feed polls with
```

```jsonc
{
  "items": [{ "id": "000000000211-000000", "member": "0x90f7…", "note": "ship ship ship",
              "timestamp": 1790132723, "time": "2026-09-23T03:05:23.000Z", "day": 20719,
              "month": "2026-09", "streak": 5, "memberTotal": 5,
              "blockNumber": 211, "logIndex": 0, "transactionHash": "0xd5c6…" }],
  "nextCursor": "000000000208-000000",  // pass as ?cursor= for older items; null at the contract's first day
  "latestCursor": "000000000211-000000", // pass as ?since= to poll for new ones
  "hasMore": true
}
```

Live updates are polling: hold `latestCursor` and hit `?since=` every few
seconds. (`/sql/*` is also mounted for `@ponder/client` if you'd rather have live
SQL subscriptions in the browser.)

**Profile** — `GET /api/members/:address?recent=10&month=YYYY-MM`

```jsonc
{
  "address": "0xf39f…", "exists": true,
  "currentStreak": 60, "longestStreak": 60, "totalCheckIns": 60,
  "checkedInToday": false, "streakAtRisk": true,   // alive, but today is still missing
  "firstCheckIn": { "day": 20660, "date": "2026-07-26" },
  "lastCheckIn": { "day": 20719, "date": "2026-09-23", "timestamp": 1790132723, "note": "day done" },
  "thisMonth": { "month": "2026-09", "checkIns": 23, "bestStreak": 60, "rank": 1 },
  "recentCheckIns": [ /* feed items */ ]
}
```

An address that has never checked in returns `200` with `exists: false` and zeros.
`GET /api/members/:address/days?month=YYYY-MM` returns that month's check-in days
for an activity calendar.

**Leaderboard** — `GET /api/leaderboard?month=YYYY-MM&limit=25&offset=0`

Defaults to the current UTC month. Ranked by check-ins that month, ties broken by
who got there first. Each row also carries all-time context (current streak,
longest streak, total). `GET /api/leaderboard/months` lists every month that has
any activity, newest first — the month picker.

**Other** — `GET /api/stats` (community totals), `GET /status` (indexing progress),
`GET /ready` (200 once the historical backfill is complete — use it as the
deployment readiness probe), `GET /health`, `POST /graphql`.

---

## Running it locally

Requirements: Node ≥ 22, [Foundry](https://getfoundry.sh). No Postgres needed
locally — Ponder falls back to an embedded PGlite database under `.ponder/`.

```bash
# 1. contracts (if contracts/lib/ is empty: forge install foundry-rs/forge-std)
cd contracts && forge build && forge test

# 2. a local chain that already has history behind it.
#    Start anvil back-dated two months, in its own terminal:
anvil --timestamp $(( $(date +%s) - 60*86400 ))

# 3. deploy + seed ~150 check-ins across 5 members and 60 days (~45s)
./scripts/seed-local.sh

# 4. point the indexer at it — the script prints exactly this block
cd indexer && npm install
cat > .env.local <<'EOF'
CHAIN_ID=31337
PONDER_RPC_URL_BASE=http://127.0.0.1:8545
STREAK_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
STREAK_START_BLOCK=1
EOF
npm run dev
```

Then:

```bash
curl 'localhost:42069/api/feed?limit=3'
curl 'localhost:42069/api/members/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
curl 'localhost:42069/api/leaderboard'
curl 'localhost:42069/api/leaderboard?month=2026-08'   # a month that ended before you started
```

The seeded members have deliberately different patterns — perfect attendance, one
missed day a week, every third day, a recent joiner, someone who drifted away —
so streaks, ranks and broken streaks are all visible. Send another check-in and
watch it land in the feed within a couple of seconds:

```bash
cast send $STREAK_ADDRESS "checkIn(string)" "gm" --rpc-url http://127.0.0.1:8545 \
  --private-key 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

`npm run dev` hot-reloads on changes to the schema or indexing function, replaying
the history from cached RPC data each time.

---

## Deploying

### 1. Contract

```bash
cd contracts
export BASE_RPC_URL=https://mainnet.base.org
export ETHERSCAN_API_KEY=…          # for --verify on Basescan

forge script script/Deploy.s.sol \
  --rpc-url $BASE_RPC_URL --broadcast --verify \
  --private-key $DEPLOYER_KEY       # or --ledger / --account <keystore>
```

The script prints the address and the deployment block. **Write both down** —
`STREAK_START_BLOCK` is what makes the read side cover the full history; set it
too high and the early record is silently missing. (If you ever lose it, the
earliest block is recoverable from the contract's creation transaction on
Basescan.) Smoke-test with:

```bash
STREAK_ADDRESS=0x… NOTE="gm" forge script script/CheckIn.s.sol --rpc-url $BASE_RPC_URL --broadcast
```

The contract is immutable and has no owner, admin or upgrade path.

### 2. Indexer

Copy `indexer/.env.example` to `.env.local` (or set the equivalent variables in
your host's dashboard) and fill in:

```
CHAIN_ID=8453
PONDER_RPC_URL_BASE=https://base-mainnet.g.alchemy.com/v2/…   # a real provider
STREAK_ADDRESS=0x…
STREAK_START_BLOCK=…            # the deployment block from step 1
DATABASE_URL=postgresql://…     # Postgres in production
DATABASE_SCHEMA=streak_v1       # required by `ponder start`
```

```bash
cd indexer
npm ci
npm start -- --schema streak_v1     # or set DATABASE_SCHEMA and run `npm start`
```

Deployment notes:

- **Postgres is required in production.** PGlite is a local-development
  convenience only. Ponder holds the indexed tables plus its RPC cache there; the
  cache is what makes redeploys fast, so keep the database between releases.
- **Zero-downtime releases.** Deploy a new instance with a new `DATABASE_SCHEMA`,
  wait for `GET /ready` to return 200 (the new instance has finished backfilling
  the entire history), then cut traffic over. Use `/ready` as the readiness probe
  and `/health` as the liveness probe. `ponder db list` / `ponder db prune` manage
  old schemas.
- **The first backfill is RPC-bound.** Months of Base blocks is a lot of
  `eth_getLogs` pages; a paid provider endpoint and a generous `RPC_MAX_RPS` make
  the difference between minutes and hours. Restarts resume from cache.
- **Scaling reads.** The API is stateless and read-only. To serve more traffic,
  run one indexing instance (`ponder start`) plus N API-only instances
  (`ponder serve`) pointed at the same Postgres schema.
- **Frontend.** The three screens are plain `fetch` calls against the endpoints
  above; set `CORS_ORIGIN` to your app's origin to lock CORS down from the
  default `*`. The write side needs nothing from this service — the check-in
  button calls `checkIn(string)` on the contract directly via wagmi/viem.

---

## Tests

```bash
cd contracts && forge test
```

13 tests cover the streak rule (consecutive days, missed days, stale streaks that
must read as zero, UTC day boundaries rather than a rolling 24 hours), the
one-per-day revert, note length limits, member independence, and a fuzz test that
replays random day gaps and checks the contract's streak against an independent
model.

For the read side, `scripts/seed-local.sh` doubles as an end-to-end fixture: the
seeded patterns give known expected answers (member 0: 60 check-ins, 60-day
streak; member 2: every third day, so a current streak of 1 and a broken streak
everywhere else), and `cast call … profileOf(address)` against the same chain is
an independent check that the API's numbers match the contract's.

## Layout

```
contracts/
  src/Streak.sol              the contract
  test/Streak.t.sol           forge tests
  script/Deploy.s.sol         deploy, prints address + start block
  script/CheckIn.s.sol        send one check-in
indexer/
  ponder.config.ts            chain, contract address, START BLOCK (full backfill)
  ponder.schema.ts            check_in / member / member_month / day_activity / stats
  src/index.ts                the single indexing function
  src/lib/time.ts             UTC day+month bucketing, streak liveness
  src/api/feed.ts             GET /api/feed
  src/api/profile.ts          GET /api/members/:address (+ /days)
  src/api/leaderboard.ts      GET /api/leaderboard (+ /months)
  src/api/index.ts            routes, CORS, /api/stats, GraphQL, /sql
  abis/StreakAbi.ts           generated from the Foundry artifact (npm run sync-abi)
scripts/seed-local.sh         two months of back-dated check-ins on anvil
```
