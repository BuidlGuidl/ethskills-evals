# Streak

A daily onchain check-in app for a community on Base. Members send one transaction
a day, optionally with a short public note. Three screens read that history back:

| Screen | What it shows | Served by |
| --- | --- | --- |
| Feed | most recent check-ins across everyone, newest first | `GET /feed` |
| Profile | a member's current streak and all-time total | `GET /members/:address` |
| Leaderboard | top members this month by check-in count | `GET /leaderboard` |

This repo contains the contract and the read side that backs those screens.

```
contracts/            Foundry project — the only write path
  src/Streak.sol
  test/Streak.t.sol
  script/Deploy.s.sol         deploy + print the indexer's start block
  script/seed-local.sh        fabricate months of history on a local anvil
  script/export-abi.sh        regenerate indexer/abis/StreakAbi.ts
indexer/              Ponder project — the read side
  ponder.config.ts            which chain, which contract, which start block
  ponder.schema.ts            the read model (check_in / member / member_month)
  src/index.ts                the indexing function for CheckedIn
  src/api/index.ts            the three HTTP routes + GraphQL + /sql
  src/lib/keys.ts             cursor keys, month/day math, streak decay
```

## Architecture

### Why there is an indexer

The contract is the source of truth, but it cannot answer any of the three screens'
questions:

- **The feed is cross-member and ordered.** Solidity has no "give me the 50 newest
  check-ins across all members". Keeping a growing array onchain and paging it would
  make every check-in more expensive and still cost an RPC round trip per page.
- **The leaderboard is an aggregate over a time window.** "Top 25 this month" means
  grouping every check-in in a month by member and sorting. That is a query, not a
  storage slot.
- **The history predates the app.** By launch the contract will have months of
  check-ins behind it. Anything that starts listening when a page opens — a
  `watchContractEvent` subscription, a websocket, a "recent logs" query — shows a
  feed that begins at page load and a leaderboard that counts only what it happened
  to witness. The month total for a member who checked in on the 3rd would be wrong
  for anyone who opened the app on the 10th.

So the read side is a **Ponder indexer**. It replays every `CheckedIn` event from the
contract's deployment block forward, writes rows into Postgres, then stays subscribed
to the head. Backfill and live tail run through the same indexing function, so a
check-in from four months ago and one from thirty seconds ago are treated identically.
Screens then read indexed tables — one indexed SQL query each, no `eth_getLogs` on the
request path, and response time that does not grow as the contract ages.

### Data flow

```
member wallet
     │  checkIn("gm")                       one transaction, once per UTC day
     ▼
Streak.sol on Base ──emits──▶ CheckedIn(member, day, timestamp, streak, total, note)
                                   │
                                   │  Ponder: backfill from the deploy block,
                                   │  then follow the head (reorg-aware)
                                   ▼
                         Postgres: check_in, member, member_month
                                   │
                                   ▼
                      HTTP API  /feed  /members/:address  /leaderboard
                                   │
                                   ▼
                            feed · profile · leaderboard
```

### The contract

`checkIn(string note)` is the only write. A UTC **day index** (`block.timestamp / 1 days`)
is the unit everything is built on: a member may check in once per day index, and a
streak continues when the previous check-in was on `day - 1`.

Days are UTC-aligned, not rolling 24-hour windows. Checking in at 23:50 and again at
00:10 is two days — which is what "daily check-in" means to a person looking at a
calendar, and it means the day boundary is the same for everyone regardless of
timezone.

The contract computes `streak` and `total` itself (it already needs `lastDay` for the
once-a-day rule) and puts both in the event. The indexer projects those numbers rather
than re-deriving them, so the indexer and the chain cannot disagree about a streak.

`members(address)`, `currentStreak(address)` and `canCheckIn(address)` are onchain
views for wallets and for the check-in button. They are deliberately *not* the app's
read path — they can only answer questions about one member at a time.

### The read model

Three tables, shaped by the three queries:

