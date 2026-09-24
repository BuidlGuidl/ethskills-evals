# First-month operational read

With the current launch plan, the vault will be economically quiet in month one. At $8,000 of USDC deposits and a 4% APY strategy, the vault produces about $320 of gross yield per year. That is about $26 if the full $8,000 is deposited on day one, or about $13 if deposits ramp roughly evenly from zero to $8,000 over the month.

That means the permissionless `harvest()` incentive is tiny. The caller receives 1% of the rewards claimed by that harvest. After an entire first month, that bounty is only about $0.13 to $0.26. If someone harvests daily, the bounty is fractions of a cent per call.

On Ethereum mainnet, that is not enough to reliably motivate normal third-party callers. As of September 23, 2026, public trackers show unusually low Ethereum gas, roughly sub-1 to about 1 gwei, and ETH around $2,750. Even in that environment, a 200k-500k gas harvest would cost roughly $0.23-$1.58 before any operational margin. The full-month bounty only competes with the very lowest end of that range, and daily or weekly bounties do not. The caller is usually economically underwater unless they are subsidizing the vault, testing the system, or using some off-chain/private reason to call it. So the practical expectation is:

1. Depositors put USDC into the vault.
2. The strategy slowly accrues rewards.
3. `harvest()` probably does not get called by random users in the first month.
4. Rewards remain unharvested until the team, a keeper, or an unusually altruistic caller runs the transaction.
5. Compounding is negligible either way, because the reward base is small.

## What this means for depositors

Depositors should not expect visible compounding activity in the first month unless the team operates it. The advertised 4% APY is only the strategy's underlying earning rate; the realized user experience will look more like a small, slowly accruing position with occasional manual compounding.

The harvest bounty also leaks 1% of claimed yield away from depositors. On the first-month numbers that is not large in dollars, roughly $0.13 to $0.26, but it is still a permanent reduction in depositor yield whenever harvesting occurs. Depositors keep the other 99% of harvested rewards before any other vault fees or strategy costs.

The bigger issue is not the 1% fee itself. The bigger issue is liveness: the current bounty is too small to make the permissionless mechanism actually self-operating at this scale on mainnet.

## Should anything change before launch?

Yes. I would change at least one of the operating assumptions before shipping.

Do not rely on public callers to harvest this vault in month one. Either run a team-controlled keeper, integrate with a keeper network, or make it explicit in the product that harvesting is operated by the team while TVL is small.

Consider adding a minimum-harvest threshold. For example, only harvest when pending rewards exceed some dollar value, or when the expected caller bounty is comfortably above gas. Without that, callers can still trigger economically silly harvests unless the contract already protects against dust harvests.

Revisit Ethereum mainnet for an $8,000 first-month vault. At this size, mainnet gas dominates operational decisions. A layer 2 deployment, a larger initial TVL, a subsidized keeper budget, or a strategy that accrues directly into vault share price without frequent harvesting would be a better fit.

If mainnet is non-negotiable, launch with an explicit keeper plan and simple user messaging: first-month yield is expected to be small, harvests may be infrequent, and compounding frequency will not materially affect returns until TVL is much higher.

Bottom line: the vault can function, but the permissionless harvest incentive will not make it self-sustaining in the first month. With $8,000 at 4% APY, the system produces too little reward for a 1% bounty to pay for mainnet execution. Before launch, either change the operating model or change the deployment venue.

Gas/ETH context checked against public data on September 23, 2026: [ChainGate Ethereum gas tracker](https://chaingate.dev/gas-tracker/ethereum), [YCharts Ethereum average gas price](https://ycharts.com/indicators/ethereum_average_gas_price), and [Binance ETH price](https://www.binance.com/en/price/ethereum).
