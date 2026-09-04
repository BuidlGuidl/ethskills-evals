# Running this thing

Weather API billing, onchain. USDC on Base, prepaid, metered by the second.

This document is the part you read after it is live: what actually has to happen day to day, what
it costs, what breaks, and what the design gives up compared to Stripe.

---

## 1. The one thing to understand first

There is no billing cycle in this system. Nothing charges anybody on the 1st of the month.

That is not a shortcut — it is the only version that works. A contract is a state machine that
moves when someone sends it a transaction and pays gas, and sits perfectly still otherwise. It has
no cron, no scheduler, no timer, no background thread. So "charge every subscriber $5 on the 1st"
is not a feature you can write down; it is a promise that *somebody* sends one transaction per
subscriber per month, forever, and eats the gas. That somebody would be you. The month you are on
holiday, or the month gas spikes, or the month you lose interest, the billing silently stops.

So instead: **a subscription is a prepaid balance draining at a fixed rate, and how much has
drained is computed from a timestamp whenever anyone looks.**

```
owed(user)     = min(rate × (now − startedAt) / 30 days,  deposited)
expiresAt(user) = startedAt + deposited × 30 days / rate
isSubscribed   = now < expiresAt
```

Nobody sends a transaction to charge a customer. Nobody sends a transaction to expire them. A
customer who runs out at 03:14 on a Sunday stops being subscribed at 03:14 on that Sunday because
`block.timestamp` moved, and time moves for free. `isSubscribed()` is a 1,235-gas view — your
backend reads it with `eth_call` and pays nothing.

This also means there is no bad debt, no liquidation, no collateral, no price oracle, and no
window where a customer owes you money they might not have. They already paid. The only thing the
contract does is decide whose money it is now.

**"Charged monthly" became "charged continuously at the monthly rate."** Same money — thirty days
of hobby costs exactly $5.00 — but the customer gets an exact refund when they leave instead of
losing the rest of a period, and you get no monthly transaction to babysit. If you ever genuinely
need discrete monthly invoices for accounting, derive them off-chain from the `Settled` events;
don't put a calendar in the contract.

---

## 2. The only recurring transaction: your payday

Money a customer has spent sits in the contract, credited to nobody in particular, until someone
calls `settle()` — which moves it out of their refundable balance into `claimable` — and
`collect()`, which pays it to `revenueRecipient`. `settleAndCollect(address[])` does both.

Working through the three questions you should ask about any recurring onchain transaction:

**Who sends it?** You do. There is a script:

```bash
# rebuild the subscriber list from the event log, keep only accounts worth the gas
RPC_URL=$RPC_URL BILLING_ADDRESS=$BILLING_ADDRESS node backend/scripts/subscribers.js > accounts.txt

# settle them and sweep the proceeds to revenueRecipient
BILLING_ADDRESS=$BILLING_ADDRESS forge script script/Sweep.s.sol --rpc-url base --broadcast
```

**Why would they?** Because it is the only way to get paid. This is not a maintenance chore you
have to remember out of duty; it is the withdraw button.

**Is that enough?** Measured, not guessed (`forge test --match-contract GasBenchmark -vv`):

| subscribers in the batch | total gas | gas per account |
|---|---|---|
| 10  | 91,443    | 9,144 |
| 50  | 254,803   | 5,096 |
| 100 | 459,003   | 4,590 |
| 250 | 1,073,312 | 4,293 |

Cost = `gas × base_fee × ETH_price`. At 0.01 gwei and $4,000/ETH, sweeping 100 accounts is about
**$0.02**, and those 100 accounts on pro are **$2,000** of revenue. Even at 1 gwei — a bad day on
Base — it is $1.84 against $2,000. The margin is roughly five orders of magnitude, so this is
never the thing that stops working. Check `cast gas-price --rpc-url base` before a sweep if you
want the number of the day rather than mine.

**What if you never send it?** Nothing breaks. Not for you and not for anyone else. The USDC stays
in the contract, still owed to exactly the same parties, and `owedOf()` keeps counting. No
customer loses access, no position gets liquidated, no state goes stale. Sweep monthly, sweep
annually, or sweep once when you feel like it — the arithmetic is identical either way, which is
the whole point of computing accrual from a fixed `startedAt` rather than accumulating it.
`test_NeverSettlingHarmsNobody` walks two years forward with zero maintenance transactions and
then collects the full amount.

Two consequences worth internalising:

