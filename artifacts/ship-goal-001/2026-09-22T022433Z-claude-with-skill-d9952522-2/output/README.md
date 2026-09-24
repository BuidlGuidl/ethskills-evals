# Toolshed

A lending library for a neighbourhood association of ~300 members. Members list
tools they own, other members ask to borrow one for a few days and put down a
USDC deposit, and they get the deposit back when they return the tool. A daily
late fee comes out of the deposit and goes to the owner. Everyone builds up a
track record — loans taken, late returns — and the browse and request screens
put the reliable people first.

This is the first shippable version: one contract, one Next.js app, one
indexer, one target chain.

---

## 1. What is onchain and what is not

The contract holds one thing: a borrower's deposit for one loan of one tool,
plus the rule that splits it when the tool comes back. Everything else is
offchain.

| Concern | Where | Why |
| --- | --- | --- |
| Deposit custody, late-fee split, refund | **onchain** (`Toolshed.sol`) | Real money between neighbours who may not trust each other. Nobody, including the association, can quietly change who gets paid. |
| Loan terms (deposit, late fee, due date) | **onchain**, as signed terms | They decide the payout, so they must be tamper-proof once agreed. |
| Who may borrow and lend (roster) | **onchain** roster | Gates escrow entry; must be enforced where the money is. |
| Tool listing: photo, title, condition notes | offchain (SQLite + disk) | Mutable content nobody needs to verify. A photo onchain would cost more than the tool. |
| Borrow requests, declines, withdrawals | offchain | Most requests never become loans. Making them free is what lets a member ask three neighbours about a drill. |
| Owner approval of a loan | offchain **EIP-712 signature** | The owner should not pay gas to say yes, and should pay nothing at all to say no. |
| Track records, browse ranking, search | offchain, derived from events | Derived data. Keeping a score in contract storage would cost gas on every settlement and freeze a formula we expect to tune. |
| Return receipts | offchain signature, redeemed onchain | Lets the borrower close the loan when the owner is unavailable. |

The only onchain handle on a listing is `toolId = keccak256("toolshed:listing:<uuid>")`.
The contract never learns what the tool is; it only needs a stable identity so
the same tool cannot be lent out twice at once.

### Custom contracts: one

`contracts/src/Toolshed.sol` (~400 lines, one file). USDC is an existing
deployed token; nothing else is needed. There is no factory (loans are rows in
one contract, not contracts), no separate escrow (the contract *is* the escrow),
and no fee splitter (the split is two transfers in one function).

---

## 2. How a loan works

```
                offchain                                    onchain
  owner lists a tool ──────────────────────────────────────────────────────
  borrower asks for 3 days ─────────────────────────────────────────────────
  owner signs terms (EIP-712, free) ────────────────────────────────────────
  borrower submits terms + signature ──────────────► startLoan()  ← deposit in
  ... tool is out, due date passes ...
  owner confirms return ───────────────────────────► confirmReturn()
     or owner signs a receipt ─────────────────────► closeWithReceipt()
     or the fee hits its cap ──────────────────────► closeAtMaxLateFee()
     or the committee arbitrates ──────────────────► resolve()
                                                     deposit split: late fee → owner,
                                                     the rest → borrower
```

The late fee is `min(days_late, maxLateDays) × lateFeePerDay`, where any part of
a day counts as a whole day. `startLoan` refuses terms where
`lateFeePerDay × maxLateDays > deposit`, so **the deposit is a hard ceiling on
what a borrower can lose**, and the cap is known to both sides before the loan
starts.

### State transitions

Contracts do not run on schedules, so every transition has a caller who wants
to call it:

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `startLoan(offer, ownerSig)` | borrower | They get the tool. This is also when the deposit is pulled. | No loan exists; the owner's signature expires at `offerExpiry`. |
| `confirmReturn(loanId)` | tool owner | Collects their late fee and frees the tool to be lent again. | The deposit stays in escrow, fully claimable by the paths below. |
| `closeWithReceipt(loanId, returnedAt, ownerSig)` | borrower | Gets their deposit back immediately, at the return time the owner signed for — no waiting on the owner to transact. | Borrower falls back to the next row. |
| `closeAtMaxLateFee(loanId)` | borrower, after `dueAt + maxLateDays` | Recovers whatever is left of the deposit. Past the cap the split can no longer change, so the owner is paid the maximum either way and nobody is worse off. Borrower-only on purpose: an owner must not be able to sit on a timely return and then bill the cap. | The deposit stays in escrow until the borrower or steward acts. |
| `resolve(loanId, lateDaysCharged)` | steward multisig, after `dueAt` | Arbitrates the cases code cannot see: tool damaged, tool lost, disputed return date. | Nothing moves; the other three paths still work. |
| `cancelOffer(nonce)` | tool owner | Kills a signed offer before anyone funds it. | The offer expires on its own at `offerExpiry`. |
| `setMembers`, `transferSteward`, `setNewLoansPaused` | steward multisig | Association business. | Roster stands as it is. |

