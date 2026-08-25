# Streak

A daily onchain check-in book for a community on Base. Once a day a member sends
one transaction — optionally with a short public note — and that is the only
write the app ever makes.

Three screens read from it:

| Screen | Question it answers | Endpoint |
| --- | --- | --- |
| **Feed** | Who checked in most recently, and what did they say? | `GET /feed` |
| **Profile** | What is this member's current streak and all-time total? | `GET /members/:address` |
| **Leaderboard** | Who has checked in the most this month? | `GET /leaderboard` |

All three cover the contract's **entire** history, from its first day — not just
what happens after a page is opened.

```
contracts/           Foundry project
  src/Streak.sol       the contract — one write, one event
  test/Streak.t.sol    day boundaries, streak breaks, note limits
  script/Deploy.s.sol  deploys and prints the indexer's start block
indexer/             Ponder indexer + HTTP API (the read side)
  ponder.config.ts     which chain, which contract, which start block
  ponder.schema.ts     the read model: check_in, member, member_month
  src/index.ts         the event handler that builds it
  src/api/index.ts     the three screens as HTTP endpoints
  src/time.ts          UTC day/month arithmetic, shared by both
  test/                unit tests for that arithmetic and for cursors
scripts/
  anvil.mjs            local node with a rewound clock
  seed-local.mjs       replays months of check-ins into it
  verify-local.mjs     checks the API against the chain it indexed
```

---

## Architecture

### Why there is an indexer at all

The three screens are history questions, and a chain is a bad database for
history questions. An app that only subscribed to new logs would show an empty
feed and zero streaks on launch day; one that called `eth_getLogs` from the
deployment block on every page load would take seconds to respond and get
rate-limited off any RPC provider. Reading the contract's own storage doesn't
help either — `members(address)` gives one member's counters, but there is no way
to ask a contract "the 25 most recent check-ins across everyone" or "the top 10
this month" without scanning.

So the history is replayed **once**, into Postgres, and kept up to date:

```
Base ──logs──▶ Ponder ──▶ Postgres ──▶ HTTP API ──▶ feed / profile / leaderboard
               (backfill from the deployment block, then follow the tip)
```

(Locally that database is an embedded PGlite under `indexer/.ponder/`; set
`DATABASE_URL` and it is Postgres.)

Ponder reads every `CheckedIn` log from `STREAK_START_BLOCK` to the chain tip
before it starts serving traffic, then follows new blocks live (~1s), handling
reorgs by unwinding affected rows. The API only ever queries the local database,
so a screen renders in milliseconds regardless of how many months are behind it.

### The contract

`contracts/src/Streak.sol` has a single write, `checkIn(string note)`:

- **One check-in per member per UTC day.** A day is `block.timestamp / 86400`,
  the same arithmetic on both sides of the system. A second check-in in the same
  day reverts with `AlreadyCheckedIn`.
- **Streaks are computed onchain.** A check-in extends the streak only if the
  previous one was literally yesterday, otherwise it starts a new one at 1. The
  contract keeps `streak`, `longestStreak`, `total`, `firstDay` and `lastDay`
  per member, and emits `streak` and `total` in the event — so the indexer never
  has to redo consecutive-day arithmetic, and the two can be cross-checked
  against each other (`pnpm verify:local` does exactly that).
- **Notes are never stored.** They live only in the `CheckedIn` log. Storage is
  the expensive part of a transaction, and nothing onchain needs to read a note
  back — the indexer picks it up from the log. A 140-byte cap bounds the cost.

The event carries everything the read side needs:

```solidity
event CheckedIn(
    address indexed member, uint32 indexed day, uint32 streak, uint32 total, string note
);
```

### The read model

`indexer/ponder.schema.ts` defines three tables. `check_in` is the log-for-log
record; the other two are rollups maintained incrementally as each log is
indexed, so no screen ever scans the whole history at request time.

| Table | Grain | Backs |
| --- | --- | --- |
| `check_in` | one row per event, ever | the feed, and a member's recent activity |
| `member` | one row per address | the profile |
| `member_month` | one row per (member, month) | the leaderboard |

A few decisions worth knowing about:

**Feed pagination uses a `(blockNumber, logIndex)` cursor**, not an offset and
not a timestamp. Several check-ins routinely land in the same block and even in
the same second, so a timestamp cursor would skip or repeat rows at page
boundaries, and an offset cursor shifts under you every time a new check-in
arrives at the head of the feed. The pair is a total order over a chain's logs,
so `WHERE (block_number, log_index) < (:b, :l) ORDER BY ... DESC` is exact. A
cursor is opaque to the client: `"461:0"`.

