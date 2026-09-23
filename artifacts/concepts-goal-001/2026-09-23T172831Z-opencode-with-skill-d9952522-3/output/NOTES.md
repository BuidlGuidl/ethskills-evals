# NOTES — onchain billing for the weather API

## What was built

| Path | What it is |
|---|---|
| `src/SubscriptionBilling.sol` | The whole billing system. One contract, no proxy, no dependencies. |
| `script/Deploy.s.sol` | Deployment script. Creates the contract and the two launch plans ($5 hobby, $20 pro). |
| `test/SubscriptionBilling.t.sol` | 20 tests covering the full lifecycle. Run with `forge test`. |
| `test/mocks/MockUSDC.sol` | Test-only USDC. Production deploys point at real USDC. |

Built with Foundry (already on this machine). `forge build` to compile, `forge test` to test.

To deploy (example: Base):

```sh
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
OWNER=<your ops address> \
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
```

Verify the USDC address for your chain yourself before deploying — the script's
comments list the well-known ones, but check them.

## The one idea the whole design rests on

**There is no monthly charge transaction.** Contracts can't run cron jobs — nothing
onchain happens unless someone sends a transaction and pays for it. So instead of
"charge $5 every 30 days," the contract treats a subscriber as owing
`seconds_elapsed × monthly_rate / 30 days` at every instant, computed from a
timestamp. Charging monthly and charging per second are the same money; per second
is just settled lazily.

"Settled lazily" means:

- **Reads** (`isSubscribed`, `effectiveBalance`, `subscribedUntil`) always compute
  the up-to-this-second answer for free. They are never wrong or stale.
- **Writes** to storage happen only when someone already has a reason to transact:
  the customer deposits, subscribes, switches plans, withdraws, or cancels — or
  anyone calls `settle(address)` permissionlessly.

So nobody ever has to run a job for the system to stay correct. The state machine
advances because users want API access and you want revenue — not because someone
remembered to run a script.

## Day to day

### Gating API requests (your backend)

One read per request, no transaction, no gas:

```sh
cast call $BILLING "isSubscribed(address)(bool)" $CUSTOMER --rpc-url $RPC
```

In JS/TS that's one `eth_call` via viem/ethers against your own node or an RPC
provider. If you want to shave RPC load, cache the result for a minute or two — a
customer's balance drains continuously, so a briefly stale `true` costs you seconds
of usage, and `subscribedUntil(address)` tells you exactly when someone's balance
runs out if you want to cache smarter (cache until `min(now + TTL, subscribedUntil)`).

If you want "your balance is low" warnings, `effectiveBalance(address)` and
`subscribedUntil(address)` give you the data; both are free calls.

### What customers do

1. Approve USDC to the contract, then `deposit(amount)` — any amount, whenever.
2. `subscribe(planId)` — needs a nonzero balance. Billing starts immediately,
   per second, from their balance.
3. `cancel()` — stops billing and refunds their entire unused balance in the same
   transaction. There is no notice period, no proration logic, nothing to
   administer; "get back whatever they haven't used" is exact to the second.
4. `withdraw(amount)` — partial top-up reversal without cancelling.

All four are customer-initiated and self-serving; you don't have to do anything
for any of them to work.

### What you (the operator) do

- **Collect revenue.** Charges only become withdrawable (`accrued`) when the
  account is settled. Settling is permissionless and cheap (~50k gas), and you are
  the one who profits from it, so call `settle(user)` then
  `withdrawRevenue(to, amount)` whenever you feel like sweeping — weekly, monthly,
  whenever the accrued number is worth the gas. On an L2 that's cents against
  real dollars of revenue, so the incentive math is comfortably positive.
- **Nothing else, on the happy path.** There are no daily tasks, no keeper, no
  cron. If you go on holiday for a year, subscriptions keep gating correctly and
  customers can still cancel and get their money back without you.

### Pricing changes

Plans are immutable on purpose. To change pricing, `createPlan(newRate)` makes a
new plan id for new subscribers, and `setPlanActive(oldId, false)` stops new
sign-ups to the old one. Existing subscribers keep their original rate until they
cancel or switch — you cannot reprice someone mid-subscription, and customers can
verify that onchain before they top up.

## What to keep an eye on

- **Your owner key.** It is the only privileged key. It can create plans,
  deactivate plans for *new* subscribers, withdraw *accrued* revenue, and hand
  over ownership. It can never touch a customer's un-accrued balance — that limit
  is in the code, tested, and worth saying to customers. Use a hardware wallet or
  multisig anyway: if the key is *stolen*, the thief gets only whatever revenue
  has accrued but not yet been swept (sweep regularly so that's small). If the key
  is *lost*, future revenue accrues forever with nobody able to withdraw it — the
  fix is to deploy a new contract and point your backend at it, and customers can
  cancel out of the old one at no loss.
- **USDC itself.** You inherit Circle's powers: USDC is upgradeable and has a
  blacklist, so Circle — not you — can freeze USDC held by this contract. That's
  the price of billing in a stablecoin people actually hold; just know it's there.
  If that's not acceptable, the contract takes any ERC20, but your customers want
  dollars.
- **Customer UX around allowances.** Topping up is two transactions (approve +
  deposit) unless you use permit or account-abstraction tooling. This is the most
  common place customers get confused; document it in your onboarding.
- **RPC reliability.** Your API gate is only as available as the node you call.
  Have a fallback RPC, and decide your failure mode: on RPC outage, fail open
  (serve anyway) or fail closed (reject). Fail open with a short cache is usually
  right for $5/month plans.
- **Dust.** Accrual rounds down by less than 1e-6 USDC per settlement (in the
  customer's favor). It is deliberately negligible; don't chase it.

## What this design gives up (read this before you trust it)

- **Can anyone be stopped from using it?** By the contract: no. There is no pause,
  no blacklist, no upgradeable proxy, no admin function that touches user funds or
  blocks a subscriber. The operator powers that exist are listed above and each is
  scoped so it can't take or freeze customer money. The one realistic censorship
  point is your API itself — the contract can say an address is subscribed, and
  you can still refuse to serve it. That's your business decision, not something
  the code enforces either way. And see "USDC itself" above: Circle can freeze the
  token.
- **Could someone else run it?** Half of it. The contract, its state, every
  customer's balance and subscription status live onchain: anyone can read them,
  verify them, fork the code, or build another frontend for deposits and
  cancellations. If you disappear tomorrow, customers can still cancel and recover
  every cent of unused balance without your cooperation — that part survives you.
  What does not survive you is the weather API itself: the data, the endpoints,
  and the backend check are yours alone. The billing being onchain guarantees
  refunds, not service.
- **What does an observer learn?** Everything, forever. Which addresses subscribe,
  at what tier, when they topped up, how much, when they cancelled, and how much
  revenue you withdrew. Competitors can watch your customer count and MRR in real
  time from a block explorer. That's inherent to public-chain billing; if a
  customer wants privacy they'd have to use a fresh address, and there's nothing
  you can do about it either way.
- **What does "audited" cover?** This code has not been audited. It has a test
  suite (`forge test`, 20 cases) covering accrual, refunds, lapses, owner limits,
  and plan immutability — that's evidence, not a guarantee. If real money
  accumulates in this contract, pay for an audit: a point-in-time review of a
  fixed commit, which says nothing about code you change afterward.
