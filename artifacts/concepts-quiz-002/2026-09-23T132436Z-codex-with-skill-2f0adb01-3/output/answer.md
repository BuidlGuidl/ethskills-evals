# Operational read: first month of the USDC vault

With the numbers above, this vault will be much quieter than the design may imply.

At about $8,000 of deposits and 4% APY, the strategy produces roughly $320 per year, about $26.67 over a 30-day first month, or about $0.88 per day. The permissionless `harvest()` incentive pays the caller 1% of the rewards claimed by that call, so the available bounty is only about $0.27 after an entire month of unharvested yield.

That is the core operating issue: smart contracts do not wake up on their own. `harvest()` only happens when someone sends a transaction and pays Ethereum mainnet gas. At this vault size, the reward for doing that is probably below the gas cost of doing it.

Recent public gas snapshots make the scale clear. Ethereum.org's gas docs note that gas is paid in ETH and varies with network demand. Around September 23, 2026, live trackers showed mainnet gas in the rough range of 0.4 to 1.1 gwei, with ETH around $2,740. At those prices, even a fairly efficient 200,000 gas harvest would cost about $0.23 to $0.60 before any keeper profit; a 500,000 gas harvest would cost about $0.58 to $1.50. If gas spikes to 10 gwei, those same calls are roughly $5.50 to $13.70.

So the likely month-one behavior is:

- Nobody harvests daily. A daily harvest would claim about $0.88 and pay the caller less than one cent.
- Nobody reliably harvests weekly. A weekly harvest would claim about $6.15 and pay the caller about six cents.
- A month-end harvest is still marginal. It claims about $26.67 and pays about twenty-seven cents, which may not cover gas, monitoring, and risk.
- The team probably becomes the de facto keeper unless the contract has another automation path or the harvest incentive is changed.

For depositors, the financial impact is not that they lose the whole 4% APY. The strategy can still earn yield while funds are deployed. The impact is that compounding and reward realization become lumpy. If no one harvests in month one, depositors see either no realized vault profit yet, or only the base value that the strategy accounting exposes without claiming rewards.

The compounding loss itself is tiny at this size. On $8,000 at 4% APY, compounding monthly versus not compounding during the first month is a rounding-error issue, not a meaningful return issue. The larger depositor issue is accounting fairness:

- If unharvested rewards are not included in share price, users who withdraw before harvest may leave earned rewards behind.
- Users who deposit just before a harvest may receive a share of rewards that accrued before they joined.
- If share price only updates on harvest, the vault may look inactive or underperforming even while rewards are accumulating.

That means the launch risk is more operational and UX-related than yield-related: depositors may not understand why a "compounding" vault is not visibly compounding, and the protocol may quietly depend on the team to poke it.

## Recommendation before launch

I would not ship this exact keeper incentive on Ethereum mainnet for an $8,000 first-month vault.

Change at least one of these before launch:

1. Increase or restructure the harvest bounty.
   A 1% bounty only works once the harvestable reward is large enough. At this vault size, the bounty is cents. Consider a minimum caller reward, a higher early-stage bounty, or a bounty funded separately from protocol treasury rather than only from claimed yield.

2. Add team-operated or sponsored harvesting for the bootstrap period.
   This is less decentralized, but honest. If the team is going to run the first-month harvests anyway, document that expectation and monitor it. Do not pretend the system is self-operating until the economics make that true.

3. Set a minimum harvest threshold.
   For example, expose guidance or contract logic that discourages harvesting until accrued rewards are high enough to cover gas plus caller profit. Without that, callers either will not call, or a subsidized actor will burn money doing it.

4. Consider launching on an L2 or waiting for more TVL.
   Ethereum mainnet can be cheap, but the vault economics are still thin. A vault with $8,000 at 4% APY produces less than $1 per day, so even small fixed transaction costs matter. If the strategy and users do not specifically need mainnet, an L2 makes the operational model much easier.

My preferred launch posture: keep `harvest()` permissionless, but add an explicit bootstrap keeper plan and do not rely on the 1% bounty to attract third-party callers. If mainnet deployment is mandatory, either subsidize harvests until TVL is materially larger or tell depositors that harvesting may happen monthly or less often.

Sources checked for gas context on September 23, 2026:

- Ethereum.org gas documentation: https://ethereum.org/developers/docs/gas/
- YCharts Ethereum average gas price: https://ycharts.com/indicators/ethereum_average_gas_price
- GasFeePredictor live Ethereum fee snapshot: https://gasfeepredictor.com/gas-fees-by-transaction-type
- Investing.com ETH/USD market data: https://www.investing.com/crypto/ethereum/eth-usd-historical-data
