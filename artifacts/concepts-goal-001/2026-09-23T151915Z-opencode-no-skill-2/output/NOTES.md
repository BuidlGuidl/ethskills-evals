# Onchain billing — operations notes

Stack: Foundry (Solidity 0.8.28, OpenZeppelin 5). One contract:
`src/SubscriptionBilling.sol`, deployed once per chain against that chain's USDC.

## How it works (the one design decision to understand)

Customers prepay USDC into escrow and subscribe to a plan priced per 30 days
(hobby $5, pro $20). Instead of a discrete "monthly charge" transaction, the
contract accrues your revenue **continuously** at the plan rate:

    charge = price × secondsElapsed / 30 days

Deposits sit in escrow until earned. This makes the two hard parts of onchain
billing free:

- **"Refund what I haven't used"** is exact to the second and needs no action
  from you: `cancel()` settles accrual up to that moment and returns the entire
  remaining balance in the same transaction.
- There is no monthly cron that must fire on time for customers to be billed
  correctly. Value accrues whether or not anyone transacts.

`settle(address)` / `settleMany(address[])` realize accrued revenue into the
owner-withdrawable `earned` balance. They are **permissionless** and only move
accounting along — the `isActive` access check already accounts for elapsed
time without them.

Key trust properties worth knowing (and worth telling customers):

- The owner can only ever withdraw from `earned` (accrued revenue). Customer
  escrow is untouchable by you, by design.
- Each account snapshots its price at subscribe/changePlan time. If you raise
  prices with `setPlan`, existing subscribers keep their old rate until they
  change plans or resubscribe. Plan changes only gate *new* subscriptions.

## Deploying

```bash
forge install            # fetch deps into lib/ (first time only)
cp .env.example .env     # fill in RPC_URL, USDC_ADDRESS, OWNER_ADDRESS, ...
source .env
forge build
forge test               # 32 tests

forge script script/Deploy.s.sol \
    --rpc-url $RPC_URL --broadcast --verify \
    --etherscan-api-key $ETHERSCAN_API_KEY \
    --account deployer   # or: --private-key $PRIVATE_KEY
```

Deploy to a cheap L2 — customers transact here (approve/deposit/subscribe/
cancel), so per-tx gas cost matters to them. Base or Arbitrum are the usual
choices; `.env.example` lists canonical USDC addresses. After deploying, save
the contract address into `.env` as `BILLING_ADDRESS` and record it somewhere
durable — your backend and keeper both need it.

## Day to day

### 1. Gating API requests (the whole point)

`isActive(address)` is a free `eth_call`. Call it per request:

```bash
cast call $BILLING_ADDRESS "isActive(address)(bool)" $CUSTOMER --rpc-url $RPC_URL
```

or with viem:

```ts
const active = await publicClient.readContract({
  address: BILLING_ADDRESS,
  abi: billingAbi, // out/SubscriptionBilling.sol/SubscriptionBilling.json
  functionName: "isActive",
  args: [customerAddress],
});
```

Practical notes:

- Use a recent block tag (default `latest` is fine). Result is exact at that
  block — it includes accrual up to the block timestamp even if nobody has
  called `settle`.
- Reading via your own/node-provider RPC each request is fine at hobby scale.
  If you want to cut latency, cache per address for one block (~2s on Base)
  or maintain a local view updated from events — but treat `isActive` as the
  source of truth.
- `currentBalance(address)` tells you what a cancel would refund; useful for
  a "time remaining" estimate in your dashboard
  (`currentBalance / price × 30 days`).

### 2. Collecting revenue

Two steps, both owner-signed:

```bash
# settle accrued revenue for active accounts (cheap, do it on a schedule)
cast send $BILLING_ADDRESS "settleMany(address[])" "[$ADDR1,$ADDR2,...]" \
    --rpc-url $RPC_URL --account operator

# sweep what's accrued to your payout address
cast send $BILLING_ADDRESS "withdrawEarned(address,uint256)" $PAYOUT $AMOUNT \
    --rpc-url $RPC_URL --account operator
```

A daily cron that settles your known subscriber list is plenty. Settlement is
**not** required for correct access control — only for moving revenue into
`earned` so you can withdraw it, and for finalizing lapsed accounts in
storage. You can also skip settling entirely and withdraw whenever `earned`
is worth the gas (customers' own transactions self-settle them).

### 3. Customers letting balances run dry

When a balance is consumed, `isActive` flips to false automatically and the
next `settle` marks the account lapsed onchain. Nothing for you to do — but
customers will churn silently. If you want renewals, watch
`currentBalance` off-chain and email/webhook them when it drops below ~one
month of their plan. Resubscribing after lapse is just `deposit` + `subscribe`.

### 4. Plan management

```bash
# reprice / deactivate an existing plan (affects NEW subscriptions only)
cast send $BILLING_ADDRESS "setPlan(uint256,uint256,bool)" 0 6000000 true ...
# add a new plan; returns its id
cast send $BILLING_ADDRESS "addPlan(uint256)" 100000000 ...
```

Because prices are snapshotted per subscriber, repricing never surprises an
existing customer — announce changes, and they apply when someone next
subscribes or changes plan.

## What to keep an eye on

- **Operator key.** It controls plan config and revenue withdrawals (never
  customer escrow). For anything beyond toy money, put ownership behind a
  multisig or at least a hardware wallet, and use `transferOwnership` to get
  there. Compromise = stolen revenue + griefed plans, not stolen deposits.
- **RPC dependency.** Your paywall is only as available as your RPC. Use a
  provider with fallback endpoints; a failed `isActive` call should fail
  closed (deny) or degrade gracefully, per your taste — decide in advance.
- **Gas wallet.** The keeper cron and your admin calls need a little native
  token on the deploy chain. Alert on low balance so revenue collection
  doesn't stall.
- **Accounting invariant.** At all times:
  `USDC.balanceOf(contract) == sum(customer balances) + earned`.
  Subsidy-free check: if it ever dips below, something is very wrong. Events
  (`Deposited/Settled/Cancelled/EarnedWithdrawn`) give you a full audit trail
  for bookkeeping; `EarnedWithdrawn` is your revenue-recognition point.
- **USDC specifics.** Prices are in USDC base units (6 decimals) — $5 is
  `5000000`. The contract trusts the token address you deployed with; use
  canonical USDC, not a bridged lookalike, and note that USDC is
  upgradeable/blocklistable by Circle (a blocklisted customer couldn't
  withdraw — same tradeoff as any USDC integration).
- **Rounding.** Accrual rounds down in the customer's favor by sub-cent dust.
  Ignore it.
- **No upgrades, by design.** The contract is immutable. If you ever need new
  mechanics, you deploy a new contract and customers migrate (deposit there /
  cancel here). That friction is the price of the "owner can't touch escrow"
  guarantee — don't add upgradeability lightly.

## Repo layout

- `src/SubscriptionBilling.sol` — the contract (the only thing that gets deployed)
- `script/Deploy.s.sol` — deployment (`forge script`, env-driven)
- `test/` — Foundry test suite incl. a 6-decimal `MockUSDC`
- `.env.example` — every variable the tooling reads
- `lib/`, `out/`, `cache/`, `broadcast/` — generated (deps, artifacts, run logs)
