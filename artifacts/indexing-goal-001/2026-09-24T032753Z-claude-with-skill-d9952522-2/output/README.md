# Streak

A daily onchain check-in app for a community on Base. A member sends one check-in
transaction per day, optionally with a short public note. That is the only write.

Three screens are the product:

| Screen | Data it needs | Endpoint |
| --- | --- | --- |
| Global feed | most recent check-ins across everyone, newest first | `GET /feed` |
| Member profile | current streak + all-time total | `GET /members/:address` |
| Monthly leaderboard | top members this month by check-in count | `GET /leaderboard` |

All three cover the contract's **entire history**, from its first day forward — not
just activity since a page was opened.

```
repo/
  contracts/     Solidity (Foundry) — Streak.sol, deploy script, tests
  indexer/       Ponder app — schema, event handler, read API
  scripts/       seed-local.sh: fills a local Anvil with months of check-ins
```

## Architecture

```
  member wallet
       │ checkIn("gm")
       ▼
  Streak.sol on Base ──emits──> CheckedIn(member, day, streak, total, isNewMember, note)
                                     │
                                     │  one-time backfill from the deployment block,
                                     │  then tails new blocks
                                     ▼
                              Ponder indexer  ──writes──>  Postgres
                                     │                     check_in
                                     │                     member
                                     │                     member_month
                                     │                     stats
                                     ▼
                         HTTP read API (Hono) + /graphql
                                     │
                                     ▼
                            feed / profile / leaderboard
```

### Why an indexer, and not log scans at request time

Historical onchain data comes from an indexer. A public RPC caps every `eth_getLogs`
call by block span and by matched-log count, so "just scan the logs when the page
loads" is thousands of paginated calls that grow with every block and fall over on
rate limits, timeouts, or credits. Rebuilding past state by replaying archive-node
reads is the same mistake wearing a different hat.

So the read side is a **one-time backfill into a persistent store that then tails new
events**. Ponder reads `CheckedIn` from `startBlock` (the deployment block) to the
chain head once, writes the rolled-up tables to Postgres, and then follows new
blocks. Every API request is a Postgres query against already-indexed rows. No
request touches an RPC node.

### Why the contract is designed event-first

A state change with no event is invisible to every indexer, frontend, and explorer.
`CheckedIn` therefore carries everything the read side needs, including the member's
streak and all-time total *as of that check-in*:

```solidity
event CheckedIn(
    address indexed member,
    uint32  indexed day,        // UTC day index: block.timestamp / 86400
    uint32  streak,             // consecutive-day streak including this check-in
    uint32  total,              // all-time count including this one
    bool    isNewMember,        // first ever check-in for this address
    string  note                // may be empty
);
```

Because the streak and total ride along in the log, the backfill is pure log
processing — zero per-event `eth_call`s. Indexing months of history is one paginated
`eth_getLogs` sweep, not a sweep plus a contract call per event.

The contract keeps only what it needs to enforce one check-in per UTC day:
`{lastDay, streak, total}` per member, packed into a single storage slot. Aggregation,
ranking, and pagination are deliberately **not** onchain — those live in the indexer.

### What each table is for

- **`check_in`** — one row per check-in, the append-only history. Backs the feed. Its
  primary key is `` `${blockNumber}-${logIndex}` `` zero-padded, so lexical ordering
  on one TEXT column equals true chain order. That makes the feed cheap keyset
  pagination (`WHERE id < cursor ORDER BY id DESC`) instead of `OFFSET`: page 100
  costs the same as page 1, and rows don't shift under a client as new check-ins land.
- **`member`** — the rolled-up profile: total, longest streak, first/last day.
- **`member_month`** — per-member, per-calendar-month counts, keyed `(month, member)`.
  The leaderboard is one indexed range scan. Aggregating the whole `check_in` history
  on every leaderboard load would get slower every month the community runs.
- **`stats`** — global counters, so the UI never needs `COUNT(*)` over all history.

### The one value that cannot be precomputed

A streak decays with the wall clock, not with any event. If a member's last check-in
was six days ago, their stored `streakAtLastDay` is still whatever it was — but their
*current* streak is 0, and no event was ever emitted to mark that.

So the decay rule is applied on read, in `liveStreak()` (`indexer/src/lib/streak.ts`):
a streak survives only if the last check-in was today or yesterday. Yesterday still
counts, because today is not over and the member can still extend it.

Every other number is precomputed at index time. This is the only one that isn't, and
the only reason it can't be.

## Production home

**The indexer runs as a long-lived Node service on Railway, started by
`npm start` (i.e. `ponder start`) from `indexer/`, against a managed Postgres.**

This is a persistent process, not a serverless function: it holds the realtime sync
and must not be frozen between requests. Concretely:

| Thing | Choice |
| --- | --- |
| Process | Railway service, root directory `indexer/`, start command `npm start` |
| Store | Railway Postgres (or Neon), injected as `DATABASE_URL` |
| RPC | Paid Base endpoint (Alchemy / QuickNode), as `PONDER_RPC_URL_8453` |
| Health | Railway healthcheck on `/ready` |
| Scale | Exactly 1 replica |

Notes that matter in practice:

- **`/ready` vs `/health`.** `/health` returns 200 as soon as the process is up;
  `/ready` only returns 200 once the historical backfill has finished. Point the
  healthcheck at `/ready` so traffic isn't sent to an instance still backfilling and
  serving a partial feed.
- **One replica.** Two replicas writing the same schema will corrupt it. Scale reads
  by putting a cache in front, not by adding replicas.
- **`DATABASE_SCHEMA` per deploy.** Set it to the git sha. A new deploy backfills into
  its own schema while the old instance keeps serving, then cuts over — otherwise the
  feed goes blank during every redeploy's backfill. Ponder drops stale schemas.
- **First backfill is the slow part.** Months of history on a paid RPC is minutes.
  It is cached in Postgres, so restarts do not re-fetch it.

Self-hosting a Graph Node, or a subgraph, would also work. If you switch to The Graph,
note that deploying is not publishing: `graph deploy` puts the subgraph in Subgraph
Studio, which is for testing only, and the free hosted service was sunset in June
2024, so there is no free public endpoint to deploy to. You must publish from Studio
to the network to get a production endpoint and query it with a Studio API key.
Production queries are metered (roughly 100K free per month, then about $2 per 100K —
check the live pricing page before committing to a budget). The Ponder-on-Railway path
above was chosen because it keeps the host, the store, and the cost model explicit.

## Deploying

### 1. The contract

```bash
cd contracts
forge install foundry-rs/forge-std   # first time only
forge test

export BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
export BASESCAN_API_KEY=...

forge script script/Deploy.s.sol:Deploy \
  --rpc-url base --broadcast --verify --interactive
```

The script prints the two values the indexer needs:

```
Streak deployed to: 0xABC...
Start block for indexer (STREAK_START_BLOCK): 12345678
```

**Record the deployment block.** `startBlock` must be that block, never `latest` —
`latest` is exactly how a read side ends up silently missing every check-in that
happened before the process first started.

### 2. The indexer

Create the Railway service from `indexer/`, attach Postgres, and set:

```
PONDER_RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
STREAK_ADDRESS=0xABC...
STREAK_START_BLOCK=12345678
DATABASE_URL=<injected by Railway>
DATABASE_SCHEMA=<git sha of this deploy>
```

Deploy, then watch the logs for `Completed historical indexing` and wait for `/ready`
to return 200 before sending traffic.

## Running locally

Requires Node 20+ and Foundry. Four terminals' worth of commands, in order:

```bash
# 1. a local chain
anvil

# 2. deploy Streak and simulate 62 days of backdated check-ins across 4 members
./scripts/seed-local.sh
#    writes indexer/.env.local with the address, start block, and CHAIN_ID=31337

# 3. index it and serve the API
cd indexer
npm install
npm run dev          # http://localhost:42069
```

`seed-local.sh` backdates Anvil so the simulated history *ends today*, which matters:
"this month" on the leaderboard and the live-streak decay rule are both evaluated
against the real clock, so a chain running 62 days into the future would disagree with
them. Override the span with `DAYS=120 ./scripts/seed-local.sh`.

Try the three screens:

```bash
curl 'localhost:42069/feed?limit=5'
curl 'localhost:42069/leaderboard'                 # defaults to the current month
curl 'localhost:42069/leaderboard?month=2026-08'
curl 'localhost:42069/members/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
curl 'localhost:42069/stats'
```

GraphQL is also served, at `localhost:42069/graphql`:

```graphql
{
  checkIns(orderBy: "id", orderDirection: "desc", limit: 10) {
    items { member note day streakAtCheckIn }
  }
}
```

Two things to know about the local setup specifically:

- **Anvil only mines when you send it something.** Ponder's realtime sync advances on
  new blocks, so the last few seeded days can sit unindexed until the next block
  exists. `cast rpc evm_mine --rpc-url http://127.0.0.1:8545` a few times and it
  catches up. On Base, where blocks arrive every 2s, this never comes up.
- **Restarting Anvil invalidates the indexer's cache.** A fresh Anvil has different
  block hashes, which Ponder correctly reports as an unrecoverable reorg. After
  restarting Anvil, `rm -rf indexer/.ponder` and reseed.

Locally, Ponder uses an embedded PGlite database under `indexer/.ponder`, so no
Postgres is required; set `DATABASE_URL` to use a real one.

## Client notes

- **Addresses are lowercase** everywhere in the API. Checksummed input to
  `/members/:address` is accepted and normalised.
- **Day identity is a UTC day index** (`unix_seconds / 86400`), the same integer the
  contract uses, so the read side and the contract can never disagree about where a
  day boundary falls. Responses include a rendered `date` alongside it.
- **Feed pagination:** pass the previous response's `nextCursor` as `cursor`. A null
  `nextCursor` means the end of history. `limit` is capped at 100.
- **A member who has never checked in** returns a zeroed profile, not a 404, so the
  UI has one code path.
- **`/members/:address` returns both** `currentStreak` (decayed, what the profile
  screen shows) and `longestStreak` (all-time best).

## Tests

```bash
cd contracts && forge test        # 8 tests: day boundaries, streak reset, note limit
cd indexer   && npm run typecheck
```

The contract tests cover the rules the indexer trusts: one check-in per UTC day,
streaks incrementing only on consecutive days, resetting after a gap, and
`currentStreak` decaying once a day is missed.
