# First-month operational read: USDC yield vault

Assumptions behind every number below: ETH at ~$2,500 and mainnet gas at
~1 gwei base (0.3–2 gwei over the last 30 days; briefly above 2 gwei during
spikes). A harvest on a plain lending strategy — claim, pay the caller fee,
redeposit — I'll cost at ~250k–400k gas, i.e. **$0.60–$2.00 per call** at
today's prices, more during any congestion.

## The one fact that drives everything

The vault is a state machine. It moves only when someone sends a transaction
and pays gas, and does nothing in between. Month one therefore has exactly
three kinds of movement: deposits, withdrawals, and harvests. Deposits and
withdrawals happen because depositors want their money in or out. **Harvests
happen only if someone profits from sending them.**

The design points the right way — harvest is permissionless with a 1% caller
fee, which is the standard move to make strangers advance your state machine
out of self-interest. But the fee has to clear the caller's gas cost, and at
this scale it doesn't. Put the two sides of the trade next to each other:

| Harvest frequency | Claim per call (at $8k TVL) | Caller's 1% | Caller's gas | Caller's P&L |
|---|---|---|---|---|
| Daily | ~$0.88 | ~$0.009 | $0.60–2.00 | loses ~100x |
| Weekly | ~$6.15 | ~$0.06 | $0.60–2.00 | loses ~10–30x |
| Monthly | ~$26.67 | ~$0.27 | $0.60–2.00 | loses ~2–7x |

And the first month is worse than the table: deposits ramp from zero toward
$8,000, so the average balance is closer to $4,000 and the whole month's
accrual is only **~$13**, making the monthly fee **~$0.13**.

Break-even TVL for a stranger's *monthly* harvest: ~$22,000 at 1 gwei, ~$45k
at 2 gwei, ~$225k in a 10 gwei episode. For *daily* harvests, roughly
**$700,000**. Nobody rational calls `harvest()` against $8,000 of deposits.
The permissionless design isn't wrong — it's inert at this size. A transition
nobody profits from silently never happens.

## What actually happens, day by day

- Deposits arrive through the month. Otherwise the vault sits completely
  still. Nothing compounds itself; there is no cron.
- The strategy accrues interest on the USDC it holds — ~$13 over the month —
  but that value sits **unharvested inside the strategy**. Until a harvest
  runs, it is not in the vault's accounting, so the share price does not
  move. A month-end snapshot shows a flat vault and depositors earning
  exactly 0%, whatever the marketing says.
- The yield isn't lost — it accrues and will be recognized at the first
  harvest. But nothing onchain recognizes it until then, and "when then" has
  no answer in this design, because the only person motivated to send the
  transaction is you.
- So in practice one of two things is true: either you send harvest yourself
  (fine — gas is $0.60–$2.00/month, trivial, and you keep your own 1% fee),
  or nobody does and the flat share price is what your depositors see. Both
  mean "permissionless and anyone can call" is not, operationally, how this
  vault runs in month one. It runs when your wallet sends a transaction.
  Write that down as the actual answer, because it's an operator dependency
  dressed as a decentralized one.

## What it means for depositors

1. **They see ~0% until the first harvest, then a lump.** If you harvest
   monthly, the share price is flat for ~30 days and then jumps. If someone
   withdraws mid-month before a harvest, whether they forfeit their share of
   the accrued interest depends on the withdrawal accounting — if
   withdrawals settle only against vault assets (the common pattern), the
   unharvested accrual is left behind for whoever's still in. Check that
   accounting before launch; it's the one place this design can actually
   cost a depositor money rather than just delay it.
2. **Frequency barely matters, so stop worrying about it.** At 4% APY,
   compounding monthly vs. never is worth ~$6/year on $8k. Compounding daily
   vs. monthly is worth ~$0.50/year. Any harvest more often than monthly is
   pure gas burn with pennies of yield benefit. Set expectations (yours and
   depositors') to monthly, or even quarterly at this TVL.
3. **Depositor gas is a visible fraction of their first-month yield.** A
   round trip (approve + deposit + withdraw, ~225k gas) costs ~$0.60 at
   1 gwei. A $500 depositor earns ~$1.67/month. That's break-even-ish today
   only because mainnet gas is at a historic low; at 5–10 gwei it's
   dollar-for-dollar negative, and small depositors are paying more to enter
   and exit than they earn. At $8k of expected TVL, your median depositor is
   exactly the person mainnet is worst for.
4. **Everything is public forever.** Every depositor address, every deposit
   size, every harvest and its 1% payout are onchain for anyone — including
   competitors — to read and index indefinitely. No part of "who uses this
   vault and how much they hold" is private.

## What should change before launch

1. **Name who sends the harvest transaction.** Either say plainly: "we call
   harvest monthly, it costs us ~$1, here's the address doing it" — and
   accept that the vault needs you alive and attentive — or fund a keeper
   (Chainlink Automation / Gelato) so the schedule survives your vacation,
   and note what the keeper costs you per month. Don't ship relying on
   anonymous bots at this TVL; the table above says they won't come.
2. **Better: remove the scheduled transaction entirely.** The cleanest fix
   for a vault this size is accrual at read time — have `totalAssets`/share
   pricing count the strategy's total value *including unharvested
   accruals* (readable without gas), and settle into the vault whenever any
   transaction next touches it. Then depositors see true value even if
   harvest runs quarterly, and the whole "who calls it and why" problem
   drops to almost nothing. If the current accounting can't do that, that
   gap is the thing to fix before launch, more than the fee.
3. **Don't raise the 1% fee — it's not the bottleneck.** The fee isn't too
   small for monthly calls to be near break-even ($0.13 vs. ~$0.60–2.00 gas
   on realistic first-month accrual); you'd have to give strangers ~10–20%
   of the claim to make daily calls profitable at $8k, which at 4% APY
   means donating most of the yield to gas. The 1% fee is a reasonable
   permanent feature (a ~4 bp/year drag on depositors); it just can't be
   the vault's heartbeat at this scale. TVL or the chain has to change, not
   the fee.
4. **Seriously consider an L2.** On Base or Arbitrum the same design works
   exactly as pitched: harvest gas is ~$0.01, so the 1% fee clears at a
   fraction of this TVL, strangers actually do show up, and depositors'
   round trips stop eating their month of yield. If staying on mainnet is a
   deliberate choice (USDC liquidity, custody, optics), make it with eyes
   open that at $8k/month-one scale you are choosing to operate the vault
   by hand during the cheapest gas regime in years.

## What we still need to write down before launch

Nothing above says who can pause the vault, upgrade it, move funds between
strategies, or gate withdrawals. Whatever those powers are — `onlyOwner` on
user funds, a `Pausable`, a proxy, a blacklist — they need to be in the docs
with, for each: what it lets you do to a paying depositor, and what
depositors get if you lose the key. If the build has none of them, say that
explicitly instead; "no operator can stop a withdrawal" is a selling point.
Also note that verified source on Etherscan lets anyone *read* the vault,
but only the contracts themselves keep working if you disappear — if
there's a frontend, API, or keeper only you run, list it as the half that
dies with you.