- **`settle()` is permissionless.** Anyone can call it for anyone. It can only move money in the
  direction the formula already says it went, so there is no call that hurts the accounts named in
  it, and it does not change anyone's expiry. If you want the sweep automated, hand it to a hot
  key with no privileges — there is nothing on it worth stealing.
- **`collect()` is permissionless too**, and always pays `revenueRecipient` (owner-set). A
  stranger pushing the button just does you a favour.

**Batch size.** 250 accounts is ~1.07M gas, comfortably inside Base's block limit. Past ~2,000
accounts per call you will hit it — `subscribers.js` gives you the list, so split it and send two
transactions. The contract deliberately keeps no onchain array of subscribers, because a loop over
one would grow forever and eventually cost more gas than a block holds, at which point you could
not get paid at all.

---

## 3. Day to day

### The API gate

`backend/` is a small Node service. Per inbound request it: verifies a bearer token bound to an
address, asks the gate whether that address is subscribed, applies the per-plan rate limit, and
serves the data.

It does **not** hit the RPC on every request. It caches, and it can cache confidently because
`statusOf()` returns the *expiry timestamp*, not just a boolean. Between two reads the answer can
only change two ways:

1. Time passes and the balance runs out — already known, it is the cached expiry.
2. The customer sends a transaction (top up, withdraw, cancel, change plan) — that emits an event,
   and the watcher drops the cache entry within a polling interval (~4s).

If the watcher stops confirming it is alive, the gate drops itself to a 5-second TTL rather than
serving confident stale answers. Deliberate asymmetry: a cancelled customer keeping access for an
extra minute costs you pennies, a paying customer locked out costs you the customer.

> One assumption baked in: chain time ≈ wall-clock time. True on Base. It is *not* true on a
> time-warped anvil, which is why `tools/e2e-local.sh` runs with a 500 ms cache TTL.

### Sign-in

An address in a header proves nothing. The customer signs a human-readable nonce once
(`GET /v1/auth/nonce` → `POST /v1/auth/token`), gets an hour-long HMAC token bound to their
address, and uses that. `verifyMessage` goes through a viem public client, so smart-contract
wallets (Safe, most modern wallets) work via ERC-1271, not just EOAs.

`SESSION_SECRET` protects your API's access control and nothing else. Losing it logs everyone out.
It cannot put a single cent of customer USDC at risk — the money is in the contract, and the
contract has never heard of your server.

### Customer lifecycle, and the one Stripe-shaped surprise

| they want to | they call |
|---|---|
| start | `approve(billing, n)` then `subscribe(planId, amount)` |
| add more time | `topUp(amount)` |
| let someone else pay | `topUpFor(their address, amount)` from any wallet |
| switch tier | `changePlan(newPlanId)` — settles at the old rate, restarts at the new one |
| take some back | `withdraw(amount, to)` — shortens expiry, keeps the subscription |
| leave | `cancel(to)` — refunds every unspent cent, prorated to the second |

**Nothing auto-renews.** This is the single biggest behavioural difference from Stripe and it will
cost you customers if you ignore it. There is no card on file to charge; a customer who forgets to
top up simply stops working one morning. Budget for it:

- Run an expiring-soon job (see §4) and email people a week out.
- Encourage bigger deposits. A year of hobby is $60 and one transaction, and the customer can
  still walk away with the unused remainder whenever they like — there is no lock-in penalty for
  prepaying long.

**A lapsed customer still has a plan.** They resume with `topUp()`, not `subscribe()` — a second
`subscribe()` reverts `AlreadySubscribed`. Make your frontend and docs say this, because the error
name reads as though something is wrong when nothing is. And they are **not** charged arrears: if
they lapse in March and top up in June, the meter restarts in June. They were not served in
between, so they do not pay for it (`test_LapsedAccountIsNotChargedArrearsOnTopUp`).

### Prepaid balances are a liability, not revenue

`totalUserBalance` is money customers can take back at any moment, without asking you. Only
`claimable` plus what you have already collected is yours. Do not spend the float — treat it the
way you would a Stripe balance you have not earned yet. The invariant tests assert the contract
can always pay everything it says it owes; make sure your bookkeeping says the same thing.

---

## 4. What to keep an eye on

Alert on these. Roughly in order of how much it will hurt.

**Solvency — should never fire.**
`USDC.balanceOf(billing) >= totalUserBalance() + claimable()`. If this is ever false something is
badly wrong (or Circle blacklisted the contract). Page yourself.

