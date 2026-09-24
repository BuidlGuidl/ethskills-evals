# Toolshed

A lending library for a neighbourhood association. Members list tools they own,
other members ask to borrow them for a few days against a USDC deposit, and the
deposit pays the owner a daily late fee when a tool comes back late. Everyone
builds up a track record, and the track record decides whose request an owner
sees first.

Built for one association of roughly 300 members: a single Node process, a
single SQLite file, no runtime dependencies, no build step.

---

## Quick start

Requirements: **Node 22.5 or newer** (it uses the built-in `node:sqlite`). That
is the whole list — there is nothing to `npm install`.

```sh
git clone <this repo> toolshed && cd toolshed

npm run seed                     # demo members, tools and loan history
TOOLSHED_DEV_FAUCET=true npm run dev
# → http://localhost:3000
```

Sign in as any of the seeded members with the password `toolshed-demo-1`:

| Email                | Who they are                                        |
| -------------------- | --------------------------------------------------- |
| `ada@example.org`    | Owns the drill and the ladder; also the treasurer    |
| `carmen@example.org` | Four loans, all returned on time                     |
| `erin@example.org`   | Returns things late, and has Ada's ladder right now  |
| `ben@example.org`    | One loan; nearly a new member                        |
| `dev@example.org`    | Three loans, one of them a day late                  |

Sign in as Ada to see the two requests waiting on the drill (Carmen first —
that is the sort in action) and the overdue ladder with its fee ticking up.
Confirm the ladder's return and watch 24 USDC move from Erin's deposit to Ada's
balance.

`npm test` runs the test suite (unit + end-to-end over real HTTP). No network,
no fixtures on disk, about two seconds.

### What a developer actually has to do

1. Install Node 22.5+.
2. `npm run seed` — creates `var/toolshed.sqlite` and fills it.
3. `npm run dev` — starts the server with `--watch`.
4. Set `TOOLSHED_DEV_FAUCET=true` if you want to mint test USDC into your own
   balance from `/wallet` (this is the only way to get funds in development).

That is it. There is no bundler, no migration CLI (migrations run at boot), no
database server, no queue, no `.env` needed for local work.

---

## How the thing works

### The loan lifecycle

```
                 ┌──────────── declined ◄── owner says no
                 │                          (deposit released)
  requested ─────┼──────────── cancelled ◄── borrower withdraws
   (deposit      │                          (deposit released)
    held) ───────┼──────────── expired  ◄── start day passed, nobody decided
                 │                          (deposit released)
                 └── active ── closed   ◄── owner confirms the tool is back
                    (owner says yes)       (deposit split: late fee → owner,
                                            remainder → borrower)
```

Three decisions worth knowing about, because they are the ones a reader will
otherwise wonder about:

**The deposit is held when the request is made, not when it is approved.** An
owner deciding whether to hand over their good drill is looking at a request
whose money is already set aside, and one member cannot spray ten requests
across the neighbourhood backed by one deposit's worth of USDC. Declining,
cancelling and expiring all release it.

**The owner confirms the return, and may backdate it.** A tool returned on
Saturday and confirmed on Monday is not two days later. The confirmation form
defaults to today and refuses dates in the future or before the loan started.
Only the owner can close a loan, because only the owner knows the tool is
actually back.

**Approving a request auto-declines the conflicting ones.** If three neighbours
want the drill this weekend and one gets it, the other two get their deposits
back immediately rather than having them tied up until someone remembers.

### Late fees

A loan is due at the end of its due date. Late days are whole calendar days
past that date **in the association's timezone** (`TOOLSHED_TZ`) — not UTC days,
because "one day late" has to mean what it means to the two neighbours
involved. The fee is `daily_late_fee × late_days`, **capped at the deposit**: a
tool that is 40 days late forfeits the deposit and closes; it does not generate
an unbounded debt Toolshed has no way to collect. Anything beyond that is a
conversation between neighbours.

Fees are computed from `(due date, day returned)` at settlement time. Nothing
accrues them incrementally, so the number is correct whether the nightly job ran
once, twice, or not for a week. The nightly job only sends reminders and expires
stale requests — the only kind of scheduled work that is safe to miss.

