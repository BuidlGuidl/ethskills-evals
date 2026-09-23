# Month-1 operational read — USDC yield vault, Ethereum mainnet

Numbers used below (late Sept 2026 — rerun with your actual gas and prices):

- ETH ≈ $2,500
- `harvest()` ≈ 300,000 gas (claim + fee + compound); a depositor round trip (deposit + later withdraw) ≈ 400,000 gas
- Mainnet base gas is ~0.1–1 gwei today, the cheapest regime the chain has ever run; the last 12 months mostly showed 0.3–2 gwei with excursions to ~5

## 1. What actually happens once it's live

**Deposits arrive, the vault invests, 4% accrues onchain.** Nothing breaks, and nothing runs itself. By day 30 there is roughly $13–27 of claimable rewards sitting in the strategy (~$20 depending on how deposits land: $8,000 × 4% ÷ 12 = $26.67/month at full TVL, about half that if deposits trickle in steadily).

**`harvest()` gets called by nobody, mostly.** Put the caller's pay next to their gas: 1% of ~$20 is ~$0.20. The call costs ~$0.08 at today's cheapest gas, ~$0.75 at 1 gwei, and $3.75+ in any busier regime mainnet visited within the last year. A profit-seeking bot simulates that and skips it; the only stranger who ever profits is a patient one calling in a cheap-gas window, once, late in the month, for cents. The rational move for everyone is always to wait — the claim builds the same whether it's harvested today or next quarter, and compounding is worth about $6/year at this TVL.

Who does have a reason to call it? Not a stranger (fee ≈ gas at best). Not small depositors (their pro-rata share of a week's rewards is under a cent). The largest depositor — harvesting unlocks their pro-rata share — but waiting costs them nothing, so they free-ride like everyone else. The strongest natural trigger is a depositor about to withdraw, if rewards only book into share price when `harvest()` runs. If that's the design, compounding happens mostly when someone exits.

**Depositors watch a flat or near-flat balance.** If share price only moves on harvest, the statement is literally flat for weeks. If the vault values accrued rewards at read time, the whole vault earns ~$0.50–0.90/day. Either way nothing compounds, and at this scale that costs almost nothing — monthly vs never compounding on $20/month is pennies.

**The month's failure mode is silence, not an event.** No liquidations, no runs, nothing dramatic. The risk is a vault that looks alive and is inert: a state machine whose only moving part has nobody paid to move it.

## 2. What that means for depositors

**Nothing is at risk from the harvest design.** Deposits stay redeemable, rewards accrue onchain, and the 1% caller fee costs all depositors combined about $0.20/month. That part is fine.

**The real fee they pay is gas, and for small balances it's bigger than the yield.** A $1,000 depositor earns $3.33/month; their round trip costs ~$0.10–1.00 at today's gas and $2–8 in any regime from the last year. A $500 depositor earns $1.67/month — one round trip in a normal regime erases a month or more of yield. The product is only cheap to use in the quietest gas period mainnet has ever had, and that's a bad thing for a product whose pitch is permanence.

**The APY is real but immaterial at this scale.** The entire vault earns $15–25 in month 1; a $500 depositor makes $1.66. What's true and sellable: self-custodial, permissionless, redeemable anytime. What isn't, yet: meaningful yield for small balances once gas is counted.

## 3. What should change before launch

**1) Fix the harvest pay, or own the harvest.** The permissionless caller-gets-paid shape is right; the number is wrong for this TVL. 1% of a claim only covers gas when claims are big: to cover $0.75 of gas the claim must be ≥ $75 — 85–170 days of accrual here — and the crossover where a monthly harvest pays a stranger is roughly $25,000 TVL at 1 gwei and $110,000 at 5 gwei. Pick one:

- **Team-run keeper** (yours or an automation service), monthly or even quarterly. At today's gas that's under $1/call; budget $5–15/month for busier regimes. Keep permissionless `harvest()` as the always-available fallback. Then say it plainly: this vault compounds because we run it, not because a stranger is paid to.
- **Pay a reward that covers gas in every regime**: `max(1%, $5–10 in USDC)` gated by a minimum pending claim (e.g. $50) or a cooldown (e.g. 7 days) so it can't be drained in a loop. This makes permissionless harvesting actually self-sustaining at today's TVL instead of at $110k TVL.
- **Not a fix: harvesting more often.** At 4% APY and $20/month of rewards, frequency is worth cents. Paying gas to compound pennies is the trap.

**2) Decide who this is for, and possibly the chain.** If the expected depositor holds $100–2,000, mainnet only works in this gas regime; the same vault on an L2 costs cents per round trip and per harvest forever, and the 1% fee actually pays a keeper. If mainnet is deliberate — permanence, composability, the chain of last resort — keep it and treat fix #1 as a real operating cost.

**3) Set depositor expectations accordingly.** Lead with self-custody, permissionless access and redeemability (true at any scale), not the 4% (which is $20/month across everyone right now).

**4) Write down the operator powers before launch** — they weren't in what I was given, and depositors deserve them in plain words: who can pause withdrawals, upgrade the strategy, or change the 1%; what happens to a paying user if that key is lost. Also what survives you disappearing: the contracts and onchain state do — anyone can still deposit, redeem and harvest — while the frontend, indexer and any offchain checks stop. And everything onchain is public forever: every depositor, balance and harvest, visible to anyone including competitors.

## Bottom line

Month 1 is quiet by construction: ~$20 of rewards accrue, roughly nobody harvests, depositors earn a few dollars collectively, and gas — not the strategy, not the 1% — is the biggest fee anyone pays. The design's one moving part only pays a stranger in the cheapest gas regime Ethereum has ever had. Either fund the keeper yourself and say so, or pay a gas-covering reward, and don't market yield to small depositors on a chain where their round trip costs more than a month of it.