No path requires a keeper, a cron job or the association being online. There is
no owner-only escape hatch that moves funds: **every function that moves money
can be called by a participant**, and settlement never checks the roster, so
removing a member cannot trap their deposit.

### What the steward can and cannot do

The steward is the association's multisig — in practice the committee. It can:
add and remove roster members, pause *new* loans, hand the role on, and resolve
an overdue loan by choosing how many late days to bill.

It cannot: pay itself, take a cut, touch a loan that is not yet overdue, bill
more than the `lateFeePerDay × maxLateDays` the two parties already agreed, or
block any settlement. That is the whole trust surface, and it is deliberately
shaped like the social reality: a neighbourhood committee already settles
"he says he brought it back Tuesday" arguments, and pretending otherwise would
just mean deposits stuck in escrow forever.

---

## 3. Track records

Reputation is derived, never stored onchain. The indexer turns `LoanStarted` and
`LoanSettled` into rows in `loans`, and `src/server/reputation.ts` computes per
member:

- `borrowed` — settled loans they took
- `lateReturns` — how many of those came back late, and `lateDays` billed
- `activeLoans` / `overdueNow` — what they are holding right now
- `lent` — loans they gave as an owner
- `reliability = (onTime + 1) / (borrowed + 2)` — Laplace-smoothed on-time rate

Browse ordering (`compareReliability`): anyone holding an overdue tool right now
drops to the back, then by smoothed on-time rate, then by volume. The smoothing
matters socially: a new member starts at 50% rather than at the bottom of the
list, so a first loan is possible, and one late return out of twenty barely
moves anyone.

Two screens use it. `/` sorts listings by their owner's record. `/requests`
sorts an owner's inbox by the asker's record — that is the screen where
"the reliable people get lent to first" actually happens, because it is where an
owner with three people asking for the same drill decides.

Because it is all derived from events, any member can recompute it from the
chain, and the formula can change without a migration or a redeploy.

---

## 4. Chain: Base mainnet

Launch target is **Base** (chain id 8453), with Base Sepolia (84532) for
staging.

- **Deposits are $30–100, so fees have to be invisible.** Measured on Base on
  2026-09-21: gas price 0.006 gwei (`cast gas-price --rpc-url https://mainnet.base.org`).
  `startLoan` costs ~262k gas measured (`forge test --gas-report`), so L2
  execution is well under a cent; with L1 data costs a loan is about a cent
  end to end. On Ethereum mainnet the same transaction would be a meaningful
  fraction of the deposit.
- **Native USDC.** Circle issues USDC directly on Base
  (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, verified onchain — see below),
  so there is no bridged-asset confusion for members who top up from an
  exchange.
- **Onboarding for people who have never held a private key.** The app ships the
  Coinbase Wallet connector with Smart Wallet enabled, which onboards with a
  passkey — no extension, no seed phrase. This is the deciding factor for ~290
  of the 300 members. The contract verifies owner signatures through ERC-1271
  (`SignatureChecker`), so a passkey smart-contract wallet can sign loan offers
  and return receipts exactly like an EOA. There is a test for this
  (`test_startLoan_acceptsOwnerWithSmartWallet`).

USDC addresses used, both checked against the live chains rather than
remembered:

```
$ cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "symbol()(string)" --rpc-url https://mainnet.base.org
"USDC"
$ cast call 0x036CbD53842c5426634e7929541eC2318f3dCF7e "symbol()(string)" --rpc-url https://sepolia.base.org
"USDC"
```

They are baked into `contracts/script/Deploy.s.sol` and
`app/src/chain/config.ts` per chain id, so a deploy cannot accidentally point
the escrow at some other token.

---

## 5. Repository layout