**Gate health.** `GET /health` exposes `watcherHealthy`, `rpcErrors`, `cachedAccounts`, hit/miss
counts. `watcherHealthy: false` means cache invalidation is blind and you are running on the
5-second TTL — degraded, not broken, but fix it. Climbing `rpcErrors` means your provider is
flaking and paying customers are about to see 500s.

**402 rate.** A spike is either customers genuinely lapsing (fine, send reminders) or your gate
reading the chain wrong (very much not fine). Tell them apart with
`node backend/scripts/check.js <address>` — it reads the chain directly, no cache, no server.
That one command separates "the chain disagrees" from "my cache is stale" and is the first thing
to run on any "I paid and it says I haven't" ticket.

**Expiring soon.** Not an alert so much as a job: from the `Subscribed` log, read `expiresAt` for
each account and notify anyone inside seven days. This is the closest thing you have to a dunning
email, and without it churn is just people forgetting.

**Unswept revenue.** `subscribers.js` prints pending and claimable totals. If pending keeps growing
you are not getting paid — which harms nobody but you, so it is a report, not a page.

**Your RPC provider.** They decide what your gate believes about your customers. Set
`FALLBACK_RPC_URL` to a provider from a different company and compare when they disagree.

**Circle and USDC.** USDC is an upgradeable proxy that Circle controls. They can blacklist any
address, including this contract, which would freeze every deposit in it — yours and your
customers'. Nothing in this design can prevent that; it is the price of a fiat-backed stablecoin.
Watch Circle's announcements the way you would watch a critical vendor's status page.

**Ownership events.** Alert on `OwnershipTransferStarted` / `OwnershipTransferred` /
`RevenueRecipientSet`. If one of those fires and it was not you, your owner key is compromised.

**Chain plumbing.** Base gas price before a sweep. Base's status page for sequencer incidents —
while the sequencer is down nobody can subscribe, top up or cancel, though `isSubscribed` keeps
answering correctly from state your RPC already has.

---

## 5. What this design gives up

The honest version. Some of this is worse than Stripe and you should know which parts before a
customer asks.

### Can anyone be stopped from using it?

**By me, at the contract: no.** These are the operator powers that actually shipped, in full:

| power | what it does | what it cannot do |
|---|---|---|
| `setPlan` | change a price, retire a plan | touch anyone already subscribed — their rate is *copied* into their account at signup, so raising the hobby price to $500 does not drain a single existing customer (`test_PriceChangeDoesNotTouchExistingSubscribers`). Retiring a plan blocks new signups only; its subscribers keep access, keep topping up, keep their refund. |
| `setRevenueRecipient` | change where my revenue lands | reach user deposits |
| `sweepSurplus` | recover tokens sent here by accident | mathematically bounded to `balance − totalUserBalance − claimable`; it cannot reach a cent of anyone's deposit |
| `rescueToken` | recover some *other* ERC-20 | reverts on the billing token |
| `transferOwnership` | hand over, in two steps | anything until the new owner accepts |

There is **no pause, no blacklist, no upgradeable proxy, and no owner function that can move,
freeze, or expire a user's balance.** `cancel()` has no owner check and no cooldown. If my key
were stolen outright, the thief could garble the plan table and redirect *future* revenue — and
every existing customer would keep their access at their locked-in rate and could still withdraw
every unspent cent.

**By me, at the API: completely.** The gate is my server. I can refuse any address for any reason,
and the contract will happily keep metering them while I do. That is the real censorship surface
here, and no amount of onchain design removes it — the weather data is mine and it is offchain. A
customer I cut off is not stuck, though: they can `cancel()` and get their unused balance back
without my cooperation. That is the whole safety valve, and it is worth telling customers about.

**By third parties: yes, in two places.** Circle can blacklist USDC addresses, including this
contract. Base's sequencer can delay or decline to include a transaction — Base offers forced
inclusion via L1 after a delay, so this is censorship with a timeout rather than a wall, but it is
real. Neither is mine to fix; both are consequences of choosing USDC on an L2, which I would still
choose.

**If I lose the owner key:** prices freeze and `setRevenueRecipient` freezes. Everything else keeps
working — customers subscribe, top up, cancel and get refunded; `collect()` is permissionless so
revenue still reaches the last recipient I set. Nobody is trapped and no money is stranded.
`test_LostOwnerKeyDoesNotTrapAnybody` asserts exactly this.

### Could someone else run it?

Verified source on Basescan is **not** an answer to this question, and stopping there is the usual
mistake. The honest split:

**Survives me disappearing entirely:**
- The contract and every balance in it. `cancel()` needs no cooperation from me, so every customer
  can recover their unspent USDC with a single transaction from their own wallet even if I am
  never heard from again.
- All the state. `statusOf`, `expiresAt`, `owedOf` are public reads.
- The subscriber list. It is rebuilt from public logs by `subscribers.js`, so anyone can rebuild
  it — including whoever inherits this.
- `settle()` and `collect()` — anyone can call them, though the proceeds go to my recipient.
- The source is MIT. Someone can deploy their own instance and run a competing service tomorrow.

**Dies with me:**
- The weather data. That is the actual product and it is a server I run.
- The gate, the nonce store, the token issuance, the domain, the RPC config.
- Anyone's *access*. If my server is down, subscriptions keep draining — customers are buying
  time, not requests, so an outage bills them for nothing. Their remedy is `cancel()`, which they
  can do without me. Worth saying out loud in your terms: extended downtime is not automatically
  refunded by the contract, but leaving always is.

So: the money is credibly not-mine-to-keep, the service is entirely mine to withdraw. Someone
forking this repo gets a working billing system; they do not get my customers, because those
subscriptions are balances in my deployment.

### What does an observer learn?

Everything, forever, and this is strictly more public than Stripe.

Onchain and permanent: every subscriber's address, which tier they chose, exactly how much they
deposited and when, every top-up, when they cancelled and how much they got back, and their expiry
timestamp. Anyone can compute my exact MRR, subscriber count and churn in real time from public
logs — competitors included, without asking me. Customers can see each other. A subscriber's
address links this to everything else that address has ever done: their DeFi positions, NFTs, ENS
name, exchange deposits.

There is no privacy dial to turn. What is available: a customer can subscribe from a fresh address
used for nothing else, and `topUpFor` lets a funding wallet differ from the subscribing one, which
helps a little. Neither is anonymity. If a customer needs their spending private, this system
cannot give them that and they should be told so plainly rather than discovering it later.

Separately — and this is a different question, not this one — my API access logs (which
coordinates, which IPs, at what times) live on my server under my privacy policy. Nothing about
putting billing onchain changes that either way.

### What does "audited" cover?

**This has not been audited.** What it has: 37 unit tests, 5 fuzzed invariants (solvency, no money
printing, accounting consistency, expired accounts fully drained, subscribed-iff-before-expiry),
and an end-to-end run against a real node. That is decent evidence and it is not an audit.

If you do commission one, be clear about what you are buying: a point-in-time review of a specific
commit, by people who may or may not have looked hard at the thing that eventually breaks. It is
not a standing guarantee about the code running in production, and it stops covering your contract
the moment you change a line and redeploy. "Audited" on a landing page next to a contract that has
since been modified is a lie with a receipt.

Given that: this holds customer deposits. Before it holds meaningful money, get a second pair of
eyes on `_settle`, `_restartIfLapsed` and the `withdraw`/`cancel` accounting, and run it on Base
Sepolia with real wallets for a couple of weeks first.

---

## 6. Deploying

```bash
forge test                                  # 37 unit + 5 invariant tests
./tools/e2e-local.sh                        # full stack against a throwaway anvil

cp .env.example .env && $EDITOR .env

# testnet first, always
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify

# mainnet, signing from hardware
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify --ledger
```

The deploy script sets the plans, then hands ownership to `BILLING_OWNER`, who must call
`acceptOwnership()`. That second transaction is the point: a typo'd owner address is recoverable
right up until it is accepted. Use a Safe or a hardware wallet — not the key that signed the
deployment.

Then put `BILLING_ADDRESS` and the deploy block (`BILLING_START_BLOCK`, so log scans do not start
from genesis) into `backend/.env`, and verify with:

```bash
node backend/scripts/check.js 0xSomeAddress
```

### Before you broadcast to mainnet

- [ ] `BILLING_TOKEN` is Circle's **native** USDC on Base
      (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), not bridged USDC.e. Check it against
      Circle's own list; the deploy script asserts the address has code but cannot tell you it is
      the right token.
- [ ] Prices are in **6-decimal base units**. $5.00 is `5000000`. A factor of a thousand here is a
      $5,000/month hobby plan or a half-cent one.
- [ ] `BILLING_OWNER` is a Safe or hardware wallet you control and have tested signing from.
- [ ] `BILLING_RECIPIENT` is somewhere you can actually spend from.
- [ ] Ran on Base Sepolia end to end with a real wallet, including a cancel and a refund.
