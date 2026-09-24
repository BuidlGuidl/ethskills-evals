# Streak

Daily onchain check-ins for a community on Base. A member sends one transaction a
day, optionally with a short public note. That's the only write. Everything else
— the global feed, per-member streaks and totals, the monthly leaderboard — is
read back out of the contract's event history.

```
contracts/   Solidity (Foundry): the Streak contract, deploy script, tests
subgraph/    The Graph subgraph: indexes CheckedIn from the deploy block onward
web/         Next.js app: the three screens, reading from the subgraph
scripts/     seed-local.sh — back-dated check-ins for local development
```

## Architecture

```
  wallet ──checkIn(note)──► Streak.sol (Base)
                                │ emits CheckedIn(member, dayIndex, note)
                                ▼
                        subgraph (The Graph)
              folds every event, from deploy block to chain head,
              into CheckIn / Member / MemberMonth entities
                                │ GraphQL
                                ▼
                   Next.js: feed · profile · leaderboard
```

### The contract stores almost nothing

`Streak.sol` keeps one mapping — the last UTC day each member checked in — which
is the minimum needed to enforce "once a day". It does not track streaks, totals
or rankings onchain. Those are read-side concerns: maintaining them onchain would
add storage writes to every check-in, and a contract still couldn't sort or
paginate a leaderboard for you. The `CheckedIn` event is the product's API.

A day is `block.timestamp / 86400` — whole UTC days since the epoch. The contract
emits that number as `dayIndex`, so the contract, the indexer and the UI all agree
on where a day begins without anyone re-deriving it from a timestamp.

### The read side is an indexer, not RPC calls

The app launches on a contract that already has months of check-ins behind it, and
all three screens must reflect that full record. That rules out reading from the
chain directly:

- `eth_getLogs` over months of Base blocks (Base produces ~43k blocks/day) means
  paging through millions of blocks per page load — slow, rate-limited, and
  expensive. Providers cap the block range per call, so it's also many round trips.
- `eth_call` only reads *current* state, and there is no historical state here to
  read anyway: streaks and counts live in logs, not in storage.
- A websocket log subscription only sees what happens *after* the page opens,
  which is exactly the part of the history the product doesn't care about.

So the subgraph indexes `CheckedIn` from the contract's deploy block (`startBlock`
in `subgraph/subgraph.yaml` — setting this to a recent block is the one mistake
that silently drops history) and keeps three derived shapes:

| Entity | Built by | Screen it backs |
| --- | --- | --- |
| `CheckIn` | one row per event, with a `sequence` chain-order key | global feed |
| `Member` | running fold: total, streak at last check-in, longest streak | profile |
| `MemberMonth` | per-member, per-calendar-month counter | monthly leaderboard |

Each screen is then a single ordered, indexed GraphQL query (`web/lib/queries.ts`)
— no client-side counting, no fan-out.

**Streaks.** The subgraph folds events in chain order: a check-in on the day right
after the previous one extends the run, anything further out starts a new one.
That gives `streakAtLastCheckIn`. But a streak doesn't *end* with an event — it
ends when a day goes by with no event, and no handler fires for that. So the
"is it still alive?" half is resolved at read time by `currentStreak()` in
`web/lib/streak.ts`: the streak counts if the last check-in was today or
yesterday, otherwise it's 0.

**Leaderboard.** `MemberMonth` rows are keyed `address-YYYY-MM` and incremented as
events arrive, so "top 25 this month" is `memberMonths(where: { month: "2026-09" },
orderBy: checkIns, orderDirection: desc, first: 25)`. The month is computed in the
mapping from `dayIndex` (`subgraph/src/date.ts`, civil-from-days — AssemblyScript
has no `Date`).

**Liveness.** The feed re-fetches on a 10s interval (`components/AutoRefresh.tsx`)
rather than tailing logs over a websocket, so fresh check-ins and historical ones
come through the same path and are always consistent with the streaks and ranks
shown next to them. Subgraph lag on Base is a few seconds.

## Deploy

### 1. Contract

```bash
cd contracts
forge install foundry-rs/forge-std   # first time only
forge test
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
```

Note the printed **address** and **deploy block** — the subgraph needs both.
(Use `--rpc-url base_sepolia` for testnet; env vars in `contracts/foundry.toml`:
`BASE_RPC_URL`, `BASE_SEPOLIA_RPC_URL`, `BASESCAN_API_KEY`.)

### 2. Subgraph

Edit `subgraph/subgraph.yaml`: set `source.address` to the deployed address and
`source.startBlock` to the deploy block. Then:

```bash
cd subgraph
npm install
npm run codegen && npm run build
graph auth <deploy-key>          # from studio.thegraph.com
npm run deploy
```

Initial indexing of months of history takes minutes; Studio shows sync progress.
For production, publish the subgraph to the decentralized network and point the
app at the network query URL.

### 3. Web app

```bash
cd web
cp .env.example .env.local        # set NEXT_PUBLIC_SUBGRAPH_URL + NEXT_PUBLIC_STREAK_ADDRESS
npm install
npm run build && npm start
```

## Running locally

You need Foundry, Node 20+, and Docker.

```bash
# 1. a back-dated chain, so there is history to index
anvil --timestamp $(( $(date +%s) - 60*86400 ))

# 2. deploy (anvil account 0)
cd contracts && forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# 3. two months of check-ins from three members
STREAK=<deployed address> ./scripts/seed-local.sh

# 4. local graph-node, then deploy the subgraph against it
cd subgraph && docker compose up -d
#    set address + startBlock (0 locally) in subgraph.yaml first
npm install && npm run codegen && npm run build
npm run create-local && npm run deploy-local

# 5. the app
cd ../web && cp .env.example .env.local
#    NEXT_PUBLIC_SUBGRAPH_URL=http://localhost:8000/subgraphs/name/streak-local
npm install && npm run dev      # http://localhost:3000
```

The seed script walks anvil's clock forward one day at a time, so member 0 builds
an unbroken streak, member 1 breaks and restarts one, and member 2 is sporadic —
enough to see all three screens do their job.

## Screens

| Route | Query | Shows |
| --- | --- | --- |
| `/feed` | `getFeed()` | every member's check-ins, newest first, cursor-paginated back through all history |
| `/member/[address]` | `getMemberProfile()` | current streak, all-time total, longest streak, recent notes |
| `/leaderboard` | `getLeaderboard()` | top 25 by check-ins this calendar month (UTC); `?month=2026-08` for past months |

## Notes and trade-offs

- **Feed pagination** uses a `sequence_lt` cursor (`blockNumber * 1e5 + logIndex`)
  rather than `skip`, which The Graph caps at 5000 and which skews when new rows
  land mid-scroll. Multiple check-ins can share a block timestamp, so timestamp
  alone isn't a stable sort key.
- **Ties on the leaderboard** break toward whoever reached the count first.
- **Reorgs** are handled by graph-node, which unwinds and replays affected blocks;
  because every entity is a pure fold over events, replay is exact.
- **Analytics** (growth over time, cohort retention) are better answered with a
  Dune query over the decoded `CheckedIn` logs than by widening this subgraph —
  the subgraph should stay shaped around the three screens it serves.
- **Alternative indexer**: Ponder would serve the same three queries from
  TypeScript handlers and Postgres if the team prefers SQL and self-hosting over
  The Graph's hosted/decentralized network. The contract wouldn't change — that's
  the point of designing it event-first.
