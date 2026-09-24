# Streak

A daily onchain check-in board for a community on Base.

A member sends one transaction a day — `checkIn()`, optionally with a short public
note. That is the only write in the system. Everything else is reading:

| Screen | Data it needs | Endpoint |
| --- | --- | --- |
| Global feed | most recent check-ins across everyone, newest first, with who / when / note | `GET /feed` |
| Member profile | current streak (consecutive days) and all-time total | `GET /members/:address` |
| Monthly leaderboard | top members this month by check-in count | `GET /leaderboard` |

All three cover the contract's **complete history**, back to the block it was
deployed in — not just what happens while a page is open.

---

## Architecture

```
  member's wallet
        │  checkIn("gm")            ← the only write
        ▼
┌──────────────────────┐
│  Streak.sol (Base)   │  one check-in per member per UTC day
│                      │  emits CheckedIn(member, day, streak, total, note)
└──────────┬───────────┘
           │  eth_getLogs from the deployment block, then live tail
           ▼
┌──────────────────────┐
│  indexer/ (Ponder)   │  replays every CheckedIn log into Postgres:
│                      │  check_in / member / monthly_count / daily_total
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  read API (Hono)     │  REST for the three screens, plus GraphQL and SQL
│  :42069              │
└──────────┬───────────┘
           ▼
     feed · profile · leaderboard
```

### Why an indexer and not direct contract reads

The contract can answer "what is *this* member's streak and total" in one `eth_call`
(`profileOf`), and the app uses that shape for the profile screen. But the two other
screens are queries the EVM cannot answer:

- **The feed is history.** Notes live in event logs, not in storage, so there is no
  view function that returns "the last 50 check-ins across everyone." Getting that
  from the chain means scanning logs over months of blocks — too slow and too
  RPC-expensive to do in a browser on every page load, and impossible to paginate
  cheaply.
- **The leaderboard is an aggregate over a time window.** Ranking members by
  check-ins in a given month is a `GROUP BY` / `ORDER BY`. Keeping it onchain would
  mean an unbounded sorted structure and a much more expensive `checkIn` for every
  member, every day, to serve a read.

So the chain stays the source of truth and the write path stays a single cheap
transaction, while a Ponder indexer replays the log history into Postgres and serves
the reads. Because indexing starts at the deployment block, the app launches with
months of backlog already queryable; the indexer then follows new blocks live
(including reorg handling) so the feed updates within a block or two.

### Data model (`indexer/ponder.schema.ts`)

- **`check_in`** — one row per check-in, i.e. the whole history. Carries `member`,
  `day`, `month`, `timestamp`, `note`, and the `streak`/`total` as of that check-in.
  `seq = blockNumber * 10^6 + logIndex` is a monotonic sort key, so the feed has a
  total order that is stable and cheap to cursor-paginate (block timestamps tie).
- **`member`** — one row per address: `total`, `streakAtLastCheckIn`, `longestStreak`,
  `firstDay`/`lastDay`, first/last timestamps, `lastNote`.
- **`monthly_count`** — `(month, member) → count`, plus `firstSeq` to break ties in
  favour of whoever got there first. The leaderboard is one indexed range scan.
- **`daily_total`** — `day → check-ins`, for "how many today" without touching the feed.

The contract computes each check-in's streak and total itself and puts them in the
event, so the indexer never has to reason about ordering or replay a member's whole
history to answer a question. Aggregates are maintained incrementally per event.

### One subtlety: a streak dies with no event

`streak` in the event is the streak *at the moment of that check-in*. If a member
then misses a day, their streak is over — but nothing happens onchain to say so, so
no row changes. The live value therefore has to be computed at read time by comparing
`lastDay` to the current UTC day: the stored streak still counts if the last check-in
was today or yesterday, otherwise it is `0`. That is
[`liveStreak()`](indexer/src/lib/streak.ts), used by the profile and leaderboard
endpoints, and mirrored onchain by `Streak.streakOf()` for direct reads.

Days are UTC-aligned and defined identically on both sides: `unixSeconds / 86400`.

---

## Repo layout

