# Operational read: month one on Ethereum mainnet

## The one-paragraph version

This vault earns roughly **$13–27 of gross yield in its entire first month**, and every dollar of it only reaches depositors when somebody pays a mainnet transaction to call `harvest()`. At today's historically cheap gas (~0.1–1 gwei) the machine runs, barely, with your team as the only keeper. In any normal mainnet gas regime (10–30 gwei, which was standard for most of the chain's history and can return), gas consumes most or all of the monthly yield and makes small deposits uneconomical. The permissionless 1% keeper incentive will not attract a single third-party caller at this TVL. Month one is best treated as a process shakedown on a chain that doesn't fit the product's size — see recommendations.

## The numbers first

- **Gross yield:** $8,000 × 4% / 12 ≈ **$26.67/month** at full balance. Deposits ramp in over the month, so average balance is closer to $4,000 and first-month accrual is closer to **~$13**. Full-year gross at constant $8K: $320 — total, across all depositors.
- **Harvest cost:** a realistic `harvest()` (claim + swap rewards to USDC + redeposit) is ~300–500k gas.
  - Today (~0.5–1 gwei, ETH ≈ $2,500): **~$0.50–1.25 per call**.
  - Normal regime (10–30 gwei): **~$10–40 per call**.
- **Depositor round trip** (approve + deposit + later withdraw, ~300k gas): **~$0.75 today**, **$7.50+ at 10 gwei**, ~$20+ at 30 gwei.

## What actually happens once it's live

1. **Deposits trickle in to ~$8K.** Average balance for the month is roughly half the endpoint, so the strategy accrues ~$13 of rewards in month one (~$27/month run-rate after).
2. **Rewards sit unclaimed until someone calls `harvest()`.** Yield does not reach the vault's share price until a harvest runs — until then, depositors' "4% APY" is unrealized accrual sitting in the strategy (and carrying whatever venue/token risk attaches to unclaimed rewards).
3. **Nobody calls it but you.** A profit-seeking keeper needs `1% × claim > gas`, i.e. a claim of **≥ 100× their gas cost**. At current gas that's a ≥ $50–100 claim — about 2–4 months of accrual at this TVL, so a stranger *might* show up quarterly. At 10–30 gwei it's a ≥ $1,000–3,000 claim — **3+ years of accrual**. The 1% of a monthly claim is $0.13–0.27 against $0.50+ of gas even in the cheapest regime. Conclusion: the permissionless harvest is not self-running; **your team is the keeper**, on your gas, on your schedule.
4. **If the team harvests monthly:** at today's gas that's ~$0.50–1 to compound ~$27 — a few percent of yield, acceptable. At 10–30 gwei each harvest costs $10–40 against ~$27 of monthly yield — **negative or fully-consumed yield**, and a recurring ops burden you're subsidizing.
5. **Compounding barely matters at 4%.** Monthly vs. annual compounding at 4% APY differs by ~0.07 APY points. The operationally important thing harvest does is *claim* rewards so they land in the vault — the "compounds back in" framing is doing almost no work.

## What this means for depositors

- **Realized net APY ≈ 4% gross, minus gas friction, minus timing lag.** Today: roughly intact (entry/exit ~$0.75, harvests effectively free). In a 10–30 gwei regime: a $200–500 depositor's round-trip gas ($7.50–20+) eats **1–3+ years of gross yield**, and per-depositor net APY rounds to zero or negative.
- **Total first-month earnings across everyone: ~$13–27.** Any depositor expecting income will be underwhelmed; the honest pitch is "your money earns ~4% and this is infrastructure," not a yield product.
- **Displayed vs. realized APY will diverge** between harvests. If your UI quotes a compounded 4% while rewards sit unclaimed for a quarter, depositors see a number they haven't experienced yet. Quote simple interest and disclose the harvest cadence.

## What should change before launch

1. **Strongest recommendation: don't ship this on mainnet at $8K TVL.** Launch on an L2 — Base is the natural fit (native USDC, deep USDC yield venues, sub-cent gas). The identical design becomes robust: team harvests cost fractions of a cent, depositor round trips are negligible, and the economics survive gas spikes. Mainnet is a venue for six-to-seven-figure TVLs; at $8K you're paying whale-venue prices at retail scale.
2. **If mainnet is non-negotiable:**
   - **Plan to be the keeper yourselves.** Budget a monthly (or quarterly) harvest as an ops line item, and expect ~$0.50–1/call in the current regime — do not build around strangers calling it, because they won't.
   - **Harvest on a value threshold, not a schedule.** Only harvest when pending rewards are ≥ ~100–200× expected gas (≥ $50–100 today). This also makes the 1% incentive actually capable of paying a stranger's gas when someone does call. At $27/month accrual that's a quarterly-ish cadence — fine, since compounding frequency is worth ~nothing at 4%.
   - **Set expectations in the docs:** simple (not compounded) APY, stated harvest cadence, and a note that sub-$1K deposits are uneconomical on mainnet outside the current low-gas regime.
3. **Leave the 1% keeper share alone — but don't count on it.** It costs nothing when uncalled and pays out cents when called; it is mis-calibrated by two orders of magnitude for attracting keepers at this scale, and raising it just gives away yield you can't spare. Revisit when claims are large enough that 1% clears 100× gas.
4. **Define the "real mainnet product" trigger.** Third-party keepers become self-sustaining when monthly claims ≥ 100× gas, i.e. TVL of roughly **$300K (at 10 gwei) to $900K+ (at 30 gwei)**. Below that, on mainnet, you're the keeper forever. Either launch on the L2 now and revisit mainnet at that threshold, or accept the subsidy.

**Bottom line:** the design is sound and nothing here is a security problem — it's a sizing problem. At $8K of deposits and 4% APY, the entire first month produces less yield than a single normal-regime harvest costs, and the permissionless-keeper mechanism is inert. Ship it where gas doesn't eat the product (L2), or ship it on mainnet knowing you're operating a manually-run micro-vault as a proof of process.