```
contracts/
  src/Toolshed.sol            the only custom contract
  test/Toolshed.t.sol         38 unit + fuzz tests against a mock USDC
  test/ToolshedFork.t.sol     full lifecycle against real USDC on a Base fork
  test/mocks/                 MockUSDC, MockSmartWallet (ERC-1271)
  script/Deploy.s.sol         deployment
  script/SetMembers.s.sol     roster changes
  script/local.sh             one-shot local deploy (mock USDC + Toolshed)

app/
  src/chain/                  chain config, ABI, EIP-712 types, wagmi config
  src/server/                 SQLite store, session auth, offer policy, reputation
  src/indexer/                events -> loans + roster projection
  src/app/                    Next.js App Router pages and API routes
  src/components/             client components (wallet, forms, tx buttons)
  src/ui/format.ts            USDC and date formatting
  src/e2e/smoke.ts            end-to-end test against a local deployment
```

`app/src/chain/toolshedAbi.ts` is generated from the Foundry artifact by
`app/src/chain/syncAbi.ts` and committed, so the app builds without compiling
the contracts first. Re-run it after changing the contract.

---

## 6. Getting it running locally

Prerequisites: Node 20+, [Foundry](https://getfoundry.sh), and a C toolchain for
`better-sqlite3` (`build-essential` on Debian/Ubuntu).

```bash
# 1. contracts
cd contracts
forge install          # forge-std + openzeppelin-contracts v5.1.0 into lib/
forge test             # 39 tests; the fork test skips without an RPC

# 2. local chain + deployment (terminal 1)
anvil

# 3. deploy mock USDC + Toolshed to anvil (terminal 2)
cd contracts && ./script/local.sh
# prints the five NEXT_PUBLIC_* values for the app

# 4. app
cd ../app
npm install
cp .env.example .env.local
$EDITOR .env.local          # paste the values from step 3, set SESSION_SECRET
npm run db:migrate
npm run seed                # four neighbours and four tools, offchain only
npm run indexer             # catch up on roster events from the deployment
npm run dev                 # http://localhost:3000

# 5. keep the projection fresh while you work (terminal 3)
npm run indexer:watch
```

To click through a whole loan you need two wallets on the local chain: import
anvil's account #1 (the owner of the seeded tools) and account #2 (the borrower)
into your browser wallet, and mint yourself some mock USDC:

```bash
cast send $NEXT_PUBLIC_USDC_ADDRESS "mint(address,uint256)" $BORROWER 200000000 \
  --rpc-url http://127.0.0.1:8545 --private-key $ANVIL_KEY_0   # 200 USDC
```

Then: sign in as the borrower and ask to borrow → sign in as the owner, go to
`/requests`, approve (a signature, no gas) → back as the borrower, pay the
deposit → as the owner, confirm the return.

### Tests

```bash
cd contracts
forge test                                          # units + fuzz, offline
BASE_RPC_URL=https://mainnet.base.org forge test    # adds the real-USDC fork test

cd ../app
npm run typecheck
npm run smoke        # end-to-end against the local deployment from step 3
```

`npm run smoke` is the one that covers the seam nothing else can: it asserts
that the app's EIP-712 definition hashes to the same digest as
`Toolshed.hashOffer`, funds a real deposit against an owner's offchain
signature, settles three days late, and checks that the indexer's loan row,
balances and track records all agree.

---

## 7. Deploying

### Environment

```bash
export BASE_RPC_URL="https://mainnet.base.org"          # or your provider
export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
export BASESCAN_API_KEY="..."                            # basescan.org account
export STEWARD_ADDRESS="0xYourAssociationSafe"           # a Safe, not an EOA
export INITIAL_MEMBERS="0xabc...,0xdef..."               # optional, comma-separated
```

`STEWARD_ADDRESS` is the contract's only privileged role and it is set in the
constructor — there is no ownership transfer step to forget. Point it at the
association's Safe (create one at [safe.global](https://safe.global) on Base
with the committee as signers). Deploying from a hot key is fine; the deployer
keeps no rights whatsoever.

### Staging on Base Sepolia

```bash
cd contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --account toolshed-deployer \
  --broadcast --verify
```

(`cast wallet import toolshed-deployer --interactive` once, to avoid
private keys in your shell history. `--private-key $PRIVATE_KEY` also works.)

### Base mainnet

```bash
cd contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$BASE_RPC_URL" \
  --account toolshed-deployer \
  --broadcast --verify --slow
```

The script prints the chain id, the USDC address it resolved, the steward and
the deployed address. Note the **deploy block number** from the broadcast
output — the indexer needs it.

If verification did not run (no API key at deploy time):

```bash
forge verify-contract <TOOLSHED_ADDRESS> src/Toolshed.sol:Toolshed \
  --chain base --watch \
  --constructor-args $(cast abi-encode \
     "constructor(address,address,address[])" \
     0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "$STEWARD_ADDRESS" "[]")
```

