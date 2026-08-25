# Running this thing

Everything below assumes the contract is deployed on Base and `backend/` is running in front of
your weather API. If you read one section, read [What this design gives
up](#what-this-design-gives-up) — it is the part that is genuinely different from Stripe, and
the part nobody tells you until it bites.

---

## First: what you actually deployed

A contract cannot run a cron job. It has no clock, no scheduler, and no background process. It
sits inert until somebody sends it a transaction and pays gas for that transaction. So "charge
the customer $5 on the 1st of every month" is not a thing the contract can do to itself — it
would need someone to send one transaction per customer per month, forever, and to keep paying
for it after they stop caring.

This contract therefore never charges anybody. It stores three numbers per customer — a prepaid
`balance`, a `ratePerPeriod`, and the timestamp those numbers were last accurate as of — and
computes the rest on demand:

```
owed = ratePerPeriod × (now − lastSettled) / 30 days     (capped at balance)
```

That single line is the whole product:

- **"Charged monthly"** — the balance drains at the monthly rate. Same money, no transaction.
- **"Cancel and get back the unused part"** — the unused part was never spent, so there is no
  refund to process and no approval for you to give. They call `closeAccount` and it is theirs.
- **"Expires when the money runs out"** — the cap at `balance` means a subscription lapses at a
  second you can calculate today. Nobody sends an "expire" transaction, because there isn't one.
- **"Is this address subscribed?"** — `isActive(address)` is a view. Free, instant, no signer.

**The practical consequence: there is no chore you can forget that breaks the accounting.** If
you go on holiday for three months and touch nothing, every customer is still billed correctly,
still lapses on time, and can still cancel and get their money back. The only thing that stops
is money arriving in your wallet — and it is waiting for you when you get back.

---

## Going live: the checklist

```bash
cp .env.example .env      # fill it in
make test                 # 44 contract tests, incl. 5 stateful invariants
cd backend && npm test    # 8 gate tests against a real contract on anvil
make deploy-testnet       # Base Sepolia first, always
```

Then, before mainnet:

1. **Set `BILLING_OWNER` to a multisig, not your laptop key.** This key does not control
   customer money — it cannot, there's no code path — but it does control your revenue and your
   prices. A Safe with two signers costs you nothing and removes the worst single point of
   failure. If you use an EOA anyway, write the seed down offline and read
   [Owner key lost](#owner-key-lost) so you know what you are accepting.
2. **Check the USDC address.** `script/Deploy.s.sol` hardcodes native Circle USDC per chain and
   asserts the address has code. Deploying against a bridged or fake USDC is unrecoverable —
   customers would deposit real money into a contract wired to a worthless token.
3. **Do a full round trip on Sepolia**: subscribe → wait → check `isActive` flips → cancel →
   confirm the refund arrives. Ten minutes, and it is the only way to know the whole loop works.
4. **Record the deploy block** in `.env` as `DEPLOY_BLOCK`. The subscriber indexer scans from
   there; without it you scan from genesis and burn your RPC quota.
5. **Verify on Basescan** (`--verify` does this). Not because it makes the system trustless — it
   does not, see below — but because customers will look, and an unverified contract asking for
   USDC looks exactly like a scam.

After deploying, commit `deployments/8453.json`. It is the record of what is live.

---

## Day to day

### The recurring chore: collecting your money

This is the only thing you have to do, it is not urgent, and nothing degrades if you skip it.

```bash
make collectable    # who has accrued something worth settling, and how much
make collect        # SUBSCRIBERS=... paste from the line the previous command prints
```

`settleAndCollect` books elapsed time for a batch of customers and sweeps the proceeds to your
wallet, in one transaction. Roughly 4,900 gas per account plus about 25,000 fixed, so 200
accounts is about 1.0M gas — pennies on Base, but check `cast gas-price --rpc-url base` if you
want a real number for today.

**Do it monthly, or quarterly, or whenever.** Unsettled time is not lost time — it is still
yours, it is just still sitting in the contract labelled as the customer's balance instead of
yours. `accrued(address)` tells you what you have earned but not booked. The only cost of
waiting is that the money is not in your wallet yet.

The one thing that *is* worth doing before a long gap: nothing. Really. The trap this design
avoids is the one where you ship an `onlyOwner` maintenance function, everything depends on you
running it, and the system quietly breaks the month you get busy.

### Warning people before they lapse

```bash
make lapsing        # everyone whose money runs out in the next 7 days
```

This matters more than it looks. A subscription ends *silently* — there is no failed-payment
email, because there is no payment attempt. The customer just starts getting 402s one morning.
Nobody will tell them but you. Wire this to whatever you use for email; it is the single highest
-value thing you can build on top of what's here.

### Onboarding a customer

Two transactions from their wallet, on Base, with USDC and a little ETH for gas:

1. `approve(billingContract, amount)` on USDC
2. `subscribeWithDeposit(planId, amount)` — plan 1 is hobby, 2 is pro

Then they sign a login message at `POST /auth/challenge` → `POST /auth/verify` and get a bearer
token for your API. The signature costs nothing and moves nothing; it just proves they hold the
address that is paying.

There is no frontend for step 1 and 2 yet — see [What I did not
build](#what-i-did-not-build). Today they do it from Basescan's *Write Contract* tab, which
hobby developers can manage and nobody else will.

**Tell customers to deposit more than one month.** A $5 deposit on the hobby plan is exactly 30
days of runway and then a silent cutoff. $20 is four months and one less thing for both of you
to think about.

### Changing a price

```bash
PLAN_ID=1 PLAN_PRICE=7000000 PLAN_OPEN=true \
  forge script script/Ops.s.sol --sig "setPlan()" --rpc-url base --broadcast
```

**Existing subscribers are not affected and cannot be.** Each account snapshots its rate at
subscribe time, so a repricing only reaches people who subscribe after it lands. That is
deliberate: it means the price change is not a power you hold over people who already paid, and
it means a compromised owner key cannot set the hobby plan to $10,000/month and drain everyone.
The flip side is that migrating existing customers to a new price requires asking them to call
`subscribe` again, and some never will.

To retire a plan, set `PLAN_OPEN=false`. Current subscribers keep running; new signups bounce.

---

## What to watch

Ordered by how much it hurts if you miss it.

### 1. Solvency — page yourself, this should never fire

```bash
make status     # reverts if the contract holds less than it owes
```

The invariant is `USDC.balanceOf(contract) ≥ totalEscrowed + revenue`. It is enforced by every
code path, checked by five stateful invariant tests across 128,000 randomized calls, and if it
is ever false in production something is very wrong — a token that behaves unexpectedly, or a
bug. Stop, do not collect revenue, work out why.

Run it from cron every few minutes. It is a read; it costs nothing.

### 2. `unaccountedBalance` — should be exactly zero

Every movement in this contract is between the escrow bucket and the revenue bucket, so
`held − escrow − revenue` is exactly `0` unless somebody sent USDC directly to the contract
address instead of calling `deposit`.

When it goes non-zero, **a customer has paid you and does not have a subscription** and does
not know it. Find them in the USDC `Transfer` logs, then either send it back or credit them with
`depositFor(theirAddress, amount)` — you will need to fund that yourself, then `rescue` the
stray amount to reimburse yourself. Alert on any non-zero value.

### 3. Gate health

`GET /healthz` returns the counters:

| counter | what it means | act when |
| --- | --- | --- |
| `failOpen` | RPC was down, no cache, you served someone for free | any increase |
| `staleServed` | serving from an expired cache because the RPC is unreachable | sustained > 0 |
| `rpcErrors` | RPC call failures | rate climbing |
| `hits` / `misses` | cache effectiveness | hit rate < ~95% means retune |

A healthy gate makes roughly one RPC call per subscriber per minute regardless of request
volume, because `activeUntil` is a promise about the future and one read authorises every
request until that second.

### 4. Your server's clock

The gate compares its own wall clock against a timestamp from the chain. If your API server's
clock drifts ten minutes fast, every subscription appears to end ten minutes early and paying
customers get 402s. **Run NTP.** This is a silly way to lose customers and it will not show up
in any of the counters above.

### 5. Gas money in the operator wallet

`settleAndCollect` needs ETH on Base. Not much — a collection run is cents — but zero ETH means
you cannot collect. Alert below ~0.005 ETH.

### 6. RPC quota

Every gated request is a potential RPC read. The cache means it usually isn't, but a burst of
traffic from many distinct new addresses is a burst of `statusOfMany` calls. Watch your
provider's dashboard, and configure a second provider before you need one.

### 7. Revenue against expectation

Multiply your active subscriber count by their rates and compare to what actually lands. A
persistent gap means customers are lapsing that you thought were active — go back to
`make lapsing`.

### 8. USDC being worth a dollar

Your plans are priced in USDC units, not dollars. If USDC depegs, your prices move with it.
Nothing to do about it day to day, but know that "$5/month" is really "5 USDC per 30 days".

---

## When things break

### The RPC provider goes down

The gate serves from its cache while entries are fresh, then from stale entries for 15 minutes
(`serveStaleForSeconds`), then falls back to `RPC_FAILURE_MODE`.

Default is `allow`: an RPC outage becomes free service rather than an outage for paying
customers. For a $5/month weather API that is almost certainly right — you lose pennies, not
customers. Set `RPC_FAILURE_MODE=deny` if you would rather be strict, and understand you are
choosing "my paying customers get errors when my infrastructure has a bad day".

Set `WS_RPC_URL` to a different provider than `RPC_URL` so a single provider's outage does not
take both the reads and the event watcher.

### The Base sequencer goes down

Nobody can send transactions. Your customers **cannot top up even if they want to**, and
subscriptions keep draining while the chain is stopped. This is what `GRACE_SECONDS` is for: the
gate keeps serving for an hour past `activeUntil` by default, which is about $0.007 of service
on the hobby plan. If an outage runs longer, raise it and restart:

```bash
GRACE_SECONDS=86400 npm start
```

Reads keep working during a sequencer outage — the chain state is still there — so the gate does
not go blind, it just sees a world where nobody can pay.

### Owner key lost

Here is exactly what happens, because you should decide now whether you can live with it:

- **Customers are completely fine.** They keep being served while their balance lasts, they can
  cancel whenever they like, and `closeAccount` refunds their unused USDC with no cooperation
  from you. Not one customer function touches the owner.
- **You stop being able to collect.** `revenue` keeps accruing in the contract and nobody can
  ever sweep it. That money is gone.
- **Prices freeze.** No new plans, no repricing.

Recovery is to deploy a fresh contract and migrate — see below. There is no admin recovery, no
upgrade, no backdoor. That is the trade for customers not having to trust you; it is also why
the checklist says multisig.

### You find a bug in the contract

There is no proxy and no upgrade path. Deploying an immutable contract means bugs are permanent.
The migration is manual and it works:

1. Deploy v2.
2. Point your gate at both: serve anyone active on v1 **or** v2.
3. Ask customers to `closeAccount` on v1 (instant, full unused refund, no help needed from you)
   and subscribe on v2.
4. When the v1 subscriber list is empty, drop it from the gate.

Slow, but nobody loses money and nobody is forced. Budget weeks, not hours — some customers will
never migrate, and their money is still theirs on v1 forever.

### "I paid but I'm getting 402"

Check in this order — it is one of these five, in roughly this frequency:

```bash
BILLING_ADDRESS=0x... RPC_URL=... DEPLOY_BLOCK=... \
  node backend/dist/src/cli.js subscribers | grep -i <their address>
```

1. **They deposited but never called `subscribe`.** Money is in escrow, no plan, nothing
   accruing. `statusOf` shows `planId: 0`. Tell them to call `subscribe(1)`.
2. **They sent USDC directly to the contract** instead of calling `deposit`. Shows up in
   `unaccountedBalance`. See above.
3. **They're on the wrong chain.** USDC sent to this address on Ethereum or Arbitrum is at an
   address with no contract on that chain. It is almost certainly unrecoverable, permanently.
   Say so plainly and quickly; do not promise a recovery you cannot do.
4. **They ran out.** `activeUntil` is in the past. They need to top up.
5. **They're calling with a token issued for a different address** — a second wallet. The token
   is bound to the address that signed, not to the person.

### A customer wants a refund beyond their unused balance

There is no function for this. Send them USDC from your own wallet like a normal person. The
contract's job is that they can always retrieve what they haven't used; anything past that is a
business decision, not a smart contract feature.

---

## What this design gives up

Onchain billing is not strictly better than Stripe. Here is the honest ledger, in the four terms
the Ethereum Foundation uses.

### Can anyone be stopped from using it?

**Onchain, the operator powers I shipped are exactly these:**

| power | what it lets you do | what it cannot do |
| --- | --- | --- |
| `setPlan` | change prices, close plans to new signups | touch anyone already subscribed |
| `settleAndCollect` / `collectRevenue` | sweep earned revenue | reach a customer's prepaid balance — it is clamped to `revenue` |
| `rescue` | recover stray tokens | take more than `unaccountedBalance` of USDC |
| `transferOwnership` | hand over the above, in two steps | anything to a customer |

**And these, deliberately, do not exist:** no pause, no blacklist, no upgradeable proxy, no
function that can cancel someone's subscription, no function that can move a customer's balance.
Shipping a `Pausable` here would have been one line and it would have meant "the operator can
freeze your prepaid money"; I would rather not be able to. `closeAccount` works forever,
regardless of what I do or whether my key still exists.

**But the contract is not the gate — my API is.** This is the part that matters and it is easy
to miss. I can refuse to serve any address for any reason. `backend/src/gate.ts` has an
allowlist; a denylist would be the same five lines. The contract would keep saying "active" and
keep charging them while my server returns 403. That is a real power to exclude people, it sits
entirely on my server, and putting billing onchain did nothing to remove it.

What the design *does* guarantee is that I cannot keep their money while doing it: a customer I
refuse to serve can `closeAccount` and walk away with their unused balance without asking me.
The worst I can do is stop serving them.

**Powers that are not mine and that I cannot remove:**

- **Circle can freeze USDC.** Any address, including this contract, at their discretion. USDC is
  itself an upgradeable proxy — its rules can change. If Circle blacklists the billing contract,
  deposits and refunds both stop dead and nothing in this repo fixes it. I chose USDC anyway
  because customers have it and pricing a $5 plan in ETH is a worse problem.
- **Coinbase runs the Base sequencer.** If it stops or reorders, customers cannot pay or cancel.
  Base has an L1 forced-inclusion escape hatch; no hobby developer is going to use it.

### Could someone else run it?

Split the stack honestly. Verified contracts on Basescan are *not* an answer to this question —
that just means people can read the code.

**Survives me disappearing entirely:**

- The contract and all its state. Balances, plans, rates, `activeUntil` for every address.
- Every customer's ability to cancel and withdraw their unused USDC. Forever, no cooperation
  from me, no key of mine involved.
- The subscriber list — it is in the event log, so anyone can rebuild what
  `backend/src/subscribers.ts` produces from public data alone.
- Anyone can fork the contract and run their own billing on it.

**Dies with me:**

- **The weather data and the API.** This is the actual product. It is a normal server with
  normal keys and nobody can fork it.
- The gate, the RPC endpoint, the auth secret. Rotating `AUTH_SECRET` logs every customer out.
- Revenue collection — only the owner key sweeps `revenue`.

So: a customer's *money* is safe if I vanish. Their *weather* is not, at all. Putting billing
onchain made the payments half independent of me and did nothing whatsoever to the product half.
That's a real improvement — customers are no longer exposed to me absconding with their prepaid
credit — but it is not "decentralized", and it would be dishonest to market it that way.

### What does an observer learn?

Everything, permanently, and this is the biggest concrete difference from Stripe.

Public forever, to anyone, including your competitors:

- **Every subscriber's address.**
- **Which tier each one is on**, and what they pay.
- **Exactly when each signed up, topped up, upgraded, downgraded and cancelled** — to the second.
- **Your revenue, to the cent.** `revenue` plus the `Settled` and `RevenueCollected` logs. A
  competitor can compute your MRR and your churn rate more accurately than your own dashboard
  does, continuously, without asking.
- **Your customer count**, and whether it is growing.

And for your customers, a cost they may not have considered: most people subscribe from an
address they already use. That permanently links their onchain identity — their NFTs, their DeFi
positions, their other purchases — to "pays $20/month for a weather API". Worth saying out loud
in your docs, with the suggestion to use a fresh address. `depositFor` lets a funding address
differ from the subscribing one, but the subscribing address is the one that gets published.

Separately, and it is a different question: access control on your own endpoints is ordinary
server auth and none of it is onchain. The chain publishes who *may* call your API. Your logs
record who actually did, what they asked for, and how often. That part is as private as your
server is.

### What does "audited" cover?

**Nothing here has been audited.** What it has: 44 contract tests, property fuzzing over amounts
and elapsed times, and five stateful invariants exercised across 128,000 randomized call
sequences, all passing. That is real evidence and it is not a guarantee.

If you do commission an audit, be clear about what you are buying: a point-in-time review of a
fixed scope of code by people who can miss things. It is not a warranty on the contract running
next year, and it does not cover a line you change afterwards.

The mitigating fact here is that the money at risk is bounded and small by design — a customer
holding $20 of prepaid credit can lose at most $20. That is a good reason not to push annual
prepayment until this has had proper eyes on it.

---

## What I did not build

- **A frontend.** Customers currently `approve` and `subscribeWithDeposit` from Basescan's write
  tab. Workable for hobby developers, unacceptable for anyone else. This is the first thing to
  build next, and it is a single page.
- **Lapse notifications.** `make lapsing` prints the list; connecting it to email is yours.
- **Fee-on-transfer or rebasing token support.** The contract credits exactly the amount it asks
  for. True of USDC. Do not point this at an exotic token without adding a balance-delta check
  in `_deposit`.
- **Annual plans.** Add a plan id with a lower per-30-day rate; there is no separate annual
  concept and no discount mechanism.
- **Usage-based billing.** This is purely time-based. Per-request metering would need a
  fundamentally different design, because metering onchain costs more per call than a weather
  lookup is worth.
- **A subscriber list onchain.** Deliberately — storing and iterating one would cost every
  customer gas at signup for the benefit of an offchain caller. It's in the event log instead.

## Gas, measured

From `make gas` (Base, so multiply by a very small number for the actual cost):

| action | who pays | gas |
| --- | --- | --- |
| deploy the contract | you, once | 2,448,899 |
| `subscribeWithDeposit` (first time) | customer | ~110,000 |
| `deposit` (top up) | customer | ~14,000 |
| `closeAccount` (cancel + full refund) | customer | ~13,000 |
| `settleAndCollect`, 200 accounts | you | ~1,018,000 |
| `settle`, marginal per extra account | you | ~4,900 |
| `isActive` / `statusOfMany` | **nobody** — it's a view | 0 |

Contract size is 12,206 bytes, comfortably under the 24,576 limit, so there is room to add
features without splitting it.
