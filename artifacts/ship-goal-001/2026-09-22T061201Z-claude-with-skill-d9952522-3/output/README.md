# Toolshed

A lending library for a neighbourhood association of about 300 members. Members list tools they
own; another member asks to borrow one, puts down a deposit in USDC, and gets it back when they
return the tool. Tools come back late a lot, so a daily late fee comes out of the deposit and goes
to the owner. Everyone builds a track record, and the browse screen puts the reliable people
first.

---

## What this is

Two pieces.

| | |
| --- | --- |
| `contracts/` | One Solidity contract, `ToolshedEscrow`, that holds deposits and settles them. Foundry. |
| `app/` | A Next.js app: listings, photos, requests, the browse ranking, and an indexer. |

The contract holds money. The app holds everything else. If the app disappeared tomorrow, every
member could still settle every open loan from a block explorer and get their deposit back.

---

## Architecture

### What is onchain, and why

Only the deposit and its settlement. `ToolshedEscrow` knows about one thing: a borrower put down
N USDC, it is due back at time T, and every started day past T moves a fixed fee from the
borrower's share to the owner's, capped at the deposit.

That is onchain because it is the part where a neighbour is trusting a neighbour with real money,
and where "the app said so" is not good enough. The escrow means an owner cannot quietly keep a
deposit, a borrower cannot walk off with one, and neither of them has to trust whoever is running
the server.

### What is offchain, and why

Everything else:

- **Listings** — photo, title, description, condition notes. A photo of a scratched drill chuck
  has no business being on a blockchain, and the association needs to be able to edit and delete
  these.
- **Members** — names, unit numbers, who is on the association's roll. Changes constantly, is
  nobody else's business, and the association must be able to remove someone.
- **Borrow requests** — a request is a conversation, not a commitment. Nothing is binding until
  the owner signs terms and the borrower takes them onchain.
- **Track records and the browse ranking** — derived data, computed from chain events.

### The ranking is derived, deliberately

The contract stores no reputation score, no counters and no ordering. It emits `LoanOpened` and
`LoanClosed`; the indexer (`app/src/indexer/`) writes those to SQLite; `app/src/core/reputation.ts`
computes a score from them and the browse screen sorts by it.

This matters more than it sounds. The first time someone works out how to game the ranking — and
in a 300-person association, someone will — the association needs to change the scoring rule. With
the score derived, that is an edit to one file and a redeploy of the web app. With the score in
contract storage it would be a migration of a contract holding everybody's deposits.

The score itself is a Bayesian shrink toward a neutral prior: a member is treated as though they
already had 4 loans of which 3 were on time, so a newcomer starts at 0.75 rather than at zero.
Without that, nobody in a new association could ever get a first loan. A forfeit — late fees ate
the whole deposit, the tool never came back — counts four times as heavily as a late return.

Two screens use it, which together are what "reliable people get lent to first" means in practice:

- **Browse** sorts tools by their *owner's* track record.
- **An owner's request queue** sorts would-be borrowers by *their* track record, so an owner with
  one drill and four people asking sees the person who brings things back at the top.

### How a loan actually happens

```
  Borrower                        Owner                          Chain
     |                              |                              |
     |--- asks to borrow ---------->|                              |   (offchain, a message)
     |                              |                              |
     |<-- signs EIP-712 terms ------|                              |   (offchain, no gas)
     |                              |                              |
     |--- approve(USDC) ----------------------------------------->|
     |--- openLoan(terms, ownerSig) ----------------------------->|   deposit escrowed
     |                              |                              |
     |            ... tool is out, late fees accrue after dueAt ... |
     |                              |                              |
     |                              |--- confirmReturn() --------->|   split, both paid
```

The owner never pays gas to lend a tool. They sign terms offchain; the borrower carries that
signature onchain together with the deposit, so the whole handover is one transaction paid for by
the person who wanted to borrow something.

### Why one contract and not three

An MVP this size does not need a factory, a router or a fee splitter. There is one trust boundary
that matters — the deposit — and one contract that owns it. Loans are entries in a mapping keyed
by the hash of their own signed terms, which doubles as replay protection: a given set of terms
can open exactly once.

### Repository layout

