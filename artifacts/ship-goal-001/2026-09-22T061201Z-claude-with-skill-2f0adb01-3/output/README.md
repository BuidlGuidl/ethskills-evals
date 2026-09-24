# Toolshed

A lending library for a neighbourhood association of ~300 members. Members list tools they own;
other members borrow them for a few days against a **USDC deposit** held in escrow. Return it on
time and the whole deposit comes back. Return it late and a **daily late fee** comes out of the
deposit and goes to the owner. Every closed loan updates the borrower's **track record** — how
many loans, how many late returns — and the app sorts by that, so the neighbours who bring things
back get lent to first.

- **Contract:** one Solidity file, `packages/contracts/src/Toolshed.sol`
- **App:** Next.js 15 + wagmi, `packages/app`
- **Chain:** Base (USDC is native there, and Coinbase Smart Wallet means members can sign up with
  a passkey instead of learning what a seed phrase is)

---

## Contents

- [How it works](#how-it-works)
- [Architecture](#architecture)
  - [What is onchain, and what isn't](#what-is-onchain-and-what-isnt)
  - [The loan state machine](#the-loan-state-machine)
  - [Late fees](#late-fees)
  - [Who calls what, and why](#who-calls-what-and-why)
  - [Track records and sorting](#track-records-and-sorting)
  - [Photos and condition notes](#photos-and-condition-notes)
  - [Why there's no subgraph](#why-theres-no-subgraph)
  - [Trust model](#trust-model)
  - [Security review](#security-review)
- [Repository layout](#repository-layout)
- [Get it running locally](#get-it-running-locally)
- [Deploy it](#deploy-it)
- [Running the association](#running-the-association)
- [Tests](#tests)
- [Design decisions and limits](#design-decisions-and-limits)

---

## How it works

1. The **steward** (whoever runs the association) admits members by address. Only members can list
   or borrow.
2. Ana lists her drill: a photo, condition notes, a 40 USDC deposit, a 3 USDC/day late fee, and a
   maximum loan of 7 days.
3. Ben asks to borrow it for 3 days. His 40 USDC moves into the contract right then — a request
   with no money behind it isn't a request. He can withdraw it any time before Ana approves.
4. Ana approves when she physically hands the drill over — within a week, or the request goes
   stale and anyone can push the deposit back. The clock starts **at approval**, not at the
   request, so a slow reply never eats the borrower's days.
5. Ben brings it back. He taps "I've returned it", Ana taps "Confirm return", and his 40 USDC goes
   home. Ana's screen shows Ben's record updated: 3 loans, 0 late.
6. If Ben is two days late instead, the contract pays Ana 6 USDC out of the deposit and refunds Ben
   34 USDC. Ben's record gains a late return, and he sinks down Ana's request queue next time.

---

## Architecture

```text
  ┌────────────────────────────┐     reads (viem/wagmi)      ┌──────────────────────────┐
  │  Next.js app (packages/app)│ ──────────────────────────► │  Toolshed.sol  (Base)    │
  │                            │     writes (wallet tx)      │                          │
  │  browse · borrow · lend    │ ◄────────────────────────── │  · membership roster     │
  │  steward                   │                             │  · tools + terms         │
  └──────────┬─────────────────┘                             │  · loans + USDC escrow   │
             │                                               │  · track-record counters │
             │ pin photo + notes                             └───────────┬──────────────┘
             ▼                                                          │ transferFrom / transfer
  ┌────────────────────────────┐                              ┌─────────▼──────────────┐
  │  IPFS (Pinata)             │ ◄── metadataURI stored ─────  │  USDC (ERC-20)         │
  │  { name, condition, image }│     onchain as a string       └────────────────────────┘
  └────────────────────────────┘
```

One contract. No factory, no proxy, no router. A tool library is a single shared ledger, not a
protocol other contracts need to compose with, so the simplest thing that can hold money honestly
is the right thing.

### What is onchain, and what isn't

| Onchain | Why |
| --- | --- |
| USDC deposits in escrow | This is the whole point: neither neighbour has to trust the other with the money |
| Loan terms, due date, status | The commitment both sides are held to |
| The late-fee split | Must execute without anyone's cooperation or goodwill |
| Track-record counters (loans taken, late returns, tools never returned, loans handed out) | Cheap (four `uint32`s) and worthless if it can be edited — a reputation you can rewrite is not a reputation |
| Membership roster | Gates who can hold escrow at all |
| Tool terms: deposit, daily fee, max days | They price the money, so they have to be as tamper-proof as the money |

| Offchain | Why |
| --- | --- |
| Photos, names, condition notes | Bytes are expensive and this is not value transfer. IPFS, referenced by one URI |
| Reputation *scoring* and browse ordering | A product decision we want to tune without touching escrow. `packages/app/src/lib/reputation.ts` |
| Search, filters, sorting | Ordinary UI work |
| Who is behind an address | The association already knows its neighbours; putting names onchain would publish them forever |

### The loan state machine

```text
                       requestLoan (deposit escrowed)
                                  │
                                  ▼
                            ┌───────────┐  withdrawRequest (borrower) ───► Withdrawn ─┐
                            │ Requested │  declineRequest  (owner)    ───► Declined  ─┤ full
                            └─────┬─────┘  expireRequest   (anyone,   ───► Expired   ─┤ refund
                                  │          after 7 days)                            │
                    approveRequest (owner, within 7 days; clock starts)                │
                                  ▼                                                   │
                            ┌───────────┐  confirmReturn (owner) ──────────────┐       │
                            │  Active   │  claimUnreturned (owner, once the    │       │
                            └─────┬─────┘    deposit is consumed or 30 days    │       │
                                  │           overdue)                      ───┤       │
                    reportReturn (borrower — stops the fee clock)               │      │
                                  ▼                                            ▼      ▼
                         ┌────────────────┐  confirmReturn (owner)       ┌────────────────┐
                         │ ReturnPending  │  settleUnconfirmed (borrower,│    Settled     │
                         └───────┬────────┘   after 3 days)              └────────────────┘
                                 │                                            ▲   ▲
                    disputeReturn (owner: "it is not back")                    │   │
                                 ▼                                            │   │
                          ┌────────────┐  confirmReturn / claimUnreturned ─────┘   │
                          │  Disputed  │  (fees resume from the due date)          │
                          └────────────┘                                           │
                                                                                   │
        resolveLoan (steward, from Active / ReturnPending / Disputed) ──────────────┘
```

Four properties hold on every path:

- **A deposit can never be stuck.** Each open state has a party who can close it and a reason to
  bother, plus a fallback for when they don't: a stale request can be expired by anyone, an
  unconfirmed return by the borrower, an abandoned tool by the owner, and anything else by the
  steward. Payouts that the token itself refuses (USDC can freeze an address) are credited for
  later withdrawal rather than reverting the settlement.
- **A borrower's worst case is exactly the deposit.** Late fees are capped at the deposit, so
  nothing else of theirs is ever at risk.
- **Neither side can end a loan on their word alone.** The borrower reporting a return stops the
  fee clock but doesn't release the money; the owner can dispute it, which restarts the clock.
- **A settled loan cannot settle again.** Status is checked and written before any transfer.

### Late fees

```text
lateDays = ceil((returnTime - dueAt) / 1 day)        // 25 hours late is 2 days
fee      = min(lateDays × dailyLateFee, deposit)     // capped, always
refund   = deposit - fee
```

`returnTime` is the moment the *borrower* reported the return, if they did and the owner did not
dispute it. That detail is what makes the mechanism fair in both directions:

- An owner who sits on their phone for a week can't inflate the fee — the clock stopped when the
  borrower reported.
- A borrower can't stop the clock by lying. Reporting a return doesn't release the money; the owner
  still confirms, and if the tool isn't actually back they call `disputeReturn`, which resumes fees
  from the original due date and takes the borrower's self-settle option away. If the owner simply
  never answers, the borrower closes the loan themselves after three days (`CONFIRM_WINDOW`) — at
  the fee owed on the reported date, not a day more.
- If a tool genuinely never comes back, the owner calls `claimUnreturned` and takes the whole
  deposit — once fees have consumed it, or once the loan is 30 days overdue (`MAX_OVERDUE`),
  whichever comes first. That second condition matters for a 1 USDC/day fee against a 500 USDC
  deposit. The loan is recorded against the borrower as an unreturned tool, which the app treats as
  much worse than lateness.

Partial days round up on purpose. "Back by Tuesday" means Tuesday, and a fee that only bites after
a full extra 24 hours teaches the wrong lesson to a shed where things come back late a lot.

The one asymmetry worth stating plainly: **`reportReturn` is not optional.** It is how a borrower
stops the clock. A borrower who hands the tool back and never taps it is relying on the owner to
confirm promptly; an owner who instead waits can charge fees for days the tool was actually sitting
in their own shed. No contract can tell those apart — nothing onchain sees a drill change hands —
so the app puts that button in front of the borrower on every active loan and says what it does,
and a neighbour who gets burned anyway has the steward.

### Who calls what, and why

Nothing onchain happens on its own. Every function has a caller with a reason:

| Function | Who | Why they bother | If nobody calls it |
| --- | --- | --- | --- |
| `requestLoan` | borrower | Wants the tool | No loan; no money moved |
| `withdrawRequest` | borrower | Wants their deposit back | Their own USDC stays escrowed — their call |
| `approveRequest` / `declineRequest` | tool owner | Hands the tool over, or frees the borrower's deposit | Request sits; borrower withdraws whenever they like |
| `reportReturn` | borrower | Freezes the late-fee clock in their favour | Fees keep accruing until the owner confirms |
| `confirmReturn` | tool owner | Collects any late fee owed to them | Borrower closes it after the confirm window |
| `settleUnconfirmed` | borrower | Gets their refund without the owner | Only reachable if the owner is absent |
| `claimUnreturned` | tool owner | Takes the forfeited deposit for a lost tool | Loan stays open; deposit is already fully forfeit |
| `disputeReturn` | tool owner | Stops a borrower closing a loan on a return that didn't happen | The borrower's report stands after the confirm window |
| `expireRequest` | anyone | Frees a deposit from a request nobody answered (a neighbour, the borrower, or a script) | The borrower can still withdraw it themselves at any time |
| `withdrawCredits` | either party | Collects a payout the token refused to accept | Their credit sits there until they do |
| `admitMember` / `suspendMember` | steward | Runs the roster | No new members |
| `resolveLoan` | steward | Settles a dispute the contract can't judge | The normal paths still work |
| `setPaused` | steward | Emergency stop | Nothing changes |
| `sweepStrayTokens` / `setMaxDeposit` | steward | Recovers tokens sent here by mistake; adjusts the deposit ceiling | Nothing changes; both are on the steward screen under "Housekeeping" |

Note the asymmetry that keeps the system honest: the person who *gains* from a state transition is
the person who pays the gas for it.

### Track records and sorting

The contract counts four things per member and nothing more:

```solidity
struct Member { bool active; uint64 joinedAt; uint32 loansTaken; uint32 lateReturns; uint32 unreturned; uint32 loansGiven; }
```

Turning counts into an ordering is a product question, so it lives in the frontend
(`src/lib/reputation.ts`, unit-tested in `reputation.test.ts`):

```text
score = (onTimeReturns + 1) / (loans + 2)  −  0.25 × unreturned
```

The `+1 / +2` is a Laplace prior — one imaginary good loan and one imaginary bad one. It does two
things a raw percentage can't:

- A member with one perfect loan doesn't outrank a member with twenty (1/1 scores 0.67; 20/20
  scores 0.95).
- A brand-new member lands mid-table (0.50) rather than at the bottom. Nobody can build a record
  without being lent to once, and this is a neighbourhood, not a credit bureau.

A tool that never came back costs a flat 0.25, not a share of an average, so losing one drops a
member below a neighbour with no history at all — which is the point.

The *label* next to the score is computed from what the member has actually done, not from the
smoothed score, so nobody is called "sometimes late" who has never been late: one clean loan reads
"Nothing late yet", three or more read "Reliable", and a member who has only ever lent reads
"Active lender".

Two screens sort by it:

- **The owner's request queue** (`/lend`) — most reliable borrower first. This is the screen that
  makes "reliable people get lent to first" literally true: when two neighbours want the same drill,
  the one who brings things back is at the top of Ana's list.
- **Browse** (`/`) — tools whose owners have a good standing first, with a small bonus for members
  who have actually lent things out (an owner with 12 loans handed out and no borrowing history
  reads as "Active lender", not "New member"). Members can re-sort by newest or smallest deposit.

Changing the formula is a frontend deploy. The counts it reads are permanent.

### Photos and condition notes

`Tool.metadataURI` holds one string. The app reads three shapes:

- `ipfs://<cid>` — the normal case. `POST /api/upload` pins the photo and then the JSON
  (`{ name, condition, image }`) through Pinata using a server-side `PINATA_JWT`.
- `https://…` — any hosted JSON, if you'd rather host it yourself.
- `data:application/json;utf8,{…}` — the fallback when no `PINATA_JWT` is configured, so a developer
  can run the whole app with no third-party account. Fine for local work; **not** for production —
  the JSON then lives in contract storage, which costs gas to write and can't be edited cheaply.

Unreachable metadata never breaks a screen: the card falls back to "Tool #7".

### Why there's no subgraph

For ~300 members and a few hundred tools, the contract keeps the three reverse indexes the UI needs
(`toolsOfOwner`, `loansOfBorrower`, `loansOfTool`) and batch getters (`getTools`, `getMembers`,
`getLoans`). The browse screen is three `eth_call`s. That removes an entire piece of infrastructure —
no indexer to deploy, monitor, or fall behind head.

The one exception is the steward's roster screen, which rebuilds the member list from
`MemberAdmitted` logs (set `NEXT_PUBLIC_DEPLOY_BLOCK` so it doesn't scan from genesis). An
append-only member array would have been paid for by every member who joins, to serve one admin
screen.

If this ever grows past a few thousand tools, `getTools` is where it breaks first — that's the point
to add The Graph and leave the contract alone.

### Trust model

What the **steward** can do:

- Admit and suspend members.
- Split a *disputed loan's own deposit* between that loan's borrower and that tool's owner
  (`resolveLoan`), capped at the deposit, and mark or forgive a late return.
- Pause new listings, requests and approvals.

What the steward **cannot** do:

- Take custody of any deposit. The only addresses a settlement can pay are that loan's borrower and
  that tool's owner — there is no path from escrow to the steward, and a test asserts it.
- Adjudicate a loan they are a party to. A steward who lists their own tool is a neighbour like any
  other for that loan: `resolveLoan` reverts with `StewardIsAParty`, so they have to use the same
  `confirmReturn` path as everyone else.
- Walk away. `renounceOwnership` is disabled, because an ownerless Toolshed would have no way to
  resolve a dispute, reinstate a member or unpause. Hand the role over with `transferOwnership`
  (two-step, so a typo cannot orphan it).
- Block a return, a refund, or a dispute resolution. `setPaused` deliberately does not gate any
  settlement path, so a pause can never trap money.
- Change a loan's terms, or edit anyone's track record.

Deploy with a Gnosis Safe as steward. Ownership transfer uses OpenZeppelin `Ownable2Step`, so a
fat-fingered handover can't orphan the role.

What members trust each other for: that the tool physically changed hands, and that it came back in
one piece. No contract can verify that. What it can do — and does — is make the money mechanical and
the history permanent, so being unreliable has a visible cost.

### Security review

The contract was audited in a fresh context by a reviewer that had not written it, against the
[ethskills audit checklist](https://ethskills.com/audit/SKILL.md), with each finding reproduced as
a Foundry proof-of-concept. Everything it found is either fixed or listed below as accepted, and
every fix has a regression test named after the scenario:

| Finding | Fix |
| --- | --- |
| A borrower could report a return they never made: that froze fees at zero *and* locked the owner out of `claimUnreturned` (which required `Active`), so after the confirm window they kept the tool and the whole deposit | Added the `Disputed` state and `disputeReturn`. Fees resume from the due date, the borrower can no longer self-settle, and the owner can still write the tool off. `test_falseReturnReportIsDisputable` |
| A stale request could be approved months later, starting a clock on a tool never handed over | `REQUEST_TTL` (7 days) on `approveRequest`, plus `expireRequest`, callable by anyone, to refund a request nobody answered. `test_staleRequestExpiresAndRefunds` |
| A frozen USDC address (the real token has a deny list) made settlement revert, pinning the *other* party's money and the tool with it — and a frozen borrower's pending request had no escape path at all | Payouts are push-with-credit-fallback (`_pay` → `credits` → `withdrawCredits`). A frozen neighbour now only blocks their own money. `test/ToolshedFrozenPayee.t.sol` |
| `dailyLateFee = 0` was legal and made `claimUnreturned` mathematically unreachable, pinning tool and deposit forever | Zero daily fee rejected, and a tool is writable-off after `MAX_OVERDUE` (30 days) regardless of accrued fee. `test_zeroDailyLateFeeIsRejected`, `test_writeOffPossibleAfterMaxOverdueEvenWithATinyFee` |
| The steward could admit themselves, list a tool, and award themselves the deposit via `resolveLoan` — contradicting the stated trust model | `StewardIsAParty` check on both the tool owner and the borrower. `test_stewardCannotAdjudicateTheirOwnLoan` |
| A suspended member could still approve requests on their own tools and take new deposits | `approveRequest` is `onlyMember`, and `requestLoan` rejects tools whose owner is inactive. `test_suspendedOwnerCannotStartNewLoans` |
| `resolveLoan` fabricated `lateDays = 1` and could never record an unreturned tool | `countLate` and `markUnreturned` are now explicit parameters; recorded day counts are the real ones. `test_stewardCanRecordAnUnreturnedToolWhenResolving` |
| `renounceOwnership` could strand the association with no steward | Overridden to revert. `test_renouncingOwnershipIsDisabled` |
| `getTools(1, type(uint64).max)` reverted on overflow instead of clamping | Paging arithmetic in `uint256`. `test_getToolsClampsInsteadOfReverting` |
| Tokens sent to the contract by mistake were unrecoverable | `sweepStrayTokens` pays out only `balance − totalEscrowed − totalCredited`. `test_strayTokensAreRecoverableButEscrowIsNot` |
| `memberCount` meant "ever admitted" | Decremented on suspension. `test_memberCountTracksActiveMembers` |

Confirmed clean by the same review: reentrancy (CEI plus `nonReentrant` on every token-moving
entry point, and an immutable token so no attacker-chosen callback), double settlement, escrow
conservation, the `uint96`/`uint64`/`uint32` packing, and the ceiling-division fee maths.

Accepted, and documented rather than fixed:

- **The owner-stall asymmetry** described under [Late fees](#late-fees) — an owner can charge fees
  for days a tool was actually back if the borrower never taps "I've returned it". Unfixable
  onchain; mitigated by the UI and the steward.
- **Unbounded per-member arrays** (`loansOfBorrower`, `loansOfTool`) are returned whole. Fine for a
  neighbourhood; see [Why there's no subgraph](#why-theres-no-subgraph) for where that breaks.
- **`slither`** reports only `timestamp`, `divide-before-multiply` (the deliberate ceiling of whole
  late days), `low-level-calls` (the credit fallback) and `reentrancy-benign`/`reentrancy-no-eth` on
  the token transfers, which are the intended shape of the code. No high or medium findings.

Run it yourself: `cd packages/contracts && slither . --filter-paths "lib|test|script"`.

---

## Repository layout

```text
packages/contracts/           Foundry project
  src/Toolshed.sol            the contract (~800 lines, one file)
  test/Toolshed.t.sol         53 tests: unit, state-machine, adversarial, fuzz invariants
  test/ToolshedFrozenPayee.t.sol  what happens when USDC freezes one party
  test/mocks/MockUSDC.sol     6-decimal USDC stand-in
  test/mocks/BlockableUSDC.sol    USDC stand-in with a deny list
  script/Deploy.s.sol         deployment, any chain
  script/SeedLocal.s.sol      local demo data: members, tools, finished loans
  script/seed-local.sh        runs the seed and jumps the chain clock

packages/app/                 Next.js 15 (App Router) + wagmi v2 + viem + Tailwind 4
  src/app/page.tsx            browse the shed
  src/app/borrow/page.tsx     my loans: requests, active, history
  src/app/lend/page.tsx       my tools: request queue, loans out, list a tool
  src/app/steward/page.tsx    roster, admissions, dispute resolution, pause, housekeeping
  src/app/api/upload/route.ts pin photo + notes to IPFS
  src/lib/reputation.ts       track-record scoring, tiers and ordering (+ tests)
  src/lib/format.ts           USDC (6dp) and late-day maths (+ tests)
  src/lib/errors.ts           the contract's custom errors, in plain sentences
  src/lib/abi.ts              generated — `npm run sync-abi`
  src/hooks/                  batched contract reads
  src/components/             cards, loan rows, the simulate-then-write transaction button
```

`packages/contracts/lib/` (Foundry dependencies) and `packages/contracts/out/`,
`packages/app/.next/` (build output) are generated — nothing hand-written lives there.

---

## Get it running locally

Prerequisites: **Node 20+** and **Foundry** (`curl -L https://foundry.paradigm.xyz | bash && foundryup`).

```bash
# 1. Contracts: build and test
cd packages/contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.1.0   # fresh clone only
forge test

# 2. Local chain, in its own terminal
anvil

# 3. Deploy to it. With no ESCROW_TOKEN set, this also deploys a mock 6-decimal USDC
#    and funds the deployer. It prints the env lines you need next.
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# 4. Seed a believable neighbourhood: 4 members, 5 tools, finished loans (one late,
#    so the browse screen has real track records to sort). Uses anvil's default accounts.
TOOLSHED=<printed> USDC=<printed> ./script/seed-local.sh

# 5. The app
cd ../app
npm install
cp .env.example .env.local     # then paste in the addresses from step 3 and set CHAIN_ID=31337
npm run sync-abi               # only after changing the contract
npm run dev                    # http://localhost:3000
```

The root `package.json` wraps the common commands if you would rather not `cd`: `npm test` (both
suites), `npm run test:contracts`, `npm run test:app`, `npm run typecheck`, `npm run build`,
`npm run dev`, `npm run sync-abi`, `npm run install:app`.

`.env.local` for local work:

```text
NEXT_PUBLIC_TOOLSHED_ADDRESS=0x…     # from step 3
NEXT_PUBLIC_USDC_ADDRESS=0x…         # the mock, from step 3
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

Import an anvil private key into your wallet and add the local network (chain id 31337). The seed
script hardcodes tool ids 1–5, so run it once per fresh deployment; running it twice against the
same contract acts on the wrong tools. It gives you:

| Account | Role in the seed data |
| --- | --- |
| anvil #0 | steward — see the `/steward` screen |
| anvil #1 (Ana) | owns the drill, ladder, wheelbarrow; has lent three times |
| anvil #2 (Ben) | owns the saw and pressure washer; 2 loans, never late; has a request waiting |
| anvil #3 (Cyd) | 1 loan, returned late — watch her sink below a no-history neighbour in Ben's request queue |

---

## Deploy it

### 1. Contract

Base mainnet USDC is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (verify it on
[BaseScan](https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913) before you send
anything). Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

```bash
cd packages/contracts

export PRIVATE_KEY=0x…                # deployer; pays gas only
export ESCROW_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export STEWARD=0x…                    # the association's Gnosis Safe
export MAX_DEPOSIT=2000000000         # ceiling on any tool's deposit: 2000 USDC (6dp)
export BASE_RPC_URL=https://mainnet.base.org
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org   # only needed for the rehearsal below
export ETHERSCAN_API_KEY=…            # for --verify

forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
```

Deployment costs roughly 0.003–0.01 USD of gas on Base. Rehearse on Base Sepolia first
(`--rpc-url base_sepolia`, faucet at [docs.base.org](https://docs.base.org/tools/network-faucets)).

Post-deploy checks, in this order:

```bash
export SHED=0x…   # the deployed address
cast call $SHED "escrowToken()(address)" --rpc-url base    # your USDC, not the mock
cast call $SHED "owner()(address)"       --rpc-url base    # the Safe
cast call $SHED "maxDeposit()(uint96)"   --rpc-url base
cast call $SHED "paused()(bool)"         --rpc-url base    # false
```

Then run one real loan end to end with two throwaway wallets and a 1 USDC deposit before you tell
300 neighbours about it. Note the deployment block number — the app wants it as
`NEXT_PUBLIC_DEPLOY_BLOCK`.

The contract is not upgradeable, on purpose: an upgradeable escrow is an escrow whose rules can
change while your money is inside it. Fixing a bug means deploying a new Toolshed and letting open
loans finish on the old one; both can run at once, since the track records that matter live per
contract.

### 2. Frontend

Any Next.js host. Vercel:

```bash
cd packages/app
npx vercel --prod
```

Environment variables (see `.env.example` for the annotated list):

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_TOOLSHED_ADDRESS` | yes | the deployed contract |
| `NEXT_PUBLIC_USDC_ADDRESS` | yes | USDC on the same chain |
| `NEXT_PUBLIC_CHAIN_ID` | yes | `8453` Base, `84532` Base Sepolia, `31337` anvil |
| `NEXT_PUBLIC_RPC_URL` | recommended | your own RPC; the public one is rate-limited |
| `NEXT_PUBLIC_DEPLOY_BLOCK` | recommended | so the roster screen doesn't scan from genesis |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | for mobile | without it the WalletConnect connector is not registered at all, so phone wallets can't connect; get one at [cloud.reown.com](https://cloud.reown.com) |
| `NEXT_PUBLIC_SITE_URL` | recommended | absolute base for Open Graph links shared in the group chat |
| `PINATA_JWT` | production | server-side only; without it, listings fall back to inline metadata |
| `NEXT_PUBLIC_IPFS_GATEWAY` | optional | defaults to `https://ipfs.io/ipfs/` |

The app is a static-ish Next build plus one API route (`/api/upload`) that needs a Node runtime —
that route is the only reason not to export it as pure static files. If you want IPFS hosting for
the frontend too, drop the upload route, pin listings by hand, and `next build` with
`output: "export"`.

---

## Running the association

Day one, as the steward:

1. Collect member addresses (a form, or a laptop at the AGM). Paste them into `/steward` →
   **Admit members** — they go in one transaction.
2. Agree deposit norms out loud before anyone lists anything. The contract only enforces
   `maxDeposit`; "a deposit is roughly what it would cost to replace it" is a social rule, and it's
   the one that decides whether people actually lend.
3. Tell members they need USDC on Base to borrow. Coinbase and most exchanges withdraw to Base
   directly; the app's connect flow offers Coinbase Smart Wallet, which needs no extension.
4. When something goes wrong that the contract can't see — a tool came back broken, a return is
   disputed, an agreed-in-person extension — settle it in `/steward` → **Resolve a dispute**. Every
   resolution is a public transaction with a visible split. Use it rarely and explain it in the
   group chat; the deposits are the mechanism, the steward is the exception.

Suspending a member stops them listing or borrowing. It deliberately doesn't touch their open loans:
those still settle and refund normally.

---

## Tests

```bash
cd packages/contracts && forge test -vv      # 58 tests, incl. 2 fuzz invariants
cd packages/app        && npm test           # 14 tests: scoring, labels, USDC/late-day maths
cd packages/app        && npm run typecheck && npm run lint && npm run build
```

What the contract suite pins down:

- **Money conservation (fuzzed, 512 runs):** for any deposit, daily fee, loan length and delay,
  `feeToOwner + refundToBorrower == deposit`, the contract's balance ends at zero, and the fee is
  exactly `min(ceil(daysLate) × dailyFee, deposit)`.
- **Escrow matches open deposits (fuzzed):** through random sequences of request/withdraw/decline,
  the contract's USDC balance *and* its own `totalEscrowed` counter always equal the sum of the
  deposits it should be holding.
- **The adversarial paths from the audit:** a false return report, a stale request approved late, a
  steward trying to adjudicate their own loan, a zero late fee, a suspended owner still lending, a
  frozen USDC address on either side of a settlement. Each is named after its scenario in
  `test/Toolshed.t.sol` and `test/ToolshedFrozenPayee.t.sol`.
- **Every settlement path:** on time, exactly at the due date, late, capped-out late, owner
  confirms without the borrower reporting, borrower self-settles after the confirm window, tool
  never returned, steward-resolved split, steward-forgiven late return.
- **The awkward cases:** a queue of requests where only one can be approved and the rest stay
  withdrawable; editing a tool not changing an open request's terms; the clock starting at approval
  rather than request; a suspended member's running loan still settling; a pause blocking new
  activity but never a refund; the steward being unable to pay themselves or exceed a deposit; no
  loan settling twice.

The frontend suite pins down the scoring properties described above (a thin perfect record doesn't
beat a long good one; a newcomer isn't ranked below a proven late returner; an unreturned tool
outweighs lateness) and that the app's late-day arithmetic matches the contract's ceiling exactly —
if those two ever disagree, the UI quotes a fee the chain won't charge.

Both the contract and the app were also reviewed by separate agents working in fresh contexts —
a security audit (see [Security review](#security-review)) and a pre-ship QA pass. The QA pass is
why the app now renders a real Connect control instead of prose, switches networks from the button
that needs it, simulates every write before asking for a signature, and turns the contract's 26
custom errors into sentences (`src/lib/errors.ts`) rather than "the contract function reverted".

---

## Design decisions and limits

**Deposit is escrowed at request, not at approval.** A request with money behind it is a real
request, and it protects owners from holding a tool for someone who then vanishes. The cost: a
borrower who asks three neighbours at once locks three deposits. They can withdraw any of them
instantly, and the app shows how much of their USDC is currently in escrow.

**The clock starts at approval.** An owner who takes two days to reply doesn't eat the borrower's
three days. It does mean an approval can land later than the ask; the borrower's protections are
that they can withdraw at any point before it, and that the request dies after a week.

**Requests aren't a real queue.** Several members can have pending requests on the same tool, and
the owner picks one; the others stay withdrawable but aren't auto-refunded, because auto-refunding
would mean iterating an unbounded list inside `approveRequest`. The app makes the withdraw button
obvious. A future version could cap concurrent requests per tool.

**Requests go stale after a week.** `REQUEST_TTL` stops an owner approving a months-old request
and starting a clock on a tool nobody handed over, and `expireRequest` lets anyone push the
deposit back. The borrower can always withdraw earlier.

**A daily late fee of zero is rejected.** It reads like generosity, but it disarms the mechanism —
a tool that never comes back would cost the borrower nothing, and the owner would have no way to
close the loan. Set a token fee and forgive it if you want to be kind.

**Payouts fall back to credits.** USDC can freeze an address, and a push-only escrow would then
revert the whole settlement and pin the innocent party's money too. If a transfer fails, that
party's share becomes a credit they can pull later; nobody else is held up. The app shows a claim
banner when you have one.

**Suspension is a full stop, not a half one.** A suspended member cannot list, borrow, or approve
requests on their own tools, and nobody can start a new loan of a tool they own — otherwise
suspending someone for misconduct would leave them collecting deposits. Loans already running
settle normally.

**No rating of tool condition on return.** The owner's only lever is the fee and, in a genuine
dispute, the steward. Star ratings on a street where everyone knows each other invite drama that
deposits already handle.

**One chain, one contract, no upgrades.** Multi-chain fragments both liquidity and reputation.

**USDC only, and USDC-shaped.** The escrow token is immutable and assumed non-rebasing and
non-fee-on-transfer. Deploy a second Toolshed to change currency.

**Timestamps are block timestamps.** A sequencer can nudge them by seconds; late fees are charged in
days, so it doesn't matter.

**Mobile is connect-and-sign, not deep-linked.** A phone user on WalletConnect has to switch to
their wallet app themselves after tapping a button; the app doesn't foreground it for them. Worth
adding if the association is mostly on phones.

**Two build-time notes.** `npm run build` prints a module-not-found warning for
`@react-native-async-storage/async-storage`, pulled in by MetaMask's SDK inside
`wagmi/connectors` — cosmetic, and safe to ignore. The `@x402/*` packages in `packages/app` are
not imported by any of our code either: they are peer shims that the Coinbase Smart Wallet
connector's dependency tree expects at build time, and dropping them breaks `next build`.

**Addresses are identities.** A member who loses their wallet loses their track record, and nothing
stops a member with a bad record from asking the steward to admit a fresh address. In a 300-person
association where the steward knows everyone, that's a social control, not a technical one — and the
same trade-off any pseudonymous reputation makes. If it becomes a problem, the next step is
attestations tying an address to a verified household, not more contract code.
