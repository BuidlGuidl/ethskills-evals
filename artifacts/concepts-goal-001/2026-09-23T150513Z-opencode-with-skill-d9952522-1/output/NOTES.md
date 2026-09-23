# NOTES — running this once it's live

## The one design decision everything hangs on

There is no monthly charge transaction. Nothing onchain runs on a schedule — a
contract only moves when someone sends it a transaction, so "charged monthly"
is implemented as **accrual at read time**: the contract stores each
customer's balance, plan, and last-settled timestamp, and computes
`owed = price × elapsed / 30 days` whenever anyone reads or touches the
account. `isSubscribed(addr)` is true while `balance > owed`.

Consequences, all deliberate:

- **No keeper, no cron, no automation bill.** The system does not depend on
  you (or anyone) sending maintenance transactions. There is a permissionless
  `settle(account)` anyone may call, but it's optional housekeeping — reads
  already account for accrual, so nothing breaks if it's never called.
- **Expiry is a timestamp, not an event.** A customer whose balance runs out
  simply stops passing `isSubscribed` at `subscribedUntil(addr)`. Nothing
  "happens" onchain at that moment, and nothing needs to.
- **Charges round down to the nearest whole USDC unit**, slightly in the
  customer's favor. At $5/month that's sub-cent per settlement; irrelevant.
- **No debt.** A lapsed subscription can never go negative. If a customer
  comes back after three months and tops up, they owe nothing for the gap —
  `deposit` settles first, capped at what was actually in the balance.

## Day to day

**Your backend, per request:** call `isSubscribed(customerAddress)` — a free
`eth_call`, ~50ms against any RPC (`backend/check-subscription.mjs` is the
reference; a one-line `cast call` works too). `isSubscribed` does not tell you
*which* plan, only subscribed-or-not. If you want plan-tiered rate limits,
also read `subscriptions(addr).planId`, or cache `subscribedUntil` for a few
minutes and treat now < until as subscribed — it only moves when the customer
themselves sends a transaction, so short caching is safe.

**Your revenue:** charges land in the `earned` counter only when a customer
transacts (deposit, subscribe, cancel, or anyone calls `settle`). So `earned`
is a *lower bound* on what you've actually accrued — the rest is accrued but
not yet settled. Withdraw whenever with `withdrawRevenue(to, amount)`. If you
want the number up to date before withdrawing, call `settle` on the accounts
you care about first — but at $5–20/month per customer, doing this monthly or
quarterly is plenty.

**Customers:** they need USDC and a wallet. The flow is `approve` →
`deposit(amount)` → `subscribe(0 or 1)`. Topping up while subscribed just
extends `subscribedUntil`; switching plans is `subscribe(otherPlan)` and
settles at the old rate first. `cancel()` refunds the entire unused balance in
the same transaction — there is no "cancel at period end", it's immediate.

## What to keep an eye on

- **The owner key.** It can only withdraw from `earned` — never customer
  balances — but losing it strands future revenue in the contract forever, and
  a compromised key drains accrued-not-yet-withdrawn revenue. Withdraw
  regularly, keep the key in a hardware wallet or multisig, and treat
  `earned` sitting in the contract as your float at risk.
- **RPC dependency.** Your paywall is only as reliable as your RPC. If your
  RPC provider goes down or starts censoring, paying customers get 402s. Run
  two providers (or your own node) and fail over, not fail closed-open
  either way — decide explicitly whether an RPC outage means "allow" or
  "deny" for your service.
- **USDC is a company, not a protocol.** Circle can freeze specific addresses.
  A frozen customer's balance is stuck — you can't release it for them, and
  neither can the contract. This is inherent to billing in USDC; if it
  matters to your users, say so in your docs.
- **Everything is public.** Every competitor can see exactly how many
  customers you have, what each paid, which plan they're on, and when each
  cancels. Customer addresses are also linkable to whatever else those
  addresses do onchain. Don't collect addresses you don't need, and don't
  promise billing privacy you can't provide.
- **Plan prices are immutable.** $5/$20 are baked in at deploy. Changing
  prices means deploying a new contract and asking customers to move — there
  is deliberately no admin setter that could reprice a paying customer out
  from under them.

## What the design gives up, in plain words

- **Censorship resistance:** the contract itself has no pause, no blacklist,
  no upgrade mechanism, and no admin access to user funds — nobody, including
  you, can stop a customer from depositing, subscribing, or cancelling. The
  one lever that exists is offchain: your API is yours, and you can refuse to
  serve any address regardless of what the contract says. The billing layer
  can't enforce that refusal; only your backend can.
- **If you disappear:** the contract keeps working forever without you.
  Customers can still top up, subscribe, and — critically — cancel and get
  their unused balance back, using any Etherscan-style "write contract" UI.
  What dies with you is the API itself and the revenue withdrawal key. The
  contract is not upgradeable, so what you audit and deploy is what runs,
  permanently.
- **"Audited":** this code has tests, not an audit. An audit would be a
  point-in-time review of this exact code, not a standing guarantee — and any
  redeploy with changes is unaudited again until reviewed.

## Before mainnet

1. `forge test` — 15 tests covering accrual, expiry boundaries, cancellation
   refunds, plan switching, post-expiry top-ups, and owner withdrawal limits.
2. Deploy to Base Sepolia first (USDC address in `.env.example`), run a real
   customer flow end to end, watch it for a few days.
3. Verify the contract on Basescan (`forge verify-contract`) so customers can
   read what they're depositing into.
4. Given the contract holds other people's money, budget for an external
   review before real deposits. It's ~200 lines with no external calls beyond
   USDC — a cheap audit as audits go.
