# Streak

Daily onchain check-ins for a community on Base. A member sends one check-in
transaction a day, optionally with a short public note. That is the only write.

Three screens read from it:

| Screen | What it shows | Backed by |
| --- | --- | --- |
| **Global feed** | Most recent check-ins across everyone, newest first — who, when, their note | `CheckIn` entities, `orderBy: seq desc` |
| **Profile** | A member's current streak and all-time total check-ins | `Member` entity + `liveStreak()` |
| **Leaderboard** | Top members this month by number of check-ins | `MemberMonth` entities, `orderBy: checkIns desc` |

All three cover the contract's **entire history**, from its first day — not just
what happens after a page is opened.

---

## Architecture

```
  member's wallet
        │  checkIn("gm")           ← the only write
        ▼
┌───────────────────┐
│ Streak.sol (Base) │  emits CheckedIn(member, day, timestamp, streak, total, note)
└─────────┬─────────┘
          │  every event, from the deployment block onward
          ▼
┌─────────────────────────────┐
│ Subgraph (The Graph)        │  subgraph/ — one handler, five entities:
│ graph-node replays history  │  CheckIn · Member · MemberMonth · DayStat · Community
└─────────┬───────────────────┘
          │  GraphQL
          ▼
┌─────────────────────────────┐
│ Read client (src/)          │  getGlobalFeed · getMemberProfile · getMonthlyLeaderboard
└─────────┬───────────────────┘
          │
      three screens
```

### Why an indexer, and not RPC

The launch-day requirement — feed, streaks and leaderboard covering the whole
history — rules out reading from the chain directly:

- **`eth_getLogs` over months of blocks does not work.** Base produces a block
  every 2 seconds, so a year is ~15.8M blocks. Providers cap log ranges (commonly
  10k blocks) and rate-limit hard, so a first page of the feed would mean hundreds
  of sequential paginated calls — slow, expensive, and re-done on every page load.
- **Contract state cannot answer these questions.** The contract knows each
  member's current streak and total, but a feed, a monthly ranking, and "what did
  they write on day 12" are *history*, which lives in event logs and in past
  state. Reading past state needs an archive node.
- **Putting the answers onchain is the wrong trade.** Maintaining a sorted
  leaderboard or an append-only feed array in storage would add unbounded SSTORE
  cost to every check-in, and every member would pay for it, forever. Ranking and
  feeds are read-side concerns; they belong in an index.

So the contract is designed **event-first** and the read side is a subgraph that
has already processed every block from the deployment block onward. Queries are
served from Postgres indexes in milliseconds, whatever the history's size.

### What the contract emits, and why

```solidity
event CheckedIn(
    address indexed member,  // filter by member
    uint32  indexed day,     // filter by UTC day
    uint64  timestamp,
    uint32  streak,          // the member's streak AFTER this check-in
    uint32  total,           // the member's all-time total AFTER this check-in
    string  note
);
```

The event carries the member's post-check-in `streak` and `total`, computed by the
contract, which already has to track them to enforce one-check-in-per-day. The
indexer therefore **records** streak arithmetic instead of **re-deriving** it: the
mapping cannot drift from the chain, and the profile screen's numbers are the
contract's own. `member` and `day` take two of the three indexed topic slots — the
two things anything ever filters by.

Days are UTC days: `day = block.timestamp / 86400`. One check-in per member per
day is enforced onchain (`AlreadyCheckedInToday`), so no de-duplication is needed
anywhere downstream.

### The one piece of read-side logic: lapsed streaks

A streak dies from *inaction*, and inaction emits no event. Nothing — not the
contract's storage, not the subgraph — can update a streak at the moment it
lapses. So `Member.currentStreak` is only true *as of* `lastCheckInDay`, and every
consumer must apply the liveness rule:

> The streak stands if the member checked in today or yesterday (they can still
> save it before UTC midnight). Otherwise it is 0.

That is `liveStreak()` in `src/time.ts`, applied by `getMemberProfile()` and by
the leaderboard's streak column. `Streak.liveStreak(address)` implements the same
rule onchain for contracts and for a no-indexer fallback. Getting this wrong is
the classic streak-app bug: a profile that proudly shows 🔥 60 for someone who
last checked in in March.

### Entities

