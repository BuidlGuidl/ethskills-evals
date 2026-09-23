# NOTES — Onchain billing for the weather API

## What's here

| Path | What it is |
|---|---|
| `src/WeatherBilling.sol` | The billing contract. Self-contained, no dependencies beyond Solidity itself. |
| `script/Deploy.s.sol` | Foundry deploy script ($5 hobby / $20 pro defaults). |
| `test/WeatherBilling.t.sol` | 31 tests, including a money-conservation invariant asserted after every scenario. |
| `foundry.toml` | Build config. |

Toolchain is [Foundry](https://getfoundry.sh): `forge build`, `forge test`,
and `forge script ... --broadcast` to deploy. First clone needs
`forge install foundry-rs/forge-std` to restore the test library (it lives
under `lib/`, which is generated and gitignored here).

Deploy:

```bash
export USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48   # mainnet USDC; override per chain
export OWNER_ADDRESS=0xYourMultisig                              # sets prices, collects revenue
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

Verify the USDC address against Circle's docs for the chain you pick. On a
chain whose "USDC" uses different decimals, export matching `HOBBY_PRICE` /
`PRO_PRICE` (defaults are `5e6` / `20e6` for 6 decimals).

**Pick the chain with gas in mind.** Customers pay gas to top up and the
backend pays gas for every renewal (~100k gas each, once a month per active
customer). On mainnet at busy gas prices that can rival the $5 plan itself;
on an L2 like Base (native USDC, sub-cent txs) it's noise. This system makes
more sense on an L2.

## How billing works, in plain words

A contract cannot charge anyone by itself — nothing onchain runs on a timer.
So there is no monthly cron job and no keeper service. Instead the model is
**pre-paid periods with lazy renewal**:

1. The customer deposits USDC with `topUp` — an internal, always-refundable
   credit balance.
2. `subscribe(plan)` moves the first month's price out of credit into escrow
   and the subscription runs until `paidUntil` (now + 30 days). The escrowed
   money is earned by the service only as time passes.
3. When `paidUntil` passes, the subscription has simply run out — the
   address stops being subscribed at that block, no grace period. Anyone may
   then call the permissionless `renewFor(customer)` to charge the next
   month from the customer's remaining credit.
4. `cancel()` stops service immediately and credits back the unused pro-rata
   share of the current month, plus leaves the unspent credit untouched.
   `withdraw()` returns all of it as USDC.

Three money pots, and one dollar never silently becomes another's:

- `credits[user]` — the customer's unspent deposit. Refundable at any time;
  only the customer can move it.
- `held[user]` — escrow for the period currently paid for. Pro-rata
  refundable on cancel; bounded by what was actually paid, so a price
  change can never inflate or deflate a refund.
- `revenue` — fully earned money. The only pot the owner can touch.

The tests assert after every scenario that
`contract's actual USDC == sum(credits) + sum(held) + revenue`, so the pots
can't leak into each other.

## Who sends each transaction, and why they'd bother

| Call | Who | Why they'd send it |
|---|---|---|
| `topUp`, `subscribe`, `cancel`, `changePlan`, `withdraw` | the customer | it's their money and their service |
| `renewFor(user)` | **your backend** (or the user, or anyone — it's permissionless) | the backend is collecting its own revenue; the user is buying their own month of service |
| `settle(user)` | your backend / you | moves a fully-elapsed period's escrow into `revenue` so you can collect it |
| `setPrice`, `collectRevenue` | you (owner key) | your revenue, your pricing |

The important property: **billing keeps working with nobody running it.**
Nothing here depends on a scheduled job, an admin key, or a third-party
keeper. The backend's renewal call is not a maintenance duty — it's how it
gets paid, triggered lazily by the customer's own traffic. If your backend is
down for a week, nobody gets robbed: lapsed customers just aren't subscribed
until a renewal lands, and every customer can always `withdraw` their
unspent money without you.

`renewFor` is deliberately one period per call: a stranger renewing someone
can only buy them one more month of service *with the customer's own
pre-deposited, refundable funds* — nothing to gain, nothing to fear.

## The per-request check

One `eth_call`, no gas, no indexing required:

```ts
// per incoming request (or cached for 30–60s if RPC load matters)
const [subscribed, planId] = await billing.read.isSubscribed([requesterAddress]);
if (!subscribed) return http402();
```

Or from a shell while debugging:

```bash
cast call $BILLING "isSubscribed(address)(bool,uint8)" $CUSTOMER
cast call $BILLING "needsRenewal(address)(bool)" $CUSTOMER
```

Request-handler flow:

1. `isSubscribed(addr)` — if true, serve.
2. If false, `needsRenewal(addr)` — if true (active, lapsed, credit
   covers the price), fire a `renewFor(addr)` tx from the backend's
   operator wallet, then serve. You can serve the request optimistically
   here; the renewal confirms within seconds.
3. Otherwise they're out of credit or cancelled — return 402 with a hint
   to top up.

That makes renewals self-healing and proportional to usage: a customer who
doesn't call the API doesn't cost you a renewal tx until they come back.

`subscribe`/`renewFor`/`cancel`/`planChanged`/`settled`/`withdrawn` events
are all emitted if you later want to build an indexer cache, but the view
call is the authoritative check — don't make correctness depend on your
own event indexer staying up.

## Day-to-day runbook

- **Nothing to do for renewals** beyond the request-handler logic above.
  Send `renewFor` from a small hot wallet; keep a few dollars of the chain's
  gas token in it.
- **Collecting revenue:** earned money lands in `revenue` when periods
  elapse (`renewFor`/`settle`) or are cancelled. Periodically call
  `settle(user)` for lapsed-with-credit-less customers, then
  `collectRevenue(treasury)`. Nothing is lost if you wait — it's your
  counter inside the contract, not an outbound transfer. Do it from the
  treasury multisig directly if you like; the call is one button on a block
  explorer.
- **Price changes:** `setPrice` affects future charges only. Already-paid
  periods are honoured at the old price, and refunds are computed from what
  was actually paid. Announce changes; subscribers who dislike the new price
  cancel and withdraw.
- **Support answers you'll need:** "topped up but not subscribed" → they
  need to call `subscribe(0)` or `subscribe(1)` after topping up;
  "subscribed but getting 402" → check `paidUntil` vs chain time and whether
  their credit ran out; "where's my refund" → `cancel` then `withdraw`,
  two transactions, no one's permission needed.

## What to keep an eye on

1. **Solvency.** `usdc.balanceOf(billing)` should always equal
   credits + held + revenue (the `subscriptionOf` view plus the two public
   mappings; or just watch the contract's USDC balance never drop without a
   matching withdrawal/RevenueCollected event). A mismatch means something
   is deeply wrong — pause deposits and investigate.
2. **Renewal backlog.** Count of customers where `needsRenewal == true` but
   requests are still arriving — if renewals are failing, check the
   operator wallet's gas-token balance first; that's the most common way
   this quietly breaks.
3. **Operator wallet ETH/L2-gas balance.** Renewals stall without it.
4. **Lapsed-and-forgotten subscriptions.** Customers who stopped calling
   the API with escrow still in `held` — their money, but it also sits as
   your uncollected revenue until `settle`. A weekly sweep is plenty.
5. **`PriceUpdated` events.** That's the only lever the owner key has over
   customers' future bills — you should know every time it moves.
6. **Refund complaints.** Any customer dispute is resolvable from public
   state: `credits`, `held`, `paidUntil` for the address, no logs required.
7. **Upgrade pressure.** There is no upgrade path, by design. If you ever
   want new billing semantics, that's a new contract and a migration
   (customers withdraw from the old one) — don't retrofit a proxy.

## What this design gives up (the honest list)

- **Can you stop someone from using it?** The onchain half: no. There is no
  pause key, no upgrade proxy, no blacklist, and the owner cannot touch
  `credits` or `held` — only `revenue` and future prices. Of course the
  *API itself* is your server, so you can refuse to serve anyone at the
  edge regardless of what the contract says; onchain billing doesn't change
  that, and it doesn't need to. What matters is that a refused customer's
  money is never hostage: cancel and withdraw need no permission from you.
- **Could someone else run it if you vanished?** The contracts and state,
  yes: everything is public and permissionless, so anyone could stand up a
  new API in front of the same contract and keep serving the same paying
  customers, and customers could still get refunds without you. Your API,
  domain and any frontend would not survive you — that's the half that
  dies. That split is fine as long as you know which half is which.
- **What does an observer learn?** Everything: who subscribes, to which
  plan, their balances, when they top up, cancel, get refunded. Public
  forever, scrapable by competitors. For weather-API billing that's almost
  certainly fine; it would not be for anything sensitive.
- **Is it audited?** No. This is tested code (31 tests, conservation
  invariant included), not an audited product. An audit is a point-in-time
  review of a fixed scope — if real money flows grow beyond hobby scale,
  get one, and treat these notes as the scope description to hand over.
- **Randomness:** none used anywhere, deliberately — billing is timestamps
  and arithmetic only. One caveat about timestamps: validators can jitter
  `block.timestamp` by a few seconds, so a `paidUntil` boundary can shift
  by that much in either direction. Irrelevant at $5/month granularity;
  don't reuse the pattern for anything where seconds matter.