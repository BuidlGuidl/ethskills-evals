# Streak

A daily onchain check-in app for a community on Base. A member sends one transaction a
day, optionally with a short public note — that is the only write in the product.
Everything else is reading history back out:

- **Feed** — the most recent check-ins across everyone, newest first: who, when, note.
- **Profile** — a member's current streak and all-time total.
- **Leaderboard** — the top members this month by number of check-ins.

By launch the contract has months of check-ins behind it, so all three screens have to
reflect the **complete history from the contract's first block**, not just what happens
while a page is open. That requirement is what shapes the architecture below.

```
.
├── contracts/              Foundry project — the onchain half
│   ├── src/Streak.sol      the contract (one write: checkIn)
│   ├── test/Streak.t.sol   12 tests covering streak/day-boundary behaviour
│   ├── script/Deploy.s.sol deploy + print the indexer's startBlock
│   └── script/seed-local.sh seeds a local anvil with ~60 days of history
├── indexer/                Ponder project — the read side
│   ├── ponder.config.ts    chain, contract address, startBlock
│   ├── ponder.schema.ts    the three indexed tables
│   ├── src/index.ts        the CheckedIn handler that fills them
│   ├── src/api/index.ts    HTTP + GraphQL API behind the three screens
│   ├── utils/time.ts       UTC day/month + live-streak helpers
│   └── abis/streakAbi.ts   generated from the Foundry artifact
└── README.md
```

