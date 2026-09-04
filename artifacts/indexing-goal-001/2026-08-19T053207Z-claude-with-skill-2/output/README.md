# Streak

A daily onchain check-in book for a community on Base. One member, one check-in
per UTC day, with an optional short public note. That single transaction is the
only write in the product.

Three screens read from it:

| Screen | Question it answers | Backed by |
| --- | --- | --- |
| **Feed** | Who checked in most recently, and what did they say? | `GET /feed` |
| **Profile** | What is this member's current streak and all-time total? | `GET /members/:address` |
| **Leaderboard** | Who has the most check-ins this month? | `GET /leaderboard?month=YYYY-MM` |

All three cover the contract's **entire history**, from its first day — not just
what happens after a page is opened.

---

## Architecture

```
        write path                                    read path
  ┌──────────────────┐                     ┌────────────────────────────────┐
  │  member's wallet │                     │  feed / profile / leaderboard  │
  └────────┬─────────┘                     └───────────────┬────────────────┘
           │ checkIn("gm")                                 │ HTTP / GraphQL
           ▼                                               ▼
  ┌──────────────────┐   CheckedIn logs    ┌────────────────────────────────┐
  │  Streak.sol      │ ──────────────────► │  Ponder indexer (indexer/)     │
  │  Base mainnet    │                     │  backfill from deploy block,   │
  └──────────────────┘                     │  then tail new blocks          │
                                           └───────────────┬────────────────┘
                                                           │ upserts
                                                           ▼
                                            ┌──────────────────────────────┐
                                            │ Postgres: check_in, member,  │
                                            │ member_month                 │
                                            └──────────────────────────────┘
```

**Historical reads come from the indexer, never from the chain at request time.**
This is the load-bearing decision in the whole design. A feed, a streak or a
monthly ranking is a question about the entire log history, and answering it with
`eth_getLogs` at request time means paginating over every block since deployment
on every page load — thousands of RPC calls that grow with the chain and die on
rate limits. Instead the indexer does that walk **once** (the backfill), writes
the results to Postgres, and then only has to keep up with the head of the chain.
Every screen is then a single indexed SQL query whose cost does not grow with
history.