**A stored streak is not a current streak.** The `member` table holds the streak
as of the member's last check-in, which is all the chain can know. Whether it is
still *alive* depends on today's date, so the API derives it per request: the
streak stands if the last check-in was today or yesterday (today isn't over yet
— the member can still continue it), and is 0 otherwise. `Streak.currentStreakOf`
applies the identical rule onchain, so the two never disagree.

**The leaderboard month is a denormalised `"YYYY-MM"` column** rather than a
range scan over timestamps, which keeps the query index-only:
`WHERE month = '2026-08' ORDER BY check_ins DESC`. Ties break on who reached the
count first, so ranks don't shuffle between requests. `?month=YYYY-MM` reads any
past month.

Everything is UTC — days, months, and the contract — so nobody's leaderboard
month depends on the timezone of the machine rendering it.

---

## Running it locally

Prerequisites: Node >= 22, [pnpm](https://pnpm.io), and
[Foundry](https://getfoundry.sh) (`anvil`, `forge`).

```bash
pnpm install
pnpm contracts:build
```

You need a chain with history on it for any of this to be interesting, and a
fresh anvil starts at the present moment with an empty contract. So start anvil
with its clock **rewound**, then replay a few months into it:

```bash
# terminal 1 — a node whose clock starts 90 days ago
pnpm anvil

# terminal 2 — deploy, then walk forward one UTC day at a time to the present
pnpm seed:local
```

Both take options: `SEED_DAYS=180 ANVIL_PORT=8600 pnpm anvil` for a longer or
relocated chain, and `pnpm seed:local --days 180 --members 6` to match. The
rewind has to happen at genesis — a chain's clock only moves forward, so it
cannot be backdated once the node is running.

`seed:local` prints the contract address and deployment block. Put them in
`indexer/.env.local` (copy `indexer/.env.example` first):

```bash
CHAIN_ID=31337
PONDER_RPC_URL=http://127.0.0.1:8545
STREAK_ADDRESS=0x5fbdb2315678afecb367f032d93f642f64180aa3
STREAK_START_BLOCK=1
PONDER_LOGS_BLOCK_RANGE=10000
```

Then start the indexer:

```bash
pnpm indexer:dev
```

It backfills the whole seeded history (a few seconds locally) and serves on
<http://localhost:42069>:

```bash
curl "localhost:42069/feed?limit=3"
curl "localhost:42069/members/0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
curl "localhost:42069/leaderboard?limit=10"
```

### Checking the read side against the chain

```bash
pnpm verify:local                      # defaults to localhost:42069 and the RPC in .env.local
pnpm verify:local --api http://localhost:42069 --rpc http://127.0.0.1:8545
```

This is the test that matters for an indexer, so it ships as a script rather
than living in someone's terminal history. It pages the feed to its end and
checks the result against `eth_getLogs` from block 0 (same count, no duplicates
across page boundaries, newest-first, notes intact), reads every member through
`/members/:address` and compares totals, longest streaks and current streaks
against the contract's own `members()` and `currentStreakOf()`, and recounts the
month's leaderboard straight from the logs.

### Tests

```bash
pnpm test              # contract tests + indexer unit tests
pnpm contracts:test    # forge test
pnpm indexer:test      # day/month/streak arithmetic, cursor encoding
```

---

## The API

Base URL is the indexer, e.g. `http://localhost:42069`.

### `GET /feed`

Global feed, newest first.

| Query param | Default | Notes |
| --- | --- | --- |
| `limit` | 25 | max 100 |
| `cursor` | — | `nextCursor` from the previous page; omit for page 1 |

```jsonc
{
  "items": [
    {
      "id": "462-0",
      "member": "0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f",
      "note": "reviewing PRs today",
      "day": 20683,
      "timestamp": 1787038841,
      "time": "2026-08-18T07:40:41.000Z",
      "streak": 2,          // the member's streak as of this check-in
      "total": 85,
      "blockNumber": 462,
      "transactionHash": "0xee65…"
    }
  ],
  "nextCursor": "460:0"     // null on the last page
}
```

### `GET /members/:address`

Profile. Any address is valid — one that has never checked in returns a zeroed
profile rather than a 404.

| Query param | Default | Notes |
| --- | --- | --- |
| `recent` | 10 | how many of the member's own check-ins to include |

```jsonc
{
  "address": "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
  "currentStreak": 2,          // 0 once a whole day has been missed
  "longestStreak": 61,
  "totalCheckIns": 85,
  "checkedInToday": false,
  "daysSinceLastCheckIn": 1,
  "firstCheckInAt": 1779433381,
  "memberSince": "2026-05-22T07:03:01.000Z",
  "lastNote": "reviewing PRs today",
  "recentCheckIns": [ /* same shape as feed items */ ]
}
```

### `GET /leaderboard`

Top members for a month.

| Query param | Default | Notes |
| --- | --- | --- |
| `month` | current UTC month | `YYYY-MM` |
| `limit` | 25 | max 100 |

```jsonc
{
  "month": "2026-08",
  "entries": [
    { "rank": 1, "member": "0x14dc…", "checkIns": 17, "currentStreak": 0, "totalCheckIns": 80 }
  ]
}
```

### Also available

- `GET /stats` — all-time totals plus today's count, for a header bar.
- `GET /ready` — 200 once the historical backfill is complete. Use it as the
  readiness probe: a pod that is still backfilling would serve a partial feed.
- `GET /health` — liveness, returns 200 immediately.
- `POST /graphql` — auto-generated GraphQL over the same tables, with a browser
  UI at `/graphql`. Handy for exploring; the REST endpoints above are the ones
  shaped for the screens.
- `/sql/*` — SQL-over-HTTP for [`@ponder/client`](https://ponder.sh/docs/query/client),
  which gives a frontend live-updating queries over a websocket instead of
  polling:

  ```ts
  import { createClient, desc } from "@ponder/client";
  import * as schema from "../../indexer/ponder.schema";

  const client = createClient("http://localhost:42069/sql", { schema });

  // Re-runs and pushes a new result whenever the indexer commits a block.
  const { unsubscribe } = client.live(
    (db) =>
      db
        .select()
        .from(schema.checkIn)
        .orderBy(desc(schema.checkIn.blockNumber), desc(schema.checkIn.logIndex))
        .limit(25),
    (rows) => setFeed(rows),
    (error) => console.error(error),
  );
  ```

  Polling `/feed` every few seconds is perfectly fine too — the feed changes at
  most a few times a minute.

---

## Deploying

### 1. The contract

```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url https://mainnet.base.org \
  --account <your-keystore-account> \
  --broadcast --verify --etherscan-api-key $BASESCAN_API_KEY
```

The script prints the address **and the deployment block**. Write the block
down: it is what makes the indexer replay the complete history. Setting it to a
recent block silently truncates the past — the feed and the leaderboard would
look fine and simply be wrong.

Try Base Sepolia (`--rpc-url https://sepolia.base.org`, chain id 84532) first.

### 2. The indexer

Runs as one long-lived process against a Postgres database. Any host that runs
a container works — Railway, Render, Fly, ECS.

```bash
CHAIN_ID=8453
PONDER_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
STREAK_ADDRESS=0x…
STREAK_START_BLOCK=<deployment block>
PONDER_LOGS_BLOCK_RANGE=10000
DATABASE_URL=postgresql://…
```

```bash
pnpm --filter streak-indexer start --schema $(git rev-parse --short HEAD)
```

Notes on running this in production:

- **Use a paid RPC endpoint.** The initial backfill is the expensive part —
  months of Base blocks at the ~1000-block `eth_getLogs` limit public endpoints
  impose will take hours, and you'll get rate-limited. A paid endpoint allows
  10,000+ block ranges and turns the same backfill into minutes. After that,
  steady-state load is one poll per second. Ponder caches raw RPC responses in
  Postgres, so a redeploy against the same database does not re-fetch history.
- **`--schema` is required** for `ponder start`. Give each deploy its own schema
  (the commit SHA works well): the new instance backfills into a fresh schema
  while the old one keeps serving, which is what makes deploys zero-downtime.
  `ponder db prune` drops the schemas of retired deploys, and
  `ponder db create-views --views-schema public` points a stable schema at
  whichever deploy is live if you want clients to use a fixed name.
- **Point the readiness probe at `/ready`, not `/health`.** `/health` is up
  immediately; `/ready` waits for the backfill so traffic never hits a partial
  feed.
- **Scaling reads:** `ponder serve` runs the HTTP API without the indexer, so
  you can put several API replicas in front of one indexing process and the same
  database.

---

## Things a next iteration would want

- **ENS / basenames.** The API returns raw addresses; resolving names is a
  frontend concern (`viem`'s `getEnsName` against mainnet, cached) or an extra
  indexed table if you want to sort or search by name.
- **Notes are public and unmoderated.** They come off the chain verbatim; escape
  them on render (any React frontend does this by default) and consider a
  denylist table if the community needs one. The contract can't take a note back.
- **A per-day activity heatmap** for the profile screen is a `GROUP BY day`
  away — the `check_in` table already carries `day` for exactly this.
- **Timezones.** Days are UTC everywhere, which means a member in UTC+13 checks
  in "yesterday" by the contract's reckoning. That's the honest thing for a
  global leaderboard, but it's worth saying out loud in the UI.