| Entity | Key | Purpose |
| --- | --- | --- |
| `CheckIn` | `txHash-logIndex` | Immutable feed row. `seq = blockNumber * 100000 + logIndex` is a unique, monotonic chain-order key, so the feed pages with a `seq_lt` cursor instead of `skip` (graph-node rejects `skip` above 5000 — and the feed is precisely the query that would run into it). |
| `Member` | address | Profile: totals, streak as of last check-in, longest streak, first/last check-in. |
| `MemberMonth` | `0xaddr-YYYY-MM` | One row per member per month — the leaderboard's unit, incremented as events arrive. Ranking is a single indexed sort, not a scan over the month's check-ins, and works the same for past months as for the current one. |
| `DayStat` | UTC day index | Community-wide daily counts. Not needed by the three screens; there for activity charts. |
| `Community` | `"global"` | All-time check-in and member counts for a header strip. |

`monthKey`/`dateKey` in `subgraph/src/dates.ts` convert a UTC day index to
`YYYY-MM` / `YYYY-MM-DD` with integer-only date math (Howard Hinnant's
`civil_from_days`) — AssemblyScript mappings have no `Date`.

---

## Layout

```
contracts/          Foundry project — Streak.sol, deploy script, tests
subgraph/           The Graph subgraph — schema, manifest, mapping
src/                Read client (TypeScript) backing the three screens
  feed.ts             SCREEN 1 — getGlobalFeed, getFeedForDate, watchNewCheckIns
  profile.ts          SCREEN 2 — getMemberProfile, getMemberCheckInDays
  leaderboard.ts      SCREEN 3 — getMonthlyLeaderboard, getMemberMonthRank
  time.ts             UTC day math + liveStreak (the lapsed-streak rule)
  graphql.ts          fetch-based GraphQL client + indexingStatus
  cli.ts              renders all three screens in the terminal
scripts/seed-local.sh Back-dates months of check-ins onto a local anvil
docker-compose.yml    Local graph-node + IPFS + Postgres
```

The read client is plain TypeScript over `fetch` with no framework, so it drops
into a Next.js server component, a React hook, or a script unchanged. `viem` is
used only for the two optional direct-chain paths (live tail, onchain fallback).

---

## Deploying

### 1. The contract

```bash
cd contracts
forge install                       # fetches forge-std into lib/
forge test
forge script script/Deploy.s.sol \
  --rpc-url $BASE_RPC_URL \
  --private-key $DEPLOYER_KEY \
  --broadcast --verify
```

The script prints the two values the subgraph needs:

```
Streak deployed to: 0x...
startBlock for subgraph.yaml: 12345678
```

### 2. The subgraph

Put both values in `subgraph/networks.json`:

```json
{ "base": { "Streak": { "address": "0x...", "startBlock": 12345678 } } }
```

`startBlock` **must be the deployment block**. It is what makes the feed,
streaks and leaderboard cover history from day one; a recent block would silently
truncate all three. There is no cost to it being right — graph-node skips blocks
with no matching logs quickly.

```bash
cd subgraph
npm install
npm run codegen
graph auth <deploy-key>             # from https://studio.thegraph.com
npm run deploy                      # graph deploy streak --network base
```

Watch it backfill in Studio; it will say `synced` once it reaches the chain head.
Then publish to the decentralized network for production traffic (Studio's
endpoint is rate-limited and meant for development).

### 3. The read side

```bash
cp .env.example .env    # set STREAK_SUBGRAPH_URL to the deployed endpoint
npm install && npm run build
```

---

## Running locally

The point of the local setup is to develop against **history**, not against an
empty chain — the launch-day condition. `scripts/seed-local.sh` back-dates months
of check-ins, with deliberate gaps so streaks really break.

Four terminals, or run the first three detached:

```bash
# 1 — a chain that starts 90 days in the past (block timestamps only move
#     forward, so the history has to begin back there). --host 0.0.0.0 lets
#     graph-node reach it from its container.
anvil --host 0.0.0.0 --timestamp $(( $(date -u +%s) - 90 * 86400 ))

# 2 — deploy (anvil's first dev account); lands at a deterministic address
cd contracts
forge create src/Streak.sol:Streak \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
# -> 0x5FbDB2315678afecb367f032d93F642f64180aa3, deployed in block 1

# 3 — 90 days of check-ins across 6 members, ending about today
./scripts/seed-local.sh 0x5FbDB2315678afecb367f032d93F642f64180aa3 90 6

# 4 — the indexing stack
docker compose up -d

# 5 — build and deploy the subgraph against the local node.
#     networks.json's "mainnet" entry is the local label; it already points at
#     the deterministic address and startBlock 1.
cd subgraph
npm install
npm run codegen
npm run create:local
npm run deploy:local
```