A listing's daily late fee may not exceed its deposit, otherwise the first late
day silently eats everything and the "per day" promise on the listing is a lie.

### The track record, and the sort

Each member has one record — how many loans they have taken, how many came back
late, and how late. It follows them to both sides of the exchange: **browse**
ranks tools by their owner's record, and an owner's **request queue** ranks
incoming requests by the borrower's record, so the reliable people get lent to
first.

Sorting on a raw on-time percentage has two problems at this size. A member with
one on-time loan would outrank a member with forty loans and one late return,
which is backwards; and a brand new member has no percentage at all, which with
300 members happens constantly. So the on-time rate is smoothed toward a neutral
prior (three imaginary loans at 90% on time) and nudged by a weak log-scaled
volume term:

```
smoothed = (onTime + 3 × 0.9) / (loans + 3)
severity = min(0.1, (lateDays / lateLoans / 30) × (lateLoans / (loans + 3)))
score    = (smoothed − severity) × 100 + 4 × log10(1 + loans)
```

New members land mid-pack — above the repeatedly late, below the proven — and
move from there. `severity` is what separates "returned it a day late once" from
"kept it for a month". The properties this is supposed to have are pinned down in
`test/reputation.test.js` rather than in the formula's comments: a spotless
record beats a spotty one, volume breaks ties, one lucky loan does not outrank a
long clean history.

Tools that are out on loan sink to the bottom of browse regardless of score — an
excellent neighbour whose ladder is already lent out is not the top result.

### The money

Every amount is an integer number of **micro-USDC** (1 USDC = 1,000,000),
stored as `TEXT` in SQLite and handled as `BigInt` in JavaScript. Nothing is
ever a float: a deposit split between a late fee and a refund has to add back up
to exactly the deposit, and `test/fees.test.js` checks that for every late-day
count from 0 to 40.

Money moves through a **double-entry ledger** (`src/payments/ledger.js`). Every
movement is a row with a source and a destination account; balances are derived
from those rows; the sum over all accounts is always zero, and the treasury page
shows that invariant so a missing refund is findable rather than merely
suspected. Member accounts cannot go negative — Toolshed does not extend credit.

Deposits sit in an **escrow port** (`src/payments/escrow.js`) with four calls:
`hold`, `release`, `capture`, `holdFor`. Everything the lending flow knows about
money is those four calls, and each one runs inside the same database
transaction as the loan state change it belongs to, so a loan is never approved
with its deposit unheld.

#### What is and is not on-chain — read this before you promise anyone anything

v1 ships one escrow driver, `ledger`, and it is **custodial bookkeeping, not a
blockchain integration**. Members fund a Toolshed balance; the association's
treasurer records USDC arriving in the association wallet (`/admin`) and credits
the member; Toolshed then moves integers inside its own books. Deposits are held
by the association, exactly as if the treasurer were holding cash in an envelope
— which is the honest first version for a group of neighbours who already trust
their treasurer with the association's money.

`src/payments/onchain.js` is a deliberate stub that throws at boot rather than
pretending. It documents what a real implementation needs: an escrow contract on
an L2 where USDC is cheap, a signer that is not an environment variable,
confirmation handling (a hold is not a hold until it is mined — the loan flow
already tolerates a `pending` hold), reorg handling, and a reconciliation job
comparing `escrow_holds` against chain state. That is a project, not an
afternoon, and it does not have to happen before the first loan.

### Security posture

- Passwords are scrypt with a per-user salt; sign-in burns the same work for
  unknown addresses so response time does not reveal who is a member.
- Sessions are 32 random bytes in an `HttpOnly`, `SameSite=Lax` cookie; the
  database stores only the SHA-256 of the token, so a database leak is not a
  pile of usable sessions.
- Every POST carries a CSRF token derived from the session id (HMAC with
  `TOOLSHED_SESSION_SECRET`), compared in constant time.
- All HTML goes through an escaping template (`src/web/views/html.js`); the
  default for a tool name typed by a neighbour is "escaped". Responses set a
  restrictive `Content-Security-Policy`, and there is no client-side JavaScript
  at all.