There is no UI in this repo: the deliverable is the contract plus the read side that
backs the three screens. Every screen is one HTTP call, listed under [API](#api).

## Architecture

```
  member ──checkIn(note)──▶  Streak.sol on Base
                                   │  emits CheckedIn(member, day, streak, total, note)
                                   ▼
                       ┌────────────────────────┐
                       │  Ponder indexer        │  backfills every log from the
                       │  src/index.ts          │  deployment block, then follows
                       └───────────┬────────────┘  the chain in realtime
                                   ▼
                    Postgres: check_in · member · member_month
                                   │
                       ┌───────────┴────────────┐
                       │  HTTP + GraphQL API    │
                       └───────────┬────────────┘
                                   ▼
                    feed · profile · leaderboard screens
```

### Why an indexer, and not the contract or the RPC

The contract is the source of truth, but it is a bad place to *read* these screens from:

- **The feed and the notes only exist in logs.** Notes are emitted, never stored — the
  cheapest possible design for a once-a-day write, but it means the feed can only be
  reconstructed from event history. Contracts cannot read their own logs.
- **`eth_getLogs` from the client does not scale to "the whole history".** Months of
  check-ins across a community is tens of thousands of logs spread over millions of
  Base blocks. Providers cap block ranges per request, so a browser would have to fan
  out hundreds of paginated requests on every page load, and then re-sort and
  re-aggregate the whole set client-side just to render 25 rows. It is slow on the
  first load, impossible to paginate cheaply, and gets worse every day the app lives.
- **A leaderboard is an aggregate.** "Top members this month" is a `GROUP BY member`
  over a month of events. Doing that onchain would mean keeping a sorted structure in
  storage and paying for it on every check-in — a tax on the write path to serve a
  read that nobody pays gas for. Doing it in the client means downloading the month.
- **Streaks need a decay rule that depends on *now*.** The contract knows the streak as
  of the last check-in; whether it is still alive depends on the current UTC day.

So: the contract stays minimal and cheap, emits everything the read side needs, and a
Ponder indexer replays `CheckedIn` from the deployment block into Postgres. Ponder
backfills the full history on first run, then follows new blocks (with reorg handling)
so the feed is live. The API then answers each screen with a single indexed query
whose cost does not grow with the length of the history.

The `startBlock` in `ponder.config.ts` is the deployment block, which is what makes
history complete — that one value is the difference between "the whole record" and
"whatever happened since we deployed the indexer".

### Data model

Three tables, all written by the single `CheckedIn` handler in `indexer/src/index.ts`.

| Table          | Grain                | Backs                | Key columns |
| -------------- | -------------------- | -------------------- | ----------- |
| `check_in`     | one row per event    | feed, member history | `(block_number, log_index)` sort key, `member`, `note`, `timestamp`, `day`, `month`, `streak` |
| `member`       | one row per address  | profile              | `total_check_ins`, `streak_as_of_last_check_in`, `longest_streak`, `first/last_check_in_at`, `last_day` |
| `member_month` | one row per member×month | leaderboard      | PK `(member, month)`, `check_ins`, `last_check_in_at` |

`member` and `member_month` are rollups maintained incrementally as events arrive, so
neither the profile nor the leaderboard ever scans the log. The monthly counter is
denormalised into a `"YYYY-MM"` column at index time, which turns "top members this
month" into one indexed range scan on `(month, check_ins)`.

The counters in `member` are copied from the values the contract itself emitted
(`streak`, `total`) rather than recomputed offchain, so the indexer cannot drift away
from onchain state.

### Streaks: the one piece of logic that lives in two places

The contract computes streaks on the write path — it already has to load the member's
record to enforce one check-in per day, so extending or resetting the streak is nearly
free, and the value gets emitted in the event.

But that value is only true *as of the day it was written*. Somebody with a 12-day
streak who then goes quiet for a week still has `12` in storage. The live streak is a
function of the current UTC day, so it is computed at read time, in one place —
`liveStreak()` in `indexer/utils/time.ts`, mirrored by `Streak.currentStreak()` onchain
for contracts and wallets that want it:

> A streak counts if the member checked in **today or yesterday** (UTC); otherwise it
> is 0. Yesterday still counts because the member has the rest of today to keep it
> alive — which is also what `streakAtRisk` in the profile response flags.

Both the API and the contract use the same rule, so a screen and a wallet never
disagree. Days and months are UTC everywhere, matching the contract's
`block.timestamp / 86400`.

## The contract

`contracts/src/Streak.sol` — no owner, no admin, no upgradeability. One write:

```solidity
function checkIn() external;                  // no note
function checkIn(string calldata note) external;  // note, max 140 bytes
```

It reverts with `AlreadyCheckedInToday(day)` on a second check-in in the same UTC day
and `NoteTooLong(length, max)` past 140 bytes. Views: `memberOf(address)`,
`currentStreak(address)`, `hasCheckedInToday(address)`, `today()`, plus
`totalCheckIns()` and `totalMembers()`.

```solidity
event CheckedIn(address indexed member, uint32 indexed day, uint32 streak, uint32 total, string note);
```

Notes: the whole member record (`firstDay`, `lastDay`, `streak`, `longestStreak`,
`totalCheckIns`) is packed into one 256-bit slot, so a check-in is one warm SSTORE plus
the log. `member` and `day` are indexed so a client can filter by either without the
indexer. The note is never written to storage — it lives only in the log, which is what
the feed reads.

```bash
cd contracts && forge test
# Ran 12 tests for test/Streak.t.sol:StreakTest ... 12 passed
```

## API

Served by the indexer on `http://localhost:42069` (`ponder dev`/`start`). All responses
are JSON; addresses come back checksummed and are accepted in any casing.

### `GET /feed` — screen 1

Global feed, newest first. Keyset pagination on `(blockNumber, logIndex)`, so pages
stay stable and cheap while new check-ins land at the head.

`limit` (1–100, default 25), `cursor` (pass back `nextCursor`).

```console
$ curl -s 'localhost:42069/feed?limit=2'
{
  "items": [
    {
      "id": "318-0",
      "member": "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
      "note": "live from anvil",
      "timestamp": 1787117815,
      "time": "2026-08-19T05:36:55.000Z",
      "day": 20684,
      "streak": 1,
      "blockNumber": "318",
      "transactionHash": "0x03ba63e4dd75e6bccc27cc3ecf5d5d834c0491cc0e6c95d1b538bdc4872d533c"
    },
    { "id": "316-0", "member": "0x90F79bf6EB2c4f870365E785982E1f101E93b906", "note": "back at it", "...": "..." }
  ],
  "nextCursor": "316-0"
}
```

The feed is live by polling — Ponder indexes new Base blocks within a block or two, so
a client polling every few seconds sees check-ins land. `null` `nextCursor` means the
end of history.

### `GET /members/:address` — screen 2

Profile: live streak, all-time total, and the member's ten most recent check-ins.

```console
$ curl -s localhost:42069/members/0x70997970c51812dc3a010c7d01b50e0d17dc79c8
{
  "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "hasCheckedIn": true,
  "currentStreak": 60,
  "streakAsOfLastCheckIn": 60,
  "longestStreak": 60,
  "totalCheckIns": 60,
  "firstCheckInAt": 1781933699,
  "lastCheckInAt": 1787031304,
  "checkedInToday": false,
  "streakAtRisk": true,
  "recentCheckIns": [ ... ]
}
```

`currentStreak` is the decayed, live value; `streakAsOfLastCheckIn` is the raw onchain
number, exposed so a UI can explain a broken streak ("your 60-day streak ended"). An
address that has never checked in is a valid empty profile (`hasCheckedIn: false`,
zeroes) rather than a 404 — the screen renders fine either way.

`GET /members/:address/check-ins` pages through that member's full history with the
same `limit`/`cursor` contract as `/feed`.

### `GET /leaderboard` — screen 3

Top members for a month. `month` (`YYYY-MM`, default the current UTC month), `limit`,
`offset`. Ties break toward whoever got there first.

```console
$ curl -s 'localhost:42069/leaderboard?limit=3'
{
  "month": "2026-08",
  "entries": [
    { "rank": 1, "address": "0x7099...79C8", "checkIns": 18, "currentStreak": 60, "longestStreak": 60, "totalCheckIns": 60, "lastCheckInAt": 1787031304 },
    { "rank": 2, "address": "0x3C44...93BC", "checkIns": 17, "currentStreak": 3,  "longestStreak": 16, "totalCheckIns": 56, "lastCheckInAt": 1787031304 },
    { "rank": 3, "address": "0x90F7...b906", "checkIns": 12, "currentStreak": 2,  "longestStreak": 5,  "totalCheckIns": 42, "lastCheckInAt": 1787031304 }
  ]
}
```

Past months work too (`?month=2026-07`) — the history is all there.

### Also

- `GET /stats` — community totals and the current UTC day/month.
- `POST /graphql` — the same tables with relations, for clients that want their own
  shape. E.g. `{ members(orderBy:"totalCheckIns", orderDirection:"desc", limit:10) { items { address totalCheckIns } } }`.
- `GET /health` — process is up. `GET /ready` — **backfill is complete**. Do not send
  traffic to a fresh deployment before `/ready` returns 200, or the screens will show a
  partial history.

## Running it locally

Prerequisites: **Node ≥ 22**, **Foundry** (`curl -L https://foundry.paradigm.xyz | bash && foundryup`).
No Postgres needed — Ponder uses an embedded PGlite database under `indexer/.ponder/`.

```bash
# 1. contract: dependencies, build, test
cd contracts
forge install foundry-rs/forge-std --no-git   # first time only
forge test

# 2. a local chain whose clock starts 60 days in the past, so there is history to index
anvil --timestamp $(( $(date +%s) - 60 * 86400 ))

# 3. in another shell: deploy + seed ~60 days of check-ins for six members with
#    different habits (perfect attendance, weekdays only, someone who quit halfway).
#    Writes indexer/.env.local with the address and deployment block.
cd contracts && ./script/seed-local.sh

# 4. run the indexer + API
cd ../indexer
npm install
npm run dev
```

Ponder backfills the seeded history (a few seconds), then follows the chain. Once
`curl -s localhost:42069/ready` returns 200:

```bash
curl -s localhost:42069/stats
curl -s 'localhost:42069/feed?limit=5'
curl -s 'localhost:42069/leaderboard?limit=10'
curl -s localhost:42069/members/0x70997970c51812dc3a010c7d01b50e0d17dc79c8
```

To watch the feed update live, send another check-in and re-read `/feed`:

```bash
cast send $STREAK_ADDRESS 'checkIn(string)' 'gm' --rpc-url http://127.0.0.1:8545 \
  --private-key $(cast wallet private-key \
    --mnemonic "test test test test test test test test test test test junk" --mnemonic-index 7)
```

If you change `src/`, `ponder.schema.ts`, or the ABI, `ponder dev` hot-reloads and
re-indexes automatically. `npm run typecheck` checks the indexer; `npm run generate:abi`
refreshes `abis/streakAbi.ts` from the Foundry artifact after a contract change.

## Deploying

### 1. The contract, to Base

```bash
cd contracts
export BASE_RPC_URL=https://mainnet.base.org
export BASESCAN_API_KEY=...

forge script script/Deploy.s.sol:Deploy \
  --rpc-url base --broadcast --verify \
  --account <your-keystore-account>      # or --ledger / --private-key
```

The script prints the address **and the deployment block number**. Keep both — the
block number is the indexer's `startBlock`, and getting it wrong is the one mistake
that silently truncates history. (Base Sepolia: `--rpc-url base_sepolia`, with
`BASE_SEPOLIA_RPC_URL` set.)

### 2. The indexer

```bash
cd indexer
cp .env.example .env.local   # then fill it in
```

| Variable             | Value |
| -------------------- | ----- |
| `CHAIN_ID`           | `8453` for Base mainnet (`84532` for Sepolia, `31337` for anvil) |
| `PONDER_RPC_URL`     | your Base RPC endpoint — use a paid provider, the backfill is log-heavy |
| `STREAK_ADDRESS`     | from step 1 |
| `STREAK_START_BLOCK` | the deployment block from step 1 |
| `DATABASE_URL`       | Postgres connection string — required in production |

Then run it:

```bash
npm ci
npm start          # ponder start: indexes and serves on :42069
```

Deploy it as one long-running service (Railway, Fly, ECS, a container anywhere) plus a
Postgres instance. Points worth knowing:

- **Postgres, not PGlite, in production.** Ponder's crash recovery, reorg handling and
  multi-instance serving all live in Postgres. Point `DATABASE_URL` at a managed
  instance and give it room — the log grows by one small row per check-in per day.
- **Wait for `/ready`.** Set it as the readiness probe. The first backfill of a
  months-old contract takes minutes; `/health` goes green long before the history is
  complete.
- **Zero-downtime redeploys.** `ponder start --schema <name>` indexes into a named
  Postgres schema, so a new version can backfill alongside the running one. Use
  `ponder db list` to see deployments and `ponder db prune` to drop retired ones. If
  you want a stable set of views for other consumers, `--views-schema`.
- **Scaling reads.** `ponder serve` runs the API alone against an already-indexed
  database — run one indexer and as many API replicas as the screens need.
- **Reorgs are handled** by Ponder: affected rows are rolled back and reindexed. On
  Base this is rarely more than a block or two.
- **Restarts are cheap.** Ponder resumes from where it left off; it does not re-scan
  the chain from `startBlock` on every boot.

### 3. The client

Point the three screens at the API and poll `/feed` every few seconds. Nothing in the
UI needs an RPC connection to render — only to *send* a check-in.

## Design notes and trade-offs

- **Notes are logs, not storage.** Cheapest write, and the feed needs an indexer
  regardless. The cost is that a contract can never read a note back; nothing in the
  product needs that.
- **Day = `timestamp / 86400`, UTC.** No timezones onchain, and it makes a check-in
  window unambiguous for everyone. It does mean the day flips mid-afternoon in the
  Americas; a UI showing "checks in at 00:00 UTC" is worth the pixel. Per-member
  timezones would require sending an offset with every check-in and would make streaks
  gameable.
- **`streak` and `total` are emitted, not derived.** The contract has already paid to
  compute them, so the event carries them and the indexer copies them. This removes a
  whole class of "the indexer says 7, the contract says 8" bugs.
- **`member_month` is denormalised.** It makes the leaderboard O(members active this
  month) instead of O(all check-ins ever), and it costs one extra upsert per event.
- **Keyset, not offset, pagination.** Offsets shift as new check-ins arrive at the head
  of the feed; a `(blockNumber, logIndex)` cursor does not.
- **No frontend here.** The three screens are each one HTTP call against the API above;
  the read side is the part that had to be designed.