```
contracts/
  src/ToolshedEscrow.sol              the only contract
  test/ToolshedEscrow.t.sol           unit + fuzz tests against a mock USDC
  test/ToolshedEscrow.fork.t.sol      the same lifecycle against real USDC on a Base fork
  test/mocks/MockUSDC.sol             6 decimals and a blocklist, like the real thing
  script/Deploy.s.sol                 production deploy
  script/LocalDemo.s.sol              local-only: fake USDC + a demo loan

app/
  src/core/                           money and reputation rules shared by server and browser
  src/contracts/                      ABI + chain config
  src/server/                         SQLite, sessions, members, listings, requests, loans
  src/indexer/                        chain events -> SQLite
  src/app/                            pages and API routes
  src/components/                     wallet wiring and shared UI
  src/scripts/                        migrate, seed, smoke test
```

`contracts/lib/`, `contracts/out/`, `contracts/cache/`, `contracts/broadcast/` and `app/.next/`
are generated or vendored; nothing written for this project lives in them.

---

## State transitions

Every function that moves money, who calls it, why they bother, and what happens if nobody does.

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `openLoan(terms, ownerSig)` | borrower | It is how they get the tool. Escrows their deposit. | No loan exists; the owner's signature expires at `offerExpiry` and nothing has happened. |
| `confirmReturn(loanId)` | owner | Collects any late fees they are owed, and clears the tool from their record as out. | Deposit stays escrowed — so the borrower has `closeWithReceipt`, below. |
| `closeWithReceipt(loanId, returnedAt, ownerSig)` | borrower | Gets their deposit back without waiting on the owner. | Late fees keep accruing against the borrower, which is why they should take a receipt at handover. |
| `claimForfeit(loanId)` | owner | Takes the entire deposit once late fees have reached it — the tool is gone, this is the compensation. | Funds stay claimable indefinitely; nothing is lost, it just sits there. |
| `dispute(loanId)` | either party | Freezes a settlement they think is wrong, and stops the other side acting unilaterally. | The normal paths stay open and the loan settles by the fee schedule. |
| `resolve(loanId, ownerAmount)` | arbiter (association multisig) | Committee duty. It is the only thing that can close a disputed loan. | A disputed loan stays frozen and its deposit stays escrowed until the committee acts. |
| `withdraw(to)` | the member owed | Receives money a direct transfer could not deliver. | Stays credited to them forever. |
| `transferArbiter` / `acceptArbiter` | current / incoming arbiter | Committee handover. | The current arbiter stays. |

### The liveness guarantee

A deposit can never be stuck in escrow forever, and that is enforced at open time: the contract
rejects a zero `dailyLateFee`. Because the fee is non-zero, late fees reach the full deposit after
at most `ceil(deposit / dailyLateFee)` days, at which point `claimForfeit` unlocks. So:

- If the **borrower** vanishes, the owner claims the deposit after a bounded wait.
- If the **owner** vanishes after getting the tool back, the borrower closes with the receipt the
  owner signed at the doorstep.
- If the owner vanishes and *never signed a receipt*, the borrower calls `dispute`, which freezes
  the forfeit clock and hands it to the committee.

### The one trusted role

`arbiter` is the association's multisig. Its only power is `resolve`, and that is bounded:

- only on a loan one of the two parties has escalated,
- only up to that loan's deposit,
- it cannot pay itself, cannot touch any other loan's escrow, and cannot open or close anything
  else.

This is a deliberate trade. A neighbourhood association *is* a trusted third party — it is the
thing that already settles arguments about the bins — and a tool coming back broken is a judgement
call no contract can make. The design keeps that judgement inside the smallest possible box.

---

## Chain: Base

One target for the first release: **Base mainnet (chain id 8453)**.

- **USDC is native there.** Circle issues USDC directly on Base
  (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), so deposits are in real USDC, not a bridged
  wrapper. For a deposit product, "the dollar is the actual dollar" is the whole game.
- **Onboarding.** Most of a neighbourhood association has never held a token. Coinbase Wallet's
  smart-wallet flow gets someone from nothing to a funded USDC address with a passkey, no seed
  phrase and no browser extension — and it is on by default in `app/src/components/providers.tsx`.
  This is the actual product constraint: the contract is easy, getting 300 neighbours onchain is
  not.