- Uploads are capped, and an image is stored only if its *bytes* start like a
  JPEG, PNG or WebP. Files are named by content hash, so nothing a member typed
  ever becomes a path.
- Signing up requires the association's invite code, which is how a 300-member
  private club stays private.

Not done in v1: rate limiting on sign-in (put it in the reverse proxy), account
recovery by email, and audit logging beyond the ledger and notices tables.

---

## Architecture

One process serves HTTP and runs the housekeeping interval. At this size that is
the entire deployment: no queue, no worker, no cron container to keep in sync
with the app. `runDailyJob` is a pure function of (database, clock) and lifts
straight out into a real cron job the day that stops being true.

```
src/
  main.js              boot: open db, load escrow driver, start server + daily interval
  config.js            all environment variables, in one place
  db.js                schema, append-only migrations, transaction helper
  domain/              pure logic, no database, no HTTP
    money.js             micro-USDC parsing, formatting, storage
    dates.js             calendar days in the association's timezone
    fees.js              late days, and the deposit split
    reputation.js        the track record and the score everything sorts by
  payments/
    ledger.js            double-entry accounts and entries
    escrow.js            the escrow port + the ledger driver + funding/withdrawal
    onchain.js           the on-chain driver, documented and unimplemented
  services/            application logic: validation, state changes, queries
    members.js           accounts, passwords, sessions, track records
    tools.js             listings and the browse sort
    loans.js             the loan lifecycle; the only place fees are charged
    notices.js           in-app notifications
  jobs/daily.js        expire stale requests, remind about overdue loans, purge sessions
  web/
    server.js            request pipeline: static, session, CSRF, render, errors
    router.js            the route table
    routes.js            ~30 routes, each a few lines over the services
    http.js              cookies, body reading, CSRF tokens
    multipart.js         just enough multipart/form-data for one photo
    photos.js            content-hash storage and serving
    views/               escaping template, layout, pages
public/app.css         one stylesheet, light and dark
deploy/                systemd unit, Caddyfile, backup script
test/                  unit tests + end-to-end HTTP tests
```

The dependency direction is one-way: `web → services → payments/domain → db`.
`domain/` knows nothing about the database or HTTP, which is why the fee,
date and reputation rules are testable without a fixture.

### Data model

| Table             | Holds                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| `members`         | account, unit number, password hash, payout wallet, admin flag                |
| `sessions`        | hashed session tokens with expiry                                             |
| `tools`           | listing: name, description, condition notes, photo, deposit, late fee, max days |
| `loans`           | one row per request; carries its own copy of the deposit and fee terms        |
| `ledger_accounts` | `member:<id>`, `escrow`, `external`, with materialised balances               |
| `ledger_entries`  | every movement of USDC, with the loan it belongs to                           |
| `escrow_holds`    | one per loan: held → released or captured                                     |
| `notices`         | in-app notifications, deduplicated per member/loan/kind/day                   |

A loan copies the tool's deposit and late fee at request time. Editing a listing
never changes the terms of a loan already agreed under the old ones.

Migrations are an append-only array in `src/db.js`, applied at boot inside a
transaction. Add one; never edit one that has shipped.

### Why SQLite, and when to stop using it

300 members generate a few hundred loans a year. The whole dataset is a few
megabytes, every query is an indexed lookup, and the synchronous driver keeps
transactions honest — a request either commits or it does not. The ceiling is
one machine and one writer, which this application will not reach. If it ever
does, the services layer is where you would introduce Postgres; `domain/` would
not change at all.

---

## Deploying it

Toolshed is a long-running Node process that needs one writable directory. Any
host that can run that will do.

```sh
# on the server, as root
useradd --system --home /var/lib/toolshed --create-home toolshed
git clone <this repo> /srv/toolshed
chown -R toolshed:toolshed /srv/toolshed /var/lib/toolshed

cp /srv/toolshed/.env.example /etc/toolshed.env
$EDITOR /etc/toolshed.env          # see below
chmod 600 /etc/toolshed.env

cp /srv/toolshed/deploy/toolshed.service /etc/systemd/system/
systemctl enable --now toolshed
```

