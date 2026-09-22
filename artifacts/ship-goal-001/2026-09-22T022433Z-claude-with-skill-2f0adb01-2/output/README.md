# Toolshed

A lending library for a neighborhood association. Members list tools they own — a photo, what it
is, honest condition notes. Another member asks to borrow one for a few days and puts down a deposit
in USDC, which comes back when they return it. Tools come back late a lot, so a daily late fee comes
out of the deposit and goes to the owner. Everyone builds a track record, and the browse screen
ranks by it, so the neighbors who return things on time get lent to first.

![The browse screen](toolshed/docs/browse.png)

The code lives in [`toolshed/`](toolshed) — a Scaffold-ETH 2 monorepo with one Solidity contract and
a Next.js frontend. **Quick start is [below](#running-it-locally); the whole thing is four commands.**

---

## How it works, in plain words

1. **Ana lists her hammer drill.** She sets a $60 deposit, a $2/day late fee, and a maximum loan of
   7 days. The photo and condition notes go to IPFS; the contract stores the link and the terms.
2. **Ben asks to borrow it for 3 days.** His $60 moves into escrow the moment he asks, so when Ana
   says yes she knows the money is really there. Until she says yes, Ben can withdraw the request and
   take every cent back, and Ana can decline and send it back to him.
3. **Ana hands it over** and taps *Hand it over*. The clock starts: due in 3 days.
4. **Ben brings it back.** Ana confirms, and the contract refunds his $60.
   - Two days late? $4 goes to Ana, $56 back to Ben.
   - Ben taps *I've returned it* when he drops it off — that freezes the late-fee clock at that
     moment, even if Ana takes a few days to confirm.
   - Never comes back at all? Ana taps *It hasn't come back*, which puts that on the record where
     Ben can see it. If he still does nothing, once the fees reach the whole deposit anyone can
     close the loan out: Ana keeps the $60 and Ben's record shows a tool that never came back.
5. **The track record updates**: Ben has 1 loan, 1 late return. Ana has 1 loan given. The browse
   screen and Ana's queue of requests both sort on that.

The deposit is the entire exposure. Nobody can ever be charged more than they escrowed, and nobody
can be left unable to get their escrow back — every path out is either something the counterparty
wants to do, or something anyone can do after a timeout.

The rules are also built so that **going quiet is never the winning move**, in either direction.
That turned out to be the hardest part of the design, and it is worth reading the next section for
why.

---

## Architecture

### What is onchain, and what is not

Onchain, in one contract:

- **The money.** Deposits sit in escrow in the contract, and settlement splits them.
- **The loan state machine.** Who has what, when it is due, what has been reported.
- **The track record.** Loans borrowed, late returns, tools never returned, loans given — counters
  the money mechanics produce as a side effect, so they cannot be edited by anyone, including us.
- **The member roll.** ~300 households, as an OpenZeppelin `AccessControl` role.

Offchain:

- **Photos, descriptions, condition notes** — an IPFS JSON blob per tool; the contract stores the
  URI. A contract is not a photo host.
- **Browsing, search, sorting, and the reliability score** — computed in the frontend from onchain
  counters. This is a display ordering, not a rule about anyone's money, so it does not need to cost
  gas, and the association can retune it without a redeploy.
- **Indexing** — there isn't any. At 300 households the whole shed fits in a handful of batched
  `eth_call`s (`getTools`, `getLoans`, `getRecords`), so there is no subgraph to run, break, or pay
  for. If this ever grows past a few thousand loans, the events are all there to index.

### Chain: Base

Base, for three reasons that matter for this specific app: fees are low enough (~$0.002 a
transaction) that a $2 late fee is not swamped by gas; USDC is native there, not a bridged wrapper;
and Coinbase's smart-wallet onboarding is the least painful way to get a neighbor who has never
touched crypto to a working wallet. The contract itself is chain-agnostic — it takes the deposit
token as a constructor argument.

### The contract: `Toolshed.sol`

One contract ([`toolshed/packages/foundry/contracts/Toolshed.sol`](toolshed/packages/foundry/contracts/Toolshed.sol),
~700 lines with comments). `MockUSDC.sol` exists only for local development and the deploy script
refuses to deploy it anywhere but a local chain.

State machine — every transition names a caller who has a reason to pay for it:

```
                     ┌──────────────── cancelRequest (borrower) ──────────────┐
                     │                 declineLoan   (owner)                  │  full refund
 requestLoan ──► Requested ── approveLoan (owner) ──► Active                  ▼
 (borrower,          │                                  │                  Closed
  escrows deposit)   └── never answered? the request    │
                         just expires; the borrower     ├── confirmReturn (owner) ─────────────► Closed
                         can always cancel              │   settles: late fee to owner,
                                                        │   remainder back to borrower
                                                        │
                                                        ├── reportReturn (borrower) ──► ReturnClaimed
                                                        │      (freezes the fee clock)      │
                                                        │                                   ├── confirmReturn (owner) ──► Closed
                                                        │                                   ├── settleUnconfirmed (ANYONE,
                                                        │                                   │     after 7 days) ────────► Closed
                                                        │                                   └── disputeReturn (owner,
                                                        │                                         within 7 days) ─► Disputed
                                                        │                                                             │
                                                        ├── flagMissing (owner, once overdue)                         ├── resolveDispute (steward) ──► Closed
                                                        │      "it hasn't come back", on the record                   └── settleStaleDispute (ANYONE,
                                                        │                                                                   after 14 more days) ──► Closed
                                                        └── claimDefault (ANYONE, once the fees have                        escrow split 50/50
                                                              reached the deposit AND the flag has
                                                              stood unanswered for 7 days) ──► Closed
```

### Why silence doesn't pay

The first version of this contract had a hole that only shows up when you ask what each party's
*best* move is rather than what they're supposed to do.

**An owner could take the deposit by doing nothing.** Confirming a return pays an owner $0. Staying
quiet lets the late fee run to the full deposit — and then anyone, including the owner, could write
the loan off and hand them the lot. An owner who got their drill back on Tuesday was better off
saying nothing until the following month. Three rules close that:

- **Late fees pause after a week unless the owner speaks up.** Fees run for `UNFLAGGED_FEE_GRACE`
  (7 days) on their own. Past that they stop until the owner calls `flagMissing` — an accusation
  with their address on it, visible to the borrower in the app and to the whole association in the
  event log. A tool sitting in the owner's own garage can therefore earn them at most a week of fees.
- **A daily fee is capped at a seventh of the deposit**, so total forfeiture is never less than a
  week away, whatever terms an owner sets.
- **A write-off needs the accusation to have gone unanswered**, for another 7 days, on top of the
  fees having reached the cap.

The borrower's side of that bargain is `reportReturn`, which is available for the entire life of an
active loan, costs one tap, and freezes the fee clock at the moment it is called.

**A borrower could keep the tool by lying.** Reporting a return that never happened takes the loan
out of `Active` — so the write-off path closes — and if the owner misses the dispute window, the
borrower gets everything back. Two rules blunt it: the owner's window to dispute is a **week**, not a
few days, and a dispute the steward never rules on is settled by **splitting the escrow down the
middle** rather than by trusting the borrower's own timestamp. Waiting the steward out costs the
liar half the deposit, so they would rather have a real ruling — which is exactly where a dispute
about a physical fact belongs.

Neither rule is a claim that the contract can tell who is telling the truth. It cannot. What it can
do is make sure that the person who is telling the truth never loses by saying so.

### Other design decisions worth knowing about

- **The deposit is escrowed at request time, not at approval.** An owner deciding whether to lend
  their good drill should not have to find out afterwards that the borrower has no money. The
  request is fully refundable until the owner approves.
- **Terms are snapshotted onto the loan.** An owner editing a listing cannot change the deposit or
  late fee of a loan that is already running.
- **A started day is a charged day.** Returning 25 hours late costs two days. That is how a physical
  lending library charges, and it keeps the arithmetic something a neighbor can check in their head.
- **Late fees are capped at the deposit**, and reaching that cap is what makes a write-off possible.
- **Nobody can strand an escrow.** Every state has an exit that does not depend on a specific person
  choosing to act: the borrower can always cancel a request or report a return, anyone can settle an
  unconfirmed return after 7 days, anyone can write off a flagged default, and anyone can split a
  dispute the steward never ruled on after 14 days.
- **A payout that cannot be delivered becomes a credit, not a failure.** USDC can block an address
  or pause transfers. Paying owner and borrower in one transaction would otherwise mean a single
  blocked counterparty takes down the whole settlement — the other party's refund included — and
  leaves the escrow stuck and the tool marked as on loan forever. Undeliverable payouts land in
  `owed[member]` and are claimable later with `withdraw()`; the app shows them on the dashboard.
- **Deposits have a floor ($1) and requests are limited to one open per tool per borrower.** Both
  exist to make the track record and the request queue expensive to spam.
- **The steward is deliberately weak.** The association's multisig can add and remove members, and
  rule on a loan an owner has *disputed* — splitting that one loan's escrow, capped at that escrow.
  Its ruling cannot contradict itself either: the mark on someone's record is derived from the award
  rather than chosen separately, so "returned on time" can never sit next to a forfeited deposit.
  The steward cannot pause the shed, cannot touch any other deposit, and cannot stop a member from
  getting their money back.
- **There is no `Pausable` and no upgrade proxy.** A single key that can freeze everyone's deposits
  is a bigger risk to this association than any bug it would let us patch; if the rules need to
  change, deploy a new shed and let the old loans settle out.

Roles: `STEWARD_ROLE` (the association multisig) and `MEMBER_ROLE` (one per household). Settlement
functions never check membership, so removing someone from the roll can never trap a live loan.

### The reliability score

The contract stores counts. The ranking is computed in
[`utils/toolshed/reputation.ts`](toolshed/packages/nextjs/utils/toolshed/reputation.ts):

```
score = (on-time loans + 3 × 0.8) / (total loans + 3)     → 0-100
on-time = loans − late returns − 2 × (tools never returned)
```

The raw on-time rate is unusable on its own — someone with one perfect loan would outrank a neighbor
with forty loans and one slip, and a brand-new member would sit at 0% or 100% depending on how you
round. So the rate is smoothed toward a neutral prior (as if everyone already had 3 loans at 80%),
and a tool that never came back counts as three late returns rather than one. New members land in
the middle of the list and move from there. Ties break toward whoever has done more loans.

Someone who has only ever *lent* gets their own "Lends out" tier rather than being labelled new —
they are the people the shed runs on, and burying them under the ranking would be perverse.

All of it is visible on the Neighbors screen with the raw counts next to it, because a ranking
people cannot check is a ranking people will not trust.

### Frontend

Next.js App Router, wagmi/viem, RainbowKit, Tailwind + DaisyUI, on Scaffold-ETH 2.

| Screen | Path | What it does |
|---|---|---|
| Browse | `/` | The shed, ranked by owner track record. Search, availability filter, alternative sorts. |
| Tool | `/tools?id=N` | Photo, condition notes, terms, the borrow form, the owner's request queue (ranked by borrower track record), loan history. |
| Your shed | `/dashboard` | Everything you have out and everything you have lent, with the action each loan is waiting on — and any undeliverable payout waiting to be collected. |
| Lend something | `/list` | List or edit a tool, with the photo upload and a plain-language explanation of the money. |
| Neighbors | `/members` | The directory, with every track-record number behind the ranking. |
| Steward | `/steward` | Member roll and disputed loans. Refuses to render for anyone else. |

![A tool's page](toolshed/docs/tool.png)

Notes:

- Token amounts use `formatUnits(..., 6)` throughout — **USDC has 6 decimals**, and treating it as
  18 is the classic way to move a million times too much money.
- Deposits use a one-button-at-a-time flow: *Connect* → *Switch to Base* → *Approve $60 USDC* →
  *Ask to borrow*. Approvals are **for the exact deposit**, never unlimited — an unlimited approval
  to a lending contract means one undiscovered bug drains every member's wallet.
- Countdowns and running late fees are computed from **the latest block's timestamp**, not the
  browser clock, because that is what the contract charges against.
- Routes are all statically exportable, which is what lets the frontend be published to IPFS.

---

## Repo layout

```
toolshed/
├── packages/foundry/
│   ├── contracts/Toolshed.sol          the whole protocol
│   ├── contracts/mocks/MockUSDC.sol    local development only
│   ├── script/DeployToolshed.s.sol     picks the right USDC per chain
│   ├── scripts-js/seedLocal.js         populates a local shed (`yarn seed`)
│   ├── scripts-js/addMemberLocal.js    adds a local member + test funds (`yarn member`)
│   └── test/Toolshed.t.sol             46 tests, unit + fuzz
└── packages/nextjs/
    ├── app/                            the six screens + /api/pin
    ├── components/toolshed/            cards, badges, the deposit/approve button
    ├── hooks/toolshed/                 batched contract reads
    └── utils/toolshed/                 money formatting, late-fee math, the ranking
```

---

## Running it locally

**You need:** Node ≥ 20.18.3, Yarn, and [Foundry](https://getfoundry.sh)
(`curl -L https://foundry.paradigm.xyz | bash && foundryup`).

Solidity dependencies (OpenZeppelin, forge-std) are vendored under
`toolshed/packages/foundry/lib/` rather than pulled as git submodules, so a fresh checkout builds
with no extra steps — that directory is third-party code only, nothing of ours lives there.

```bash
cd toolshed
yarn install

yarn chain      # terminal 1 — local Anvil node
yarn deploy     # terminal 2 — deploys MockUSDC + Toolshed, writes the ABI into the frontend
yarn seed       # terminal 2 — four tools, four neighbors, one clean loan, one overdue, one request
yarn start      # terminal 3 — http://localhost:3000
```

No API keys, no pinning service, no testnet funds needed: locally the deposit token is a `MockUSDC`
with an open faucet, and seeded listings inline their metadata as `data:` URIs.

On localhost the app connects a burner wallet automatically. To act as one of the seeded neighbors
instead, import an Anvil key into your wallet (`yarn seed` prints the addresses; the keys are
Anvil's well-known development keys). To put the burner wallet itself on the member roll with test
money:

```bash
yarn member 0xYourBurnerAddress   # adds to the roll, sends $2,000 test USDC and gas
```

The seeded steward is Anvil account #9 (`0xa0Ee…9720`) — import that one to see the Steward screen.

### Testing

```bash
cd toolshed/packages/foundry
forge test                 # 46 tests: the whole state machine, access control, edge cases
forge test -vvv            # with traces
FOUNDRY_FUZZ_RUNS=5000 forge test --match-test testFuzz
forge coverage --no-match-coverage "script|mocks"   # ~98% of lines in Toolshed.sol
```

46 tests. The two fuzz properties are the ones worth reading: for any terms and any return time the
escrow is exactly conserved (`fee + refund == deposit`, and the owner never gets more than the
deposit), and a write-off is always reachable in finite time so no loan can hang forever. The rest
cover the state machine, access control, and the specific attacks the design is built against —
`test_ownerCannotTakeTheDepositBySilence`, `test_blockedCounterpartyGetsACreditInsteadOfBreakingSettlement`,
`test_absentSteward_splitsTheEscrowDownTheMiddle`, `test_feeOnTransferTokenIsRejectedAtRequestTime`.

Static analysis:

```bash
pip install slither-analyzer
cd toolshed/packages/foundry && slither . --filter-paths "lib/|test/|script/|mocks/"
```

Nothing actionable remains: no unchecked transfers, no unprotected state-changing functions. What it
does report is day-granularity `block.timestamp` comparisons (a 15-second validator nudge cannot
move a whole late day), an intentional ceiling-then-multiply in the fee calculation, and a
"reentrancy" flag on the credit-on-failure path in `_payOut`, where `owed[to] += amount` is written
after the token call it is compensating for. Every value-moving entry point carries `nonReentrant`,
so re-entering is not possible; the ordering is inherent to try-then-credit.

Both contracts were also reviewed by a separate agent working from the codebase with no knowledge of
how it was written. The findings that survived scrutiny are the ones the design notes above
describe, and each has a regression test.

---

## Deploying

### 1. The steward multisig

Create a [Safe](https://app.safe.global) on Base for the association — the committee, not one
person. This address gets `DEFAULT_ADMIN_ROLE` and `STEWARD_ROLE`. The deploy script refuses to
deploy to a live chain without one.

### 2. Contracts

```bash
cd toolshed/packages/foundry
cp .env.example .env            # then set STEWARD_ADDRESS=0xYourSafe
cd ../..

yarn generate                   # creates an encrypted deployer keystore
yarn account                    # shows the address — send it ~$2 of ETH on Base
yarn deploy --network baseSepolia   # dry run first, with Base Sepolia USDC
yarn deploy --network base          # production
yarn verify --network base          # verify the source on Basescan — do this immediately
```

The deploy script resolves the deposit token automatically: Circle USDC
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` on Base, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
on Base Sepolia (both verified onchain), `MockUSDC` on a local chain, or whatever `USDC_ADDRESS`
says if you set it. Deploying costs roughly $0.05 on Base.

**Never commit `.env`, a private key, or an RPC URL with a key in it.** `.gitignore` already covers
`.env*`; keep it that way.

### 3. The member roll

Open `/steward` connected as the Safe, paste the association's member addresses (one per line) and
submit — one batched transaction, a few cents. The screen asks for batches of 150 or fewer so the
transaction stays comfortably inside a block; 300 households is two pastes. Members can be added and
removed at any time; removing someone never affects a loan already in flight.

To test against real state before going live, run `yarn fork --network base` and deploy against a
local fork of Base with real USDC.

### 4. Frontend

```bash
cd toolshed/packages/nextjs
cp .env.example .env.local      # set NEXT_PUBLIC_TARGET_CHAIN=base
```

Optional but recommended: set `PINATA_JWT` (server-side only) to turn on photo uploads. Without it
the listing form asks for a photo URL and inlines the listing JSON as a `data:` URI — which still
works, just less pleasantly. Set `NEXT_PUBLIC_IPFS_GATEWAY` if the association runs its own gateway.

Also replace the shared Scaffold-ETH defaults before a real launch: `NEXT_PUBLIC_ALCHEMY_API_KEY`
and `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` both fall back to demo keys that are rate-limited and
shared with every other SE-2 project.

```bash
yarn vercel        # Vercel: photo uploads work, needs PINATA_JWT in the project env
# or
yarn ipfs          # IPFS: fully static, censorship-resistant, no photo uploads (no server)
```

Point an ENS name or a subdomain at whichever you choose.

### 5. After deploying

- Read back `depositToken()`, `hasRole(STEWARD_ROLE, safe)` and `MAX_DEPOSIT()` on Basescan.
- List one cheap tool and run a whole loan through with $1, including a deliberate late return.
- Confirm the contract is verified and that the burner wallet does **not** appear in production
  (`burnerWalletMode: "localNetworksOnly"` is the default and should stay that way).

---

## Running it, day to day

**The steward's job** is small on purpose: keep the member roll current, and rule on disputes. A
dispute only exists when an owner says a reported return did not happen — the steward decides how
much of that loan's escrow the owner keeps, capped at the escrow, and the mark on the borrower's
record follows from that award. If the steward is on holiday for two weeks, anyone can close the
loan by splitting the escrow in half; nobody's money is held hostage, and neither party gains from
the delay.

**What members should be told:**

- Your deposit is escrowed the moment you ask, and refunded in full if the owner says no.
- Tap *I've returned it* when you drop the tool off — that stops the late-fee clock even if the
  owner takes a few days to confirm, and it is the thing that protects your deposit.
- A day started is a day charged.
- If a tool you lent out does not come back, tap *It hasn't come back*. Late fees pause after a week
  until you do, and nothing can be written off until you have.
- Everything you do is public: addresses, amounts, and your track record are visible to anyone
  looking at Base, not just to the association.

---

## What this version deliberately does not do

- **No damage claims beyond the deposit.** The escrow is the whole exposure. A $600 mitre saw
  needs a $600 deposit, or an understanding between neighbors.
- **The track record is only as trustworthy as the member roll.** Two neighbors who cooperate can
  run loans back and forth to pad each other's numbers — the deposit floor and the gas make it
  tedious rather than impossible. The real defense is that membership is gated by the steward and
  every loan is public: 300 known households, and a pattern of loans between the same two addresses
  is visible to anyone who looks. If it ever matters, rank by *distinct counterparties* rather than
  raw loan count; the events carry everything needed.
- **No reputation for lenders' behaviour** — the counters record loans given, but there is no way
  to record "he handed it over filthy". The condition notes field is doing that work for now.
- **No notifications.** Nobody gets an email when a tool is due back. That is the obvious next
  thing to build; the events are all there (`LoanApproved`, `ReturnReported`, `LoanClosed`).
- **No onchain privacy.** Every loan, amount and counterparty is public on Base. For a neighborhood
  shed that is probably fine, but members should know it before they join.
- **No gasless onboarding.** Members need a little ETH on Base. Base smart wallets plus a paymaster
  would remove that, and it is the highest-value thing to add after notifications.
