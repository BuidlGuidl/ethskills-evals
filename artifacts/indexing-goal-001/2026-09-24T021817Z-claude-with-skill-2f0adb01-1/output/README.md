# Streak

Daily onchain check-ins for a community on Base. One member, one check-in per UTC
day, with an optional short public note. Three screens: a live global feed, a
per-member profile (current streak + all-time total), and a monthly leaderboard.

---

## The one design decision that matters

By launch the contract will already have months of check-ins behind it, and all
three screens have to reflect **the complete record from the contract's first
day** — not just what happens after someone opens the page.

That rules out the two obvious approaches:

- **Reading state back off the contract.** `eth_call` only ever sees *current*
  state. There is no cheap way to ask a contract "what did the leaderboard look
  like in March", and storing a feed or a ranking onchain so you could ask would
  mean paying storage gas to maintain sorted arrays on every check-in.
- **Scanning logs at read time.** `eth_getLogs` over every block since deployment
  is O(chain). On Base — 2-second blocks, so ~1.3M blocks per month — that is a
  multi-minute, rate-limited, paginated crawl on *every page view*, and it gets
  slower every day the contract lives.

So the split is:

> **The contract is the write path and the source of truth. An indexer replays
> its entire event history into a queryable database, and the app only ever
> reads from the indexer.**

The contract stores only what it needs to *enforce* its rules — last check-in
day, streak, total, per member. No feeds, no rankings, no arrays. Everything the
UI needs rides on the `CheckedIn` event, and a subgraph starting at the
deployment block turns months of those events into three cheap queries.

```
  member ──checkIn(note)──▶  Streak.sol (Base)
                                  │  emits CheckedIn(member, day, streak, total, note)
                                  ▼
                          subgraph  ── replays every log from startBlock ──▶ Postgres
                                  │
                                  │  GraphQL
                                  ▼
                       Next.js server  ──▶  feed · profile · leaderboard
```

---

## Layout

| Path | What's in it |
|---|---|
| `contracts/` | `Streak.sol`, Foundry tests, deploy script |
| `subgraph/` | Schema, mappings, manifest — the indexer |
| `web/` | Next.js app: the three screens and the query layer |
| `scripts/` | ABI sync, subgraph configuration, local history seeder |
| `docker-compose.yml` | Local graph-node + IPFS + Postgres |

---

## The contract

`contracts/src/Streak.sol` — one write, `checkIn(string note)`.

- **Days are UTC day indices**, `block.timestamp / 86400`. Both the contract and
  the read side work in this unit, so the UI can never disagree with the chain
  about which day a check-in landed on.
- **One check-in per day** is enforced by comparing against the member's stored
  `lastDay`; a second attempt reverts with `AlreadyCheckedInToday`.
- **A streak continues only if the previous check-in was literally yesterday**
  (`lastDay + 1 == today`); any longer gap restarts it at 1.
- **Notes are capped at 140 bytes.** They're public and cost calldata.
- **Everything the UI needs is on the event.** `CheckedIn` carries the member,
  the day, the streak *and* the running total — so the indexer stores what the
  contract computed rather than re-deriving the same arithmetic and risking
  drift. `member` and `day` are indexed.

### The stale-streak trap

A streak is the one number that changes **without a transaction**. Nothing
happens onchain when a member simply stops showing up, so the stored streak is a
snapshot from their last check-in — read it raw and you'll tell someone they're
on a 40-day streak three months after they quit.