The one thing that is *not* indexed: "can I check in right now?" is current
state, so the frontend reads `canCheckIn(address)` straight from the contract
(see [Write side](#write-side)). Indexers are for history; the chain answers
"as of now" on request.

### Why Ponder

Streaks are the reason. "Consecutive days" is a fold over each member's check-in
days in order, and Ponder lets that be five lines of ordinary TypeScript in an
event handler (`indexer/src/index.ts`) with a typed Postgres store behind it.
A subgraph would work too — the schema and handlers map over almost directly —
but see [Alternatives](#alternatives) for what that route costs.

### Repo layout

```
contracts/            Foundry project
  src/Streak.sol      the contract
  test/Streak.t.sol   contract tests
  script/Deploy.s.sol deploy script (prints address + start block)
indexer/              Ponder indexer + read API  ← the read side
  ponder.config.ts    chain, contract address, start block
  ponder.schema.ts    check_in / member / member_month tables
  src/index.ts        CheckedIn handler: feed rows, streaks, monthly counts
  src/api/index.ts    the three screens' HTTP endpoints
  src/lib/time.ts     day/month math shared by handlers and API (+ tests)
  railway.json        production deployment config
  Dockerfile          same, for hosts that want an image
scripts/
  seed-local.sh       anvil + deploy + weeks of seeded history, one command
  sync-abi.mjs        copies the built ABI into the indexer
```

---

## The contract

`contracts/src/Streak.sol` is deliberately small and **event-first**:

```solidity
event CheckedIn(address indexed member, uint32 indexed day, uint64 timestamp, string note);
```

- The only storage is `lastCheckInDay[member]`, which is what enforces
  one check-in per UTC day. A "day" is `block.timestamp / 86400`, so days are UTC
  days and the read side uses the exact same arithmetic (`dayIndex()` in
  `indexer/src/lib/time.ts`).
- Streaks, totals and rankings are **not** stored onchain. They are aggregations,
  they change with every check-in, and nothing onchain needs them — so they live
  in the indexer, where they cost no gas and can be re-derived at will.
- The event carries everything a reader needs (who, which day, when, the note),
  because a state change with no event is invisible to every indexer, frontend
  and explorer that will ever look at this contract. Nothing about the feed
  requires an extra RPC call per row.
- `note` is capped at 140 bytes and emitted, not stored.

Check-in costs ~30–50k gas depending on note length (fractions of a cent on Base).

---

## The read side

### Tables (`indexer/ponder.schema.ts`)

- **`check_in`** — one row per event: member, day, timestamp, note, tx hash.
  The primary key is `<blockNumber>-<logIndex>`, zero-padded so it sorts in chain
  order as a string. The feed pages with `id < cursor` (keyset pagination), so
  page 500 costs the same as page 1 after a year of history.
- **`member`** — maintained incrementally: `totalCheckIns`, `currentStreak`,
  `longestStreak`, `firstDay`/`lastDay`, `lastNote`.
- **`member_month`** — `(member, YYYYMM) -> checkIns`, so the leaderboard is one
  indexed range scan instead of an aggregate over all history.

**Streak decay is applied at read time.** The stored `currentStreak` is the
streak *as of the member's last check-in*. When a member stops checking in they
emit no events, so no handler ever runs to zero it out — waiting for a write that
will never come is how streak counters end up permanently wrong. The API resolves
it instead (`resolveCurrentStreak` in `src/lib/time.ts`): a streak is alive if
the member checked in today or yesterday, otherwise it reads as `0`. `streakAtRisk`
tells the UI when today's check-in is the one keeping it alive.

### Endpoints (`indexer/src/api/index.ts`)

```
GET /feed?limit=50&cursor=<nextCursor>[&member=0x…]
GET /members/:address?recent=10
GET /leaderboard?month=2026-08&limit=25
GET /graphql                # auto-generated GraphQL over the same tables
GET /sql/*                  # typed SQL over HTTP, for @ponder/client
GET /health  |  GET /ready  # liveness | "backfill complete"
```

<details>
<summary>Example responses</summary>

```jsonc
// GET /feed?limit=2
{
  "items": [
    { "id": "000000000089-000000", "member": "0x9965…a4dc", "timestamp": 1787227309,
      "day": 20685, "note": "shipped the docs", "transactionHash": "0x3f43…", "blockNumber": "89" }
  ],
  "nextCursor": "000000000089-000000"   // pass back as ?cursor= for the next page
}

// GET /members/0x7099…79C8
{ "address": "0x7099…79c8", "totalCheckIns": 20, "currentStreak": 20, "longestStreak": 20,
  "checkedInToday": true, "streakAtRisk": false, "monthlyCheckIns": 19,
  "lastNote": "onchain summer", "recentCheckIns": [ /* … */ ] }

// GET /leaderboard?month=2026-08&limit=25
{ "month": "2026-08",
  "entries": [ { "rank": 1, "monthlyCheckIns": 19, "address": "0x7099…79c8",
                 "totalCheckIns": 20, "currentStreak": 20, /* … */ } ] }
```

</details>

Unknown addresses return a zeroed profile rather than a 404, so the profile
screen renders for anyone. Bad input returns `400`.

---

## Running it locally

Requires Node 22+, pnpm, and [Foundry](https://getfoundry.sh).

### Option A — a local chain with seeded history (no RPC key needed)

This is the fastest way to see the real thing: it starts anvil with a backdated
clock, deploys `Streak`, and writes weeks of check-ins across several members, so
the indexer has an actual multi-month backfill to run.

```bash
cd contracts && forge install && forge build && cd ..   # forge-std, pinned in foundry.lock
DAYS=45 MEMBERS=6 ./scripts/seed-local.sh   # leaves anvil running; writes indexer/.env.local
cd indexer && pnpm install && pnpm dev
```

Then:

```bash
curl 'localhost:42069/feed?limit=5'
curl 'localhost:42069/leaderboard'
curl 'localhost:42069/members/0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
```

Stop the chain with `pkill anvil`. To watch live indexing, send another check-in
and re-read the feed:

```bash
source indexer/.env.local      # STREAK_ADDRESS, written by the seed script
cast send $STREAK_ADDRESS 'checkIn(string)' 'gm' \
  --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
  --rpc-url http://127.0.0.1:8545
```

### Option B — against the real contract on Base

```bash
cd indexer
pnpm install
cp .env.example .env.local     # fill in RPC url, contract address, start block
pnpm dev
```

`pnpm dev` with no `DATABASE_URL` uses a local PGlite database under
`indexer/.ponder/`; that is fine for development but not for production (see
below). The first run replays all history — expect the backfill to take minutes,
not seconds, over months of check-ins.

### Tests

```bash
cd contracts && forge install && forge test   # one-per-day rule, note limits, events
cd indexer   && pnpm test                    # day/month math and the streak-decay rule
cd indexer   && pnpm typecheck
```

---

## Deploying

### 1. The contract

```bash
cd contracts
export BASE_RPC_URL=https://mainnet.base.org
export BASESCAN_API_KEY=…
forge script script/Deploy.s.sol \
  --rpc-url base --account deployer --broadcast --verify
```

The script prints the two values the indexer needs:

```
Streak deployed to: 0x…
Deployment block  : 12345678
```

Write both down. **The deployment block is not optional detail** — it is the
indexer's `startBlock`. Too late and you silently lose history; block `0` makes
the backfill crawl millions of empty Base blocks before reaching your first
check-in.

Then sync the ABI into the indexer:

```bash
forge build && node ../scripts/sync-abi.mjs
```

### 2. The indexer — production home

**The indexer runs as a Railway service (`streak-indexer`) with a Railway
Postgres attached, started by `pnpm start`.** That is its production home; the
config lives in `indexer/railway.json` and is checked into this repo. Anything
else — a laptop, a `pnpm dev` in a tmux window — is not a deployment: the API
that the three screens call has to be up whenever the app is.

```bash
railway init                    # or: railway link, in an existing project
railway add --database postgres # provides DATABASE_URL
railway up                      # deploys indexer/ using railway.json
```

Variables to set on the service:

| Variable | Value |
| --- | --- |
| `PONDER_RPC_URL_BASE` | A **paid** Base RPC endpoint (Alchemy, QuickNode, …) |
| `STREAK_ADDRESS` | Deployed contract address |
| `STREAK_START_BLOCK` | Deployment block from step 1 |
| `CHAIN_ID` | `8453` |
| `DATABASE_URL` | Railway Postgres (`${{Postgres.DATABASE_URL}}`) |

Notes that matter in production:

- **Postgres is required.** Without `DATABASE_URL`, Ponder falls back to an
  ephemeral PGlite store, and every restart re-runs the entire backfill against
  your RPC provider.
- **`--schema $RAILWAY_DEPLOYMENT_ID`** (already in `railway.json`) gives each
  deployment its own Postgres namespace. A new version backfills into a fresh
  schema and only takes over serving traffic once it has caught up — redeploys
  don't blank out the feed.
- **Healthcheck is `/health`, not `/ready`.** `/ready` returns 200 only after the
  backfill finishes, which on a long history exceeds any healthcheck timeout.
- **Use a paid RPC endpoint.** The backfill is thousands of `eth_getLogs` calls;
  public endpoints rate-limit it into a crawl or fail it outright.
- Point the frontend at the service's public URL (`https://…up.railway.app`).

Hosts other than Railway work the same way — `indexer/Dockerfile` covers Fly.io,
Render, ECS or a VM — but whichever you pick, the host, the Postgres instance and
the process supervision are the things to name and write down here.

---

## Write side

The app's only transaction, with wagmi/viem:

```ts
// "can I check in today?" is current state → read it from the chain directly.
const { data: canCheckIn } = useReadContract({
  address: STREAK_ADDRESS, abi: streakAbi, functionName: "canCheckIn", args: [address],
});

const { writeContract } = useWriteContract();
writeContract({ address: STREAK_ADDRESS, abi: streakAbi, functionName: "checkIn", args: [note] });
```

If you need several of these current-state reads at once (a page showing many
members' check-in status), batch them into a single request with Multicall3 —
`0xcA11bde05977b3631167028862bE2a173976CA11` on Base, as everywhere else — rather
than adding them to the indexer. Ponder's `/sql` endpoint plus `@ponder/client`
gives the frontend typed, live-updating queries against the indexed tables for
everything historical.

---

## Alternatives

- **A subgraph (The Graph).** The same schema and handlers port over. Be aware
  that on The Graph, *deploying is not publishing*: `graph deploy` puts the
  subgraph in Subgraph Studio, which is for testing only, and the free hosted
  service was sunset in June 2024. To get a production endpoint you publish the
  subgraph from Studio to the network and query it with a Studio API key.
  Queries are metered — roughly 100K free per month, then about $2 per 100K
  (checked 2026-08-18; re-read the live pricing page before budgeting).
- **Self-hosted Graph Node.** Fine, and free of query fees, but then you are
  running a Graph Node, an IPFS node and Postgres — strictly more infrastructure
  than the single Ponder process above.
- **A provider data API** (Alchemy/Covalent transfers-and-logs endpoints) can
  serve a raw feed, but streaks and monthly rankings are custom aggregations you
  would end up computing and storing yourself anyway.

What is *not* an alternative is scanning logs from the frontend on page load.
That is the failure mode this architecture exists to avoid.