```
contracts/          Foundry project
  src/Streak.sol      the contract
  test/Streak.t.sol   unit + fuzz tests
  script/Deploy.s.sol deploy script (prints the address and start block)
indexer/            Ponder project — the read side
  ponder.config.ts    chain, contract address, start block
  ponder.schema.ts    Postgres tables the screens read
  src/index.ts        the CheckedIn indexing function
  src/api/index.ts    REST endpoints + GraphQL + SQL
  src/lib/streak.ts   day/month/streak logic shared by indexer and API
  abis/StreakAbi.ts   generated from the Foundry artifact (npm run abi)
scripts/seed-anvil.sh Fabricates months of backdated check-ins on a local node
```

---

## The contract

```solidity
function checkIn() external returns (uint32 streak);
function checkIn(string calldata note) external returns (uint32 streak);  // note ≤ 140 bytes

event CheckedIn(address indexed member, uint32 indexed day, uint32 streak, uint32 total, string note);
```

- One check-in per member per UTC day; a second attempt the same day reverts with
  `AlreadyCheckedInToday(day)`.
- `streak` increments when the previous check-in was yesterday, otherwise resets to 1.
- Reads for a single member without an indexer: `profileOf`, `streakOf`, `totalOf`,
  `canCheckIn`, plus `totalCheckIns` / `totalMembers` for community totals (handy as a
  cross-check that the indexer is caught up — it should equal `/stats.totalCheckIns`).
- No owner, no admin functions, nothing upgradeable, no pausing. Notes are capped at
  140 bytes to bound calldata and log size.

A check-in with a note costs roughly 110k gas — a fraction of a cent on Base.

---

## Local development

