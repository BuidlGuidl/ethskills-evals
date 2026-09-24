# Toolshed

A lending library for a neighbourhood association of ~300 members. Members list
the tools they own, other members ask to borrow them for a few days against a
USDC deposit, and the deposit comes back when the tool does. Tools come back
late a lot, so a fixed late fee is charged per late day out of the deposit and
paid to the owner. Every finished loan updates the borrower's track record, and
that track record is what the browse screen ranks by.

This is v0.1: complete end to end, with one deliberate exception — real USDC
custody is behind an interface with a mock implementation. See
[Wiring up real USDC](#wiring-up-real-usdc).

---

## How it works (the product rules)

**Listing.** A tool has a photo, a name, a category, a description, condition
notes, and its own terms: the deposit, the late fee per day, and the maximum
loan length. Terms are set by the owner, within association-wide caps. A late
fee larger than the deposit is rejected — it could never be collected.

**Borrowing.**

1. A member asks for a tool for *n* days. The deposit moves from their
   available balance into escrow **at request time**, so an owner looking at a
   queue of requests knows the money is really there. Not enough balance means
   no request.
2. The owner approves or declines. Approving one request auto-declines the
   others for that tool and releases their deposits — one tool, one borrower.
3. The owner marks the handover when the tool physically changes hands. **The
   clock starts here, not at approval**, so a slow pickup doesn't eat the
   borrower's days or trigger fees for a tool they never got.
4. The due date is handover + *n* days. The owner marks the return; the
   remaining deposit goes back to the borrower in the same transaction.

**Late fees.** Any part of a day past the due date (plus `LATE_GRACE_HOURS`)
counts as a whole late day, because the tool is unavailable to everyone else
for that day. Each late day moves one late fee from the borrower's escrowed
deposit to the owner's available balance, capped at the deposit: fees stop when
the deposit runs out and the loan is flagged `depositExhausted` for the
association to chase. Fees are charged by a background sweep every
`ACCRUAL_INTERVAL_MINUTES`, not lazily on page load, so the money moves even if
nobody opens the app. Each (loan, late day) charge is keyed in the ledger, so
running the sweep twice — or catching up after a day of downtime — charges each
day exactly once.

**Track record.** Counted from settled loans: how many loans a member has
returned, how many of those were late, and how many late days in total. The
score is a smoothed on-time rate (`server/src/domain/reputation.ts`):

```
score = (onTimeReturns + 0.8 * 4) / (totalReturns + 4) * 100
```

A new member starts at 80 — lendable, but ranked below anyone with a real
record — and one slip in fifty loans barely registers. Lateness is counted from
the clock at return time, not from fees collected, so an exhausted deposit
never launders a late return. Two guard rails follow from the record: a member
holding something overdue cannot borrow anything else, and requests nobody
answers within 7 days expire and release their deposit.

**Where the ranking shows up.** Browse defaults to `sort=trust`, which orders
tools by their owner's score (ties: most loans lent, then newest). Incoming
requests on the Loans screen and on your own tool page are ranked by the
*borrower's* score, so the reliable people get lent to first. `/members` is the
roster under the same ranking. Owner reputation and borrower reputation are
tracked separately — being a generous lender says nothing about whether you
bring things back.

---

## Architecture

```
web/  React SPA (Vite, react-router). Talks to /api over cookies.
      │
      ▼
server/  Express 5 + TypeScript
      routes/     HTTP: validation (zod), authz, serialisation
      domain/     the rules: loans, ledger, reputation, tools, members
      payments/   PaymentProvider interface + mock implementation
      db/         SQLite (better-sqlite3), schema.sql, member_stats view
      worker.ts   late-fee sweep + request/session expiry, on a timer
```

One Node process. In production it also serves the built client, so a
deployment is a single container with one volume. At 300 members this is the
right shape: no queue, no cache, no second service to keep alive.

**Layering.** Routes never contain business rules and `domain/` never touches
`req`/`res`. Domain functions take `(db, input, now?)` and run inside a
transaction, which is why the whole late-fee lifecycle can be tested by passing
timestamps instead of mocking the clock.

**Storage.** SQLite in WAL mode. The schema
(`server/src/db/schema.sql`) is applied idempotently at boot. Photos are
validated by magic bytes (not by the client's content-type) and stored behind an
opaque key by a `PhotoStore`; the local-disk store ships, object storage is a
drop-in replacement.

### Money: a double-entry ledger

Balances are never a column that gets incremented. Every movement of USDC is a
`transfer` with `ledger_entries` that sum to zero, and a balance is a `SUM` over
those entries. Three accounts per member:

| Account    | Meaning                                                       |
| ---------- | ------------------------------------------------------------- |
| `available` | Spendable: can fund a deposit or be withdrawn                |
| `escrow`    | Deposits held against open requests and live loans           |
| `external`  | The outside world (one system-wide account, `member_id NULL`) |

Transfer kinds: `top_up`, `withdrawal`, `deposit_hold`, `deposit_release`,
`late_fee`. Every transfer carries a unique `idempotency_key`, so retries and
repeated sweeps are no-ops rather than double charges. Two invariants are
enforced inside the posting function, after the insert and inside the
transaction: no member account may go negative, and **no loan may spend another
loan's escrow** (per-loan escrow is tracked by `loan_id` on each entry).
`GET /api/admin/ledger-check` re-checks all of this against live data.

This is why late fees are safe to compute from timestamps: the ledger, not a
counter, is the record of what was actually charged.

### Data model

`members` · `sessions` · `tools` · `loans` · `transfers` · `ledger_entries`,
plus a `member_stats` view that aggregates each member's loan counts. Notes:

- Money is integer **micro-USDC** (1 USDC = 1,000,000). No floats anywhere;
  the API returns both `micros` and a display string. Times are epoch
  milliseconds.
- A loan **copies the tool's terms** (deposit, late fee) at request time, so
  editing a listing can't move the goalposts on a live loan.
- A partial unique index enforces one open loan per tool at the database level,
  not just in application code.
- `loans.late_days_charged` is what the deposit paid for; `loans.late_days` is
  what actually happened. Reputation uses the latter.

### Authentication

Email + password (scrypt), sessions in the database behind an httpOnly,
SameSite=Lax cookie. Joining requires the association's `INVITE_CODE` — this is
a members-only library, not a public marketplace. Admins (`ADMIN_EMAILS`) can
run maintenance by hand, check the ledger, and confirm a return on an owner's
behalf.

### API

All endpoints are under `/api` and require a session except where noted.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness (no auth) |
| `POST` | `/auth/signup` · `/auth/login` · `/auth/logout` | Sessions (no auth) |
| `GET`/`PATCH` | `/auth/me` | Own profile, balances, track record |
| `GET` | `/tools?sort=trust\|newest\|deposit&q=&category=&availableOnly=` | Browse |
| `POST` | `/tools` | List a tool (multipart, `photo` field) |
| `GET`/`PATCH` | `/tools/:id` | Detail (owners also see their request queue) / edit |
| `GET` | `/tools/categories` | Category vocabulary |
| `POST` | `/loans` | Ask to borrow; holds the deposit |
| `GET` | `/loans?role=borrower\|owner\|any&status=` | Own loans, with tool + people |
| `GET` | `/loans/:id` | One loan (participants and admins only) |
| `POST` | `/loans/:id/approve` · `/decline` · `/cancel` · `/handover` · `/return` | Lifecycle |
| `GET` | `/wallet` · `/wallet/deposit-instructions` | Balances and ledger history |
| `POST` | `/wallet/top-up` (mock only) · `/wallet/withdraw` | Money in and out |
| `GET` | `/members` · `/members/:id` | Roster (ranked) and profiles |
| `POST` | `/admin/run-maintenance` | Run the sweep now (admin) |
| `GET` | `/admin/ledger-check` | Ledger invariants (admin) |
| `GET` | `/photos/:key` | Tool photos (no auth, immutable cache) |

Errors are always `{ "error": { "code", "message", "details"? } }` with a stable
machine-readable `code` (`insufficient_funds`, `tool_lent_out`,
`borrower_overdue`, `late_fee_over_deposit`, …).

---

## Getting it running

**Prerequisites:** Node.js ≥ 20.11 (22 recommended) and npm 10+. No database
server, no Docker needed for development. `better-sqlite3` ships prebuilt
binaries for mainstream platforms; on an exotic one you'll need a C++ toolchain
(`build-essential`, `python3`).

```bash
npm install                   # installs both workspaces
npm run seed                  # 24 members, 20 tools, ~130 loans of history
npm run dev                   # API on :8080, client on :5173 (proxying /api)
```

Open <http://localhost:5173> and sign in as any seeded member — the seed prints
the password (`toolshed-demo-1`) and which account is the admin. The seed
deliberately lands on interesting state: one overdue loan accruing fees, one
healthy loan, one request waiting for an owner, and a spread of track records
from spotless to repeatedly late.

Re-seed with `SEED_RESET=1 npm run seed` (it refuses to touch a non-empty
database otherwise).

Signing up as yourself needs the invite code, which defaults to
`maple-street`; override with `INVITE_CODE`. To give yourself admin rights, set
`ADMIN_EMAILS=you@example.org` **before** signing up.

Everything is configured by environment variables with working defaults — see
[`.env.example`](.env.example) for the annotated list. Nothing is required in
development; in production set at least `INVITE_CODE`, `ADMIN_EMAILS` and
`SECURE_COOKIES=true`.

### Other commands

```bash
npm test          # 45 tests: unit + full HTTP integration (vitest, supertest)
npm run typecheck # tsc --noEmit across both workspaces
npm run build     # client bundle + server to dist/
npm start         # run the built server (serves API + client on :8080)
```

The test suite runs against an in-memory SQLite database and a fake payment
provider, so it needs no setup and no network. The late-fee tests drive time by
passing timestamps: idempotent re-sweeps, deposit exhaustion, partial final
fees, and cross-loan escrow isolation are all covered.

---

## Deploying

The image is self-contained: API, client bundle, and SQLite. State (database +
photos) lives in one volume at `/data`.

```bash
docker compose up --build -d
docker compose exec toolshed node server/dist/scripts/seed.js   # demo data, optional
```

Or by hand:

```bash
docker build -t toolshed .
docker run -d --name toolshed -p 8080:8080 \
  -v toolshed-data:/data \
  -e INVITE_CODE=your-code -e ADMIN_EMAILS=you@example.org \
  -e SECURE_COOKIES=true \
  toolshed
```

Without Docker: `npm ci && npm run build && npm start` behind a process
supervisor (systemd, pm2). Set `DATABASE_PATH` and `UPLOAD_DIR` to somewhere
persistent.

**Checklist for a real deployment**

- **TLS.** Terminate HTTPS in front of the app (Caddy, nginx, a platform
  router) and set `SECURE_COOKIES=true`. The app trusts `X-Forwarded-*`.
- **Backups.** The whole state is `/data`. Snapshot the volume, or
  `sqlite3 /data/toolshed.db ".backup /backup/toolshed-$(date +%F).db"` on a
  schedule — a hot copy of a WAL database is not safe, `.backup` is. The ledger
  is append-only, so a restore loses only what happened after the snapshot.
- **The late-fee sweep** runs inside the app process. If you prefer an external
  scheduler, set `RUN_ACCRUAL_WORKER=false` and `POST /api/admin/run-maintenance`
  from cron as an admin. Don't run two app processes with the worker enabled
  against the same database — fee charges are idempotent so it would be
  *correct*, but SQLite would rather not have the write contention.
- **Scaling.** One process, and SQLite serialises writers. For 300 members that
  is a rounding error. If it ever isn't, the move is Postgres (the SQL here is
  plain, the ledger is the only hot table) before it is a second app server.
- **Monitoring.** `GET /api/health` for liveness; `GET /api/admin/ledger-check`
  should always return `ok: true` — alert if it doesn't.

---

## Wiring up real USDC

Deposits, escrow and late fees are all internal ledger movements; real money
only has to cross the boundary at top-up and withdrawal. That boundary is
`PaymentProvider` (`server/src/payments/index.ts`), with three methods:
`depositInstructions`, `confirmTopUp`, `payout`.

`PAYMENT_PROVIDER=mock` ships and is what the seed and tests use: balances are
credited on request and no USDC moves. Any other value **fails at boot** rather
than at the first withdrawal. To go live:

1. Implement a provider against a custody wallet (e.g. USDC on Base or Polygon
   for fees that make sense against a 2 USDC late fee).
2. Add a chain watcher that calls `ledger.topUp(db, memberId, micros, txHash)`
   once a transfer has enough confirmations. `txHash` as the reference makes
   reorg-driven retries idempotent for free.
3. Route `payout` through your withdrawal signing path and keep the ledger debit
   *after* the provider accepts, as `routes/wallet.ts` already does.
4. Delete `POST /api/wallet/top-up` (it already refuses to run under a non-mock
   provider).

Per-member deposit addresses are the reason `depositInstructions` takes a
`memberId`; the mock returns a note instead of an address.

---

## What v0.1 does not do

Known gaps, roughly in the order I'd close them:

- **No notifications.** Nobody is emailed or texted when a request arrives or a
  tool goes overdue, which is the single biggest thing standing between this and
  real-world use. The domain events exist (`approveLoan`, `accrueLoan`, …) —
  they just need a sink.
- **Returns are owner-confirmed only.** A borrower cannot mark a return, so an
  unresponsive owner can keep a deposit in escrow accruing fees. Admins can
  confirm on their behalf; a borrower-initiated "I returned it" with a dispute
  window is the real fix.
- **No disputes or damage claims.** If a tool comes back broken, that is a
  conversation, not a feature. Deposits are only ever consumed by late fees.
- **No photo processing.** Uploads are stored as sent (validated and size-capped,
  but not resized or stripped of EXIF); an 8 MB phone photo is served as an
  8 MB phone photo.
- **No availability calendar.** Requests are for "*n* days starting whenever the
  owner hands it over", not for specific dates.
- **Migrations are `CREATE IF NOT EXISTS`.** Fine while the schema is additive;
  a real migration runner is needed before the first column has to change.
- **Rate limiting** on login and signup is left to the proxy in front.