- **`check_in`** — one row per check-in, ever. Backs the feed. Its primary key is
  `${blockNumber}-${logIndex}`, zero padded so it sorts chronologically as text; the
  feed pages with `where id < $cursor order by id desc limit n`, a keyset scan that
  costs the same on page 1 and page 200 (unlike `offset`).
- **`member`** — one row per address. Backs the profile: all-time total, longest
  streak, first/last check-in, and the streak as of the last check-in.
- **`member_month`** — one row per (member, month), incremented as events arrive.
  Backs the leaderboard as `where month = $1 order by check_ins desc limit n`, instead
  of counting rows in `check_in` on every request. `month` is denormalised onto
  `check_in` too, so month filters never need date math in SQL.

### One thing that cannot be indexed: streak decay

A streak *ends* when a day passes with no check-in — and a missed day emits no event,
so there is nothing for the indexer to react to. Storing "current streak" as a column
would silently go stale: a member who last checked in three weeks ago would still show
a streak of 40.

So `member.streakAsOfLastDay` stores the streak at the moment of the last check-in, and
the API derives the live value at read time from `lastDay` (`currentStreak()` in
`indexer/src/lib/keys.ts`): the streak still counts if the last check-in was today or
yesterday — today is not over yet — and is 0 otherwise. `Streak.currentStreak()` applies
the same rule onchain, and `src/lib/keys.test.ts` pins the boundaries.

## Running it locally