Requirements: Node 20+, [Foundry](https://getfoundry.sh), and — optionally — Postgres.
Without `DATABASE_URL`, Ponder uses an embedded PGlite database under
`indexer/.ponder/`, which is fine for local work.

```bash
# 1. install
cd indexer && npm install && cd ..
forge build --root contracts

# 2. run the tests
npm test                     # contract tests + indexer unit tests

# 3. start a local chain, then seed it with backdated history
anvil                        # terminal 1
./scripts/seed-anvil.sh      # terminal 2 — deploys Streak and fabricates 75 days
                             # of check-ins across 6 members, ending yesterday
                             # (DAYS=120 MEMBERS=8 ./scripts/seed-anvil.sh to vary)
```

The seed script prints the values to put in `indexer/.env.local`
(`cp indexer/.env.example indexer/.env.local`, then edit):

```ini
STREAK_CHAIN=anvil
PONDER_RPC_URL=http://127.0.0.1:8545
STREAK_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
STREAK_START_BLOCK=2
```

```bash
# 4. run the indexer + API
npm run dev                  # backfills, then follows the chain; API on :42069
```

The seeded history is deliberately uneven — some members skip days — so streaks,
totals and monthly rankings all differ. `GET /ready` returns 503 until the backfill
finishes (about a minute and a half for 75 days of seeded data against anvil), then
200; after that the indexer is tailing new blocks.

```bash
curl 'localhost:42069/feed?limit=5'
curl 'localhost:42069/members/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
curl 'localhost:42069/leaderboard'
curl 'localhost:42069/stats'
```

Check in again from a seeded account and the feed picks it up within a second or two:

```bash
cast send --rpc-url http://127.0.0.1:8545 \
  --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
  $STREAK_ADDRESS 'checkIn(string)' 'gm'
```

`npm run dev` hot-reloads on changes to the config, schema, or handlers, and re-indexes
from scratch when the schema changes. After editing the contract, run
`forge build --root contracts && npm run abi` to refresh the generated ABI.

---

## The read API

Served by `indexer/src/api/index.ts` on port 42069 (`PORT` to override).

### `GET /feed?limit=50&cursor=<cursor>` — global feed

Newest first across all members, over all of history. Pass the `cursor` field of the
last item you received to page into the past; `nextCursor` is `null` on the last page.

```json
{
  "items": [
    {
      "id": "36127841-0",
      "member": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      "note": "shipped the docs",
      "day": 20719,
      "month": "2026-09",
      "timestamp": 1790139477,
      "isoTime": "2026-09-23T04:57:57.000Z",
      "streak": 11,
      "total": 66,
      "blockNumber": 36127841,
      "transactionHash": "0x…",
      "cursor": "36127841000000"
    }
  ],
  "nextCursor": "36127841000000"
}
```

### `GET /members/:address?recent=10&month=YYYY-MM` — profile

`currentStreak` is the live streak (0 if a day was missed); `streakAtLastCheckIn` is
the raw onchain value it was derived from. An address that has never checked in is not
an error — it returns `exists: false` and zeroes.

```json
{
  "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "exists": true,
  "currentStreak": 11,
  "streakAtLastCheckIn": 11,
  "longestStreak": 20,
  "totalCheckIns": 66,
  "month": "2026-09",
  "checkInsThisMonth": 22,
  "canCheckInToday": true,
  "firstCheckInAt": 1784264277,
  "lastCheckInAt": 1790139477,
  "lastNote": "back at it",
  "recentCheckIns": [ "…same shape as /feed items…" ]
}
```

### `GET /leaderboard?month=YYYY-MM&limit=25&offset=0` — monthly leaderboard

Defaults to the current UTC month. Any past month works, which is what makes
"last month's winner" a single call.

```json
{
  "month": "2026-09",
  "entries": [
    { "rank": 1, "address": "0xf39f…2266", "checkIns": 22, "currentStreak": 11, "longestStreak": 20, "totalCheckIns": 66 },
    { "rank": 2, "address": "0x7099…79c8", "checkIns": 20, "currentStreak": 2,  "longestStreak": 15, "totalCheckIns": 61 }
  ]
}
```

### `GET /stats`

Community totals: all-time check-ins and members, members with a live streak,
check-ins this month and today, and the timestamp of the very first check-in.

### `POST /graphql`

Ponder's generated GraphQL API over the same tables, including relations — useful for
screens that want a different slice than the REST endpoints expose. Note that
`streakAtLastCheckIn` here is raw, not live.

```graphql
{
  checkIns(orderBy: "seq", orderDirection: "desc", limit: 20) {
    items { member note timestamp memberRecord { total longestStreak } }
  }
}
```

### `GET /sql/*`

Typed SQL-over-HTTP for [`@ponder/client`](https://ponder.sh/docs/query/sql-client),
if the frontend would rather query with Drizzle and subscribe to live updates than
call REST.

---

## Deploying

### 1. Contract

```bash
cd contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://mainnet.base.org \
  --account <keystore-account> \
  --broadcast --verify --verifier-url https://api.basescan.org/api
```

Note the two values it prints — the address, and the block to start indexing from.

### 2. Indexer

Set the environment (see `indexer/.env.example`):

```ini
STREAK_CHAIN=base
PONDER_RPC_URL=https://base-mainnet.g.alchemy.com/v2/…
STREAK_ADDRESS=0x…
STREAK_START_BLOCK=36127841      # ← the deployment block, so nothing is missed
DATABASE_URL=postgresql://…      # Postgres in production
```

```bash
cd indexer
npm ci
npm run start                    # backfill from STREAK_START_BLOCK, then live tail
```

`STREAK_START_BLOCK` is the one setting that matters for correctness of the history:
set it to the deployment block (never `latest`) and the backfill covers every check-in
ever made. A public RPC will work but is slow for a large backfill — use a provider
with archive logs and decent rate limits for the initial sync.

Notes for production:

- **Postgres, not PGlite.** Ponder writes to a fresh schema per deploy and serves the
  previous one until the new one is caught up, so redeploys and schema changes don't
  blank the API. Point `DATABASE_URL` at a real database.
- **Health.** `GET /ready` returns 200 once the backfill is complete; use it as the
  readiness probe so traffic doesn't hit a half-indexed API. `GET /health` is liveness.
- **Reorgs** are handled by Ponder: finalized blocks are checkpointed and unfinalized
  rows are rolled back automatically. `seq` values come from block numbers, so a
  reorged check-in disappears from the feed rather than lingering.
- **Re-indexing** from scratch (after a schema change, say) takes minutes, not hours,
  since the contract emits one small event per member per day.
- **Timezones.** Days and months are UTC everywhere. If the community wants streaks to
  roll over at a local midnight instead, that has to change in the contract — the
  indexer deliberately uses the same day index the contract emits.