Then put TLS in front of it — `deploy/Caddyfile` is a working example — and set
`TOOLSHED_SECURE_COOKIES=true` once you have.

### Configuration

| Variable                   | Default              | Notes                                                       |
| -------------------------- | -------------------- | ----------------------------------------------------------- |
| `PORT`                     | `3000`               |                                                             |
| `NODE_ENV`                 | —                    | `production` makes `TOOLSHED_SESSION_SECRET` mandatory       |
| `TOOLSHED_TZ`              | `America/New_York`   | the zone that defines a calendar day for due dates and fees  |
| `TOOLSHED_DB`              | `var/toolshed.sqlite`| put it on backed-up storage                                  |
| `TOOLSHED_UPLOADS`         | `var/uploads`        | photos; also needs backing up                                |
| `TOOLSHED_SESSION_SECRET`  | random per boot      | **required in production**; changing it signs everyone out   |
| `TOOLSHED_INVITE_CODE`     | `neighbors`          | rotate when someone leaves the association                   |
| `TOOLSHED_SECURE_COOKIES`  | `false`              | `true` once behind HTTPS                                     |
| `TOOLSHED_SESSION_DAYS`    | `30`                 | how long a sign-in lasts                                     |
| `TOOLSHED_MAX_PHOTO_BYTES` | `5242880`            | 5 MB                                                         |
| `TOOLSHED_ESCROW`          | `ledger`             | `onchain` is not implemented and refuses to boot             |
| `TOOLSHED_DEV_FAUCET`      | unset                | development only; lets members mint test USDC                |

### Day-one operational tasks

**Make the treasurer an admin.** There is no UI for this on purpose; the first
one is set by hand:

```sh
sqlite3 /var/lib/toolshed/toolshed.sqlite \
  "UPDATE members SET is_admin = 1 WHERE email = 'treasurer@example.org';"
```

The treasurer then uses `/admin` to credit a member's balance when their USDC
arrives in the association wallet, and to record payouts back out. That page
also shows total member balances, total escrow, and whether the ledger still
sums to zero.

**Back up.** `deploy/backup.sh` uses SQLite's own `.backup` (copying the file
with `cp` while it is being written is not safe) and tars the photos. Run it
nightly from cron. The database and the uploads directory together are the
entire state of the application; nothing else on the box matters.

**Upgrade.**

```sh
cd /srv/toolshed && git pull && systemctl restart toolshed
```

Migrations run at boot inside a transaction. Take a backup first; there is no
down-migration path, by design — at this scale, restoring a backup is the rollback.

**Watch.** `/healthz` returns `{"ok":true}`; point an uptime check at it. The
daily job logs a one-line JSON summary. Everything else goes to the journal:
`journalctl -u toolshed -f`.

---

## Testing

```sh
npm test
```

67 tests, no network, no disk fixtures. They cover the money arithmetic and its
invariants, calendar-day counting across DST and year boundaries, the fee cap,
the reputation properties, ledger conservation, the full loan lifecycle
(including the cases that should be refused: double-booking, stacked requests,
future return dates, closing someone else's loan), and end-to-end HTTP flows
over a real server (sign-in, CSRF rejection, invite-code enforcement, one member
not being able to read another's loan).

---

## Deliberately not in v1

Worth saying out loud, because each of these is a real thing the association
will eventually ask for:

- **Damage and dispute handling.** Today the deposit only ever pays late fees. A
  tool that comes back broken is a conversation between neighbours. A claim
  flow, with the treasurer as arbiter, is the obvious next feature.
- **Email.** Notices are in-app only. `kind` on every notice is stable so a
  sender can be attached without touching call sites.
- **On-chain escrow.** See above, and `src/payments/onchain.js`.
- **A reservation calendar.** You can request any free date range, but there is
  no month view of what is booked when.
- **Password reset.** Requires email; until then, the treasurer resets by hand.
- **Rate limiting.** Belongs in the reverse proxy for now.
