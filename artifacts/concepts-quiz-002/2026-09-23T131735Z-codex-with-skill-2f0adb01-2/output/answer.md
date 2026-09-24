# Operational Read: First Month USDC Vault

## Short answer

At the planned first-month size, this vault is economically tiny on Ethereum mainnet.

With $8,000 deposited and a 4% APY strategy, the vault earns roughly:

- About $320 per year before vault-specific fees
- About $26 to $27 in the first month
- About $0.88 per day

Because `harvest()` pays the caller 1% of the amount claimed, the harvest caller earns only:

- About $0.009 after one day
- About $0.06 after one week
- About $0.26 to $0.27 after one month

That is the core operational issue. The vault may be permissionless, but it is not automatic. `harvest()` only runs when someone sends a transaction and pays gas. A rational third-party caller will wait until the 1% bounty is worth more than their gas cost plus some profit.

## What Actually Happens Once It Is Live

Deposits can come in normally. The strategy can earn its 4% APY. But the compounding step only happens when `harvest()` is called.

In practice, during month one, the most likely outcomes are:

1. No one calls `harvest()` for a while.

   The reward stream is too small to attract reliable public keepers. At $8,000 TVL, even a full month of accrued yield only gives the caller about twenty-six cents.

2. A harvest may happen only when gas is unusually cheap, or when the team runs it.

   Live mainnet gas was very low when checked on September 23, 2026: EthScan showed a standard gas price around 0.063 gwei. At that level, a 300k to 700k gas harvest would cost roughly $0.05 to $0.12 with ETH around $2,746. That can be barely profitable after enough rewards accrue.

   But this is fragile. At about 1 gwei, the same 300k to 700k gas harvest costs roughly $0.82 to $1.92. At that point, the caller needs several months of accumulated rewards before the 1% bounty covers gas.

3. Harvest timing will be lumpy.

   The vault should not be expected to compound daily. It will compound whenever the pending reward pile is large enough for someone to bother, or whenever an operator deliberately pays to do it.

4. The 1% harvester fee is not the depositor's main cost.

   If the vault earns about $26.67 in month one and is harvested once, the caller keeps about $0.27 and depositors keep about $26.40. That fee is small. The bigger problem is whether the harvest happens at all, and whether accounting is fair while rewards are pending.

## What This Means For Depositors

Depositors should expect a low, delayed, and possibly uneven return in the first month.

At 4% APY, a depositor earns about $3.33 per month per $1,000 deposited before harvest fees and gas. After the 1% harvest fee, that is about $3.30 per month per $1,000 if rewards are harvested.

For small deposits, Ethereum mainnet transaction costs can be meaningful relative to the first month of yield. Even if gas is cheap at launch, users still have to consider approval, deposit, withdrawal, and any other interaction costs. The vault may be technically working while still being economically underwhelming for small depositors.

The most important depositor-facing risk is reward accounting around harvests:

- If pending strategy rewards are not included in `totalAssets()`, then the share price can be stale between harvests.
- Users who withdraw before a harvest may miss rewards they economically helped earn.
- Users who deposit shortly before a harvest may receive part of rewards earned before they arrived.
- A sophisticated user could try to deposit before harvest and withdraw after harvest if the accounting lets them capture stale pending rewards.

So the question is not only "will anyone harvest?" It is also "who owns the unharvested rewards before the harvest transaction lands?"

## Recommendation Before Launch

I would change the launch plan before shipping on Ethereum mainnet.

The current design is directionally right because `harvest()` is permissionless and pays the caller. But with only $8,000 of expected TVL and 4% APY, a 1% harvest bounty is too small to create reliable operations on mainnet. Permissionless access does not by itself create maintenance. The incentive has to be large enough.

Recommended changes:

1. Do not market this as reliably auto-compounding unless you run a keeper or otherwise guarantee harvests.

   A better statement is that rewards are compounded when `harvest()` is called. If the team plans to call it during the bootstrap phase, say so internally and monitor it like an operational dependency.

2. Add an explicit harvest threshold.

   `harvest()` should only execute when pending rewards are above a minimum useful amount, unless called by an approved keeper or unless the caller accepts the economics. This avoids wasteful harvests and makes expected behavior easier to reason about.

3. Bootstrap harvests with a keeper or treasury subsidy.

   For the first month, the team should expect to run harvests itself or fund a keeper. At this TVL, public callers are not a reliable operating plan.

4. Fix or verify pending-reward accounting before launch.

   If pending rewards are material and claimable, decide whether they are included in `totalAssets()`. Deposits and withdrawals around harvest should not transfer already-earned rewards to the wrong users.

5. Consider launching somewhere cheaper, or waiting for more TVL.

   An L2 deployment, a larger initial deposit base, or a strategy that does not require external harvesting would fit this scale better. Mainnet makes more sense once TVL is high enough that routine maintenance rewards are dollars, not cents.

## Practical Launch Bar

For this exact setup, I would want one of these to be true before launch:

- The team commits to operating harvests during the bootstrap period.
- The vault launches on a cheaper network.
- Initial TVL is much higher than $8,000.
- The harvester incentive is redesigned to cover gas, possibly with a treasury-funded keeper reward or a dynamic bounty.
- The strategy's yield accrues directly into vault assets without requiring frequent harvests for fair accounting.

Without one of those changes, the vault can still function, but the first month will look more like a manually nudged pilot than a self-sustaining onchain system.

Sources checked for live fee context on September 23, 2026:

- EthScan gas tracker: https://ethscan.io/gas
- Investing.com ETH/USD market data: https://www.investing.com/crypto/ethereum/eth-usd-historical-data
