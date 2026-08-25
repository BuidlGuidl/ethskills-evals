# Operational read: USDC yield vault, first month on mainnet

## The one-line version

At $8,000 TVL on Ethereum mainnet, **`harvest()` never gets called by a stranger** — the
1% caller fee is worth about $0.27 after a full month of accrual, against $3–30 of gas to
send the transaction. The vault will sit there not compounding until someone on the team
pays out of pocket to move it. Meanwhile a typical depositor spends more gas getting in
and out than the vault earns them all month. Both problems are the same problem: **the
whole vault produces $26.67 a month, and mainnet transactions cost single-digit to
double-digit dollars.** Nothing about the strategy is wrong; the chain is wrong for the
size.

---

## Assumptions

Everything below is arithmetic on your four numbers plus current mainnet costs. Re-run it
against live prices before you decide — the conclusion is robust to a wide range, but you
should see the range.

| Input | Value used |
| --- | --- |
| TVL, first month | $8,000 |
| Strategy APY | 4% |
| ETH price | $3,500 |
| Mainnet gas price | 3 / 10 / 30 gwei (calm / normal / busy) |
| `harvest()` gas | ~300,000 (claim + swap + redeposit + fee transfer) |
| `approve` + `deposit` | ~170,000 |
| `withdraw` | ~100,000 |

If your `harvest()` doesn't swap a reward token it may be closer to 150k; that halves the
gas numbers and changes none of the conclusions.

**What the vault earns, in total, for everybody:**

| Period | Yield to the whole vault | 1% caller fee |
| --- | --- | --- |
| Day | $0.88 | $0.009 |
| Week | $6.15 | $0.06 |
| Month | $26.67 | **$0.27** |
| Year | $320.00 | $3.20 |

**What a transaction costs:**

| | 3 gwei | 10 gwei | 30 gwei |
| --- | --- | --- | --- |
| `harvest()` | $3.15 | $10.50 | $31.50 |
| `approve` + `deposit` | $1.79 | $5.95 | $17.85 |
| `withdraw` | $1.05 | $3.50 | $10.50 |

---

## What actually happens once it's live

A contract is a state machine — it moves only when someone sends a transaction and pays
for it. There is no scheduler, no cron, no background process. So take each state
transition in turn: who sends it, why would they, and is that enough?

### 1. Deposits — these happen

**Who:** your depositors. **Why:** they want the yield. **Is it enough?** Yes, they'll pay
their own gas to get in. This transition is fine. (Whether it was *worth* it for them is
the next section.)

### 2. `harvest()` — this does not happen

**Who:** anyone. **Why:** 1% of what the call claims. **Is it enough?** No, and not
remotely.

Put the caller's reward and the caller's gas next to each other:

| Time since last harvest | Caller earns | Caller pays (10 gwei) | Net |
| --- | --- | --- | --- |
| 1 day | $0.009 | $10.50 | **−$10.49** |
| 1 week | $0.06 | $10.50 | **−$10.44** |
| 1 month | $0.27 | $10.50 | **−$10.23** |
| 1 year | $3.20 | $10.50 | **−$7.30** |

At a 1% fee, a caller breaks even when the pending claim is 100× the gas cost — about
$1,050 at 10 gwei. At $26.67/month of accrual, the vault reaches that **39 months** after
launch. Even at a calm 3 gwei it's about 12 months of waiting before the first
economically rational harvest.

Turn it around and ask what TVL this fee schedule actually needs:

| Harvest cadence | TVL needed at 3 gwei | at 10 gwei | at 30 gwei |
| --- | --- | --- | --- |
| Monthly | $94,500 | $315,000 | $945,000 |
| Weekly | $409,500 | $1,365,000 | $4,095,000 |

You're at $8,000. The design is off by roughly **40× at best and 170× at worst** for a
merely *monthly* harvest.

**So what really happens:** you notice nothing is compounding and you start calling
`harvest()` yourselves. That is an owner-run keeper wearing a permissionless costume, and
it costs:

| Cadence | Annual gas at 10 gwei | vs. $320/yr of yield |
| --- | --- | --- |
| Daily | $3,832 | 12× the yield |
| Weekly | $546 | 1.7× the yield |
| Monthly | $126 | 39% of the yield |

Harvesting this vault more often than monthly costs more than the vault earns. And the day
someone on the team gets bored, changes jobs, or loses the key, compounding stops
permanently, with no mechanism to restart it.

### 3. Withdrawals — these happen, and they're where it gets uncomfortable

**Who:** depositors. **Why:** they want their money. Fine — as long as `withdraw()` needs
nothing but the contract. See the forkability note at the bottom.

---

## What this means for your depositors

Not "4% APY." Their real number is 4% minus the gas they personally spend, and at $8,000
of TVL spread over a normal number of people, that's negative.

Say $8,000 comes from 20 people at $400 each. For one of them, over the first month:

- Yield earned: **$1.33**
- Gas in and out at 10 gwei: **−$9.45**
- Net: **−$8.12**, to earn $1.33
- And the $1.33 is notional — with `harvest()` unfired, the compounded portion never lands

**Minimum deposit to merely break even on your own gas:**

| Hold for | 3 gwei | 10 gwei | 30 gwei |
| --- | --- | --- | --- |
| 1 month | $1,273 | $4,242 | $12,727 |
| 12 months | $106 | $354 | $1,061 |

So on mainnet, this product is only honest for someone bringing **$4,000+ for a month**, or
**$350+ if they'll leave it for a year**. If your expected $8,000 is two people at $4,000,
the economics are merely thin. If it's twenty people at $400, you are launching a product
that loses money for almost everyone who uses it, and they will find that out from their
wallet rather than from you.

---

## Three more things that break at this size

**Just-in-time harvest capture.** `harvest()` compounds a lump sum, so the share price
steps up in a single block. Anyone can deposit in the block before a harvest, take a
pro-rata cut of a month's accrual, and withdraw after — value transferred straight from
your long-term depositors. Today the prize is $26 and nobody will bother, but the flaw is
structural, not size-dependent, and it gets exploited the moment TVL makes it worth the
gas. Streaming the harvest over a lock period (or accruing continuously — see below) is
the fix.

**Slippage and MEV on the compound swap.** If `harvest()` routes reward tokens through a
DEX, it's swapping about $26 of value. Any slippage tolerance loose enough to survive a
trade that small hands a sandwich bot most of it; any tolerance tight enough to protect it
will revert. Check what your harvest path actually does with dust.

**First-depositor share inflation.** The vault launches empty. If it's ERC-4626 or
ERC-4626-shaped without virtual shares or a seeded dead deposit, the classic donation
attack is open: mint 1 wei of shares, donate USDC directly to the contract, and round the
next real depositor's shares to zero. Cheap to prevent, expensive to discover live. Confirm
you have OpenZeppelin's virtual-offset version or seed the vault yourself in the deploy
transaction.

---

## What should change before launch

Ranked by how much it actually moves the numbers.

### 1. Deploy to an L2 instead of mainnet — this is the whole fix

Everything above is a gas problem. On Base, Arbitrum, or Optimism a 300k-gas call costs
roughly **$0.01–$0.10**. The same 1% fee on the same $8,000:

| Harvest cost | Break-even TVL, monthly | weekly | daily |
| --- | --- | --- | --- |
| $0.01 | $300 | $1,300 | $9,125 |
| $0.03 | $900 | $3,900 | $27,375 |
| $0.10 | $3,000 | $13,000 | $91,250 |

At $8,000 TVL, weekly harvests are comfortably profitable for a stranger and daily ones
are within reach as you grow. Depositors' break-even deposit drops from ~$4,000 to a few
dollars. No contract change required — same code, different chain. If USDC-on-mainnet is
a hard requirement for the strategy itself, say so and we'll work around it, but if the
strategy exists on an L2, that is the move.

### 2. If mainnet is genuinely non-negotiable, delete the harvest transaction

Be clear that **no fee schedule rescues mainnet at this size.** Even a 100% caller fee
gives up $26.67 against $10.50 of gas only once a full month has accrued, and paying out
100% of the yield to callers means depositors earn zero. There's no number to tune here.