Then read the three screens:

```bash
export STREAK_SUBGRAPH_URL=http://localhost:8000/subgraphs/name/streak
npm install
npm run screens -- feed 20
npm run screens -- profile 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
npm run screens -- leaderboard          # this month; or pass 2026-08
```

```
GLOBAL FEED — 190 check-ins from 6 members

0x9965…a4dc      3h ago  day 2026-09-24  🔥6
0x15d3…6a65      4h ago  day 2026-09-24  🔥2  "reviewed 3 PRs"
0x7099…79c8      6h ago  day 2026-09-24  🔥2  "gm"
```

Re-seed any time by restarting `anvil` (state is in memory) and repeating steps
2–3, then `npm run deploy:local` again with a bumped `--version-label`.

To check in by hand:

```bash
cast send 0x5FbDB2315678afecb367f032d93F642f64180aa3 "checkIn(string)" "gm" \
  --rpc-url http://localhost:8545 --private-key 0xac09...ff80
```

### Tests

```bash
cd contracts && forge test     # streaks, gaps, one-per-day, note limits
npm test                       # UTC day math + the lapsed-streak rule
npm run typecheck
```

---

## Using the read client

```ts
import {
  configFromEnv, getGlobalFeed, getMemberProfile, getMonthlyLeaderboard,
} from "./src/index.js";

const config = configFromEnv();

// SCREEN 1 — feed, newest first. Page with the returned cursor.
const { checkIns, nextCursor } = await getGlobalFeed(config, { first: 50 });
const older = await getGlobalFeed(config, { first: 50, cursor: nextCursor });

// SCREEN 2 — profile. currentStreak already has the liveness rule applied.
const profile = await getMemberProfile(config, "0xabc…");
profile.currentStreak;   // 0 if they missed a day
profile.totalCheckIns;   // all-time
profile.canCheckInToday; // drives the check-in button

// SCREEN 3 — this month's leaderboard (or any past month).
const board = await getMonthlyLeaderboard(config, { first: 25 });
const august = await getMonthlyLeaderboard(config, { month: "2026-08" });
```

Also available: `getMemberMonthRank` (a member's rank even outside the top N),
`getMemberCheckInDays` (full history for a calendar heatmap), `getFeedForDate`,
`getCommunityStats`, `iterateGlobalFeed` (walks all history for exports), and
`indexingStatus` (how far behind the head the subgraph is — worth surfacing as a
"live" dot).

### Freshness

graph-node follows the chain head within a block or two, so polling
`getGlobalFeed` every few seconds is enough for a "live" feed. For instant
appends there are two optional direct-chain helpers:

- `watchNewCheckIns(config, cb)` — subscribes to new logs and appends rows as
  they land. It never backfills; history stays the subgraph's job. Dedupe against
  subgraph rows with `feedRowKey(row)`.
- `getMemberProfileOnchain(config, address)` — one multicall for a member's
  streak and totals. Use it to confirm a check-in the indexer has not ingested
  yet, or as a fallback if the subgraph is down. It cannot produce the feed or
  the leaderboard; those need history.

### Known limits

- **Leaderboard ties.** graph-node sorts on one key, so equal check-in counts are
  ordered arbitrarily by the database; the client re-sorts a page to break ties in
  favour of whoever got there first. A tie straddling a page boundary can still
  order those two rows arbitrarily — fetch a slightly larger page than you render
  if that matters.
- **`getMemberMonthRank`** counts members ahead by paging, and stops at 5000 (the
  `skip` ceiling). Fine for a community; a chain-sized membership would want a
  rank column maintained by the mapping.
- **Reorgs** are handled by graph-node, which unwinds and replays affected
  blocks. Rows delivered by `watchNewCheckIns` are not reorg-aware, which is why
  they are a display-only tail over subgraph-served history.
- **Note contents are unmoderated** and public forever. If the community needs
  moderation, filter on the read side (`src/feed.ts` is the one place to do it) —
  the chain cannot forget.
