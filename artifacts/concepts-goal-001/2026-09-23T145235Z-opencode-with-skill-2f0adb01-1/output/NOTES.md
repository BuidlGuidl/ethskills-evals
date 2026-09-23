# NOTES — Onchain billing for the weather API

## What's here

```
src/SubscriptionBilling.sol   the billing contract (the whole product)
src/MockUSDC.sol              6-decimal test token — local/testnet only
script/Deploy.s.sol           deployment script (forge script)
test/SubscriptionBilling.t.sol  17 tests covering the full lifecycle
foundry.toml                  Foundry config (lib/, out/, cache/ are generated)
```

Build/test: `forge build`, `forge test`. Deploy:

```bash
export PRIVATE_KEY=...          # deployer; becomes contract owner
export USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   # USDC on Base
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

(Omit `USDC_ADDRESS` and it deploys MockUSDC — fine on a testnet, wrong on
mainnet.)

## How it works day to day

**The one mental model that matters: nothing onchain is automatic.** No
function runs "monthly" by itself — every state change needs someone to send a
transaction and pay gas. This contract is designed so that *no scheduled job is
ever required*: charges accrue per second mathematically, and the current
state is computed on demand. "Charged monthly" = `elapsed_seconds × price /
30 days`, which is exact at any instant and makes cancellation refunds precise
to the second.

**Customer flow.** Approve USDC → `deposit(amount)` → `subscribe(Hobby|Pro)`.
The first month must be prepaid, so a subscription can never start in debt.
Topping up later is just another `deposit`. Cancelling is `cancel()` — it
settles charges to the current second and refunds every unused wei in the same
transaction. Customers pay gas on an L2 (deploy on Base); each of these costs
well under a cent.

**The approve pattern**, since your customers will ask: `approve` gives the
billing contract permission to pull their USDC, like signing a check. Advise
them to approve what they intend to deposit rather than an unlimited amount.

**Gating API requests.** Per incoming request, your backend does a free read:

```js
const ok = await billing.isSubscribed(customerAddress); // eth_call, no gas, no tx
```

That's the whole integration. `paidThrough(address)` gives you the lapse
timestamp for "your subscription ends on …" warnings. Caching for a few
seconds (or one block) is safe — state only changes onchain, block by block.
Decide your RPC-outage policy in advance: fail closed (subscribers locked out
during an outage) or fail open with a short grace window.

**Getting paid.** Fees move into `collected` whenever an account is settled —
which happens automatically as a side effect of customers depositing,
switching, or cancelling. `withdraw(amount)` (owner only) pays out earned fees.
The contract enforces that withdrawals can never touch unearned customer
escrow, so refunds are always backed. If you ever want to checkpoint idle
accounts, `poke(address)` is permissionless — but it's housekeeping, never
required for correctness.

**Events** (`Subscribed`, `Settled`, `Lapsed`, `Cancelled`, …) are your
off-chain notification feed. Poll them or run an indexer to email customers
receipts, low-balance warnings, and lapse notices — the contract can't email
anyone.

## What to keep an eye on

- **The owner key is the whole admin surface.** It sets prices (new
  subscribers only — existing subs keep the price they signed up at, by
  design) and withdraws fees. If it leaks, someone steals your revenue; if you
  lose it, fee withdrawal dies with it. Put it on a Safe multisig or at least
  a hardware wallet, and know the bus factor. Honest framing: this is a
  *service* with an operator (you), not an unstoppable protocol — that's fine
  for billing, just don't pretend otherwise.
- **Lapsed subscribers go silent.** When a balance hits zero the subscription
  ends at that exact second. Nothing pokes them. Watch `Lapsed` events (or
  poll `paidThrough`) and notify *before* lapse; note that topping up does NOT
  auto-resubscribe — the customer must call `subscribe` again.
- **USDC is a company.** Circle can freeze addresses at the token level, and
  the contract trusts that 1 USDC = $1. That's the tradeoff for not handling
  card payments. Double-check the token address per chain before deploying;
  MockUSDC must never reach mainnet.
- **Everything is public.** Who subscribes, to what plan, how much they
  topped up — all visible on a block explorer. Fine for most customers; don't
  promise billing privacy you don't have.
- **Price changes don't apply retroactively.** Existing subscribers keep their
  snapshot until they cancel or switch. If you raise prices, grandfathered
  users stay cheap until they churn — deliberate, but know it.
- **A "month" is exactly 30 days**, always. Per-second accrual means this
  barely matters, but your marketing copy should say "30 days" if anyone asks.
- **RPC dependency.** `isSubscribed` is a free read, but it needs a working
  node connection. Use a reliable provider or run your own; cache per block.
- **This is not audited.** Tests pass, but the contract holds real customer
  money. Before meaningful TVL, get an external review — an audit is a
  point-in-time snapshot, not a guarantee, but it's the norm for handling
  other people's funds.