A streak is alive only if the last check-in was today or yesterday (yesterday
still counts; today isn't over). That rule is implemented in three places that
must agree, and all three are tested:

- `Streak.currentStreak(address)` — onchain view
- `liveStreak()` in `web/src/streak.ts` — used by the profile and leaderboard
- the `streakAtLastCheckIn` doc comment in `subgraph/schema.graphql`, which
  deliberately does *not* pretend to be live

The subgraph stores the raw snapshot plus `lastDay` rather than a "current"
streak, because an indexer only runs on events — it has no way to write a row at
midnight when a streak lapses.

---

## The read side

### Schema (`subgraph/schema.graphql`)

| Entity | Backs | Why it's shaped that way |
|---|---|---|
| `CheckIn` | the feed | Immutable row per event. `sortKey` = `blockNumber * 100000 + logIndex` gives a globally unique, monotonic ordering |
| `Member` | the profile | All-time total, streak snapshot + `lastDay`, longest streak |
| `MemberMonth` | the leaderboard | Pre-aggregated count per member per `YYYY-MM` |
| `Month`, `Global` | headline stats | Community totals |

`subgraph/src/date.ts` converts UTC day indices to `YYYY-MM` buckets
(Hinnant's civil-from-days — AssemblyScript has no usable date formatting).

### The three queries (`web/src/graphql/queries.ts`)

**Feed** — `checkIns(orderBy: sortKey, orderDirection: desc, where: {sortKey_lt: $cursor})`.

Keyset pagination, not `skip`. With `skip`, a check-in landing between two
requests shifts every later row down by one and the reader silently sees a
duplicate. A cursor is anchored to a row, so arrivals at the head can't disturb
it. A short page means you've reached the contract's first day.

**Profile** — `member(id: $address)`, a single indexed lookup returning the
streak snapshot, the all-time total, and recent notes. The alternative — replaying
that member's logs — would be a full-history scan per page view.

**Leaderboard** — `memberMonths(where: {month: "2026-09"}, orderBy: checkIns, orderDirection: desc)`.

A sort over a counter the indexer already maintains, so it costs the same whether
the month has 10 check-ins or 100,000 — and **any past month is exactly as cheap
as the current one**, which is why `?month=YYYY-MM` just works. Ties break on who
got there first.

### App notes

- All subgraph access is **server-side** (`web/src/graphql/client.ts` imports
  `server-only`). The Graph's gateway URL embeds an API key, so the browser never
  holds it — the feed polls `/api/feed`, our own route, which calls through.
- **The feed polls rather than subscribing.** A websocket subscription only
  delivers check-ins that happen while the tab is open, and this feed has to show
  months of prior history anyway. One source of truth beats stitching a live
  stream onto a backfill. Server-render page one, poll the head every 15s.
- `SubgraphWarning` surfaces `_meta.hasIndexingErrors` — a silently stale feed is
  worse than a visibly stale one.
- The check-in button is deliberately thin (viem + EIP-1193, no connector
  library). The write path is one transaction; the interesting work is all reads.

---

## Run it locally

Needs [Foundry](https://getfoundry.sh), Node 20+, and Docker.

```bash
npm install                 # installs subgraph/ and web/ workspaces
npm run contracts:test      # 12 tests incl. fuzzed streak arithmetic
```

**1. Start a chain back-dated three months**, so there's real history to index:

```bash
anvil --timestamp $(( $(date +%s) - 90*86400 )) --host 0.0.0.0
```

**2. Start the indexing stack and seed history** (new terminal):

```bash
npm run stack:up            # graph-node + IPFS + Postgres
npm run seed:local          # deploys Streak, writes 90 days of check-ins
```

The seeder writes `contracts/deployments/local.json` with the address **and the
deployment block** — the value the subgraph needs.

**3. Deploy the subgraph** and let it backfill:

```bash
npm run abi:sync
npm run subgraph:configure local
cd subgraph && npm run codegen && npm run create:local && npm run deploy:local
```

Watch it chew through the history; it's done when
`curl -s localhost:8030/graphql -d '{"query":"{indexingStatuses{synced}}"}'`
reports `synced: true`. GraphiQL is at
<http://localhost:8000/subgraphs/name/streak>.

**4. Run the app:**

```bash
cp web/.env.example web/.env.local     # defaults already point at localhost:8000
# set NEXT_PUBLIC_STREAK_ADDRESS to the address seed-local.sh printed
npm run dev
```

<http://localhost:3000> — the feed already has three months behind it.

---

## Deploy to Base

**1. Contract.**

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL \
  --private-key $DEPLOYER_KEY --broadcast --verify
```

The script prints the address **and `block.number`**. Record both in
`contracts/deployments/base.json`:

```json
{ "network": "base", "address": "0x…", "startBlock": 12345678 }
```

> `startBlock` is the single most important value in this repo. Set it to the
> contract's deployment block and the indexer replays every check-in ever made.
> Set it late — to "now", say — and the feed, the streaks and the leaderboard
> quietly lose everything before that block, with no error to tell you.

**2. Subgraph.** Create it at [Subgraph Studio](https://studio.thegraph.com),
then:

```bash
npm run abi:sync
npm run subgraph:configure base
cd subgraph
npx graph auth <DEPLOY_KEY>
npm run codegen && npm run build
npx graph deploy <SUBGRAPH_SLUG>
```

Wait for it to sync the full history before pointing the app at it. For
production, publish to the decentralised network and query through the gateway;
Studio URLs are rate-limited and meant for development.

**3. App.** Any Node host. Set:

```
SUBGRAPH_URL=https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
NEXT_PUBLIC_STREAK_ADDRESS=0x…
NEXT_PUBLIC_CHAIN_ID=8453
```

`SUBGRAPH_URL` is intentionally **not** `NEXT_PUBLIC_` — it carries the API key.

---

## Tests

```bash
npm run contracts:test                 # Foundry: 12 tests, incl. fuzz
cd subgraph && npx graph test -d       # Matchstick mapping tests (via Docker)
cd web && npm run typecheck && npm run build
```

The contract tests cover the cases that actually bite: a second check-in the same
day, 23:59 → 00:01 counting as a streak, a missed day resetting the streak while
the total and longest survive, and a stored streak going stale.

The mapping tests (`subgraph/tests/streak.test.ts`) cover month bucketing across
year and leap-day boundaries — the calendar conversion is hand-rolled, so it's
checked against known dates. They need `-d` (Docker): Matchstick ships prebuilt
binaries only for some platforms.

---

## Things deliberately left out

- **No wallet connector library.** One transaction doesn't justify the
  dependency; swap in RainbowKit/wagmi if you want WalletConnect.
- **No onchain leaderboard.** Maintaining a sorted ranking in storage would cost
  gas on every check-in to serve a query that's free offchain.
- **No auth or spam control.** Any address can check in. Gate on an allowlist or
  token balance in `checkIn` if the community needs it.
- **No reorg handling in the app.** graph-node already handles reorgs; the app
  just reads what the indexer currently believes.
