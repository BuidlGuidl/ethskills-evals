# Operational read for the first month

This vault will not run itself. Once it is live, deposits can sit in the strategy and earn, but `harvest()` only happens when an externally owned account or bot sends a transaction and pays Ethereum mainnet gas. Making `harvest()` permissionless means anyone is allowed to do that work. It does not mean anyone will do it.

With the current launch assumptions, the first-month economics are very small:

- Expected deposits: $8,000 USDC
- Strategy yield: about 4% APY
- Gross yield at that size: about $320 per year, $26.67 per month, or $0.88 per day
- Harvest caller reward: 1% of claimed rewards
- Caller reward if harvested after one full month: about $0.27
- Caller reward if harvested daily: less than one cent per call

That reward is not enough to create a reliable permissionless harvester on Ethereum mainnet. As a spot check on September 23, 2026, public gas trackers showed mainnet gas around roughly 0.4-3 gwei, and ETH was around $2,740. At 250,000 gas, that is about $0.29-$2.16 in gas before considering bot overhead, failed transactions, priority fees, or the fact that a real claim-and-compound flow may use more than 250,000 gas.

So the first-month call looks like this:

- If someone harvests after a month, they receive about $0.27.
- They likely spend more than that in ETH gas.
- A rational bot will usually skip it.
- If gas is unusually cheap and the harvest is unusually efficient, it may be close to break-even, but that is not enough to rely on strangers keeping the vault fresh.

In practice, this means harvests probably happen only when one of these is true:

- the team calls `harvest()` as an operating expense;
- a friendly user calls it despite losing money;
- rewards are allowed to accumulate for long enough that the 1% bounty finally exceeds gas;
- TVL grows materially above the first-month expectation;
- the vault is deployed somewhere with much cheaper execution than Ethereum mainnet.

## What depositors experience

Depositors should not expect frequent compounding in month one. The strategy may be earning economically, but the vault only realizes the harvestable portion when someone calls `harvest()`. If nobody calls it, the advertised 4% APY is not experienced as clean, regularly-compounded vault growth.

The dollar impact is small but important for trust. At $8,000 TVL, even a perfect month only produces about $26.67 of gross yield before the caller incentive. After the 1% harvest reward, depositors split about $26.40 for the month, assuming a harvest happens. If the team has to spend ETH to make that happen, the protocol is subsidizing operations. If the team does not subsidize it, users may see stale vault accounting or lumpy yield realization.

This also means the product may feel odd: depositors are taking smart contract, strategy, operational, and mainnet transaction risk for a first-month yield pool of only about $27 total. For small depositors, normal mainnet deposit/withdraw gas can easily matter more than their yield.

## Should anything change before launch?

Yes. I would not launch this exact setup on Ethereum mainnet with $8,000 expected first-month TVL and a 1% harvest bounty unless the team is explicitly committing to operate harvests at a loss.

Recommended changes before launch:

1. Add an operating policy: the team should commit to calling `harvest()` on a stated cadence or when pending rewards cross a stated threshold. Treat the ETH gas spend as a launch subsidy, not as something the permissionless market will handle.

2. Add a minimum profitable harvest threshold in the UI/docs, and ideally in the contract if appropriate. For example: do not suggest or trigger harvests until the caller bounty comfortably exceeds expected gas. At 250,000 gas and the September 23 spot-check range, the vault needs roughly $29-$216 of pending rewards for a 1% bounty to cover gas. At $8,000 TVL and 4% APY, that is about 33-246 days of yield, and longer if the harvest costs more than 250,000 gas.

3. Consider moving the first version to an L2 if the product requires frequent compounding. The current economics are much more compatible with cheap execution than with Ethereum mainnet.

4. If mainnet is non-negotiable, consider changing the incentive design. A higher caller fee, flat keeper payment, team-funded keeper, or harvest-on-user-action model would be more realistic. Be careful with simply raising the caller fee: at this TVL, making the keeper incentive large enough to matter also takes a visible bite out of depositor yield.

5. Be plain with depositors. The public promise should be closer to: "the strategy targets about 4% APY before vault operations, and early mainnet harvests may be periodic and team-operated." Do not imply that permissionless harvesting guarantees regular compounding.

Bottom line: the vault can launch technically, but it is not yet self-operating. At the expected first-month size, `harvest()` is a negative-expected-value transaction for outsiders, so "anyone can call it" mostly means "the team still needs to call it." Either launch with an explicit keeper subsidy, move to cheaper execution, or wait for enough TVL that the harvest incentive is real.

Sources checked for market assumptions on September 23, 2026:

- Ethereum gas overview: https://ethereum.org/developers/docs/gas/
- Live/mainnet gas snapshots: https://gweiprice.com/ and https://chaingate.dev/gas-tracker/ethereum
- ETH/USD spot reference: https://www.investing.com/crypto/ethereum/eth-usd-historical-data
