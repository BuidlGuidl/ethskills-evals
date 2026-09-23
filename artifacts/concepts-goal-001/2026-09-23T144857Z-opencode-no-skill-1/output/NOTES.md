# NOTES — running the onchain billing

## What's here

| Path | Purpose |
| --- | --- |
| `src/SubscriptionBilling.sol` | The whole billing system: one contract, no dependencies |
| `test/SubscriptionBilling.t.sol` | Foundry tests (15) covering the full customer lifecycle |
| `test/mocks/MockUSDC.sol` | 6-decimal test token — never deploy this |
| `script/Deploy.s.sol` | Deploy + configure the two launch plans |
| `backend/checkSubscription.js` | The per-request `isActive` check for your API |

Build/test: `forge build`, `forge test`. Deploy:

```bash
export USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  # USDC on Base
export OWNER_ADDRESS=0x...   # your ops wallet — use a multisig, see below
export PRIVATE_KEY=0x...     # deployer key
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

Base mainnet is the natural home: real USDC, and transactions cost fractions
of a cent, which matters at $5/month price points.

## How the money flows

1. Customer approves USDC and calls `deposit(amount)` — funds sit in their
   in-contract balance, refundable at any time via `withdraw` or `cancel`.
2. `subscribe(planId)` (1 = hobby $5, 2 = pro $20) charges one 30-day period
   immediately and sets `paidThrough = now + 30 days`.
3. Renewals are **lazy**: the chain can't run cron, so instead the next
   transaction that touches the account (deposit, withdraw, or anyone calling
   `chargeBatch`) charges one period and extends `paidThrough` from that
   moment. If the balance can't cover it, the subscription simply lapses.
   **Nobody is ever back-charged for lapsed time** — a customer who disappears
   for 6 months and returns pays for one new period, not seven.
4. `isActive(address)` is what your backend calls. It's written so the answer
   is correct *whether or not any renewal transaction has landed yet*: a
   subscriber past `paidThrough` whose balance covers the next period still
   reads as active. There is no gap at the renewal boundary.
5. `cancel()` stops future charges and immediately refunds the unused balance.
   The already-paid period is consumed — note the account keeps its
   `paidThrough`, so if you want to honor access until period end after a
   cancel, check `getAccount(...).paidThrough` in your backend instead of
   `isActive` alone. (Current behavior: `isActive` goes false at cancel.)

## Day to day

**Per request:** call `isActive(address)` (see `backend/checkSubscription.js`).
It's a free view call. A 10-second cache is plenty; billing state can't change
meaningfully faster than that except at the moment of a top-up.

**Keeper (you, ~daily):** run a cron job that calls `chargeBatch(addrs)` over
your subscriber list. This is **not required for correctness** — `isActive` is
right regardless — but it (a) moves due fees into `collectedFees` so you can
sweep them, and (b) settles accounts so the on-chain `paidThrough` stays
current. Build the subscriber list by indexing the `Subscribed`/`Cancelled`
events (a tiny indexer or a `cast logs` cron is enough at your scale).

**Getting paid:** `sweep(amount)` sends collected fees to the owner address.
Customer deposits are not sweepable — the function can only touch
`collectedFees`, which is worth double-checking any time you modify the
contract.

**Plan changes:** `setPlan(planId, price, exists)`. A price change applies at
each subscriber's *next* renewal — the current paid period is untouched.
Setting `exists=false` retires a plan: current subscribers finish their paid
period, then lapse.

## What to keep an eye on

- **Subscribers about to lapse.** Watch for accounts where
  `balance < plan price` and `paidThrough` is near. A "your balance runs out
  on X" email/notification is the onchain equivalent of a dunning email, and
  it's the difference between a lapse and a top-up.
- **Keeper failures.** If `chargeBatch` stops running, nothing breaks for
  customers, but your revenue stays unrealized and `paidThrough` goes stale.
  Alert if the job hasn't succeeded in >48h.
- **Owner key.** It controls plans and sweeps fees. Put it on a multisig (or
  at minimum a hardware wallet) before real money accumulates, and consider
  `transferOwnership` to it right after deploying from a hot key.
- **USDC decimals = 6.** `$5` is `5_000_000`. Every price, deposit, and UI
  string. Also confirm you're using the chain's canonical USDC address — there
  are lookalike tokens.
- **Allowances.** Customers approve your contract to pull USDC. Encourage
  exact-amount approvals in your UI rather than unlimited ones.
- **No upgradeability.** The contract is immutable by design. If you ever need
  to change the rules, the migration path is: deploy v2, honor old
  `paidThrough` in your backend during a transition window, and have users
  `cancel()` (full refund) and re-subscribe on v2. Don't improvise this mid-
  incident — write the runbook before you need it.
- **RPC reliability.** Your API now depends on a JSON-RPC call per request.
  Use a provider with fallbacks (or two providers raced), and decide your
  failure mode explicitly: if the RPC is down, fail open or closed? For a
  hobby-priced API, fail-open-with-short-grace is usually the right call, but
  make it a decision, not an accident.
- **Events are your source of truth** for anything analytical: `Charged` for
  revenue, `Subscribed`/`Cancelled` for churn, `Deposited`/`Withdrawn` for
  float. Index them from day one; reconstructing them later is annoying.
