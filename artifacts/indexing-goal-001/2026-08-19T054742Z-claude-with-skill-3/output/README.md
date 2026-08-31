# Streak

A daily onchain check-in app for a community on Base. Once a day a member sends
one transaction — optionally with a short public note — and that is the only
write the app ever makes. Everything else is reading.

This repo contains the contract, the read side that backs the app's three
screens, and a typed client the frontend calls.

```
contracts/   Foundry project — Streak.sol, tests, deploy script
indexer/     Ponder indexer — backfills + tails CheckedIn, serves the read API
app/         Read-side client the three screens call, plus a text-mode demo
scripts/     seed-local.sh — local anvil with weeks of back-dated history
```

## The three screens, and where each number comes from

| Screen | Needs | Source |
| --- | --- | --- |
| **Global feed** — newest check-ins across everyone, with who / when / note | The full ordered event log, paginated | Indexer, `GET /feed` |
| **Profile** — a member's current streak and all-time total, plus their notes | Two "as of now" numbers, plus history | Contract call `getMember` for the numbers; indexer `GET /members/:address` for the notes |
| **Leaderboard** — top members this month by check-ins | A ranked aggregate over one month of history | Indexer, `GET /leaderboard` |

The app launches on top of a contract that already has months of check-ins
behind it, so the feed, streaks and leaderboard all have to reflect the record
from the contract's first day. That is what the indexer is for.

### Why an indexer and not `eth_getLogs`

Reading months of history at request time means paginating `eth_getLogs` across
every block since deployment. Public RPCs cap each call by block span *and* by
matched-log count, so that is thousands of round trips — a number that grows
with every block — and any one of them can fail on a rate limit, a timeout or
credits. It is also repeated on every page load.

Instead the indexer does a **one-time backfill** of the entire `CheckedIn`
history into Postgres and then **tails** new blocks. Every screen reads
pre-aggregated rows: the feed is one indexed scan, the leaderboard is one
indexed lookup, and neither gets slower as history grows.

### Why the profile's two numbers are *not* indexed

A member's current streak and all-time total are "as of now" values that the
contract returns on request. `Streak.getMember(address)` is one `eth_call`, so
the profile screen reads them directly: trustless, and it cannot lag the chain
tip. The indexer mirrors them anyway (the leaderboard needs streaks for a whole
page of members at once), and `getLiveMemberStats` batches many members into a
single request via Multicall3 at `0xcA11bde05977b3631167028862bE2a173976CA11`
when a screen wants exact-live values for a list.

Standing up an indexer to track a number the chain will hand you on request is
the mistake in the other direction; the split above is deliberate.

## Contract

`contracts/src/Streak.sol` — one function, one event.

```solidity
function checkIn(string calldata note) external;

event CheckedIn(
    address indexed member,
    uint32  indexed day,      // UTC day index, block.timestamp / 1 days
    uint32          streak,   // consecutive days, including this check-in
    uint32          memberTotal,
    string          note      // up to 140 bytes, may be empty
);
```

Design notes:

- **The event carries everything the read side needs.** A state change with no
  event is invisible to every indexer, frontend and explorer, so `CheckedIn`
  ships the resulting streak and total rather than making the indexer re-derive
  them. `day` is indexed so a backfill can be filtered per day if ever needed.
- **No arrays, no rankings onchain.** The contract stores no feed and no
  leaderboard. Ordering, aggregation and pagination are offchain work; putting
  them onchain costs gas forever and still can't be queried usefully.
- **Per-member state is packed into one slot** (`lastDay`, `streakAtLastDay`,
  `totalCheckIns` as three `uint32`s), so a check-in is a single `SSTORE`. That
  state is needed anyway to enforce one check-in per UTC day, which is what
  makes the direct profile read essentially free to support.