(Pass the same `initialMembers` array you deployed with.)

### Post-deploy checks

Confirm the escrow is pointed at the right token and the right steward, then
prove the whole path with one real loan before telling 300 people about it.

```bash
export TOOLSHED=0x...   # from the deploy output

# 1. it is wired to Circle USDC and the committee Safe
cast call $TOOLSHED "usdc()(address)"    --rpc-url "$BASE_RPC_URL"
cast call $TOOLSHED "steward()(address)" --rpc-url "$BASE_RPC_URL"

# 2. roster: add the first members (from the Safe, via its UI or a Safe tx)
#    setMembers(address[],bool) with included = true
#    Locally or in staging, the script does it:
TOOLSHED_ADDRESS=$TOOLSHED MEMBERS="0xowner,0xborrower" \
forge script script/SetMembers.s.sol:SetMembers \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" --account toolshed-deployer --broadcast

# 3. end-to-end smoke on the real deployment: list a tool in the app, approve a
#    request, fund a small deposit (say 2 USDC with a 1 USDC/day late fee), then
#    confirm the return and check the money landed:
cast call $TOOLSHED "getLoan(uint256)" 1 --rpc-url "$BASE_RPC_URL"
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" $TOOLSHED --rpc-url "$BASE_RPC_URL"   # 0 after settling
```

### Running the app

The app is a standard Next.js server plus a SQLite file plus a photo directory;
it needs persistent disk, so a VPS or a container with a volume, not a
read-only serverless runtime.

```bash
cd app
npm ci
npm run build
NODE_ENV=production npm start           # or behind a systemd unit / nginx
npm run indexer:watch                   # second process, same env and disk
```

Production env (`app/.env.production` or the process environment):

```
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org      # or a paid provider
NEXT_PUBLIC_TOOLSHED_ADDRESS=0x...
NEXT_PUBLIC_DEPLOY_BLOCK=<deploy block from the broadcast>
SESSION_SECRET=<openssl rand -hex 32>
DATABASE_PATH=/var/lib/toolshed/toolshed.db
UPLOAD_DIR=/var/lib/toolshed/uploads
```

`NEXT_PUBLIC_USDC_ADDRESS` is optional on Base and Base Sepolia (built in) and
required anywhere else.

Operational notes:

- `GET /api/health` reports the chain id, the contract, the chain head and how
  many blocks behind the indexer is. Alert if `blocksBehind` keeps growing.
- The indexer is idempotent. To rebuild the projection, delete the
  `indexer_state` row (or the whole DB) and run it again; every loan fact comes
  back from the chain. Members' names and listing photos do **not** — back up
  `DATABASE_PATH` and `UPLOAD_DIR`.
- Photos are on local disk behind `src/server/storage.ts`. For ephemeral disks,
  replace `savePhoto`/`photoPath` with an S3/R2 put and signed GET; nothing else
  in the app touches the filesystem.
- `setNewLoansPaused(true)` stops new loans while leaving every settlement path
  open — the right first move if something looks wrong.

---

## 8. Known limits of this first version

- **Physical handover is not verifiable.** The contract knows about signatures
  and timestamps, not about who is holding a drill. The four settlement paths
  and the bounded steward role are the answer to that, not an oracle.
- **A dishonest owner can refuse to confirm a timely return.** The borrower's
  worst case is capped: they wait until `dueAt + maxLateDays` and recover the
  deposit minus the capped fee, or the steward resolves it sooner. Bounded, not
  eliminated.
- **One deposit per tool at a time**, enforced by `activeLoanOf`. No queueing or
  reservations yet — requests simply stay in the owner's inbox.
- **Reputation counts borrowing only.** Lending volume is displayed but does not
  affect ranking. It should eventually, and that change is one function in
  `reputation.ts` because nothing about it is onchain.
- **No notifications.** Members find out about requests and due dates by opening
  the app. An email or push job reading `outstandingLoans()` is the obvious next
  addition.
- **Settlement is atomic, which USDC can in principle block.** The split pays
  owner and borrower in one transaction, so if Circle were to blocklist one of
  the two addresses, that loan's settlement would revert and the deposit would
  be stuck. A pull-payment ledger (credit balances, `withdraw()`) removes this
  at the cost of a second transaction per loan and more contract surface;
  accepted risk for a 300-person neighbourhood, and the first thing to change if
  Toolshed is ever reused somewhere the odds are different.
- **The offchain store is a single SQLite file.** Right for 300 members and one
  volunteer operator; the module boundary in `src/server/db.ts` is where you
  would swap in Postgres.