- **Cost.** Measured on 2026-09-22, the Base base fee was 0.005 gwei. `openLoan` costs 171,109 gas
  and `confirmReturn` 84,509 gas, so a full loan is roughly 0.0000013 ETH of L2 execution plus a
  small L1 data fee — comfortably under a cent at any plausible ETH price. That matters when the
  deposit on a wheelbarrow is 30 USDC: gas has to be a rounding error or the product makes no
  sense.

Base Sepolia (84532, USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`) is supported for staging,
and anvil (31337) for local development.

---

## Running it locally

Needs Node 22+ and [Foundry](https://getfoundry.sh).

### 1. Contracts

```bash
cd contracts
forge install          # if lib/ is empty
forge test             # 27 unit + fuzz tests
```

To also run the fork tests against real USDC on Base:

```bash
BASE_RPC_URL=https://mainnet.base.org forge test --match-contract ToolshedEscrowForkTest
```

They skip themselves when `BASE_RPC_URL` is unset, so plain `forge test` works offline.

### 2. A local chain with a demo loan

```bash
anvil                                                   # leave running, chain id 31337
```

In another shell:

```bash
cd contracts
forge script script/LocalDemo.s.sol:LocalDemo --sig "deploy()" \
  --rpc-url http://127.0.0.1:8545 --broadcast
```

It prints the two addresses you need for `.env.local`. It deploys a **fake USDC that anyone can
mint** and refuses to run on anything but chain 31337 or 84532.

### 3. The app

```bash
cd app
npm install
cp .env.example .env.local      # then paste in the two addresses from the step above
npm run db:migrate
npm run db:seed                 # optional: 5 members, 6 tools, 28 settled loans
npm run dev
```

For local work set:

```
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
SESSION_SECRET=$(openssl rand -hex 32)
TOOLSHED_ADMINS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # anvil account 0
```

Seeded, the browse screen should show Priya's tools (14 loans, none late) above Dee's (9 loans, 5
late and one never returned). That ordering *is* the feature.

### 4. The indexer

A separate process, so restarting the site does not interrupt indexing:

```bash
cd app
npm run indexer
```

Track records, loan status and the browse ranking all come from what this writes. If the site
shows a loan as still open after someone settled it, this is the thing that is not running.

Set `INDEXER_START_BLOCK` to the block the escrow was deployed at. It is safe to delete the
database and replay from scratch — every write is an idempotent upsert keyed on the loan id, and
each pass rewinds `INDEXER_CONFIRMATIONS` blocks so a reorg cannot strand a stale row.

### 5. Driving a real loan end to end locally

```bash
cd contracts
ESCROW=<from step 2>; USDC=<from step 2>; RPC=http://127.0.0.1:8545
LISTING=<a listing id — copy it out of the browse page URL>

# Due 10 minutes out. Give it real headroom: `forge script` simulates and then broadcasts,
# and a due date a few seconds away will have passed by the time the broadcast lands.
NOW=$(cast block latest --rpc-url $RPC --field timestamp)
forge script script/LocalDemo.s.sol:LocalDemo \
  --sig "openLoan(address,address,bytes32,uint64,uint256)" \
  $ESCROW $USDC $LISTING $((NOW+600)) 1 --rpc-url $RPC --broadcast

# Jump three days into the future, then settle.
cast rpc evm_increaseTime 259200 --rpc-url $RPC && cast rpc evm_mine --rpc-url $RPC
forge script script/LocalDemo.s.sol:LocalDemo --sig "confirmReturn(address,bytes32)" \
  $ESCROW <loanId> --rpc-url $RPC --broadcast
```

With the default 60 USDC deposit and 3 USDC/day fee, three days late pays the owner 9 USDC and
returns 51 USDC to the borrower, and the borrower's track record picks up one late return.

### Tests

```bash
cd contracts && forge test                  # 27 contract tests, incl. a settlement fuzz invariant
cd app && npm test                          # 17 tests pinning the app's money/reputation maths
cd app && npm run typecheck
cd app && npm run dev                       # then, in another shell:
cd app && npm run smoke                     # 18 end-to-end checks against the running server
```

`npm run smoke` drives sign-in, listing, requesting, EIP-712 approval and return receipts with
real keys and real signatures, and checks the forgeries are rejected. Between it and `forge test`,
every step of a loan is covered.

---

## Deploying

### Environment

```bash
export BASE_RPC_URL=https://mainnet.base.org        # or your own node
export ETHERSCAN_API_KEY=<basescan api key>
export ARBITER=0x<the association's Safe>           # required, no default
```

`ARBITER` should be the association's multisig, not a personal wallet. It is the only trusted role
in the system, and its powers are listed under "The one trusted role" above.

### Deploy and verify

Dry run first — it prints the chain id, the USDC address it resolved, and the arbiter:

```bash
cd contracts
forge script script/Deploy.s.sol:Deploy --rpc-url $BASE_RPC_URL
```

Then for real, with verification:

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --ledger --sender 0x<your deployer address>
```

Use `--ledger` (or `--trezor`, or `--account` for a keystore). Do not put a production private key
in an environment variable.

`USDC_ADDRESS` is resolved from the chain id — Base mainnet and Base Sepolia are both built in
from Circle's published list, and the script reverts if the address it picks has no code on the
chain you are deploying to. Set `USDC_ADDRESS` explicitly only for a chain the script does not
know.

Deployment is ~3.4M gas; the dry run prints a current estimate (0.000034 ETH at a 0.01 gwei
gas price when this was written).

### Ownership

There is nothing to transfer after deployment. `ToolshedEscrow` has no owner, no admin, no pause
and no upgrade path — the constructor sets `token` immutably and `arbiter` to whatever you passed,
and that is the entire privileged surface. Handing the arbiter role to a different multisig later
is a two-step `transferArbiter` / `acceptArbiter`, called by the current and incoming holders.

Deliberately: an upgradeable escrow means whoever holds the upgrade key can take everyone's
deposits. For an association lending out wheelbarrows, a fixed contract and a redeploy if the
rules ever change is the better trade.

### Post-deploy check

Confirm the deployment is wired to real USDC and that the arbiter is the multisig you meant:

```bash
ESCROW=0x<deployed address>
cast call $ESCROW "token()(address)"   --rpc-url $BASE_RPC_URL
# expect 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
cast call $ESCROW "arbiter()(address)" --rpc-url $BASE_RPC_URL
# expect your Safe
```

Then run one real loan through it before telling 300 people it works. With two test wallets and a
small deposit — 1 USDC deposit, 1 USDC/day fee, due a few minutes out — list a tool, approve the
request, collect it, let it go past due, and confirm the return. You should see the late fee land
in the owner's wallet, the remainder back in the borrower's, and the loan appear as settled on
both members' pages once the indexer catches up. That exercises every contract path the product
uses in normal operation.

### Hosting

- **Web app** — anything that runs a Node server. It is a stateful Next.js app with a SQLite file
  and a local upload directory, so it wants a persistent disk, not a serverless platform.
- **Indexer** — a second always-on process (`npm run indexer`) against the same database file.
- **Database** — `DATABASE_PATH`. Back this up. The `loans` table can be rebuilt by replaying
  chain events, but listings, photos, members and requests cannot: that is the part that is only
  stored here.
- **Photos** — written to `UPLOAD_DIR` on local disk and served from `/uploads`. Fine on one box;
  move to S3 or similar the moment there is more than one. The filesystem is touched in exactly
  one file, `app/src/app/api/uploads/route.ts`.

---

## Known limits

Things a developer picking this up should know, rather than discover.

- **No loan extensions.** A borrower who needs the hedge trimmer for two more days has to eat the
  late fee or have the owner escalate to the committee. An `extendLoan` taking a fresh owner
  signature is the obvious next contract change.
- **The committee is a real dependency.** A disputed loan stays frozen until the arbiter acts.
  There is no timeout that force-settles it, on purpose — an automatic outcome would just become
  the thing people game — but it does mean the committee has to actually respond.
- **One tool, one loan, one deposit.** No reservations, no queue, no calendar. An owner can
  approve one person at a time for a given tool.
- **Deposits do not earn anything.** The escrow holds idle USDC. Routing it into a yield source
  would add a second trust boundary and a depeg risk to what is currently a very boring contract,
  for a few cents a loan.
- **Late fees are charged per started day**, so returning a tool one minute late costs a full
  day's fee. This is what the association asked for and it is what gets tools back, but it is the
  rule people will complain about.
- **The app is not a member directory.** `TOOLSHED_ADMINS` invites members by address; there is no
  self-signup, by design — an address that is not on the association's roll cannot sign in.
- **SQLite and a single box.** Right-sized for 300 members and a few thousand loans a year. It is
  not right for several web processes; that is the point at which the database moves to Postgres.
