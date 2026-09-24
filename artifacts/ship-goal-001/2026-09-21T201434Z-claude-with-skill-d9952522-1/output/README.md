# Toolshed

A lending library for a neighborhood association. Members list tools they own,
neighbors borrow them for a few days against a USDC deposit, and a daily late
fee comes out of that deposit and goes to the owner. Everybody builds a track
record, and the browse screen puts the reliable people first.

The deposit is the only part that needs a blockchain, so it is the only part
that got one.

---

## Contents

- [How a loan works](#how-a-loan-works)
- [Architecture](#architecture)
- [State transitions](#state-transitions)
- [Track record and ranking](#track-record-and-ranking)
- [Why Base](#why-base)
- [Running it locally](#running-it-locally)
- [Deploying](#deploying)
- [Post-deploy verification](#post-deploy-verification)
- [Operating it](#operating-it)
- [Security notes](#security-notes)
- [What is deliberately not here](#what-is-deliberately-not-here)

---

## How a loan works

1. **Priya lists her drill.** Photo, description, honest condition notes, a $60
   deposit and a $2/day late fee. Nothing touches the chain — this is a row in
   a database.
2. **Tomás asks to borrow it for four days.** His wallet approves USDC and
   calls `request()`, which pulls $60 into escrow. Priya can see a real deposit
   is posted before she commits to anything.
3. **Priya calls `approve()` and hands over the drill.** The four-day clock
   starts at that moment, not when he asked.
4. **Tomás brings it back two days late.** Priya calls `confirmReturn()`. The
   contract sends her $4 and returns $56 to Tomás. One transaction, no
   argument about arithmetic.
5. **Both track records update.** Tomás now has a late return against his name,
   Priya has another completed loan as a lender. The browse screen re-sorts.

If Tomás returns it on time, he gets the whole $60 back and Priya gets nothing —
the late fee is the only money that ever moves between neighbors.

---

## Architecture

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  web/  Next.js app           │        │  contracts/  Toolshed.sol    │
│                              │        │                              │
│  • member directory          │        │  • holds USDC deposits       │
│  • listings, photos,         │        │  • computes the late fee     │
│    condition notes           │──────▶ │  • splits the deposit        │
│  • browse + ranking          │  wagmi │  • emits what happened       │
│  • loan UI                   │        │                              │
│                              │        │   no owner, no pause,        │
│  ┌────────────────────────┐  │        │   no upgrade, no fee         │
│  │ indexer (viem getLogs) │◀─┼────────┘                              │
│  └───────────┬────────────┘  │             events                    │
│              ▼               │                                       │
│  ┌────────────────────────┐  │        ┌──────────────────────────────┐
│  │ SQLite                 │  │        │  USDC (Circle, on Base)      │
│  │  members / listings /  │  │        └──────────────────────────────┘
│  │  indexed loan history  │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

### What is onchain, and why

| Onchain | Reason |
| --- | --- |
| The USDC deposit | It is somebody else's money. Escrow is the whole reason a stranger two streets over will lend you a $400 pressure washer. |
| The late-fee calculation and split | The one number the two parties have an incentive to disagree about. Settling it in code means nobody has to trust the association's treasurer with a spreadsheet. |
| Who owes what to whom, and the due date | Needed to compute the split; also what makes the track record unforgeable. |

### What is offchain, and why

| Offchain | Reason |
| --- | --- |
| Photos, titles, descriptions, condition notes | Nothing trustless about a JPEG of a drill. Storing it onchain would cost more than the drill. |
| The member directory and who is approved | Changes constantly, is the association's business, and is not something the escrow needs to know. |
| **The track record and the browse ranking** | Derived data. The contract emits `LoanSettled(…, daysLate, unreturned)`; the app aggregates it. The association can change the ranking formula any afternoon without redeploying anything or migrating any storage. |
| Search, filtering, sorting | Ordinary database work. |

The contract deliberately stores **no** score, no leaderboard and no per-member
counters. `src/core/reputation.ts` is the only place ranking exists, and the
`loans` table it reads is a pure cache — delete the database, restart the
indexer, and it rebuilds from the chain.

### One custom contract

`contracts/src/Toolshed.sol`, around 360 lines including comments. It is the only contract deployed.
There is no factory (one escrow handles every loan via a mapping), no separate
escrow contract (the escrow *is* the contract), and no fee splitter (there is no
protocol fee to split). USDC is an existing audited token contract, used as-is.

### Layout

```
contracts/
  src/Toolshed.sol            the escrow
  test/Toolshed.t.sol         26 unit + fuzz tests
  test/ToolshedFork.t.sol     lifecycle against real USDC on a Base fork
  test/mocks/MockUSDC.sol     6-decimal token with a blacklist, like the real one
  script/Deploy.s.sol         picks the right USDC per chain, refuses a dead address
web/
  src/core/db.ts               SQLite schema
  src/core/chain.ts            chain + USDC addresses, USDC amount parsing
  src/core/auth.ts             signed-write verification (EIP-1271 aware)
  src/core/reputation.ts       the ranking formula
  src/core/listings.ts         browse queries and sorting
  src/core/loans.ts            loan queries + late-fee preview
  src/core/abi.ts              generated from the Foundry artifact (npm run abi)
  src/indexer/run.ts           chain → SQLite
  src/app/                     pages and API routes
  scripts/seed.ts              a plausible neighborhood to look at
scripts/e2e-local.sh           deploy + full loan + index + assert, on anvil
```

---

## State transitions

Every function that moves money, who calls it, why they bother, and what
happens if nobody does. **No transition depends on a cron job, a keeper, or the
association running a bot.**

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `request(owner, ref, deposit, fee, days)` | borrower | It is how they ask for the tool; the deposit is escrowed in the same transaction | No loan exists. Nothing is at risk. |
| `approve(loanId)` | tool owner | It is how they agree to lend; the late-fee clock only starts here | Request sits. After 3 days anyone can `expireRequest` and the borrower is refunded in full. |
| `decline(loanId)` | tool owner | Politeness, and it frees the tool up | Same as above — the 3-day expiry covers it. |
| `withdrawRequest(loanId)` | borrower | Gets their own deposit back before the loan starts | Same as above. |
| `expireRequest(loanId)` | **anyone** | Borrower calls it to recover their own deposit; permissionless because the outcome is fixed (full refund to the borrower) and cannot be gamed | Deposit stays in escrow until somebody does. Only the borrower loses by waiting, and only the borrower can be paid. |
| `confirmReturn(loanId)` | tool owner | **This is how the accrued late fee reaches their wallet.** The happy path. | Borrower calls `assertReturn`, waits out the window, and settles without them. |
| `assertReturn(loanId)` | borrower | Freezes the late-fee clock immediately, so a slow owner cannot run up their bill | Fees keep accruing against the borrower until the deposit cap. |
| `objectToReturn(loanId)` | tool owner | Disputes a false return claim; accrual resumes as if it never paused | The assertion stands and settles after 3 days. |
| `settleUnchallenged(loanId)` | **anyone** | Borrower calls it to get their refund; permissionless because by this point the split is already fixed by `assertedAt` and cannot be influenced by the caller | Money sits in escrow, claimable forever. Nothing expires. |
| `claimUnreturned(loanId)` | **anyone** | Owner calls it to collect a deposit for a tool they will never see again; permissionless because the funds can only go to the owner | Deposit sits in escrow, claimable forever. |
| `withdraw()` | whoever is owed | Claims a payout that could not be pushed (see [Security notes](#security-notes)) | Their balance stays credited indefinitely. |

Two properties worth stating plainly:

- **Neither party can strand the other's money.** If the owner vanishes, the
  borrower asserts and settles. If the borrower vanishes, the owner claims once
  the fee cap is hit. If the owner never approves, the request expires.
- **The objection is limited to one per loan.** Otherwise an owner could object
  to every return assertion in turn and drain the full deposit by attrition.
  After one objection, the borrower's next assertion settles on schedule.

### Late fee arithmetic

Any *started* day past the due date counts as a whole day, the way a library
desk charges it — one hour late is one day's fee. The total is capped at the
deposit, so a borrower's worst case is legible before they commit. When the
cap is reached the tool is treated as lost and the owner takes the whole
deposit.

`request()` rejects a daily fee larger than the deposit, so a single day can
never consume everything.

---

## Track record and ranking

The contract emits the facts. `web/src/core/reputation.ts` turns them into an
order.

The ranking is the **Wilson lower bound** on a member's on-time rate, not a raw
ratio. A plain ratio ranks "1 loan, 0 late" above "40 loans, 1 late", which is
exactly backwards for deciding who to lend to. The lower bound holds a thin
history near the middle until it has earned a position:

| Member | History | Score |
| --- | --- | --- |
| Priya | 12 loans, 1 late, lent 5 | 0.671 |
| Tomás | 5 loans, 1 late, lent 6 | 0.406 |
| Ellen | 1 loan, 0 late, lent 6 | 0.237 |
| Marcus | 4 loans, 3 late, lent 4 | 0.066 |
| Hana | 3 loans, 1 late, lent 4, **1 never returned** | 0.000 |

(Numbers from `npm run seed`, which is there so the browse screen has something
to rank on a fresh checkout.)

Two adjustments on top of the on-time rate: lending your own tools out nudges
the score up slightly (capped, so you cannot farm it), and losing a neighbor's
tool outright is penalised far harder than being late. Browse also floats
tools that are actually available above ones already out on loan.

The UI shows the underlying counts — "12 loans · 1 late" — rather than a score
out of five. Neighbors trust the numbers more, and the numbers are public
onchain anyway.

---

## Why Base

One target chain for the first release: **Base mainnet** (chain id 8453).

- **Circle-issued native USDC.** Base has real USDC at
  `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, not a bridged wrapper. Deposits
  are in the same dollar the association already thinks in, and a member can
  off-ramp through Coinbase without a bridge hop.
- **Coinbase Smart Wallet.** These are 300 neighbors, not crypto users. Passkey
  signup with no seed phrase is the difference between the association adopting
  this and not. The app ships `coinbaseWallet({ preference: "smartWalletOnly" })`
  first in the connector list for exactly this reason, and the server verifies
  signatures via EIP-1271 so smart-contract wallets work everywhere an EOA does.
- **Cost.** Measured on Base at 0.0065 gwei with ETH at $2,776:

  | | gas | cost |
  | --- | ---: | ---: |
  | `request` (incl. the USDC pull) | 207,310 | $0.0037 |
  | `approve` | 38,849 | $0.0007 |
  | `confirmReturn` | 85,930 | $0.0016 |
  | **complete loan round trip** | **332,089** | **$0.0060** |

  Under a cent per loan matters here specifically: the whole product is $2 late
  fees. On L1 the gas would routinely exceed the fee being collected, which
  would make the economics absurd.

Base Sepolia (84532) is wired up for the dry run and uses USDC at
`0x036CbD53842c5426634e7929541eC2318f3dCF7e`. Both addresses come from Circle's
official contract-address documentation and are verified live in
`test/ToolshedFork.t.sol` and by `Deploy.s.sol`, which refuses to deploy against
an address with no code.

---

## Running it locally

**Prerequisites:** Node 20+, [Foundry](https://getfoundry.sh), and a C toolchain
(`better-sqlite3` builds a native module).

```bash
git clone <this repo> && cd toolshed

# 1. Contracts: build and test
cd contracts
forge install                 # forge-std + openzeppelin-contracts
forge test                    # 26 unit + fuzz tests, no network needed
cd ..

# 2. Web app
cd web
npm install
cp .env.example .env.local
npm run seed                  # a neighborhood to look at
npm run dev                   # http://localhost:3000
```

The browse screen works immediately against the seeded data. To exercise a real
loan you need a chain and a deployed contract — see below.

### Full local stack, with a real chain

```bash
anvil &                                    # terminal 1
./scripts/e2e-local.sh                     # terminal 2
```

That script deploys a mock USDC and Toolshed to anvil, runs a complete loan
that comes back two days late, indexes the result, and asserts that the
offchain track record matches what settled onchain. It is the fastest way to
confirm your toolchain is working, and it prints the contract address to put in
`.env.local`.

To point the app at your anvil deployment:

```bash
# web/.env.local
NEXT_PUBLIC_CHAIN=foundry
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_TOOLSHED_ADDRESS=0x…          # printed by the script
NEXT_PUBLIC_USDC_ADDRESS=0x…              # the mock, also printed
TOOLSHED_DEPLOY_BLOCK=0
TOOLSHED_OPEN_SIGNUP=1                     # skip admin approval while developing
```

Then run the app and the indexer side by side:

```bash
npm run dev          # terminal 1
npm run indexer      # terminal 2 — chain → SQLite
```

### Tests

```bash
cd contracts && forge test                     # 26 contract tests
cd contracts && BASE_RPC_URL=https://mainnet.base.org \
  forge test --match-contract Fork             # against real USDC on Base
cd web && npm test                             # 10 offchain tests
./scripts/e2e-local.sh                         # full stack on anvil
```

The offchain suite specifically pins the late-fee preview in `core/loans.ts` to the
contract's own arithmetic. If those drift, the UI quotes a number the chain
then refuses, so it is worth keeping the test.

---

## Deploying

### 1. Environment

```bash
export BASE_RPC_URL=https://mainnet.base.org        # or your own node
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
export BASESCAN_API_KEY=…                           # from basescan.org
export DEPLOYER_KEY=…                               # or use --ledger / --trezor
```

### 2. Dry run on Base Sepolia first

```bash
cd contracts

forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  --broadcast \
  --verify \
  --etherscan-api-key "$BASESCAN_API_KEY"
```

Get test USDC from [faucet.circle.com](https://faucet.circle.com) and run a
real loan through the UI before going near mainnet.

### 3. Mainnet

```bash
cd contracts

forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  --broadcast \
  --verify \
  --etherscan-api-key "$BASESCAN_API_KEY"
```

The script prints the chain id, the USDC address it selected, and the deployed
address. It reverts before broadcasting if the USDC address has no code.

If verification does not go through on the first attempt:

```bash
forge verify-contract <TOOLSHED_ADDRESS> src/Toolshed.sol:Toolshed \
  --chain base \
  --constructor-args $(cast abi-encode "constructor(address)" 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) \
  --etherscan-api-key "$BASESCAN_API_KEY" \
  --watch
```

### 4. Contract ownership

**There is nothing to transfer.** Toolshed has no `owner`, no admin role, no
pause, no upgrade proxy and no protocol fee. The deploying key holds zero
privileges over the contract once the transaction lands, so there is no
multisig handover step and no key for the association to lose or leak.

The association's real administrative surface is the *web app*: who is an
approved member, which listings are visible. That is controlled by
`TOOLSHED_ADMIN_ADDRESSES` and can be changed by editing an environment
variable. Put more than one address in it so a single committee member going on
holiday does not block new signups.

### 5. Point the app at the deployment

```bash
# web/.env.local
NEXT_PUBLIC_CHAIN=base
NEXT_PUBLIC_RPC_URL=https://…                   # a real RPC, not the public one
NEXT_PUBLIC_TOOLSHED_ADDRESS=0x…                # from the deploy output
TOOLSHED_DEPLOY_BLOCK=…                         # block of the deploy tx
TOOLSHED_DB_PATH=/var/lib/toolshed/toolshed.db
TOOLSHED_UPLOAD_DIR=/var/lib/toolshed/uploads
TOOLSHED_ADMIN_ADDRESSES=0x…,0x…
TOOLSHED_OPEN_SIGNUP=0
```

`TOOLSHED_DEPLOY_BLOCK` matters: leave it at 0 and the indexer scans the chain
from genesis on first run.

```bash
cd web
npm run abi      # regenerate the ABI from the Foundry artifact
npm run build
npm run start    # process 1
npm run indexer  # process 2
```

Run both under a supervisor (systemd, pm2, Docker Compose — anything that
restarts them). The indexer is safe to restart at any point: it resumes from
its last confirmed block, and reindexing a range is idempotent.

**Hosting note:** the default setup writes the SQLite file and the uploaded
photos to local disk, so it wants a box or a container with a persistent volume
— a $5 VPS is ample for 300 members. On a platform with an ephemeral filesystem
(Vercel, Fly without a volume), swap `src/app/api/upload/route.ts` for an
S3/R2 presigned upload and point `TOOLSHED_DB_PATH` at a hosted Postgres via a
different driver. Nothing else in the app cares.

---

## Post-deploy verification

Run this against the live deployment before telling the association it works.
It is one real loan, start to finish, for about a cent.

```bash
export SHED=0x…                                              # your deployment
export USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export OWNER_KEY=…   OWNER=0x…                               # two wallets you control
export BORROWER_KEY=… BORROWER=0x…

# 0. The contract is pointed at real USDC
cast call $SHED "usdc()(address)" --rpc-url $BASE_RPC_URL
cast call $USDC "symbol()(string)" --rpc-url $BASE_RPC_URL    # -> "USDC"

# 1. Borrower escrows a $1 deposit with a $1/day late fee, for 1 day
cast send $USDC "approve(address,uint256)" $SHED 1000000 \
  --rpc-url $BASE_RPC_URL --private-key $BORROWER_KEY

cast send $SHED "request(address,bytes32,uint96,uint96,uint32)" \
  $OWNER $(cast keccak "smoke-test") 1000000 1000000 1 \
  --rpc-url $BASE_RPC_URL --private-key $BORROWER_KEY

# 2. Escrow is actually holding the money
cast call $USDC "balanceOf(address)(uint256)" $SHED --rpc-url $BASE_RPC_URL   # -> 1000000

# 3. Owner approves; note the loan id from the logs (1 for the first ever loan)
cast send $SHED "approve(uint256)" 1 --rpc-url $BASE_RPC_URL --private-key $OWNER_KEY
cast call $SHED "getLoan(uint256)" 1 --rpc-url $BASE_RPC_URL

# 4. Owner confirms the return immediately — on time, so nothing is charged
cast send $SHED "confirmReturn(uint256)" 1 --rpc-url $BASE_RPC_URL --private-key $OWNER_KEY

# 5. The borrower got the whole dollar back and escrow is empty
cast call $USDC "balanceOf(address)(uint256)" $SHED --rpc-url $BASE_RPC_URL   # -> 0
```

Then confirm the offchain half caught up: the loan should appear under **My
loans** for both wallets within a few seconds of the indexer polling, marked
*Returned on time*, and both members' counts should go up by one on
**Neighbors**. If it does not, check the indexer logs and that
`TOOLSHED_DEPLOY_BLOCK` is not later than the deploy block.

---

## Operating it

**Onboarding a member.** They connect a wallet and submit a display name, which
creates an unapproved row. An address in `TOOLSHED_ADMIN_ADDRESSES` then
approves them:

```bash
PATCH /api/members/0x…   { approved: true, …signature fields }
```

Approval gates the *app* only. The contract is permissionless by design — it
holds nothing but the two parties' own money, so there is nothing to protect by
gating it, and gating it would mean an admin key that can freeze deposits.

**Someone lost their wallet.** Their track record is attached to the address
and does not move. Approve the new address, and have the association note the
link in the member's bio. Making records transferable would mean making them
forgeable.

**Backups.** Back up the SQLite file and the uploads directory. The `loans`
table does not strictly need backing up — it rebuilds from the chain — but
members, listings and photos exist nowhere else.

**Changing the ranking.** Edit `scoreFor()` in `web/src/core/reputation.ts` and
restart. No migration, no redeploy, no onchain anything.

---

## Security notes

- **No admin keys.** No owner, pause, upgrade path, or protocol fee. The
  deployer cannot touch a deposit.
- **Reentrancy.** All fund-moving functions are `nonReentrant` and follow
  checks-effects-interactions — status is written to `Settled` before any
  transfer. USDC has no transfer callback, so this is belt and braces.
- **Frozen accounts.** Real USDC can blacklist an address. If a payout transfer
  fails, `_pay` credits the amount to `owed[account]` instead of reverting, and
  the recipient claims it later with `withdraw()`. Without this, one frozen
  party could trap the *other* party's money in escrow permanently. Covered by
  `test_blockedRefund_isCreditedNotReverted`.
- **Deposit conservation** is fuzz-tested: every settlement pays out exactly
  the deposit, never more, never less, and always drains the escrow
  (`testFuzz_splitConservesDeposit`).
- **Signed writes.** Every mutating API call carries a wallet signature over a
  canonical message including a single-use nonce and a timestamp, rejected
  after 5 minutes of drift. Verification goes through the RPC so EIP-1271
  smart-contract wallets work. Nonces are burned via a unique constraint, so
  concurrent replays lose the race rather than both succeeding.
- **Uploads** are capped at 6 MB, restricted to JPEG/PNG/WebP by content type,
  and always renamed server-side — the client-supplied filename is never used
  as a path.
- **Not audited.** This is a first version handling small deposits among
  neighbors. Have someone who did not write it read `Toolshed.sol` before the
  association puts real money through it; it is a few hundred lines and an
  afternoon's work to review.

### Known trust assumptions

Worth being straight with the association about, because no contract fixes
these:

- **Nothing verifies the tool physically changed hands.** `approve()` means "I
  gave it to them" and `confirmReturn()` means "I got it back". The escrow makes
  the *money* trustless; the neighbors still have to be neighbors.
- **An owner can object once to a truthful return claim**, which costs the
  borrower up to three more days of late fees before their second assertion
  settles. That is the price of not having an arbiter. It is bounded, it is
  visible in the loan history, and in a 300-person association doing it twice
  is a social problem rather than a technical one.
- **Condition disputes are out of scope.** If a drill comes back working but
  scratched, that is a conversation, not a contract call. The condition notes
  field exists to make that conversation shorter.

---

## What is deliberately not here

Things that were considered and left out of the first version, so the next
person does not assume they were forgotten:

- **A reputation score in contract storage.** Ranking is derived data; keeping
  it onchain would cost gas on every settlement and freeze the formula.
- **A governance token, or any token.** There is no protocol to govern.
- **A factory contract.** One escrow with a mapping handles every loan.
- **Onchain membership gating.** Would mean an admin key with power over
  deposits, in exchange for nothing the app's own gate does not already give.
- **Notifications.** The association has a WhatsApp group. Email/push is a
  reasonable second version; `LoanSettled` and the due dates in the `loans`
  table are the hooks.
- **Multi-tool or recurring loans.** One tool, one loan, one deposit.