The real fix is a design where the scheduled transaction doesn't exist:

- **Prefer a strategy that accrues at read time.** Something like Aave: park USDC, hold
  aUSDC, and `totalAssets()` just reads the balance. Interest accrues continuously in the
  token itself, `harvest()` disappears entirely, there is no keeper to fund and no lump to
  front-run. This is strictly better than a harvest loop at any TVL, and at $8,000 it's the
  difference between a working vault and a parked one.
- **If the strategy pays a separate reward token you must claim,** don't schedule it —
  settle it opportunistically. Claim inside the next user deposit or withdrawal that
  happens to be large enough to absorb the extra gas, gated on `pendingRewards > threshold`
  so ordinary small transactions aren't taxed with it.

### 3. Tell depositors the break-even number

Whatever you ship, put the minimum-sensible-deposit figure in the UI next to the APY, live
against current gas. "4% APY" beside a $10 round-trip cost is, for a $400 depositor, a
true statement that produces a false impression. Showing the number costs you a few small
deposits and buys you people who don't feel tricked.

### 4. If you ship the owner-run keeper anyway, say so in public

If the honest plan is "the team calls `harvest()` monthly and eats the gas," that's a
legitimate choice — but it's an operator dependency, and it belongs in the README, not in
the team chat. Write down who holds the key, what cadence they commit to, and what happens
to depositors' compounding when that person stops. Depositors can still always withdraw;
they just stop earning. The failure is shipping it unflagged.

---

## What this design gives up

Worth writing into the README before launch, not after. I can only half-answer these —
the gaps are questions for you.

**Can anyone be stopped from using it?** I don't know what you've shipped, and that's the
point: name every operator power explicitly. `Pausable`, `onlyOwner` on `setStrategy`, an
upgradeable proxy, a deposit cap or allowlist — for each one, say what it lets you do to a
depositor's money and what happens if that key is lost. `setStrategy` is the sharp one: if
an owner key can repoint the vault at an arbitrary address, that key can drain every
deposit, and depositors should be told that in plain words rather than left to read the
code. Shipping *no* operator powers is a fine answer — but then say that, because silence
reads the same as hiding them.

Separately: USDC itself has a freeze function. Circle can blacklist an address, including
this vault's. That's inherited, not yours, but it's part of the honest picture.

**Could someone else run it?** Verified contracts on Etherscan are not the answer to this
question. Split the stack: the vault contract and its balances are onchain, forkable, and
survive you. Your frontend, your APY indexer, and your subgraph do not. The test that
matters: **can a depositor withdraw their full balance using only Etherscan's "Write
Contract" tab, with no input that only your backend can compute?** If yes, users are
genuinely safe from you disappearing and you should say so. If `withdraw()` needs a
signature, a merkle proof, or a quote from your API, then your frontend going down traps
their money and that needs fixing before launch, not after.

**What does an observer learn?** Everything, forever. Every depositor's address, exact
amount, and timing is public and permanently indexed. At $8,000 across a handful of
addresses, anyone can trivially enumerate your entire user base, watch a whale enter or
exit in real time, and compute your true realized APY — including the part where
`harvest()` hasn't fired. Assume competitors and your own depositors will both do this.
There is no privacy here to configure; there is only whether you told people.

**What does "audited" cover?** If you get one: a point-in-time review of a specific commit
and a specific scope. It is not a standing guarantee about the code running today, and it
says nothing about the underlying strategy you're depositing into — which is where the
actual money risk lives. Depositors are trusting your vault *and* that protocol; name it.

---

## Bottom line

Nothing here is a bug in your contract. It's a mismatch between a $26-a-month revenue line
and a chain where transactions cost $10. Move it to an L2 and the same code works as
designed: strangers harvest for profit, depositors keep their yield, and nobody on your
team has to remember to press a button. Stay on mainnet and you're shipping a vault whose
compounding depends on your goodwill and whose depositors mostly lose money — which is
survivable at $8,000 and is not the product you meant to build.