Needs [Foundry](https://getfoundry.sh) and Node 22+. `forge-std` is vendored under
`contracts/lib/`, so there is no `forge install` step.

```bash
# 1. contract tests
cd contracts
forge test

# 2. a local chain with months of history behind it
#    (rewinding anvil's clock is what makes a real backfill possible locally)
anvil --timestamp $(( $(date +%s) - 130*86400 )) &
./script/seed-local.sh          # deploys Streak, seeds 120 days, prints the env vars

# 3. the indexer
cd ../indexer
npm install
cp .env.example .env.local      # then paste in the values seed-local.sh printed
npm run dev
```

`seed-local.sh` walks one UTC day at a time with five members on different attendance
patterns — one never misses, one does weekdays, one is sporadic, one has a long streak
that breaks, one shows up rarely — so streaks, gaps and month boundaries are all
exercised. `DAYS=30 ./script/seed-local.sh` for a faster loop.

Ponder prints its progress through the backfill, then serves on
**http://localhost:42069**:

```bash
curl 'localhost:42069/feed?limit=5'
curl 'localhost:42069/members/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
curl 'localhost:42069/leaderboard?month=2026-05'
```

To check in again while it is running:

```bash
cast rpc evm_setNextBlockTimestamp $(( $(date +%s)/86400*86400 + 3600 ))   # tomorrow, 01:00 UTC
cast send $STREAK_ADDRESS 'checkIn(string)' 'gm' --private-key 0xac09...ff80
```

The new row appears in `/feed` within a second or two.

Other commands:

```bash
npm test         # read-side unit tests (streak decay, cursor keys, month math)
npm run typecheck
npm run codegen  # regenerate ponder-env.d.ts and generated/schema.graphql
```

## API

### `GET /feed?limit=50&cursor=<id>`

Newest first. `limit` is capped at 100. Pass the previous response's `nextCursor` back
as `cursor` for the next page; `nextCursor` is `null` on the last page.

```json
{
  "checkIns": [
    {
      "id": "000000000413-000000",
      "member": "0xf39f…2266",
      "note": "shipped the docs",
      "timestamp": 1787101200,
      "day": 20684,
      "streak": 121,
      "transactionHash": "0xc6ee…cd9a",
      "blockNumber": "413"
    }
  ],
  "nextCursor": "000000000413-000000"
}
```

### `GET /members/:address?limit=30`

```json
{
  "address": "0xf39f…2266",
  "hasCheckedIn": true,
  "currentStreak": 121,
  "longestStreak": 121,
  "totalCheckIns": 121,
  "checkedInToday": true,
  "firstCheckInAt": 1776762000,
  "lastCheckInAt": 1787101200,
  "lastNote": "gm",
  "recentCheckIns": [{ "id": "…", "note": "gm", "timestamp": 1787101200, "day": 20684, "streak": 121, "transactionHash": "0x…" }]
}
```

An address that has never checked in is a normal case (someone opened a profile link),
so it returns zeros with `hasCheckedIn: false` rather than a 404. A malformed address
is a 400.

### `GET /leaderboard?month=YYYY-MM&limit=25`

`month` defaults to the current UTC month; any past month works, because the indexer
has the whole history. Ties are broken in favour of whoever reached the count first.

```json
{
  "month": "2026-08",
  "entries": [
    { "rank": 1, "member": "0xf39f…2266", "checkIns": 18, "totalCheckIns": 121,
      "currentStreak": 121, "longestStreak": 121, "lastCheckInAt": 1787101200 }
  ]
}
```

### Also available

- `/graphql` — auto-generated GraphQL over the same tables, for a frontend that would
  rather select its own fields.
- `/sql/*` — the [`@ponder/client`](https://ponder.sh/docs/query/client) endpoint, for
  typed and live-updating SQL reads from the browser.
- `/health`, `/ready` — Ponder's own endpoints. `/ready` returns 200 only once the
  historical backfill is complete, which is what a load balancer should gate on.

## Deploying

### 1. The contract

```bash
cd contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_RPC_URL --account deployer --broadcast --verify
```

The script prints the deployed address **and the block number it landed in**. Both go
into the indexer's environment. Then regenerate the ABI the indexer compiles against:

```bash
./script/export-abi.sh
```

### 2. The indexer

`STREAK_START_BLOCK` must be the deployment block. Setting it later silently truncates
history — the feed would begin mid-story and month totals before that block would be
wrong. Setting it to 0 is merely slower, not incorrect.

```bash
CHAIN_ID=8453
PONDER_RPC_URL_BASE=https://base-mainnet.example/<key>
STREAK_ADDRESS=0x…
STREAK_START_BLOCK=12345678
DATABASE_URL=postgresql://…
```

```bash
cd indexer
npm ci
npm run start -- --schema streak_v1
```

Notes for a real deployment:

- **Postgres is required in production.** Without `DATABASE_URL`, Ponder falls back to
  PGlite on local disk, which is fine for development and not for a deployed service.
- **`--schema` isolates a deployment.** Deploy a new version under a new schema name
  and it backfills into its own tables while the old one keeps serving; cut over when
  `/ready` returns 200. See [Ponder's zero-downtime notes](https://ponder.sh/docs/api-reference/ponder-cli#start).
- **The RPC only needs logs and blocks.** The indexer never makes historical `eth_call`s,
  so an archive node is not required — but the backfill does pull every log in the
  contract's range, so use a provider that allows wide `eth_getLogs` ranges rather than
  the public endpoint.
- **Reorgs are handled by Ponder**, which reverts affected rows when the chain
  reorganises. Base reorgs are shallow and check-ins are idempotent per day, so a
  reverted check-in simply disappears from the feed.
- **Scaling reads.** The API is stateless — run as many instances as you like against
  the same Postgres. Only one indexer process should write to a given schema.

## Design notes

- **Notes are capped at 140 bytes** and stored as calldata-only event data. They are
  never read onchain, so they cost calldata gas and nothing else. They are also
  arbitrary user text: escape them when rendering, and if the community needs
  moderation, do it in the read layer — the chain has no delete.
- **`longestStreak` is tracked onchain** as well as indexed. It is one `SSTORE` on the
  rare occasion a member sets a personal best, and it makes the value available to
  other contracts (badges, rewards) without an offchain oracle.
- **`totalCheckIns` / `totalMembers`** on the contract exist for cheap global counters;
  the indexer does not depend on them.
- **`MemberJoined` is not indexed.** It fires once per address, for consumers that want
  to react to a newcomer (a welcome bot, an onboarding NFT). The read model gets
  "member since" from `firstCheckInAt`, which the `CheckedIn` handler sets on insert,
  so indexing `MemberJoined` too would only duplicate it.
- **What is not built here:** the frontend. The three routes above are shaped to be a
  screen each, and `/graphql` is there if a client wants a different cut of the data.