- **A stored streak goes stale.** `streakAtLastDay` is only meaningful if the
  member checked in today or yesterday. `currentStreak()` applies that rule
  onchain, and the read side applies the identical rule in `liveStreak()`
  (`indexer/src/time.ts`) — otherwise someone who stopped checking in months ago
  would still show a 40-day streak.

Days are UTC days (`block.timestamp / 1 days`). The month a check-in belongs to
is derived from the same day index, so the leaderboard's month boundaries match
the contract's day boundaries exactly.

```bash
cd contracts
forge install foundry-rs/forge-std   # once, for tests and the deploy script
forge test                           # 11 tests: streaks, resets, day boundaries, notes
```

## Indexer

`indexer/` is a [Ponder](https://ponder.sh) app: TypeScript handlers over
Postgres, with an HTTP API on top.

`src/index.ts` handles the single `CheckedIn` event and writes three tables
(`ponder.schema.ts`):

- `check_in` — one row per event: member, note, day, month, streak, total,
  timestamp, tx hash, plus an `ordinal` (`blockNumber << 16 | logIndex`) used as
  a keyset cursor so the feed paginates newest-first without an `OFFSET` that
  drifts as new check-ins land.
- `member` — per-member rollup: total, streak at last day, longest streak, first
  and last check-in.
- `member_month` — `(month, member) → count`, indexed on `(month, checkIns)`.
  The leaderboard is one lookup into this table, not a scan over the feed.

Handlers are idempotent upserts, so a reorg or a re-index converges to the same
state.

### API

Served by `src/api/index.ts` on port 42069.

| Route | Returns |
| --- | --- |
| `GET /feed?limit=&cursor=` | Newest-first page of check-ins + `nextCursor` |
| `GET /members/:address?limit=` | Streak, totals, and that member's recent notes |
| `GET /leaderboard?month=YYYY-MM&limit=` | Ranked members for a month (defaults to the current UTC month) |
| `GET /leaderboard/:address?month=` | One member's rank and count for a month |
| `POST /graphql` | Auto-generated GraphQL over all tables |
| `/sql/*` | `@ponder/client` endpoint for typed SQL from the frontend |

`/feed` and `/leaderboard` cap `limit` at 100.

## Read-side client

`app/readSide.ts` is what the three screens call — `getFeed`, `getProfile`,
`getLeaderboard`, `getRank`, `getLiveMemberStats`, `canCheckIn`, and
`buildCheckIn` for the one write. It is plain `fetch` + viem, with no framework
assumptions, so it drops into a Next.js server component, a React hook, or a
script.

```ts
const reader = createStreakReader({
  indexerUrl: process.env.INDEXER_URL!,   // https://streak-indexer.up.railway.app
  address: process.env.STREAK_ADDRESS as Address,
  rpcUrl: process.env.RPC_URL,
});

const feed  = await reader.getFeed({ limit: 25 });
const next  = await reader.getFeed({ cursor: feed.nextCursor });
const me    = await reader.getProfile(address);        // contract + indexer
const board = await reader.getLeaderboard();           // this month
```

`npm run demo` in `app/` prints all three screens as text against whatever
indexer you point it at — the quickest way to confirm the stack is wired up.

## Running it locally

You need Node 20+ and [Foundry](https://getfoundry.sh). Postgres is optional
locally: Ponder falls back to an embedded PGlite database.

```bash
# terminal 1 — a local chain
anvil

# terminal 2 — first run only: fetch the Foundry test dependency
cd contracts && forge install foundry-rs/forge-std && cd ..

# terminal 2 — deploy Streak and fill it with 45 days of back-dated check-ins
# across 5 members with different rhythms, ending today. Writes indexer/.env.local.
./scripts/seed-local.sh          # DAYS=90 ./scripts/seed-local.sh for more

# terminal 2 — backfill that history and serve the API
cd indexer && npm install && npm run dev

# terminal 3 — see the three screens
cd app && npm install && npm run demo
```

The seed script back-dates the chain (`anvil_setTime`) so the seeded history
*ends today*: you develop against a contract that already has a past, which is
the situation the app launches into.

```bash
curl 'localhost:42069/feed?limit=5'
curl 'localhost:42069/leaderboard'
curl 'localhost:42069/members/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
```

## Deploying

### 1. The contract

```bash
cd contracts
export BASE_RPC_URL=https://mainnet.base.org
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base --broadcast --verify --account <your-keystore-account>
```

The script prints the address **and the deployment block**. Keep both: the
deployment block is what makes the indexer's backfill cover the entire record.

### 2. The indexer

Set these (see `indexer/.env.example`):

```bash
CHAIN_ID=8453
PONDER_RPC_URL=https://...          # archive-capable; a paid provider for months of history
STREAK_ADDRESS=0x...
STREAK_START_BLOCK=<deployment block>   # NOT a recent block
DATABASE_URL=postgres://...
DATABASE_SCHEMA=streak
```

`STREAK_START_BLOCK` is the setting that decides whether the app shows all of
history or only what happened after the process started. Set it to the block the
contract was deployed in.

Regenerate the ABI after any contract change:

```bash
cd contracts && forge build
node -e "const a=require('./out/Streak.sol/Streak.json').abi;require('fs').writeFileSync('../indexer/abis/StreakAbi.ts','export const StreakAbi = '+JSON.stringify(a,null,2)+' as const;\n')"
cp ../indexer/abis/StreakAbi.ts ../app/streakAbi.ts
```

## Where this runs in production

**The indexer is a long-running process. It needs a host, a persistent Postgres
and process supervision — none of which come for free with the code.** The
answer for this project:

> **Home:** a Railway project with two services.
> - **`streak-postgres`** — Railway's managed Postgres plugin. This is where the
>   backfill lives; back it up, because losing it means re-indexing from the
>   contract's first block.
> - **`streak-indexer`** — this repo's `indexer/` directory, built from
>   `indexer/Dockerfile`, with `DATABASE_URL` referenced from the Postgres
>   service. Start command:
>   ```
>   npx ponder start --schema $RAILWAY_DEPLOYMENT_ID --views-schema public --hostname 0.0.0.0
>   ```
>   Railway restarts it on crash and gives it a public HTTPS URL; that URL is the
>   frontend's `INDEXER_URL`. A per-deployment `--schema` with a stable
>   `--views-schema public` lets a new deploy backfill while the old one keeps
>   serving, then cut over.
>
> **Health check:** point Railway's at `GET /ready` (Ponder built-in), which
> returns 200 only once the historical backfill has completed — so a new deploy
> does not take traffic while it is still catching up. `GET /health` is the
> liveness probe (200 as soon as the process is up) and `GET /status` reports
> the block each chain is synced to.

To self-host instead — a VPS, Fly, Render, your own Kubernetes — `docker-compose.yml`
at the repo root brings up the same two pieces:

```bash
cp indexer/.env.example indexer/.env.local   # fill in RPC + contract + start block
docker compose up -d                          # Postgres + indexer on :42069
```

Either way, the first boot is the slow one: it replays the contract's whole
history. Expect that to take minutes and to be RPC-heavy — use a paid RPC
endpoint for it. After that the process is only tailing new blocks.

### If you'd rather use a subgraph

The same three tables map cleanly onto a subgraph, and it is a reasonable
alternative. Two things to plan for:

- **Deploying is not publishing.** The free hosted service was sunset in June
  2024, so there is no free public endpoint to deploy to. `graph deploy` puts
  the subgraph in Subgraph Studio, which is for testing; you then *publish* it
  to the network to get a production endpoint, queried with a Studio API key.
- **Production queries are metered** — roughly 100K free per month, then about
  $2 per 100K (checked 2026-08-18; re-read the live pricing page before
  budgeting).

Ponder was chosen here because the read side is a handful of counters that are
cheapest to maintain incrementally as ordered events arrive, and because keeping
the store means the leaderboard and feed stay ordinary indexed SQL queries.
